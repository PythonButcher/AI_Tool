"""Versioned, JSON-safe domain contracts for ML Studio Gate 1.

The contracts use only the Python standard library so the evaluation core is
portable and independent of Flask, persistence, and process-global state.
"""

from __future__ import annotations

import json
import hashlib
import math
import re
from dataclasses import dataclass, fields, is_dataclass
from datetime import datetime
from types import MappingProxyType
from typing import Any, ClassVar, Literal, Mapping


CONTRACT_VERSION = "ml_studio_contract_v1"
_IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_.:-]{0,127}$")
_HASH_PATTERN = re.compile(r"^(?:sha256:)?[0-9a-fA-F]{64}$")
_SAFE_ERROR_FORBIDDEN = (
    "traceback (most recent call last)",
    'file "',
    "serialized estimator",
    "-----begin private key-----",
)
_PATH_PATTERN = re.compile(r"(?:[A-Za-z]:\\|/(?:home|users|var|tmp)/)", re.IGNORECASE)
SUPPORTED_POWER_QUERY_ACTIONS = frozenset(
    {
        "change_case",
        "convert_type",
        "extract_date_component",
        "filter_rows",
        "group_by",
        "keep_bottom_rows",
        "keep_columns",
        "keep_top_rows",
        "merge_columns",
        "pivot",
        "remove_bottom_rows",
        "remove_columns",
        "remove_duplicates",
        "remove_nulls",
        "remove_top_rows",
        "rename_columns",
        "reorder_columns",
        "replace_nulls",
        "replace_values",
        "sort_rows",
        "split_column",
        "trim_whitespace",
        "unpivot",
    }
)


def _json_value(value: Any) -> Any:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            raise ValueError("timestamps must include a timezone")
        return value.isoformat()
    if is_dataclass(value) and not isinstance(value, type):
        payload = {item.name: _json_value(getattr(value, item.name)) for item in fields(value)}
        if isinstance(value, ContractObject):
            payload = {"contract_version": value.contract_version, **payload}
        return payload
    if isinstance(value, Mapping):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [_json_value(item) for item in value]
    return value


def _freeze_json(value: Any) -> Any:
    """Deep-freeze JSON-shaped values so frozen contracts cannot mutate indirectly."""

    if isinstance(value, Mapping):
        if any(not isinstance(key, str) for key in value):
            raise ValueError("JSON object keys must be strings")
        return MappingProxyType({key: _freeze_json(item) for key, item in value.items()})
    if isinstance(value, (list, tuple)):
        return tuple(_freeze_json(item) for item in value)
    _json_safe(value, label="value")
    return value


def _json_safe(value: Any, *, label: str) -> None:
    try:
        json.dumps(_json_value(value), allow_nan=False, sort_keys=True)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be JSON-safe") from exc


def _identity(value: str, *, label: str) -> None:
    if not isinstance(value, str) or not _IDENTIFIER_PATTERN.fullmatch(value):
        raise ValueError(f"{label} has an invalid format")


def _sha256(value: str, *, label: str) -> None:
    if not isinstance(value, str) or not _HASH_PATTERN.fullmatch(value):
        raise ValueError(f"{label} must be a SHA-256 digest")


def _canonical_sha256(value: Any) -> str:
    payload = json.dumps(_json_value(value), allow_nan=False, separators=(",", ":"), sort_keys=True)
    return f"sha256:{hashlib.sha256(payload.encode('utf-8')).hexdigest()}"


def _aware_timestamp(value: datetime, *, label: str) -> None:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{label} must include a timezone")


def _safe_text(value: str, *, label: str) -> None:
    if not isinstance(value, str):
        raise ValueError(f"{label} must be a string")
    lowered = value.casefold()
    if not value.strip() or len(value) > 1000:
        raise ValueError(f"{label} must be a non-empty bounded string")
    if any(marker in lowered for marker in _SAFE_ERROR_FORBIDDEN) or _PATH_PATTERN.search(value):
        raise ValueError(f"{label} contains unsafe implementation detail")


def _reject_raw_data_and_paths(value: Any, *, label: str) -> None:
    forbidden_keys = {"dataframe", "dataset", "dataset_path", "file_path", "filesystem_path", "path", "raw_rows", "rows"}
    if isinstance(value, Mapping):
        for key, item in value.items():
            if key.casefold() in forbidden_keys:
                raise ValueError(f"{label} cannot contain raw dataset rows or filesystem paths")
            _reject_raw_data_and_paths(item, label=label)
    elif isinstance(value, (tuple, list)):
        for item in value:
            _reject_raw_data_and_paths(item, label=label)
    elif isinstance(value, str) and _PATH_PATTERN.search(value):
        raise ValueError(f"{label} cannot contain raw dataset rows or filesystem paths")


def _unique(values: tuple[str, ...], *, label: str, allow_empty: bool = True) -> None:
    if not allow_empty and not values:
        raise ValueError(f"{label} must not be empty")
    if any(not isinstance(value, str) or not value for value in values):
        raise ValueError(f"{label} must contain non-empty strings")
    if len(values) != len(set(values)):
        raise ValueError(f"{label} must not contain duplicates")


def _metrics(value: Mapping[str, float], *, label: str) -> None:
    if not value:
        raise ValueError(f"{label} must contain at least one metric")
    for name, metric in value.items():
        _identity(name, label=f"{label} metric name")
        if isinstance(metric, bool) or not isinstance(metric, (int, float)) or not math.isfinite(float(metric)):
            raise ValueError(f"{label} metric values must be finite numbers")


def _finite_values(value: Mapping[str, float], *, label: str) -> None:
    if not value:
        raise ValueError(f"{label} must not be empty")
    for name, metric in value.items():
        if not isinstance(name, str) or not name:
            raise ValueError(f"{label} names must be non-empty strings")
        if isinstance(metric, bool) or not isinstance(metric, (int, float)) or not math.isfinite(float(metric)):
            raise ValueError(f"{label} values must be finite numbers")


class ContractObject:
    contract_version: ClassVar[str] = CONTRACT_VERSION

    def to_dict(self) -> dict[str, Any]:
        payload = _json_value(self)
        if not isinstance(payload, dict):
            raise ValueError("contract payload must be an object")
        payload = {"contract_version": self.contract_version, **payload}
        _json_safe(payload, label=self.__class__.__name__)
        return payload


@dataclass(frozen=True, slots=True)
class SourceFingerprint:
    source_id: str
    content_fingerprint: str
    schema_version: int

    def __post_init__(self) -> None:
        _identity(self.source_id, label="source_id")
        _sha256(self.content_fingerprint, label="content_fingerprint")
        object.__setattr__(self, "content_fingerprint", self.content_fingerprint.lower())
        if not isinstance(self.schema_version, int) or isinstance(self.schema_version, bool) or self.schema_version < 1:
            raise ValueError("schema_version must be a positive integer")


@dataclass(frozen=True, slots=True)
class ColumnProfile:
    name: str
    logical_type: Literal["numeric", "categorical", "boolean", "datetime", "text"]
    null_count: int
    distinct_count: int

    def __post_init__(self) -> None:
        if not self.name:
            raise ValueError("column profile name is required")
        if self.logical_type not in {"numeric", "categorical", "boolean", "datetime", "text"}:
            raise ValueError("column profile logical_type is unsupported")
        if any(isinstance(value, bool) or not isinstance(value, int) or value < 0 for value in (self.null_count, self.distinct_count)):
            raise ValueError("column profile counts must be non-negative integers")


@dataclass(frozen=True, slots=True)
class DatasetSnapshotIdentity(ContractObject):
    snapshot_id: str
    workspace_id: str
    workspace_version: int
    source_ids: tuple[str, ...]
    relationship_ids: tuple[str, ...]
    source_fingerprints: tuple[SourceFingerprint, ...]
    schema_version: int
    semantic_model_version: str
    governance_result: dict[str, Any]
    transformation_recipe_hash: str
    row_count: int
    column_profile: tuple[ColumnProfile, ...]
    created_at: datetime
    created_by: str | None = None

    def __post_init__(self) -> None:
        _identity(self.snapshot_id, label="snapshot_id")
        _identity(self.workspace_id, label="workspace_id")
        _unique(self.source_ids, label="source_ids", allow_empty=False)
        _unique(self.relationship_ids, label="relationship_ids")
        for value in self.source_ids + self.relationship_ids:
            _identity(value, label="snapshot identity")
        if not isinstance(self.workspace_version, int) or self.workspace_version < 1:
            raise ValueError("workspace_version must be a positive integer")
        if not isinstance(self.schema_version, int) or self.schema_version < 1:
            raise ValueError("schema_version must be a positive integer")
        if not self.semantic_model_version:
            raise ValueError("semantic_model_version is required")
        _sha256(self.transformation_recipe_hash, label="transformation_recipe_hash")
        object.__setattr__(self, "transformation_recipe_hash", self.transformation_recipe_hash.lower())
        if not isinstance(self.row_count, int) or self.row_count < 1:
            raise ValueError("row_count must be a positive integer")
        if not self.column_profile:
            raise ValueError("column_profile must not be empty")
        if tuple(item.source_id for item in self.source_fingerprints) != self.source_ids:
            raise ValueError("source_fingerprints must match ordered source_ids")
        names = tuple(item.name for item in self.column_profile)
        _unique(names, label="column_profile names", allow_empty=False)
        if any(item.null_count > self.row_count or item.distinct_count > self.row_count for item in self.column_profile):
            raise ValueError("column profile counts cannot exceed row_count")
        _json_safe(self.governance_result, label="governance_result")
        if self.governance_result.get("status") not in {"ready", "warning"}:
            raise ValueError("governance_result must be ready or warning")
        object.__setattr__(self, "governance_result", _freeze_json(self.governance_result))
        _json_safe(self.to_dict(), label="DatasetSnapshotIdentity")

    def assert_current(
        self,
        *,
        workspace_version: int,
        source_fingerprints: Mapping[str, tuple[str, int]],
    ) -> None:
        if workspace_version != self.workspace_version:
            raise ValueError("snapshot workspace_version is stale")
        expected = {
            item.source_id: (item.content_fingerprint, item.schema_version)
            for item in self.source_fingerprints
        }
        if dict(source_fingerprints) != expected:
            raise ValueError("snapshot source fingerprints are stale")


@dataclass(frozen=True, slots=True)
class FeatureRoles:
    numeric: tuple[str, ...] = ()
    categorical: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        _unique(self.all_features, label="feature roles", allow_empty=False)

    @property
    def all_features(self) -> tuple[str, ...]:
        return self.numeric + self.categorical


@dataclass(frozen=True, slots=True)
class SplitPolicy:
    strategy: Literal["random", "stratified", "time_ordered", "grouped"]
    final_holdout_fraction: float
    cross_validation_folds: int
    time_column: str | None = None
    group_column: str | None = None

    def __post_init__(self) -> None:
        if self.strategy not in {"random", "stratified", "time_ordered", "grouped"}:
            raise ValueError("split strategy is unsupported")
        if isinstance(self.final_holdout_fraction, bool) or not isinstance(self.final_holdout_fraction, (int, float)) or not 0.1 <= self.final_holdout_fraction <= 0.4:
            raise ValueError("final_holdout_fraction must be between 0.1 and 0.4")
        if not isinstance(self.cross_validation_folds, int) or not 2 <= self.cross_validation_folds <= 20:
            raise ValueError("cross_validation_folds must be between 2 and 20")
        if (self.strategy == "time_ordered") != (self.time_column is not None):
            raise ValueError("time_ordered splits require only time_column")
        if (self.strategy == "grouped") != (self.group_column is not None):
            raise ValueError("grouped splits require only group_column")


@dataclass(frozen=True, slots=True)
class MetricPolicy:
    primary_metric: str
    optimization: Literal["maximize", "minimize"]
    reported_metrics: tuple[str, ...]

    def __post_init__(self) -> None:
        _unique(self.reported_metrics, label="reported_metrics", allow_empty=False)
        if self.optimization not in {"maximize", "minimize"}:
            raise ValueError("optimization must be maximize or minimize")
        if self.primary_metric not in self.reported_metrics:
            raise ValueError("primary_metric must be included in reported_metrics")


@dataclass(frozen=True, slots=True)
class ResourceLimits:
    max_rows: int
    max_features: int
    max_candidates: int
    timeout_seconds: int

    def __post_init__(self) -> None:
        if any(not isinstance(value, int) or isinstance(value, bool) or value < 1 for value in (self.max_rows, self.max_features, self.timeout_seconds)):
            raise ValueError("resource limits must be positive integers")
        if not isinstance(self.max_candidates, int) or not 1 <= self.max_candidates <= 3:
            raise ValueError("max_candidates must be between 1 and 3")


@dataclass(frozen=True, slots=True)
class RandomSeedPolicy:
    final_holdout_seed: int
    cross_validation_seed: int
    estimator_seed: int

    def __post_init__(self) -> None:
        for value in (self.final_holdout_seed, self.cross_validation_seed, self.estimator_seed):
            if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value <= 2**32 - 1:
                raise ValueError("random seeds must be unsigned 32-bit integers")


@dataclass(frozen=True, slots=True)
class ExperimentSpecification(ContractObject):
    experiment_id: str
    specification_version: int
    task_type: Literal["regression", "classification"]
    target: str
    feature_roles: FeatureRoles
    excluded_columns: tuple[str, ...]
    split_policy: SplitPolicy
    candidate_families: tuple[str, ...]
    metric_policy: MetricPolicy
    resource_limits: ResourceLimits
    random_seed_policy: RandomSeedPolicy

    def __post_init__(self) -> None:
        _identity(self.experiment_id, label="experiment_id")
        if not isinstance(self.specification_version, int) or self.specification_version < 1:
            raise ValueError("specification_version must be a positive integer")
        if self.task_type not in {"regression", "classification"}:
            raise ValueError("task_type must be user-selected regression or classification")
        if not self.target:
            raise ValueError("target is required")
        allowed = {
            "regression": {"regularized_linear", "random_forest", "hist_gradient_boosting"},
            "classification": {"logistic", "random_forest", "hist_gradient_boosting"},
        }[self.task_type]
        _unique(self.candidate_families, label="candidate_families", allow_empty=False)
        if len(self.candidate_families) > 3 or not set(self.candidate_families).issubset(allowed):
            raise ValueError("candidate_families contradict task_type")
        _unique(self.excluded_columns, label="excluded_columns")
        features = set(self.feature_roles.all_features)
        if self.target in features or self.target in self.excluded_columns:
            raise ValueError("target cannot be a feature or excluded column")
        if features.intersection(self.excluded_columns):
            raise ValueError("excluded columns cannot have feature roles")
        split_columns = {self.split_policy.time_column, self.split_policy.group_column} - {None}
        if self.target in split_columns:
            raise ValueError("target cannot be a time or group split column")
        if features.intersection(split_columns):
            raise ValueError("time and group split columns cannot be model features")
        if self.split_policy.strategy == "stratified" and self.task_type != "classification":
            raise ValueError("stratified split is classification-only")
        if self.task_type == "classification" and self.metric_policy.primary_metric == "accuracy":
            raise ValueError("raw accuracy cannot be the sole classification selection metric")
        if self.task_type == "regression" and self.metric_policy.primary_metric == "r2":
            raise ValueError("fit alone cannot be the regression selection metric")
        _json_safe(self.to_dict(), label="ExperimentSpecification")


@dataclass(frozen=True, slots=True)
class TransformationStep(ContractObject):
    step_id: str
    action_type: str
    affected_columns: tuple[str, ...]
    parameters: dict[str, Any]

    def __post_init__(self) -> None:
        _identity(self.step_id, label="step_id")
        if self.action_type not in SUPPORTED_POWER_QUERY_ACTIONS:
            raise ValueError("action_type is not supported by the existing Power Query executor")
        _unique(self.affected_columns, label="affected_columns")
        _json_safe(self.parameters, label="transformation step parameters")
        _reject_raw_data_and_paths(self.parameters, label="transformation step parameters")
        object.__setattr__(self, "parameters", _freeze_json(self.parameters))
        _json_safe(self.to_dict(), label="TransformationStep")


@dataclass(frozen=True, slots=True)
class TransformationRecipeLineage(ContractObject):
    recipe_id: str
    workspace_id: str
    base_snapshot_id: str
    base_recipe_hash: str
    recipe_version: int
    steps: tuple[TransformationStep, ...]
    canonical_recipe_hash: str
    created_at: datetime
    created_by: str | None = None

    @staticmethod
    def calculate_hash(
        *,
        recipe_id: str,
        workspace_id: str,
        base_snapshot_id: str,
        base_recipe_hash: str,
        recipe_version: int,
        steps: tuple[TransformationStep, ...],
    ) -> str:
        return _canonical_sha256(
            {
                "recipe_id": recipe_id,
                "workspace_id": workspace_id,
                "base_snapshot_id": base_snapshot_id,
                "base_recipe_hash": base_recipe_hash.lower(),
                "recipe_version": recipe_version,
                "steps": steps,
            }
        )

    def __post_init__(self) -> None:
        for label, value in (
            ("recipe_id", self.recipe_id),
            ("workspace_id", self.workspace_id),
            ("base_snapshot_id", self.base_snapshot_id),
        ):
            _identity(value, label=label)
        _sha256(self.base_recipe_hash, label="base_recipe_hash")
        _sha256(self.canonical_recipe_hash, label="canonical_recipe_hash")
        object.__setattr__(self, "base_recipe_hash", self.base_recipe_hash.lower())
        object.__setattr__(self, "canonical_recipe_hash", self.canonical_recipe_hash.lower())
        if not isinstance(self.recipe_version, int) or isinstance(self.recipe_version, bool) or self.recipe_version < 1:
            raise ValueError("recipe_version must be a positive integer")
        step_ids = tuple(step.step_id for step in self.steps)
        _unique(step_ids, label="transformation step identities")
        _aware_timestamp(self.created_at, label="created_at")
        if self.created_by is not None:
            _identity(self.created_by, label="created_by")
        expected_hash = self.calculate_hash(
            recipe_id=self.recipe_id,
            workspace_id=self.workspace_id,
            base_snapshot_id=self.base_snapshot_id,
            base_recipe_hash=self.base_recipe_hash,
            recipe_version=self.recipe_version,
            steps=self.steps,
        )
        if self.canonical_recipe_hash != expected_hash:
            raise ValueError("canonical_recipe_hash does not match the ordered recipe content")
        _json_safe(self.to_dict(), label="TransformationRecipeLineage")


@dataclass(frozen=True, slots=True)
class PreparationIssue(ContractObject):
    issue_id: str
    code: str
    severity: Literal["blocking", "warning", "info"]
    message: str
    affected_field: str | None
    remediation: str

    def __post_init__(self) -> None:
        _identity(self.issue_id, label="issue_id")
        if not re.fullmatch(r"[a-z][a-z0-9_]{0,63}", self.code):
            raise ValueError("preparation issue code has an invalid format")
        if self.severity not in {"blocking", "warning", "info"}:
            raise ValueError("preparation issue severity is unsupported")
        _safe_text(self.message, label="preparation issue message")
        _safe_text(self.remediation, label="preparation issue remediation")
        if self.affected_field is not None and (
            not isinstance(self.affected_field, str) or not self.affected_field.strip()
        ):
            raise ValueError("affected_field must be a non-empty string when provided")
        _json_safe(self.to_dict(), label="PreparationIssue")


@dataclass(frozen=True, slots=True)
class SuggestedPreparationFix(ContractObject):
    fix_id: str
    action_type: str
    affected_columns: tuple[str, ...]
    parameters: dict[str, Any]
    reason: str
    status: Literal["supported", "unsupported"]
    explanation: str

    def __post_init__(self) -> None:
        _identity(self.fix_id, label="fix_id")
        if self.action_type not in SUPPORTED_POWER_QUERY_ACTIONS:
            raise ValueError("action_type is not supported by the existing Power Query executor")
        _unique(self.affected_columns, label="suggested fix affected_columns")
        _json_safe(self.parameters, label="suggested fix parameters")
        _reject_raw_data_and_paths(self.parameters, label="suggested fix parameters")
        object.__setattr__(self, "parameters", _freeze_json(self.parameters))
        _safe_text(self.reason, label="suggested fix reason")
        if self.status not in {"supported", "unsupported"}:
            raise ValueError("suggested fix status is unsupported")
        _safe_text(self.explanation, label="suggested fix explanation")
        _json_safe(self.to_dict(), label="SuggestedPreparationFix")


@dataclass(frozen=True, slots=True)
class PreparationAssessment(ContractObject):
    assessment_id: str
    assessed_at: datetime
    state: Literal["ready", "blocked"]
    dataset_snapshot: DatasetSnapshotIdentity
    experiment_specification: ExperimentSpecification
    transformation_recipe: TransformationRecipeLineage
    issues: tuple[PreparationIssue, ...]
    suggested_fixes: tuple[SuggestedPreparationFix, ...]
    input_fingerprint: str

    @staticmethod
    def calculate_input_fingerprint(
        *,
        dataset_snapshot: DatasetSnapshotIdentity,
        experiment_specification: ExperimentSpecification,
        transformation_recipe: TransformationRecipeLineage,
    ) -> str:
        return _canonical_sha256(
            {
                "dataset_snapshot": dataset_snapshot,
                "experiment_specification": experiment_specification,
                "transformation_recipe": transformation_recipe,
            }
        )

    def __post_init__(self) -> None:
        _identity(self.assessment_id, label="assessment_id")
        _aware_timestamp(self.assessed_at, label="assessed_at")
        if self.state not in {"ready", "blocked"}:
            raise ValueError("preparation assessment state is unsupported")
        if self.transformation_recipe.workspace_id != self.dataset_snapshot.workspace_id:
            raise ValueError("transformation recipe workspace contradicts the dataset snapshot")
        if self.transformation_recipe.base_snapshot_id != self.dataset_snapshot.snapshot_id:
            raise ValueError("transformation recipe base snapshot contradicts the dataset snapshot")
        if self.transformation_recipe.base_recipe_hash != self.dataset_snapshot.transformation_recipe_hash:
            raise ValueError("transformation recipe base hash contradicts the dataset snapshot")
        snapshot_columns = {column.name for column in self.dataset_snapshot.column_profile}
        referenced_columns = {
            self.experiment_specification.target,
            *self.experiment_specification.feature_roles.all_features,
            *self.experiment_specification.excluded_columns,
        }
        referenced_columns.update(
            column
            for column in (
                self.experiment_specification.split_policy.time_column,
                self.experiment_specification.split_policy.group_column,
            )
            if column is not None
        )
        if not referenced_columns.issubset(snapshot_columns):
            raise ValueError("experiment specification references columns outside the dataset snapshot")
        issue_ids = tuple(issue.issue_id for issue in self.issues)
        fix_ids = tuple(fix.fix_id for fix in self.suggested_fixes)
        _unique(issue_ids, label="preparation issue identities")
        _unique(fix_ids, label="suggested fix identities")
        has_blocker = any(issue.severity == "blocking" for issue in self.issues)
        if (self.state == "blocked") != has_blocker:
            raise ValueError("preparation assessment state contradicts its issues")
        _sha256(self.input_fingerprint, label="input_fingerprint")
        object.__setattr__(self, "input_fingerprint", self.input_fingerprint.lower())
        expected_fingerprint = self.calculate_input_fingerprint(
            dataset_snapshot=self.dataset_snapshot,
            experiment_specification=self.experiment_specification,
            transformation_recipe=self.transformation_recipe,
        )
        if self.input_fingerprint != expected_fingerprint:
            raise ValueError("input_fingerprint does not match the bound snapshot, recipe, and specification")
        _json_safe(self.to_dict(), label="PreparationAssessment")


@dataclass(frozen=True, slots=True)
class RunSpecification(ContractObject):
    run_id: str
    experiment_id: str
    specification_version: int
    dataset_snapshot: DatasetSnapshotIdentity
    submitted_at: datetime
    parameters: dict[str, Any]
    environment: dict[str, str]
    code_revision: str

    def __post_init__(self) -> None:
        _identity(self.run_id, label="run_id")
        _identity(self.experiment_id, label="experiment_id")
        if not isinstance(self.specification_version, int) or self.specification_version < 1:
            raise ValueError("specification_version must be a positive integer")
        if not self.environment or any(not isinstance(key, str) or not isinstance(value, str) for key, value in self.environment.items()):
            raise ValueError("environment must contain version strings")
        if not isinstance(self.code_revision, str) or not 7 <= len(self.code_revision) <= 64:
            raise ValueError("code_revision must be 7 to 64 characters")
        _json_safe(self.parameters, label="parameters")
        object.__setattr__(self, "parameters", _freeze_json(self.parameters))
        object.__setattr__(self, "environment", _freeze_json(self.environment))
        _json_safe(self.to_dict(), label="RunSpecification")


@dataclass(frozen=True, slots=True)
class CandidateSelectionEvidence:
    candidate_family: str
    fold_metrics: tuple[dict[str, float], ...]
    mean_metrics: dict[str, float]

    def __post_init__(self) -> None:
        if not self.candidate_family or len(self.fold_metrics) < 2:
            raise ValueError("candidate evidence requires a family and at least two folds")
        for item in self.fold_metrics:
            _metrics(item, label="fold_metrics")
        _metrics(self.mean_metrics, label="mean_metrics")
        object.__setattr__(self, "fold_metrics", tuple(_freeze_json(item) for item in self.fold_metrics))
        object.__setattr__(self, "mean_metrics", _freeze_json(self.mean_metrics))


@dataclass(frozen=True, slots=True)
class SelectionEvidence:
    baseline_name: str
    baseline_fold_metrics: tuple[dict[str, float], ...]
    candidates: tuple[CandidateSelectionEvidence, ...]
    selected_candidate: str
    development_row_count: int

    def __post_init__(self) -> None:
        if not self.baseline_name or len(self.baseline_fold_metrics) < 2:
            raise ValueError("baseline evidence requires a name and at least two folds")
        for item in self.baseline_fold_metrics:
            _metrics(item, label="baseline_fold_metrics")
        object.__setattr__(
            self,
            "baseline_fold_metrics",
            tuple(_freeze_json(item) for item in self.baseline_fold_metrics),
        )
        if not self.candidates:
            raise ValueError("candidate evidence is required")
        names = tuple(item.candidate_family for item in self.candidates)
        _unique(names, label="selection candidates", allow_empty=False)
        if self.selected_candidate not in names:
            raise ValueError("selected_candidate must reference candidate evidence")
        if not isinstance(self.development_row_count, int) or self.development_row_count < 1:
            raise ValueError("development_row_count must be positive")


@dataclass(frozen=True, slots=True)
class FinalHoldoutEvidence:
    selected_candidate: str
    candidate_metrics: dict[str, float]
    baseline_metrics: dict[str, float]
    holdout_row_count: int
    evaluated_once: Literal[True] = True

    def __post_init__(self) -> None:
        if not self.selected_candidate or self.evaluated_once is not True:
            raise ValueError("final holdout must evaluate one selected candidate once")
        _metrics(self.candidate_metrics, label="candidate_metrics")
        _metrics(self.baseline_metrics, label="baseline_metrics")
        object.__setattr__(self, "candidate_metrics", _freeze_json(self.candidate_metrics))
        object.__setattr__(self, "baseline_metrics", _freeze_json(self.baseline_metrics))
        if not isinstance(self.holdout_row_count, int) or self.holdout_row_count < 1:
            raise ValueError("holdout_row_count must be positive")


@dataclass(frozen=True, slots=True)
class FoldEvidence:
    train_row_count: int
    evaluation_row_count: int
    train_index_hash: str
    evaluation_index_hash: str
    row_overlap_count: int
    temporal_order_valid: bool | None
    group_overlap_count: int | None

    def __post_init__(self) -> None:
        if self.train_row_count < 1 or self.evaluation_row_count < 1:
            raise ValueError("fold evidence row counts must be positive")
        _sha256(self.train_index_hash, label="train_index_hash")
        _sha256(self.evaluation_index_hash, label="evaluation_index_hash")
        if self.row_overlap_count != 0:
            raise ValueError("training and evaluation rows must not overlap")
        if self.temporal_order_valid is False:
            raise ValueError("time-ordered folds cannot train after evaluation rows")
        if self.group_overlap_count not in {None, 0}:
            raise ValueError("grouped folds cannot share groups")


@dataclass(frozen=True, slots=True)
class SplitEvidence:
    strategy: Literal["random", "stratified", "time_ordered", "grouped"]
    development_index_hash: str
    final_holdout_index_hash: str
    development_row_count: int
    final_holdout_row_count: int
    final_row_overlap_count: int
    final_temporal_order_valid: bool | None
    final_group_overlap_count: int | None
    folds: tuple[FoldEvidence, ...]

    def __post_init__(self) -> None:
        if self.strategy not in {"random", "stratified", "time_ordered", "grouped"}:
            raise ValueError("split evidence strategy is unsupported")
        _sha256(self.development_index_hash, label="development_index_hash")
        _sha256(self.final_holdout_index_hash, label="final_holdout_index_hash")
        if self.development_row_count < 1 or self.final_holdout_row_count < 1 or not self.folds:
            raise ValueError("split evidence requires positive row counts and folds")
        if self.final_row_overlap_count != 0:
            raise ValueError("development and final holdout rows must not overlap")
        if self.final_temporal_order_valid is False:
            raise ValueError("final time holdout cannot precede development rows")
        if self.final_group_overlap_count not in {None, 0}:
            raise ValueError("development and final holdout cannot share groups")


@dataclass(frozen=True, slots=True)
class LeakageFinding:
    code: str
    severity: Literal["info", "warning", "blocked"]
    message: str
    columns: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        _identity(self.code, label="leakage finding code")
        if self.severity not in {"info", "warning", "blocked"} or not self.message:
            raise ValueError("leakage finding must have valid severity and message")


@dataclass(frozen=True, slots=True)
class FeatureInfluence:
    method: str
    values: dict[str, float]
    limitations: tuple[str, ...]
    causal: Literal[False] = False

    def __post_init__(self) -> None:
        if not self.method or not self.limitations or self.causal is not False:
            raise ValueError("feature influence must be non-causal and state limitations")
        _finite_values(self.values, label="feature influence")
        object.__setattr__(self, "values", _freeze_json(self.values))


@dataclass(frozen=True, slots=True)
class FailureSlice:
    """Aggregate holdout error for a privacy-bounded feature cohort."""

    slice_id: str
    field: str
    cohort: str
    row_count: int
    metric_name: Literal["mae", "error_rate"]
    metric_value: float
    overall_metric_value: float
    delta_from_overall: float

    def __post_init__(self) -> None:
        _identity(self.slice_id, label="failure slice identity")
        _safe_text(self.field, label="failure slice field")
        if self.cohort not in {
            "lowest_quartile",
            "lower_middle_quartile",
            "upper_middle_quartile",
            "highest_quartile",
            "missing",
            "most_frequent_category",
            "other_categories",
        }:
            raise ValueError("failure slice cohort is unsupported")
        if not isinstance(self.row_count, int) or self.row_count < 1:
            raise ValueError("failure slice row_count must be positive")
        if self.metric_name not in {"mae", "error_rate"}:
            raise ValueError("failure slice metric is unsupported")
        _finite_values(
            {
                "metric_value": self.metric_value,
                "overall_metric_value": self.overall_metric_value,
                "delta_from_overall": self.delta_from_overall,
            },
            label="failure slice metrics",
        )


@dataclass(frozen=True, slots=True)
class TruthBoundary:
    claims: tuple[str, ...]
    prohibited_claims: tuple[str, ...]
    status: Literal["evaluated_experiment"] = "evaluated_experiment"

    def __post_init__(self) -> None:
        if self.status != "evaluated_experiment" or not self.claims or not self.prohibited_claims:
            raise ValueError("truth boundary requires claims and prohibited claims")


@dataclass(frozen=True, slots=True)
class EvaluationResult(ContractObject):
    run_id: str
    task_type: Literal["regression", "classification"]
    dataset_snapshot: DatasetSnapshotIdentity
    experiment_id: str
    specification_version: int
    selection_evidence: SelectionEvidence
    final_holdout_evidence: FinalHoldoutEvidence
    split_evidence: SplitEvidence
    warnings: tuple[str, ...]
    limitations: tuple[str, ...]
    leakage_findings: tuple[LeakageFinding, ...]
    feature_influence: FeatureInfluence
    runtime_versions: dict[str, str]
    random_seeds: RandomSeedPolicy
    truth_boundary: TruthBoundary
    failure_slices: tuple[FailureSlice, ...] = ()

    def __post_init__(self) -> None:
        _identity(self.run_id, label="run_id")
        _identity(self.experiment_id, label="experiment_id")
        if self.task_type not in {"regression", "classification"}:
            raise ValueError("task_type is unsupported")
        if not isinstance(self.specification_version, int) or self.specification_version < 1:
            raise ValueError("specification_version must be positive")
        if not self.limitations or not self.runtime_versions:
            raise ValueError("evaluation requires limitations and runtime versions")
        if any(not isinstance(key, str) or not isinstance(value, str) for key, value in self.runtime_versions.items()):
            raise ValueError("runtime_versions must contain strings")
        if self.selection_evidence.selected_candidate != self.final_holdout_evidence.selected_candidate:
            raise ValueError("final holdout must evaluate the selected development candidate")
        evaluated_rows = self.selection_evidence.development_row_count + self.final_holdout_evidence.holdout_row_count
        if evaluated_rows > self.dataset_snapshot.row_count:
            raise ValueError("evaluation row counts exceed the dataset snapshot")
        slice_ids = tuple(item.slice_id for item in self.failure_slices)
        _unique(slice_ids, label="failure slice identities")
        object.__setattr__(self, "runtime_versions", _freeze_json(self.runtime_versions))
        _json_safe(self.to_dict(), label="EvaluationResult")


@dataclass(frozen=True, slots=True)
class ReviewedCandidateReference(ContractObject):
    candidate_id: str
    run_id: str
    experiment_id: str
    specification_version: int
    snapshot_id: str
    model_artifact_hash: str
    review_status: Literal["reviewed_candidate", "rejected"]
    reviewed_at: datetime
    reviewed_by: str
    intended_use: str
    prohibited_use: tuple[str, ...]

    def __post_init__(self) -> None:
        for label, value in (("candidate_id", self.candidate_id), ("run_id", self.run_id), ("experiment_id", self.experiment_id), ("snapshot_id", self.snapshot_id)):
            _identity(value, label=label)
        _sha256(self.model_artifact_hash, label="model_artifact_hash")
        object.__setattr__(self, "model_artifact_hash", self.model_artifact_hash.lower())
        if not isinstance(self.specification_version, int) or self.specification_version < 1:
            raise ValueError("specification_version must be positive")
        if self.review_status not in {"reviewed_candidate", "rejected"}:
            raise ValueError("review_status is unsupported")
        if not self.reviewed_by or not self.intended_use or not self.prohibited_use:
            raise ValueError("review metadata and use boundaries are required")
        _json_safe(self.to_dict(), label="ReviewedCandidateReference")


@dataclass(frozen=True, slots=True)
class StructuredError(ContractObject):
    code: str
    message: str
    remediation: str

    def __post_init__(self) -> None:
        if not re.fullmatch(r"[a-z][a-z0-9_]{0,63}", self.code):
            raise ValueError("structured error code has an invalid format")
        for value in (self.message, self.remediation):
            if not isinstance(value, str):
                raise ValueError("structured error text must be a string")
            lowered = value.casefold()
            if not value or any(marker in lowered for marker in _SAFE_ERROR_FORBIDDEN) or _PATH_PATTERN.search(value):
                raise ValueError("structured error text contains unsafe implementation detail")
        _json_safe(self.to_dict(), label="StructuredError")
