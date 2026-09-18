"""Framework-independent application service for the ML Studio v1 API."""

from __future__ import annotations

import re
from collections.abc import Callable, Mapping, Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from .contracts import (
    CONTRACT_VERSION,
    ColumnProfile,
    DatasetSnapshotIdentity,
    ExperimentSpecification,
    FeatureRoles,
    MetricPolicy,
    RandomSeedPolicy,
    ResourceLimits,
    ReviewedCandidateReference,
    RunSpecification,
    SourceFingerprint,
    SplitPolicy,
    StructuredError,
)
from .repository import MLStudioRepository, PersistenceError


SnapshotResolver = Callable[[str], Mapping[str, Any]]
ArtifactVerifier = Callable[[Mapping[str, Any]], None]
_FORBIDDEN_RUN_KEYS = {
    "artifact_bytes",
    "data",
    "dataset",
    "estimator",
    "file_path",
    "full_data",
    "model",
    "model_bytes",
    "path",
    "raw_data",
    "records",
    "rows",
    "storage_path",
    "uploaded_data",
}
_SECRET_KEY_PARTS = ("api_key", "authorization", "credential", "password", "secret", "token")
_FILESYSTEM_PATH = re.compile(r"(?:^[A-Za-z]:[\\/]|^/(?:home|users|var|tmp)/)", re.IGNORECASE)


class MLStudioServiceError(ValueError):
    """Stable application error suitable for a public JSON response."""

    def __init__(self, code: str, message: str, remediation: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.error = StructuredError(code=code, message=message, remediation=remediation)
        self.status_code = status_code

    @property
    def code(self) -> str:
        return self.error.code

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.error.code,
            "message": self.error.message,
            "remediation": self.error.remediation,
        }


def _utc_now() -> datetime:
    return datetime.now(UTC)


def _require_object(value: Any, *, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise MLStudioServiceError(
            "invalid_request",
            f"{label} must be a JSON object.",
            "Send the documented versioned JSON request body.",
        )
    return value


def _exact_fields(payload: Mapping[str, Any], allowed: set[str], required: set[str]) -> None:
    unknown = sorted(set(payload).difference(allowed))
    missing = sorted(field for field in required if payload.get(field) is None)
    if unknown or missing:
        raise MLStudioServiceError(
            "invalid_request_fields",
            "The request contains unknown fields or omits required fields.",
            "Send only the documented fields and include every required identity.",
        )


def _ordered_ids(value: Any, *, label: str, allow_empty: bool) -> tuple[str, ...]:
    if not isinstance(value, list):
        raise MLStudioServiceError(
            "invalid_identity",
            f"{label} must be an ordered array.",
            "Send the exact ordered server identity list.",
        )
    normalized = tuple(str(item).strip() for item in value)
    if (not allow_empty and not normalized) or any(not item for item in normalized) or len(set(normalized)) != len(normalized):
        raise MLStudioServiceError(
            "invalid_identity",
            f"{label} must contain unique non-empty identities.",
            "Send the exact ordered server identity list.",
        )
    return normalized


def _parse_datetime(value: Any, *, label: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(str(value))
    except (TypeError, ValueError) as exc:
        raise MLStudioServiceError(
            "stored_contract_invalid",
            f"The stored {label} timestamp is invalid.",
            "Inspect the server-owned ML Studio metadata.",
            status_code=500,
        ) from exc
    if parsed.tzinfo is None:
        raise MLStudioServiceError(
            "stored_contract_invalid",
            f"The stored {label} timestamp has no timezone.",
            "Inspect the server-owned ML Studio metadata.",
            status_code=500,
        )
    return parsed


def _snapshot_from_dict(payload: Mapping[str, Any]) -> DatasetSnapshotIdentity:
    value = dict(payload)
    value.pop("contract_version", None)
    value["source_ids"] = tuple(value["source_ids"])
    value["relationship_ids"] = tuple(value["relationship_ids"])
    value["source_fingerprints"] = tuple(
        SourceFingerprint(**item) for item in value["source_fingerprints"]
    )
    value["column_profile"] = tuple(ColumnProfile(**item) for item in value["column_profile"])
    value["created_at"] = _parse_datetime(value["created_at"], label="snapshot creation")
    return DatasetSnapshotIdentity(**value)


def _experiment_from_dict(payload: Mapping[str, Any]) -> ExperimentSpecification:
    value = dict(payload)
    if value.get("contract_version", CONTRACT_VERSION) != CONTRACT_VERSION:
        raise ValueError("contract_version is unsupported")
    value.pop("contract_version", None)
    value["feature_roles"] = FeatureRoles(
        numeric=tuple(value["feature_roles"].get("numeric") or ()),
        categorical=tuple(value["feature_roles"].get("categorical") or ()),
    )
    value["excluded_columns"] = tuple(value.get("excluded_columns") or ())
    value["split_policy"] = SplitPolicy(**value["split_policy"])
    value["candidate_families"] = tuple(value["candidate_families"])
    metric = value["metric_policy"]
    value["metric_policy"] = MetricPolicy(
        primary_metric=metric["primary_metric"],
        optimization=metric["optimization"],
        reported_metrics=tuple(metric["reported_metrics"]),
    )
    value["resource_limits"] = ResourceLimits(**value["resource_limits"])
    value["random_seed_policy"] = RandomSeedPolicy(**value["random_seed_policy"])
    return ExperimentSpecification(**value)


def _reject_unsafe_run_metadata(value: Any, *, depth: int = 0) -> None:
    if depth > 8:
        raise MLStudioServiceError(
            "run_submission_unsafe",
            "Run metadata exceeds the supported nesting depth.",
            "Send bounded JSON-safe hyperparameters and version strings only.",
        )
    if isinstance(value, Mapping):
        for key, child in value.items():
            normalized = str(key).strip().casefold()
            if normalized in _FORBIDDEN_RUN_KEYS or any(part in normalized for part in _SECRET_KEY_PARTS):
                raise MLStudioServiceError(
                    "run_submission_unsafe",
                    "Run metadata contains a prohibited data, path, estimator, artifact, or secret field.",
                    "Send only bounded model hyperparameters and public runtime version strings.",
                )
            _reject_unsafe_run_metadata(child, depth=depth + 1)
    elif isinstance(value, (list, tuple)):
        for child in value:
            _reject_unsafe_run_metadata(child, depth=depth + 1)
    elif isinstance(value, str) and _FILESYSTEM_PATH.search(value):
        raise MLStudioServiceError(
            "run_submission_unsafe",
            "Run metadata contains a client filesystem path.",
            "Use server-owned identities instead of filesystem locations.",
        )


class MLStudioService:
    """Own API behavior while keeping HTTP and trusted resolution injected."""

    def __init__(
        self,
        repository: MLStudioRepository,
        snapshot_resolver: SnapshotResolver,
        artifact_verifier: ArtifactVerifier,
        *,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        self._repository = repository
        self._snapshot_resolver = snapshot_resolver
        self._artifact_verifier = artifact_verifier
        self._clock = clock

    @staticmethod
    def _translate_persistence(exc: PersistenceError) -> MLStudioServiceError:
        status = 404 if exc.code.endswith("not_found") or exc.code.endswith("missing") else 409
        if exc.code.endswith("invalid") or exc.code.endswith("too_large"):
            status = 400
        return MLStudioServiceError(
            exc.error.code,
            exc.error.message,
            exc.error.remediation,
            status_code=status,
        )

    def _resolve_truth(self, workspace_id: str) -> Mapping[str, Any]:
        try:
            resolved = self._snapshot_resolver(workspace_id)
        except MLStudioServiceError:
            raise
        except Exception as exc:
            raise MLStudioServiceError(
                "snapshot_resolution_failed",
                "The server could not resolve the governed dataset snapshot.",
                "Verify the workspace data model and managed sources, then retry.",
                status_code=409,
            ) from exc
        if not isinstance(resolved, Mapping):
            raise MLStudioServiceError(
                "snapshot_resolution_failed",
                "The server returned invalid snapshot metadata.",
                "Inspect the trusted dataset resolver.",
                status_code=500,
            )
        return resolved

    def create_snapshot(self, request: Any) -> dict[str, Any]:
        payload = _require_object(request, label="snapshot request")
        allowed = {"workspace_id", "workspace_version", "source_ids", "relationship_ids"}
        _exact_fields(payload, allowed, allowed)
        workspace_id = str(payload["workspace_id"]).strip()
        if not workspace_id:
            raise MLStudioServiceError("invalid_identity", "workspace_id is required.", "Use a server workspace identity.")
        source_ids = _ordered_ids(payload["source_ids"], label="source_ids", allow_empty=False)
        relationship_ids = _ordered_ids(payload["relationship_ids"], label="relationship_ids", allow_empty=True)
        try:
            workspace_version = int(payload["workspace_version"])
        except (TypeError, ValueError) as exc:
            raise MLStudioServiceError(
                "invalid_identity", "workspace_version must be a positive integer.", "Use the current server workspace version."
            ) from exc
        truth = self._resolve_truth(workspace_id)
        if (
            truth.get("workspace_id") != workspace_id
            or truth.get("workspace_version") != workspace_version
            or tuple(truth.get("source_ids") or ()) != source_ids
            or tuple(truth.get("relationship_ids") or ()) != relationship_ids
        ):
            raise MLStudioServiceError(
                "snapshot_identity_stale",
                "The requested workspace, source, or relationship identity is stale.",
                "Reload the current Data Model identities and create a new snapshot.",
                status_code=409,
            )
        if (truth.get("governance_result") or {}).get("status") not in {"ready", "warning"}:
            raise MLStudioServiceError(
                "snapshot_governance_blocked",
                "Dataset governance blocks this ML Studio snapshot.",
                "Resolve the governance findings and create a new snapshot.",
                status_code=422,
            )
        if int(truth.get("row_count") or 0) < 1 or not truth.get("column_profile"):
            raise MLStudioServiceError(
                "snapshot_dataset_empty",
                "The governed dataset has no rows or columns available for ML Studio.",
                "Select a non-empty governed dataset and retry.",
                status_code=422,
            )
        now = self._clock()
        snapshot = DatasetSnapshotIdentity(
            snapshot_id=f"snapshot-{uuid4().hex}",
            workspace_id=workspace_id,
            workspace_version=workspace_version,
            source_ids=source_ids,
            relationship_ids=relationship_ids,
            source_fingerprints=tuple(SourceFingerprint(**item) for item in truth["source_fingerprints"]),
            schema_version=int(truth["schema_version"]),
            semantic_model_version=str(truth["semantic_model_version"]),
            governance_result=dict(truth["governance_result"]),
            transformation_recipe_hash=str(truth["transformation_recipe_hash"]),
            row_count=int(truth["row_count"]),
            column_profile=tuple(ColumnProfile(**item) for item in truth["column_profile"]),
            created_at=now,
            created_by=str(truth["created_by"]) if truth.get("created_by") else None,
        )
        try:
            return self._repository.create_snapshot(snapshot)
        except PersistenceError as exc:
            raise self._translate_persistence(exc) from exc

    def get_snapshot(self, snapshot_id: str) -> dict[str, Any]:
        snapshot = self._repository.get_snapshot(snapshot_id)
        if snapshot is None:
            raise MLStudioServiceError(
                "snapshot_not_found", "The requested dataset snapshot does not exist.", "Create or select a valid snapshot.", status_code=404
            )
        return snapshot

    def create_experiment(self, request: Any) -> dict[str, Any]:
        payload = _require_object(request, label="experiment specification")
        try:
            specification = _experiment_from_dict(payload)
            return self._repository.create_experiment(specification)
        except PersistenceError as exc:
            raise self._translate_persistence(exc) from exc
        except (KeyError, TypeError, ValueError) as exc:
            raise MLStudioServiceError(
                "experiment_specification_invalid",
                "The experiment specification is invalid.",
                "Correct the documented task, feature, split, metric, resource, and seed fields.",
            ) from exc

    def list_experiment_versions(self, experiment_id: str) -> list[dict[str, Any]]:
        versions = self._repository.list_experiment_versions(experiment_id)
        if not versions:
            raise MLStudioServiceError(
                "experiment_not_found", "The requested experiment does not exist.", "Create or select a valid experiment.", status_code=404
            )
        return versions

    def _assert_snapshot_current(self, snapshot: DatasetSnapshotIdentity) -> None:
        truth = self._resolve_truth(snapshot.workspace_id)
        current_fingerprints = tuple(
            (item["source_id"], item["content_fingerprint"].lower(), int(item["schema_version"]))
            for item in truth["source_fingerprints"]
        )
        stored_fingerprints = tuple(
            (item.source_id, item.content_fingerprint.lower(), item.schema_version)
            for item in snapshot.source_fingerprints
        )
        if (
            truth.get("workspace_version") != snapshot.workspace_version
            or tuple(truth.get("source_ids") or ()) != snapshot.source_ids
            or tuple(truth.get("relationship_ids") or ()) != snapshot.relationship_ids
            or current_fingerprints != stored_fingerprints
            or str(truth.get("semantic_model_version")) != snapshot.semantic_model_version
            or str(truth.get("transformation_recipe_hash")).lower() != snapshot.transformation_recipe_hash.lower()
            or (truth.get("governance_result") or {}).get("status") not in {"ready", "warning"}
        ):
            raise MLStudioServiceError(
                "snapshot_identity_stale",
                "The dataset snapshot no longer matches authoritative server state.",
                "Create a new snapshot from the current governed Data Model.",
                status_code=409,
            )

    def submit_run(self, request: Any, *, idempotency_key: str | None) -> tuple[dict[str, Any], bool]:
        payload = _require_object(request, label="run submission")
        allowed = {"experiment_id", "specification_version", "snapshot_id", "parameters", "environment", "code_revision"}
        _exact_fields(payload, allowed, allowed)
        if not idempotency_key:
            raise MLStudioServiceError(
                "idempotency_key_required",
                "An Idempotency-Key header is required.",
                "Send one stable key for this exact run submission.",
            )
        try:
            experiment_id = str(payload["experiment_id"])
            specification_version = int(payload["specification_version"])
        except (TypeError, ValueError) as exc:
            raise MLStudioServiceError(
                "run_submission_invalid",
                "The experiment identity or specification version is invalid.",
                "Use an existing experiment identity and positive integer version.",
            ) from exc
        experiment = self._repository.get_experiment(experiment_id, specification_version)
        if experiment is None:
            raise MLStudioServiceError(
                "experiment_version_missing",
                "The run references an experiment specification that does not exist.",
                "Create or select the exact immutable experiment version.",
                status_code=404,
            )
        snapshot_payload = self.get_snapshot(str(payload["snapshot_id"]))
        try:
            _reject_unsafe_run_metadata(payload["parameters"])
            _reject_unsafe_run_metadata(payload["environment"])
            snapshot = _snapshot_from_dict(snapshot_payload)
            self._assert_snapshot_current(snapshot)
            run = RunSpecification(
                run_id=f"run-{uuid4().hex}",
                experiment_id=experiment_id,
                specification_version=specification_version,
                dataset_snapshot=snapshot,
                submitted_at=self._clock(),
                parameters=dict(payload["parameters"]),
                environment=dict(payload["environment"]),
                code_revision=str(payload["code_revision"]),
            )
            return self._repository.submit_run(run, idempotency_key=idempotency_key)
        except PersistenceError as exc:
            raise self._translate_persistence(exc) from exc
        except MLStudioServiceError:
            raise
        except (TypeError, ValueError) as exc:
            raise MLStudioServiceError(
                "run_submission_invalid",
                "The run submission is invalid.",
                "Correct the experiment, snapshot, parameters, environment, and code revision fields.",
            ) from exc

    def get_run(self, run_id: str) -> dict[str, Any]:
        run = self._repository.get_run(run_id)
        if run is None:
            raise MLStudioServiceError("run_not_found", "The requested run does not exist.", "Reload the run list.", status_code=404)
        return {**run, "artifacts": self._repository.list_artifacts(run_id)}

    def list_runs(self, *, limit: int = 100) -> list[dict[str, Any]]:
        return self._repository.list_runs(limit=limit)

    def recover_incomplete_runs(self) -> list[str]:
        return self._repository.recover_incomplete_runs()

    def get_events(self, run_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
        self.get_run(run_id)
        return self._repository.list_events(run_id, limit=limit)

    def cancel_run(self, run_id: str) -> dict[str, Any]:
        try:
            return self._repository.request_cancellation(run_id)
        except PersistenceError as exc:
            raise self._translate_persistence(exc) from exc

    def get_evaluation(self, run_id: str) -> dict[str, Any]:
        run = self.get_run(run_id)
        if run["status"] != "completed" or "evaluation_result" not in run:
            raise MLStudioServiceError(
                "evaluation_unavailable",
                "Evaluation evidence is not available for this run.",
                "Wait for a successful completed run.",
                status_code=409,
            )
        return run["evaluation_result"]

    def compare_runs(self, request: Any) -> dict[str, Any]:
        payload = _require_object(request, label="run comparison")
        _exact_fields(payload, {"run_ids"}, {"run_ids"})
        run_ids = _ordered_ids(payload["run_ids"], label="run_ids", allow_empty=False)
        if not 2 <= len(run_ids) <= 4:
            raise MLStudioServiceError(
                "comparison_size_invalid", "Run comparison requires two to four runs.", "Select two to four compatible completed runs."
            )
        runs_by_id = {item["run_id"]: item for item in self._repository.list_runs(run_ids=run_ids, limit=4)}
        if set(runs_by_id) != set(run_ids):
            raise MLStudioServiceError(
                "run_not_found", "One or more comparison runs do not exist.", "Reload the run list and retry.", status_code=404
            )
        runs = [runs_by_id[item] for item in run_ids]
        if any(item["status"] != "completed" or "evaluation_result" not in item for item in runs):
            raise MLStudioServiceError(
                "comparison_run_incomplete", "Only completed runs with evaluation evidence can be compared.", "Select completed runs.", status_code=409
            )
        identity = {
            (item["experiment_id"], item["specification_version"], item["snapshot_id"], item["evaluation_result"]["task_type"])
            for item in runs
        }
        if len(identity) != 1:
            raise MLStudioServiceError(
                "comparison_identity_mismatch",
                "The selected runs do not share one experiment version, snapshot, and task type.",
                "Compare runs created from the same immutable inputs.",
                status_code=409,
            )
        return {
            "experiment_id": runs[0]["experiment_id"],
            "specification_version": runs[0]["specification_version"],
            "snapshot_id": runs[0]["snapshot_id"],
            "task_type": runs[0]["evaluation_result"]["task_type"],
            "runs": [
                {
                    "run_id": item["run_id"],
                    "selection_evidence": item["evaluation_result"]["selection_evidence"],
                    "final_holdout_evidence": item["evaluation_result"]["final_holdout_evidence"],
                    "warnings": item["warnings"],
                }
                for item in runs
            ],
        }

    def review_candidate(self, request: Any) -> dict[str, Any]:
        payload = _require_object(request, label="candidate review")
        allowed = {"run_id", "artifact_hash", "review_status", "reviewed_by", "intended_use", "prohibited_use"}
        _exact_fields(payload, allowed, allowed)
        run = self.get_run(str(payload["run_id"]))
        if run["status"] != "completed" or "evaluation_result" not in run:
            raise MLStudioServiceError(
                "candidate_run_incomplete", "Only a completed evaluated run can be reviewed.", "Select a completed run.", status_code=409
            )
        artifact_hash = str(payload["artifact_hash"]).lower()
        artifacts = self._repository.list_artifacts(run["run_id"])
        artifact = next((item for item in artifacts if item["sha256"].lower() == artifact_hash), None)
        if artifact is None:
            raise MLStudioServiceError(
                "candidate_artifact_unverified",
                "The candidate artifact hash is not registered for this run.",
                "Verify and register the server-created artifact before review.",
                status_code=409,
            )
        try:
            self._artifact_verifier(artifact)
        except Exception as exc:
            raise MLStudioServiceError(
                "candidate_artifact_unverified",
                "The candidate artifact failed managed-storage verification.",
                "Recreate and verify the server-created artifact before review.",
                status_code=409,
            ) from exc
        try:
            candidate = ReviewedCandidateReference(
                candidate_id=f"candidate-{uuid4().hex}",
                run_id=run["run_id"],
                experiment_id=run["experiment_id"],
                specification_version=run["specification_version"],
                snapshot_id=run["snapshot_id"],
                model_artifact_hash=artifact_hash,
                review_status=str(payload["review_status"]),
                reviewed_at=self._clock(),
                reviewed_by=str(payload["reviewed_by"]),
                intended_use=str(payload["intended_use"]),
                prohibited_use=tuple(payload["prohibited_use"]),
            )
            return self._repository.create_candidate(candidate)
        except PersistenceError as exc:
            raise self._translate_persistence(exc) from exc
        except (TypeError, ValueError) as exc:
            raise MLStudioServiceError(
                "candidate_review_invalid", "The candidate review is invalid.", "Correct the review identity and use boundaries."
            ) from exc

    def get_candidate(self, candidate_id: str) -> dict[str, Any]:
        candidate = self._repository.get_candidate(candidate_id)
        if candidate is None:
            raise MLStudioServiceError(
                "candidate_not_found", "The reviewed candidate does not exist.", "Use a valid candidate identity.", status_code=404
            )
        return candidate
