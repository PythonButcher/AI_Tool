"""Focused behavior tests for leakage-safe ML Studio evaluation."""

from __future__ import annotations

import unittest
from datetime import UTC, datetime, timedelta
from unittest import mock

import numpy as np
import pandas as pd

from backend.ml_studio.contracts import (
    ColumnProfile,
    DatasetSnapshotIdentity,
    ExperimentSpecification,
    FeatureRoles,
    MetricPolicy,
    RandomSeedPolicy,
    ResourceLimits,
    RunSpecification,
    SourceFingerprint,
    SplitPolicy,
)
from backend.ml_studio.evaluation import EvaluationBlocked, evaluate_supervised
from backend.ml_studio import evaluation as evaluation_module


SHA = "a" * 64
NOW = datetime(2026, 9, 14, tzinfo=UTC)


def snapshot_for(data: pd.DataFrame) -> DatasetSnapshotIdentity:
    profiles = []
    for name in data.columns:
        logical_type = "numeric" if pd.api.types.is_numeric_dtype(data[name]) else "categorical"
        if pd.api.types.is_datetime64_any_dtype(data[name]):
            logical_type = "datetime"
        profiles.append(
            ColumnProfile(
                name=name,
                logical_type=logical_type,
                null_count=int(data[name].isna().sum()),
                distinct_count=int(data[name].nunique(dropna=True)),
            )
        )
    return DatasetSnapshotIdentity(
        snapshot_id="snapshot-1",
        workspace_id="workspace-1",
        workspace_version=2,
        source_ids=("source-1",),
        relationship_ids=(),
        source_fingerprints=(
            SourceFingerprint(source_id="source-1", content_fingerprint=f"sha256:{SHA}", schema_version=1),
        ),
        schema_version=1,
        semantic_model_version="semantic-v1",
        governance_result={"status": "ready", "reasons": []},
        transformation_recipe_hash=f"sha256:{SHA}",
        row_count=len(data),
        column_profile=tuple(profiles),
        created_at=NOW,
    )


def specification(
    *,
    task_type: str,
    split_policy: SplitPolicy,
    numeric: tuple[str, ...],
    categorical: tuple[str, ...] = (),
    candidates: tuple[str, ...],
) -> ExperimentSpecification:
    regression = task_type == "regression"
    return ExperimentSpecification(
        experiment_id="experiment-1",
        specification_version=1,
        task_type=task_type,
        target="target",
        feature_roles=FeatureRoles(numeric=numeric, categorical=categorical),
        excluded_columns=(),
        split_policy=split_policy,
        candidate_families=candidates,
        metric_policy=MetricPolicy(
            primary_metric="rmse" if regression else "balanced_accuracy",
            optimization="minimize" if regression else "maximize",
            reported_metrics=("rmse", "mae", "r2")
            if regression
            else ("balanced_accuracy", "f1_weighted", "accuracy"),
        ),
        resource_limits=ResourceLimits(
            max_rows=1000, max_features=10, max_candidates=3, timeout_seconds=120
        ),
        random_seed_policy=RandomSeedPolicy(
            final_holdout_seed=17,
            cross_validation_seed=19,
            estimator_seed=23,
        ),
    )


def run_for(data: pd.DataFrame) -> RunSpecification:
    return RunSpecification(
        run_id="run-1",
        experiment_id="experiment-1",
        specification_version=1,
        dataset_snapshot=snapshot_for(data),
        submitted_at=NOW,
        parameters={},
        environment={"python": "test"},
        code_revision="abcdef0",
    )


def evaluate(data: pd.DataFrame, spec: ExperimentSpecification):
    return evaluate_supervised(
        data,
        run_for(data),
        spec,
        current_workspace_version=2,
        current_source_fingerprints={"source-1": (f"sha256:{SHA}", 1)},
    )


class EvaluationFlowTests(unittest.TestCase):
    def test_regression_compares_every_candidate_and_baseline_before_final_holdout(self) -> None:
        rng = np.random.default_rng(7)
        x = np.linspace(-3, 3, 120)
        data = pd.DataFrame(
            {
                "feature": x,
                "category": np.where(x > 0, "positive", "negative"),
                "target": 4.0 * x + rng.normal(0, 0.25, len(x)),
            }
        )
        spec = specification(
            task_type="regression",
            split_policy=SplitPolicy(
                strategy="random", final_holdout_fraction=0.2, cross_validation_folds=3
            ),
            numeric=("feature",),
            categorical=("category",),
            candidates=("regularized_linear", "random_forest", "hist_gradient_boosting"),
        )

        result = evaluate(data, spec)

        self.assertEqual(len(result.selection_evidence.candidates), 3)
        self.assertEqual(len(result.selection_evidence.baseline_fold_metrics), 3)
        self.assertEqual(result.final_holdout_evidence.evaluated_once, True)
        self.assertEqual(
            result.selection_evidence.selected_candidate,
            result.final_holdout_evidence.selected_candidate,
        )
        self.assertEqual(result.split_evidence.final_row_overlap_count, 0)
        self.assertEqual(
            result.selection_evidence.development_row_count
            + result.final_holdout_evidence.holdout_row_count,
            len(data),
        )
        self.assertIn("feature", result.feature_influence.values)
        self.assertFalse(result.feature_influence.causal)
        self.assertTrue(result.failure_slices)
        self.assertTrue(all(item.field in {"feature", "category"} for item in result.failure_slices))
        self.assertTrue(all(item.cohort not in {"positive", "negative"} for item in result.failure_slices))

    def test_classification_uses_task_metrics_and_majority_baseline(self) -> None:
        rng = np.random.default_rng(11)
        x = rng.normal(size=150)
        data = pd.DataFrame(
            {
                "feature": x,
                "segment": np.where(x > 0, "east", "west"),
                "target": np.where(x + rng.normal(0, 0.2, len(x)) > 0, "yes", "no"),
            }
        )
        spec = specification(
            task_type="classification",
            split_policy=SplitPolicy(
                strategy="stratified", final_holdout_fraction=0.2, cross_validation_folds=3
            ),
            numeric=("feature",),
            categorical=("segment",),
            candidates=("logistic", "random_forest", "hist_gradient_boosting"),
        )

        result = evaluate(data, spec)

        self.assertEqual(result.selection_evidence.baseline_name, "majority_class")
        self.assertEqual(
            set(result.final_holdout_evidence.candidate_metrics),
            {"balanced_accuracy", "f1_weighted", "accuracy"},
        )
        self.assertEqual(result.split_evidence.strategy, "stratified")
        self.assertEqual(result.truth_boundary.status, "evaluated_experiment")
        self.assertTrue(all(item.metric_name == "error_rate" for item in result.failure_slices))

    def test_same_seeds_produce_identical_split_and_metrics(self) -> None:
        x = np.arange(90, dtype=float)
        data = pd.DataFrame({"feature": x, "target": 2.0 * x + 1.0})
        spec = specification(
            task_type="regression",
            split_policy=SplitPolicy(
                strategy="random", final_holdout_fraction=0.2, cross_validation_folds=3
            ),
            numeric=("feature",),
            candidates=("regularized_linear",),
        )

        first = evaluate(data, spec)
        second = evaluate(data, spec)

        self.assertEqual(first.split_evidence, second.split_evidence)
        self.assertEqual(first.selection_evidence, second.selection_evidence)
        self.assertEqual(first.final_holdout_evidence, second.final_holdout_evidence)

    def test_stale_snapshot_is_refused_before_evaluation(self) -> None:
        data = pd.DataFrame({"feature": np.arange(30), "target": np.arange(30) * 2})
        spec = specification(
            task_type="regression",
            split_policy=SplitPolicy(
                strategy="random", final_holdout_fraction=0.2, cross_validation_folds=3
            ),
            numeric=("feature",),
            candidates=("regularized_linear",),
        )
        with self.assertRaises(EvaluationBlocked) as raised:
            evaluate_supervised(
                data,
                run_for(data),
                spec,
                current_workspace_version=3,
                current_source_fingerprints={"source-1": (f"sha256:{SHA}", 1)},
            )
        self.assertEqual(raised.exception.error.code, "snapshot_stale")

    def test_exact_target_proxy_returns_safe_blocked_error(self) -> None:
        data = pd.DataFrame(
            {
                "feature": np.arange(40),
                "copied_target": np.arange(40) * 3,
                "target": np.arange(40) * 3,
            }
        )
        spec = specification(
            task_type="regression",
            split_policy=SplitPolicy(
                strategy="random", final_holdout_fraction=0.2, cross_validation_folds=3
            ),
            numeric=("feature", "copied_target"),
            candidates=("regularized_linear",),
        )

        with self.assertRaises(EvaluationBlocked) as raised:
            evaluate(data, spec)

        self.assertEqual(raised.exception.error.code, "structural_target_leakage")
        self.assertEqual(raised.exception.findings[-1].severity, "blocked")
        self.assertNotIn("Traceback", raised.exception.error.message)


class StructuredSplitTests(unittest.TestCase):
    def test_time_ordered_evidence_never_trains_after_evaluation(self) -> None:
        count = 80
        data = pd.DataFrame(
            {
                "feature": np.arange(count, dtype=float),
                "event_time": [NOW + timedelta(days=index) for index in range(count)],
                "target": np.arange(count, dtype=float) * 1.5,
            }
        )
        spec = specification(
            task_type="regression",
            split_policy=SplitPolicy(
                strategy="time_ordered",
                final_holdout_fraction=0.2,
                cross_validation_folds=3,
                time_column="event_time",
            ),
            numeric=("feature",),
            candidates=("regularized_linear",),
        )

        result = evaluate(data, spec)

        self.assertTrue(result.split_evidence.final_temporal_order_valid)
        self.assertTrue(all(fold.temporal_order_valid for fold in result.split_evidence.folds))

    def test_grouped_evidence_keeps_groups_disjoint(self) -> None:
        group_count = 12
        rows_per_group = 6
        groups = np.repeat([f"group-{index}" for index in range(group_count)], rows_per_group)
        feature = np.arange(len(groups), dtype=float)
        data = pd.DataFrame(
            {"feature": feature, "account": groups, "target": feature * 0.75 + 2.0}
        )
        spec = specification(
            task_type="regression",
            split_policy=SplitPolicy(
                strategy="grouped",
                final_holdout_fraction=0.2,
                cross_validation_folds=3,
                group_column="account",
            ),
            numeric=("feature",),
            candidates=("regularized_linear",),
        )

        result = evaluate(data, spec)

        self.assertEqual(result.split_evidence.final_group_overlap_count, 0)
        self.assertTrue(all(fold.group_overlap_count == 0 for fold in result.split_evidence.folds))


class LeakageInvariantTests(unittest.TestCase):
    def setUp(self) -> None:
        feature = np.arange(90, dtype=float)
        self.data = pd.DataFrame({"feature": feature, "target": feature * 2.5 + 3.0})
        self.spec = specification(
            task_type="regression",
            split_policy=SplitPolicy(
                strategy="random", final_holdout_fraction=0.2, cross_validation_folds=3
            ),
            numeric=("feature",),
            candidates=("regularized_linear",),
        )

    def test_holdout_rows_never_enter_preprocessing_fit(self) -> None:
        partition = evaluation_module._partition_rows(self.data, self.data["target"], self.spec)
        holdout = set(partition.holdout.tolist())
        fitted_indexes: list[set[int]] = []
        original_fit = evaluation_module.SimpleImputer.fit

        def recording_fit(imputer, values, target=None):
            if hasattr(values, "index"):
                fitted_indexes.append(set(int(value) for value in values.index))
            return original_fit(imputer, values, target)

        with mock.patch.object(evaluation_module.SimpleImputer, "fit", new=recording_fit):
            evaluate(self.data, self.spec)

        self.assertTrue(fitted_indexes)
        self.assertTrue(all(indexes.isdisjoint(holdout) for indexes in fitted_indexes))

    def test_holdout_target_changes_cannot_change_candidate_selection(self) -> None:
        partition = evaluation_module._partition_rows(self.data, self.data["target"], self.spec)
        changed = self.data.copy()
        changed.loc[partition.holdout, "target"] += 10000.0

        original_result = evaluate(self.data, self.spec)
        changed_result = evaluate(changed, self.spec)

        self.assertEqual(original_result.selection_evidence, changed_result.selection_evidence)
        self.assertNotEqual(
            original_result.final_holdout_evidence.candidate_metrics,
            changed_result.final_holdout_evidence.candidate_metrics,
        )

    def test_final_holdout_metrics_are_computed_once_for_candidate_and_baseline(self) -> None:
        partition = evaluation_module._partition_rows(self.data, self.data["target"], self.spec)
        holdout = set(partition.holdout.tolist())
        measured_indexes: list[set[int]] = []
        original_measure = evaluation_module._measure

        def recording_measure(task_type, truth, predictions):
            measured_indexes.append(set(int(value) for value in truth.index))
            return original_measure(task_type, truth, predictions)

        with mock.patch.object(evaluation_module, "_measure", side_effect=recording_measure):
            evaluate(self.data, self.spec)

        self.assertEqual(sum(indexes == holdout for indexes in measured_indexes), 2)

    def test_infeasible_structured_splits_return_stable_safe_codes(self) -> None:
        invalid_time = self.data.assign(event_time=[NOW] * 89 + [None])
        time_spec = specification(
            task_type="regression",
            split_policy=SplitPolicy(
                strategy="time_ordered",
                final_holdout_fraction=0.2,
                cross_validation_folds=3,
                time_column="event_time",
            ),
            numeric=("feature",),
            candidates=("regularized_linear",),
        )
        with self.assertRaises(EvaluationBlocked) as time_error:
            evaluate(invalid_time, time_spec)
        self.assertEqual(time_error.exception.error.code, "invalid_time_split_column")

        invalid_groups = self.data.assign(account=np.repeat(("a", "b", "c"), 30))
        group_spec = specification(
            task_type="regression",
            split_policy=SplitPolicy(
                strategy="grouped",
                final_holdout_fraction=0.2,
                cross_validation_folds=3,
                group_column="account",
            ),
            numeric=("feature",),
            candidates=("regularized_linear",),
        )
        with self.assertRaises(EvaluationBlocked) as group_error:
            evaluate(invalid_groups, group_spec)
        self.assertEqual(group_error.exception.error.code, "grouped_split_infeasible")


if __name__ == "__main__":
    unittest.main()
