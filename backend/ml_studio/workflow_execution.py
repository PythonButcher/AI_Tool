"""Draft-scoped execution using the existing durable run/event repository."""

from __future__ import annotations

import hashlib
from pathlib import Path
import platform
from uuid import uuid4

from .configuration import dependency_fingerprint
from .contracts import RunSpecification, StructuredError
from .repository import PersistenceError
from .service import MLStudioServiceError, _snapshot_from_dict
from .training import DevelopmentEvaluation, TrainingCancelled, run_with_limits


def submit_draft_run(service, experiment_id: str, workspace_id: str, etag: str, key: str, payload: dict) -> tuple[dict, bool]:
    if not isinstance(payload, dict) or set(payload) != {"configuration_id"} or not isinstance(payload["configuration_id"], str):
        raise MLStudioServiceError("run_submission_invalid", "Supply exactly the server-issued configuration_id.", "Assess the saved configuration first.")
    envelope = service.get_draft(experiment_id, workspace_id)
    draft, assessment = envelope["draft"], envelope["assessment"]
    repository = service._repository
    try:
        existing = repository.find_run_submission(key)
        if existing:
            original = existing["run_specification"]
            if original["dataset_snapshot"]["workspace_id"] != workspace_id or original["parameters"].get("draft_experiment_id") != experiment_id or original["parameters"].get("configuration_id") != payload["configuration_id"]:
                raise MLStudioServiceError("idempotency_key_conflict", "This key belongs to another submission.", "Reuse a key only for its original configuration.", status_code=409)
            return existing, False
        if draft["etag"] != etag:
            raise MLStudioServiceError("draft_revision_conflict", "The draft changed before submission.", "Reload the current draft and retry.", status_code=409)
        if envelope["preparation_context"]:
            raise MLStudioServiceError("draft_preparation_pending", "Preparation is open.", "Apply or cancel the recipe first.", status_code=409)
        if not assessment or assessment["state"] != "ready" or assessment["input_fingerprint"] != dependency_fingerprint(draft) or assessment["configuration"]["configuration_id"] != payload["configuration_id"]:
            raise MLStudioServiceError("assessment_required", "The saved configuration needs a current ready assessment.", "Return to Configure and assess the saved settings.", status_code=409)
        if service._artifact_store is None or service._run_data_resolver is None:
            raise MLStudioServiceError("run_executor_unavailable", "Local training storage or data resolution is unavailable.", "Configure the local ML Studio backend.", status_code=503)
        config = assessment["configuration"]
        snapshot = _snapshot_from_dict(service.get_snapshot(config["snapshot_id"]))
        service._assert_snapshot_current(snapshot)
        source_root = Path(__file__).parent
        revision = hashlib.sha256(b"".join(path.read_bytes() for path in sorted(source_root.glob("*.py")))).hexdigest()
        run = RunSpecification(run_id=f"run-{uuid4().hex}", experiment_id=config["experiment_id"], specification_version=config["specification_version"],
            dataset_snapshot=snapshot, submitted_at=service._clock(),
            parameters={"run_purpose": "development_comparison", "configuration_id": config["configuration_id"],
                        "draft_experiment_id": experiment_id, "input_fingerprint": config["input_fingerprint"], "resource_limits": config["resource"]},
            environment={"python": platform.python_version()}, code_revision=revision)
        stored, created = repository.submit_run(run, idempotency_key=key, single_active_experiment=True,
                                                draft_binding=(experiment_id, workspace_id, etag))
        if created and service._run_scheduler:
            try:
                if not service._run_scheduler(stored["run_id"]):
                    raise RuntimeError("scheduler declined run")
            except Exception:
                service._fail_active_run(stored["run_id"], StructuredError(code="run_scheduling_failed", message="The local worker could not start this run.", remediation="Retry with a new submission key after checking worker availability."))
                stored = repository.get_run(stored["run_id"])
        return stored, created
    except PersistenceError as exc:
        raise service._translate_persistence(exc) from exc


def scoped_run(service, experiment_id: str, workspace_id: str, run_id: str) -> dict:
    service.get_draft(experiment_id, workspace_id)
    run = service.get_run(run_id)
    specification = run["run_specification"]
    if specification["dataset_snapshot"]["workspace_id"] != workspace_id or specification["parameters"].get("draft_experiment_id") != experiment_id:
        raise MLStudioServiceError("run_not_found", "The run is unavailable in this experiment.", "Choose a run from the current experiment.", status_code=404)
    return run


def execute_development_run(service, run_id: str) -> None:
    repository = service._repository
    try:
        repository.transition_run(run_id, "running", progress_stage="resolving_dataset")
    except PersistenceError:
        return
    try:
        stored = repository.get_run(run_id)
        specification = stored["run_specification"]
        snapshot = _snapshot_from_dict(specification["dataset_snapshot"])
        config = repository.get_experiment(stored["experiment_id"], stored["specification_version"])
        if not config or config.get("configuration_id") != specification["parameters"]["configuration_id"]:
            raise MLStudioServiceError("configuration_missing", "The immutable configuration is unavailable.", "Restore its metadata before retrying.")
        service._assert_snapshot_current(snapshot)
        data, version, fingerprints = service._run_data_resolver(snapshot)
        snapshot.assert_current(workspace_version=version, source_fingerprints=fingerprints)
        if len(data) != snapshot.row_count:
            raise MLStudioServiceError("snapshot_row_count_mismatch", "The resolved data differs from the saved snapshot.", "Create a fresh snapshot.")
        def cancelled():
            current = repository.get_run(run_id)
            return current is None or current["status"] != "running"
        result = run_with_limits(data, config, cancelled=cancelled, progress=lambda stage: repository.update_run_progress(run_id, stage))
        if service._finish_cancellation(run_id):
            return
        repository.update_run_progress(run_id, "verifying_fitted_artifacts")
        for family, content in result.pop("bundles").items():
            metadata = service._artifact_store.write(run_id, f"development-{family}.joblib", content,
                                                     media_type="application/octet-stream", server_created=True)
            service._artifact_store.verify(run_id, metadata.name)
            repository.register_artifact(metadata)
        if service._finish_cancellation(run_id):
            return
        evaluation = DevelopmentEvaluation(run_id=run_id, experiment_id=stored["experiment_id"], specification_version=stored["specification_version"],
            dataset_snapshot=snapshot, configuration_id=config["configuration_id"], task_type=config["task_type"],
            split=result["split"], candidates=result["candidates"], baseline=result["baseline"], limitations=result["limitations"],
            warnings=tuple(result["warnings"]), runtime_versions=result["runtime_versions"],
            primary_metric=config["metric"]["primary"], metric_direction="maximize" if config["task_type"] == "classification" else "minimize")
        repository.transition_run(run_id, "completed", progress_stage="development_complete", evaluation_result=evaluation, warnings=evaluation.warnings)
    except TrainingCancelled:
        service._finish_cancellation(run_id)
    except Exception as exc:
        error = getattr(exc, "error", None)
        service._fail_active_run(run_id, error if isinstance(error, StructuredError) else StructuredError(
            code="run_execution_failed", message="The local development run could not finish.", remediation="Review the saved settings and run events, then retry."))
