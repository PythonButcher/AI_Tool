"""Leakage-safe supervised evaluation for ML Studio.

The final holdout is created before candidate work and is never passed to the
candidate-selection loop.  Preprocessing lives inside each scikit-learn
pipeline, so imputers and encoders fit only on a fold's training rows.
"""

from __future__ import annotations

import hashlib
import math
import platform
from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence

import numpy as np
import pandas as pd
import sklearn
from sklearn.base import BaseEstimator
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.ensemble import (
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)
from sklearn.model_selection import (
    GroupKFold,
    GroupShuffleSplit,
    KFold,
    StratifiedKFold,
    TimeSeriesSplit,
    train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from .contracts import (
    CandidateSelectionEvidence,
    EvaluationResult,
    ExperimentSpecification,
    FeatureInfluence,
    FinalHoldoutEvidence,
    FoldEvidence,
    LeakageFinding,
    RunSpecification,
    SelectionEvidence,
    SplitEvidence,
    StructuredError,
    TruthBoundary,
)


class EvaluationBlocked(ValueError):
    """Expected, safely reportable refusal to evaluate an invalid experiment."""

    def __init__(self, error: StructuredError, findings: Sequence[LeakageFinding] = ()) -> None:
        super().__init__(error.message)
        self.error = error
        self.findings = tuple(findings)


@dataclass(frozen=True)
class _Partition:
    development: np.ndarray
    holdout: np.ndarray
    folds: tuple[tuple[np.ndarray, np.ndarray], ...]
    evidence: SplitEvidence


def _blocked(code: str, message: str, remediation: str, findings: Sequence[LeakageFinding] = ()) -> EvaluationBlocked:
    return EvaluationBlocked(
        StructuredError(code=code, message=message, remediation=remediation),
        findings=findings,
    )


def _index_hash(values: Iterable[int]) -> str:
    normalized = ",".join(str(int(value)) for value in sorted(values))
    return f"sha256:{hashlib.sha256(normalized.encode('utf-8')).hexdigest()}"


def _fold_evidence(
    train: np.ndarray,
    evaluation: np.ndarray,
    *,
    time_values: pd.Series | None = None,
    group_values: pd.Series | None = None,
) -> FoldEvidence:
    temporal_valid = None
    if time_values is not None:
        temporal_valid = bool(time_values.iloc[train].max() <= time_values.iloc[evaluation].min())
    group_overlap = None
    if group_values is not None:
        group_overlap = len(set(group_values.iloc[train]).intersection(group_values.iloc[evaluation]))
    return FoldEvidence(
        train_row_count=len(train),
        evaluation_row_count=len(evaluation),
        train_index_hash=_index_hash(train),
        evaluation_index_hash=_index_hash(evaluation),
        row_overlap_count=len(set(train).intersection(evaluation)),
        temporal_order_valid=temporal_valid,
        group_overlap_count=group_overlap,
    )


def _partition_rows(data: pd.DataFrame, target: pd.Series, specification: ExperimentSpecification) -> _Partition:
    policy = specification.split_policy
    positions = np.arange(len(data), dtype=int)
    holdout_size = max(1, int(math.ceil(len(data) * policy.final_holdout_fraction)))
    if len(data) - holdout_size < policy.cross_validation_folds + 1:
        raise _blocked(
            "split_too_small",
            "The development partition is too small for the requested cross-validation folds.",
            "Reduce the fold count or provide more rows.",
        )

    time_values: pd.Series | None = None
    group_values: pd.Series | None = None
    try:
        if policy.strategy == "random":
            development, holdout = train_test_split(
                positions,
                test_size=policy.final_holdout_fraction,
                random_state=specification.random_seed_policy.final_holdout_seed,
                shuffle=True,
            )
        elif policy.strategy == "stratified":
            class_counts = target.value_counts()
            if len(class_counts) < 2 or int(class_counts.min()) < 2:
                raise _blocked(
                    "stratified_split_infeasible",
                    "Every class needs at least two rows for a stratified final holdout.",
                    "Collect more examples for rare classes or choose a valid split policy.",
                )
            development, holdout = train_test_split(
                positions,
                test_size=policy.final_holdout_fraction,
                random_state=specification.random_seed_policy.final_holdout_seed,
                shuffle=True,
                stratify=target,
            )
        elif policy.strategy == "time_ordered":
            assert policy.time_column is not None
            time_values = pd.to_datetime(data[policy.time_column], errors="coerce", utc=True)
            if time_values.isna().any():
                raise _blocked(
                    "invalid_time_split_column",
                    "The time split column contains missing or invalid timestamps.",
                    "Clean the time column or choose another explicit split policy.",
                )
            ordered = np.argsort(time_values.to_numpy(), kind="stable")
            development, holdout = ordered[:-holdout_size], ordered[-holdout_size:]
        else:
            assert policy.group_column is not None
            group_values = data[policy.group_column]
            if group_values.isna().any():
                raise _blocked(
                    "invalid_group_split_column",
                    "The group split column contains missing values.",
                    "Fill the group identities or choose another explicit split policy.",
                )
            if group_values.nunique() < policy.cross_validation_folds + 1:
                raise _blocked(
                    "grouped_split_infeasible",
                    "There are not enough distinct groups for a final holdout and the requested folds.",
                    "Reduce the fold count, choose another group column, or collect more groups.",
                )
            splitter = GroupShuffleSplit(
                n_splits=1,
                test_size=policy.final_holdout_fraction,
                random_state=specification.random_seed_policy.final_holdout_seed,
            )
            development, holdout = next(splitter.split(positions, target, groups=group_values))
    except EvaluationBlocked:
        raise
    except ValueError as exc:
        raise _blocked(
            "invalid_final_holdout",
            "The requested final holdout could not be created safely.",
            "Review class counts, split columns, holdout size, and fold count.",
        ) from exc

    development = np.asarray(development, dtype=int)
    holdout = np.asarray(holdout, dtype=int)
    local_positions = np.arange(len(development), dtype=int)
    development_target = target.iloc[development]

    try:
        if policy.strategy == "random":
            splitter = KFold(
                n_splits=policy.cross_validation_folds,
                shuffle=True,
                random_state=specification.random_seed_policy.cross_validation_seed,
            )
            local_folds = tuple(splitter.split(local_positions))
        elif policy.strategy == "stratified":
            counts = development_target.value_counts()
            if int(counts.min()) < policy.cross_validation_folds:
                raise _blocked(
                    "stratified_cross_validation_infeasible",
                    "Every class needs at least one development row in every stratified fold.",
                    "Reduce the fold count or provide more examples for rare classes.",
                )
            splitter = StratifiedKFold(
                n_splits=policy.cross_validation_folds,
                shuffle=True,
                random_state=specification.random_seed_policy.cross_validation_seed,
            )
            local_folds = tuple(splitter.split(local_positions, development_target))
        elif policy.strategy == "time_ordered":
            splitter = TimeSeriesSplit(n_splits=policy.cross_validation_folds)
            local_folds = tuple(splitter.split(local_positions))
        else:
            assert group_values is not None
            development_groups = group_values.iloc[development]
            splitter = GroupKFold(n_splits=policy.cross_validation_folds)
            local_folds = tuple(splitter.split(local_positions, development_target, groups=development_groups))
    except EvaluationBlocked:
        raise
    except ValueError as exc:
        raise _blocked(
            "invalid_cross_validation",
            "The development cross-validation folds could not be created safely.",
            "Review the fold count and the selected split structure.",
        ) from exc

    folds = tuple((development[train], development[evaluation]) for train, evaluation in local_folds)
    fold_evidence = tuple(
        _fold_evidence(
            train,
            evaluation,
            time_values=time_values,
            group_values=group_values,
        )
        for train, evaluation in folds
    )
    final_temporal_valid = None
    if time_values is not None:
        final_temporal_valid = bool(time_values.iloc[development].max() <= time_values.iloc[holdout].min())
    final_group_overlap = None
    if group_values is not None:
        final_group_overlap = len(set(group_values.iloc[development]).intersection(group_values.iloc[holdout]))
    evidence = SplitEvidence(
        strategy=policy.strategy,
        development_index_hash=_index_hash(development),
        final_holdout_index_hash=_index_hash(holdout),
        development_row_count=len(development),
        final_holdout_row_count=len(holdout),
        final_row_overlap_count=len(set(development).intersection(holdout)),
        final_temporal_order_valid=final_temporal_valid,
        final_group_overlap_count=final_group_overlap,
        folds=fold_evidence,
    )
    return _Partition(development=development, holdout=holdout, folds=folds, evidence=evidence)


def _build_preprocessor(specification: ExperimentSpecification) -> ColumnTransformer:
    transformers: list[tuple[str, Pipeline, list[str]]] = []
    if specification.feature_roles.numeric:
        transformers.append(
            (
                "numeric",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                list(specification.feature_roles.numeric),
            )
        )
    if specification.feature_roles.categorical:
        transformers.append(
            (
                "categorical",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
                    ]
                ),
                list(specification.feature_roles.categorical),
            )
        )
    return ColumnTransformer(transformers=transformers, remainder="drop")


def _estimator(family: str, task_type: str, seed: int) -> BaseEstimator:
    if task_type == "regression":
        if family == "regularized_linear":
            return Ridge(alpha=1.0)
        if family == "random_forest":
            return RandomForestRegressor(n_estimators=100, random_state=seed, n_jobs=1)
        return HistGradientBoostingRegressor(random_state=seed)
    if family == "logistic":
        return LogisticRegression(max_iter=2000, random_state=seed)
    if family == "random_forest":
        return RandomForestClassifier(n_estimators=100, random_state=seed, n_jobs=1)
    return HistGradientBoostingClassifier(random_state=seed)


def _pipeline(specification: ExperimentSpecification, family: str) -> Pipeline:
    return Pipeline(
        [
            ("preprocessor", _build_preprocessor(specification)),
            ("model", _estimator(family, specification.task_type, specification.random_seed_policy.estimator_seed)),
        ]
    )


def _baseline(task_type: str) -> BaseEstimator:
    if task_type == "regression":
        return DummyRegressor(strategy="mean")
    return DummyClassifier(strategy="most_frequent")


def _measure(task_type: str, truth: pd.Series, predictions: np.ndarray) -> dict[str, float]:
    if task_type == "regression":
        mse = float(mean_squared_error(truth, predictions))
        return {
            "rmse": float(math.sqrt(mse)),
            "mae": float(mean_absolute_error(truth, predictions)),
            "r2": float(r2_score(truth, predictions)),
        }
    return {
        "balanced_accuracy": float(balanced_accuracy_score(truth, predictions)),
        "f1_weighted": float(f1_score(truth, predictions, average="weighted", zero_division=0)),
        "accuracy": float(accuracy_score(truth, predictions)),
    }


def _mean_metrics(folds: Sequence[Mapping[str, float]]) -> dict[str, float]:
    return {
        name: float(np.mean([fold[name] for fold in folds]))
        for name in folds[0]
    }


def _structural_leakage(data: pd.DataFrame, target: pd.Series, features: Sequence[str]) -> tuple[LeakageFinding, ...]:
    findings: list[LeakageFinding] = []
    blocked: list[str] = []
    for name in features:
        series = data[name]
        comparable = series.notna() & target.notna()
        if comparable.any() and series[comparable].astype(str).equals(target[comparable].astype(str)):
            blocked.append(name)
        normalized = re_normalize(name)
        if (normalized.endswith("id") or "identifier" in normalized) and series.nunique(dropna=True) / max(len(series), 1) > 0.9:
            findings.append(
                LeakageFinding(
                    code="identifier_like_feature",
                    severity="warning",
                    message="A near-unique identifier may memorize rows instead of generalizing.",
                    columns=(name,),
                )
            )
        if any(marker in normalized for marker in ("outcome", "result", "postevent", "afterevent")):
            findings.append(
                LeakageFinding(
                    code="post_outcome_name",
                    severity="warning",
                    message="A feature name suggests information that may only exist after the outcome.",
                    columns=(name,),
                )
            )
    if blocked:
        finding = LeakageFinding(
            code="exact_target_proxy",
            severity="blocked",
            message="One or more features exactly reproduce the target on observed rows.",
            columns=tuple(blocked),
        )
        raise _blocked(
            "structural_target_leakage",
            "Evaluation is blocked because a feature exactly reproduces the target.",
            "Exclude target-derived features and create a new experiment specification.",
            findings=(*findings, finding),
        )
    return tuple(findings)


def re_normalize(value: str) -> str:
    return "".join(character for character in value.casefold() if character.isalnum())


def _feature_influence(
    pipeline: Pipeline,
    development_features: pd.DataFrame,
    development_target: pd.Series,
    specification: ExperimentSpecification,
) -> FeatureInfluence:
    scoring = {
        "regression": {"r2": "r2", "rmse": "neg_root_mean_squared_error", "mae": "neg_mean_absolute_error"},
        "classification": {
            "balanced_accuracy": "balanced_accuracy",
            "f1_weighted": "f1_weighted",
            "accuracy": "accuracy",
        },
    }[specification.task_type][specification.metric_policy.primary_metric]
    result = permutation_importance(
        pipeline,
        development_features,
        development_target,
        scoring=scoring,
        n_repeats=3,
        random_state=specification.random_seed_policy.estimator_seed,
        n_jobs=1,
    )
    values = {
        name: float(value)
        for name, value in zip(specification.feature_roles.all_features, result.importances_mean)
    }
    return FeatureInfluence(
        method="development_set_permutation",
        values=values,
        limitations=(
            "Influence is measured on the refit development data and may be optimistic.",
            "Correlated features can divide or mask permutation influence.",
            "Model influence is associative, not causal.",
        ),
    )


def evaluate_supervised(
    data: pd.DataFrame,
    run: RunSpecification,
    specification: ExperimentSpecification,
    *,
    current_workspace_version: int,
    current_source_fingerprints: Mapping[str, tuple[str, int]],
) -> EvaluationResult:
    """Evaluate one trusted server-resolved dataset without holdout reuse."""

    if run.experiment_id != specification.experiment_id or run.specification_version != specification.specification_version:
        raise _blocked(
            "run_specification_mismatch",
            "The run does not reference the supplied experiment specification version.",
            "Submit a run bound to the exact immutable experiment specification.",
        )
    try:
        run.dataset_snapshot.assert_current(
            workspace_version=current_workspace_version,
            source_fingerprints=current_source_fingerprints,
        )
    except ValueError as exc:
        raise _blocked(
            "snapshot_stale",
            "The dataset snapshot no longer matches authoritative workspace or source identity.",
            "Create a fresh snapshot and submit a new run.",
        ) from exc
    if not isinstance(data, pd.DataFrame) or data.empty:
        raise _blocked("dataset_empty", "The resolved dataset is empty.", "Choose a governed snapshot with usable rows.")
    if len(data) != run.dataset_snapshot.row_count:
        raise _blocked(
            "snapshot_row_count_mismatch",
            "The resolved row count does not match the immutable dataset snapshot.",
            "Resolve a fresh snapshot before evaluation.",
        )
    required = set(specification.feature_roles.all_features) | {specification.target}
    if specification.split_policy.time_column:
        required.add(specification.split_policy.time_column)
    if specification.split_policy.group_column:
        required.add(specification.split_policy.group_column)
    missing = sorted(required.difference(data.columns))
    if missing:
        raise _blocked(
            "experiment_columns_missing",
            "The snapshot does not contain every column required by the experiment.",
            "Create a new specification against the current snapshot schema.",
        )
    if len(data) > specification.resource_limits.max_rows or len(specification.feature_roles.all_features) > specification.resource_limits.max_features:
        raise _blocked(
            "resource_limit_exceeded",
            "The experiment exceeds its declared row or feature limit.",
            "Reduce the governed dataset or raise the explicit resource limit.",
        )
    if len(specification.candidate_families) > specification.resource_limits.max_candidates:
        raise _blocked(
            "candidate_limit_exceeded",
            "The experiment requests more candidates than its resource limit allows.",
            "Reduce the candidate set or raise the explicit candidate limit.",
        )

    working = data.reset_index(drop=True).copy()
    valid_target = working[specification.target].notna()
    warnings: list[str] = []
    if not valid_target.all():
        removed = int((~valid_target).sum())
        working = working.loc[valid_target].reset_index(drop=True)
        warnings.append(f"Excluded {removed} rows with missing target values before splitting.")
    if len(working) < max(20, specification.split_policy.cross_validation_folds * 3):
        raise _blocked(
            "insufficient_rows",
            "The usable dataset is too small for the requested evaluation design.",
            "Provide more target-complete rows or reduce the fold count.",
        )
    target = working[specification.target]
    if specification.task_type == "regression":
        target = pd.to_numeric(target, errors="coerce")
        if target.isna().any() or not np.isfinite(target.to_numpy(dtype=float)).all():
            raise _blocked(
                "invalid_regression_target",
                "The regression target contains non-numeric or non-finite values.",
                "Clean the target or confirm classification as the task type.",
            )
    else:
        target = target.astype(str)
        counts = target.value_counts()
        if len(counts) < 2:
            raise _blocked(
                "classification_single_class",
                "Classification requires at least two target classes.",
                "Choose another target or collect examples for another class.",
            )
        if int(counts.min()) < 2:
            raise _blocked(
                "classification_class_too_small",
                "Every class needs at least two rows for safe evaluation.",
                "Collect more examples for rare classes.",
            )
        if int(counts.max()) / len(target) > 0.8:
            warnings.append("The target is imbalanced; prefer balanced accuracy and weighted F1 over raw accuracy.")

    features = list(specification.feature_roles.all_features)
    findings = _structural_leakage(working, target, features)
    supported_metrics = {
        "regression": {"rmse", "mae", "r2"},
        "classification": {"balanced_accuracy", "f1_weighted", "accuracy"},
    }[specification.task_type]
    if set(specification.metric_policy.reported_metrics) != supported_metrics:
        raise _blocked(
            "metric_policy_incomplete",
            "The metric policy must include the complete task-appropriate metric set.",
            "Use RMSE, MAE, and R-squared for regression or balanced accuracy, weighted F1, and accuracy for classification.",
        )
    partition = _partition_rows(working, target, specification)
    feature_frame = working[features]

    baseline_folds: list[dict[str, float]] = []
    candidate_results: list[CandidateSelectionEvidence] = []
    for train_positions, evaluation_positions in partition.folds:
        baseline = _baseline(specification.task_type)
        baseline.fit(feature_frame.iloc[train_positions], target.iloc[train_positions])
        baseline_folds.append(
            _measure(specification.task_type, target.iloc[evaluation_positions], baseline.predict(feature_frame.iloc[evaluation_positions]))
        )

    for family in specification.candidate_families:
        fold_metrics: list[dict[str, float]] = []
        try:
            for train_positions, evaluation_positions in partition.folds:
                candidate = _pipeline(specification, family)
                candidate.fit(feature_frame.iloc[train_positions], target.iloc[train_positions])
                fold_metrics.append(
                    _measure(
                        specification.task_type,
                        target.iloc[evaluation_positions],
                        candidate.predict(feature_frame.iloc[evaluation_positions]),
                    )
                )
        except (TypeError, ValueError) as exc:
            raise _blocked(
                "candidate_evaluation_failed",
                "A requested candidate could not be evaluated on every development fold.",
                "Review feature types, class representation, and split feasibility.",
            ) from exc
        candidate_results.append(
            CandidateSelectionEvidence(
                candidate_family=family,
                fold_metrics=tuple(fold_metrics),
                mean_metrics=_mean_metrics(fold_metrics),
            )
        )

    primary = specification.metric_policy.primary_metric
    reverse = specification.metric_policy.optimization == "maximize"
    selected = sorted(candidate_results, key=lambda item: item.mean_metrics[primary], reverse=reverse)[0]
    development_features = feature_frame.iloc[partition.development]
    development_target = target.iloc[partition.development]
    final_features = feature_frame.iloc[partition.holdout]
    final_target = target.iloc[partition.holdout]

    selected_pipeline = _pipeline(specification, selected.candidate_family)
    selected_pipeline.fit(development_features, development_target)
    baseline = _baseline(specification.task_type)
    baseline.fit(development_features, development_target)
    final_candidate_metrics = _measure(specification.task_type, final_target, selected_pipeline.predict(final_features))
    final_baseline_metrics = _measure(specification.task_type, final_target, baseline.predict(final_features))

    return EvaluationResult(
        run_id=run.run_id,
        task_type=specification.task_type,
        dataset_snapshot=run.dataset_snapshot,
        experiment_id=specification.experiment_id,
        specification_version=specification.specification_version,
        selection_evidence=SelectionEvidence(
            baseline_name="mean" if specification.task_type == "regression" else "majority_class",
            baseline_fold_metrics=tuple(baseline_folds),
            candidates=tuple(candidate_results),
            selected_candidate=selected.candidate_family,
            development_row_count=len(partition.development),
        ),
        final_holdout_evidence=FinalHoldoutEvidence(
            selected_candidate=selected.candidate_family,
            candidate_metrics=final_candidate_metrics,
            baseline_metrics=final_baseline_metrics,
            holdout_row_count=len(partition.holdout),
        ),
        split_evidence=partition.evidence,
        warnings=tuple(warnings),
        limitations=(
            "Results describe one governed dataset snapshot and may not generalize to future or external data.",
            "Candidate selection is bounded to the configured library and metric policy.",
            "A successful evaluation is not a deployment or production-readiness decision.",
        ),
        leakage_findings=findings,
        feature_influence=_feature_influence(selected_pipeline, development_features, development_target, specification),
        runtime_versions={
            "python": platform.python_version(),
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "scikit_learn": sklearn.__version__,
        },
        random_seeds=specification.random_seed_policy,
        truth_boundary=TruthBoundary(
            claims=(
                "The selected candidate was chosen using development cross-validation only.",
                "The selected candidate and naive baseline were evaluated once on the final holdout.",
            ),
            prohibited_claims=(
                "Production readiness or deployment approval.",
                "Future performance outside the governed snapshot.",
                "Causal effect of any feature.",
            ),
        ),
    )
