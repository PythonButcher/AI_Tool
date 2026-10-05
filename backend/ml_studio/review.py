"""Explicit nomination, a locked final evaluation, and durable selection receipts."""

from dataclasses import dataclass
import hashlib
from io import BytesIO
import json
from uuid import uuid4
from pathlib import Path

from .configuration import dependency_fingerprint
from .contracts import ContractObject, DatasetSnapshotIdentity, RunSpecification, StructuredError
from .repository import PersistenceError
from .service import MLStudioServiceError, _snapshot_from_dict
from .training import TrainingCancelled, run_with_limits, measure, normalize_features
from .workflow_execution import scoped_run


@dataclass(frozen=True)
class FinalEvaluation(ContractObject):
    contract_version = "ml_studio_final_evaluation_v1"
    run_id: str
    experiment_id: str
    specification_version: int
    dataset_snapshot: DatasetSnapshotIdentity
    nomination_id: str
    configuration_id: str
    family: str
    metrics: dict
    baseline: dict
    evidence: dict
    holdout_rows: int
    limitations: list[str]
    evaluated_once: bool = True
    run_purpose: str = "final_evaluation"


def _fields(payload, required):
    if not isinstance(payload, dict) or set(payload) != set(required):
        raise MLStudioServiceError("review_request_invalid", "Supply exactly the documented decision fields.", "Reload the review form and retry.")
    if any(not isinstance(value, str) or not value.strip() or len(value) > 2000 for value in payload.values()):
        raise MLStudioServiceError("review_request_invalid", "Decision fields must be text between 1 and 2000 characters.", "Complete the review notes before continuing.")


def _current(service, experiment_id, workspace_id, fingerprint):
    envelope = service.get_draft(experiment_id, workspace_id)
    if envelope["preparation_context"] or fingerprint != dependency_fingerprint(envelope["draft"]):
        raise MLStudioServiceError("review_evidence_stale", "These results no longer match the saved draft.", "Restore the original configuration or train the current settings.", status_code=409)
    snapshot = _snapshot_from_dict(service.get_snapshot(envelope["draft"]["snapshot_id"]))
    service._assert_snapshot_current(snapshot)
    return envelope


def _artifact(service, run_id, family):
    value = next((item for item in service._repository.list_artifacts(run_id) if item["name"] == f"development-{family}.joblib"), None)
    if value is None or service._artifact_store is None:
        raise MLStudioServiceError("candidate_artifact_missing", "The fitted candidate is unavailable.", "Restore the verified managed artifact before continuing.", status_code=409)
    try:
        content = service._artifact_store.read_verified(value)
    except Exception as exc:
        raise MLStudioServiceError("candidate_artifact_unverified", "The fitted candidate failed integrity verification.", "Restore its original managed artifact before continuing.", status_code=409) from exc
    return value, content


def selected_artifact(service, selection):
    """Forecast selections may bind a context-refreshed final artifact."""
    expected = selection["artifact"]
    registered = next((item for item in service._repository.list_artifacts(expected["run_id"]) if item["name"] == expected["name"]), None)
    if registered != expected or service._artifact_store is None:
        raise MLStudioServiceError("artifact_binding_invalid", "The selected artifact is unavailable or changed.", "Restore its original registered artifact.", status_code=409)
    try:
        return registered, service._artifact_store.read_verified(registered)
    except Exception as exc:
        raise MLStudioServiceError("candidate_artifact_unverified", "The selected model failed integrity verification.", "Restore its original managed artifact.", status_code=409) from exc


def nomination_for(service, experiment_id, workspace_id, nomination_id):
    service.get_draft(experiment_id, workspace_id)
    value = next((item for item in service._repository.list_nominations(experiment_id, workspace_id) if item["nomination_id"] == nomination_id), None)
    if value is None:
        raise MLStudioServiceError("nomination_not_found", "This nomination is unavailable in the experiment.", "Reload the saved review.", status_code=404)
    return value


def nominate(service, experiment_id, workspace_id, etag, payload):
    _fields(payload, ("run_id", "family", "nominator", "intended_use"))
    run = scoped_run(service, experiment_id, workspace_id, payload["run_id"])
    evidence = run.get("evaluation_result") or {}
    if run["status"] != "completed" or evidence.get("run_purpose") != "development_comparison" or payload["family"] not in [item["family"] for item in evidence.get("candidates", [])]:
        raise MLStudioServiceError("nomination_evidence_required", "Choose a fitted candidate from a completed development run.", "Review the development comparison first.", status_code=409)
    specification = run["run_specification"]
    _current(service, experiment_id, workspace_id, specification["parameters"]["input_fingerprint"])
    artifact, _ = _artifact(service, run["run_id"], payload["family"])
    snapshot = specification["dataset_snapshot"]
    # Deliberately exclude configuration/feature/split edits: they cannot buy
    # another look at the same experiment's final data. A changed dataset can.
    identity = {key: snapshot[key] for key in ("workspace_id", "source_fingerprints", "relationship_ids", "transformation_recipe_hash", "row_count")}
    holdout_key = hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
    identifier = uuid4().hex
    value = {"contract_version": "ml_studio_nomination_v1", "nomination_id": f"nomination-{identifier}",
        "final_run_id": f"final-{identifier}", "experiment_id": experiment_id, "workspace_id": workspace_id,
        "development_run_id": run["run_id"], "configuration_id": specification["parameters"]["configuration_id"],
        "specification_version": run["specification_version"], "snapshot_id": snapshot["snapshot_id"],
        "input_fingerprint": specification["parameters"]["input_fingerprint"], "holdout_key": holdout_key,
        "family": payload["family"], "nominator": payload["nominator"].strip(), "intended_use": payload["intended_use"].strip(),
        "artifact": artifact, "nominated_at": service._clock().isoformat()}
    try:
        return service._repository.save_nomination(value, etag)
    except PersistenceError as exc:
        raise service._translate_persistence(exc) from exc


def submit_final_evaluation(service, experiment_id, workspace_id, nomination_id, payload):
    if payload != {}:
        raise MLStudioServiceError("review_request_invalid", "Final evaluation accepts an empty object.", "Use the saved nomination without overriding its inputs.")
    nomination = nomination_for(service, experiment_id, workspace_id, nomination_id)
    existing = service._repository.get_run(nomination["final_run_id"])
    if existing and existing["status"] == "completed":
        return existing
    envelope = _current(service, experiment_id, workspace_id, nomination["input_fingerprint"])
    development = service.get_run(nomination["development_run_id"])
    specification = development["run_specification"]
    _artifact(service, development["run_id"], nomination["family"])
    run = RunSpecification(run_id=nomination["final_run_id"], experiment_id=development["experiment_id"],
        specification_version=development["specification_version"], dataset_snapshot=_snapshot_from_dict(specification["dataset_snapshot"]),
        submitted_at=service._clock(), parameters={**specification["parameters"], "run_purpose": "final_evaluation", "nomination_id": nomination_id},
        environment=specification["environment"], code_revision=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    try:
        if existing:
            stored, created = existing, False
        else:
            stored, created = service._repository.submit_run(run, idempotency_key=f"final:{nomination_id}",
                draft_binding=(experiment_id, workspace_id, envelope["draft"]["etag"]))
        resumed = service._repository.resume_final_evaluation(stored["run_id"], draft_binding=(experiment_id, workspace_id, envelope["draft"]["etag"]))
        if (created or resumed) and service._run_scheduler:
            try:
                service._run_scheduler(stored["run_id"])
            except Exception:
                service._fail_active_run(stored["run_id"], StructuredError(code="run_scheduling_failed", message="The local final evaluation could not start.", remediation="Retry the same saved nomination."))
        return service.get_run(stored["run_id"])
    except PersistenceError as exc:
        raise service._translate_persistence(exc) from exc


def _final_worker(connection, data, config):
    """Reload the hash-verified model; never refit or rank alternatives."""
    try:
        import joblib
        import numpy as np
        from sklearn.metrics import confusion_matrix
        from threadpoolctl import threadpool_limits
        from .evaluation import _baseline
        bundle = joblib.load(BytesIO(config["serialized_model"]))
        saved = bundle["configuration"]
        if saved["configuration_id"] != config["configuration_id"] or bundle["family"] != config["family"]:
            raise ValueError("artifact binding mismatch")
        if saved["task_type"] == "forecasting":
            from .forecasting import evaluate_forecast
            connection.send({"event": "scoring_nominated_forecast"})
            connection.send({"result": evaluate_forecast(bundle, data, saved)})
            return
        data = normalize_features(data, saved)
        target = data[saved["roles"]["target"]].reset_index(drop=True)
        if saved["task_type"] == "classification":
            target = target.astype(str)
        holdout, development = bundle["holdout_indices"], bundle["development_indices"]
        connection.send({"event": "scoring_nominated_holdout"})
        with threadpool_limits(limits=1):
            predictions = bundle["pipeline"].predict(data.iloc[holdout])
            baseline = _baseline(saved["task_type"])
            baseline.fit(np.zeros((len(development), 1)), target.iloc[development])
            baseline_predictions = baseline.predict(np.zeros((len(holdout), 1)))
        actual = target.iloc[holdout].tolist()
        predicted = predictions.tolist()
        if saved["task_type"] == "classification":
            labels = sorted(set(actual) | set(predicted))
            evidence = {"kind": "confusion_matrix", "labels": labels, "counts": confusion_matrix(actual, predicted, labels=labels).tolist()}
        else:
            evidence = {"kind": "residuals", "points": [{"actual": float(a), "predicted": float(p), "residual": float(a - p)} for a, p in list(zip(actual, predicted))[:100]], "sample_limit": 100}
        connection.send({"result": {"metrics": measure(saved["task_type"], actual, predicted),
            "baseline": measure(saved["task_type"], actual, baseline_predictions), "evidence": evidence, "holdout_rows": len(holdout),
            "limitations": ["Final evidence applies only to this nominated candidate and must not rank alternatives.",
                "The model remains fitted on development rows; final rows were used for evaluation only."] + (["Fewer than 30 final rows: estimates may vary substantially on new samples."] if len(holdout) < 30 else [])}})
    except Exception:
        connection.send({"error": {"code": "final_evaluation_failed", "message": "The nominated model could not complete final evaluation.", "remediation": "Verify the saved dataset and managed artifact, then retry this nomination."}})
    finally:
        connection.close()


def execute_final_evaluation(service, run_id):
    repository = service._repository
    try:
        repository.transition_run(run_id, "running", progress_stage="loading_nominated_model")
    except PersistenceError:
        return
    try:
        run = repository.get_run(run_id)
        specification = run["run_specification"]
        parameters = specification["parameters"]
        snapshot = _snapshot_from_dict(specification["dataset_snapshot"])
        nomination = nomination_for(service, parameters["draft_experiment_id"], snapshot.workspace_id, parameters["nomination_id"])
        service._assert_snapshot_current(snapshot)
        data, version, fingerprints = service._run_data_resolver(snapshot)
        snapshot.assert_current(workspace_version=version, source_fingerprints=fingerprints)
        if len(data) != snapshot.row_count:
            raise ValueError("snapshot row count changed")
        _, content = _artifact(service, nomination["development_run_id"], nomination["family"])
        config = repository.get_experiment(run["experiment_id"], run["specification_version"])
        result = run_with_limits(data.reset_index(drop=True), {**config, "family": nomination["family"], "serialized_model": content},
            cancelled=lambda: repository.get_run(run_id)["status"] != "running",
            progress=lambda stage: repository.update_run_progress(run_id, stage), worker=_final_worker)
        if service._finish_cancellation(run_id):
            return
        inference_content = result.pop("inference_bundle", None)
        if inference_content is not None:
            name = f"inference-{nomination['family']}.joblib"
            from .outputs import _persist_artifact
            _persist_artifact(service, run_id, name, inference_content, "application/octet-stream")
        evidence = FinalEvaluation(run_id=run_id, experiment_id=run["experiment_id"], specification_version=run["specification_version"],
            dataset_snapshot=snapshot, nomination_id=nomination["nomination_id"], configuration_id=config["configuration_id"], family=nomination["family"], **result)
        repository.transition_run(run_id, "completed", progress_stage="final_evaluation_complete", evaluation_result=evidence)
    except TrainingCancelled:
        service._finish_cancellation(run_id)
    except Exception as exc:
        error = getattr(exc, "error", None)
        service._fail_active_run(run_id, error if isinstance(error, StructuredError) else StructuredError(code="final_evaluation_failed", message="The final evaluation could not finish.", remediation="Review the saved dataset and retry the same nomination."))


def select_candidate(service, experiment_id, workspace_id, etag, payload):
    _fields(payload, ("nomination_id", "reviewed_by", "intended_use", "prohibited_use"))
    nomination = nomination_for(service, experiment_id, workspace_id, payload["nomination_id"])
    _current(service, experiment_id, workspace_id, nomination["input_fingerprint"])
    final = service._repository.get_run(nomination["final_run_id"])
    if not final or final["status"] != "completed":
        raise MLStudioServiceError("final_evidence_required", "Selection requires the saved final evaluation.", "Evaluate the nominated candidate first.", status_code=409)
    artifact, _ = _artifact(service, nomination["development_run_id"], nomination["family"])
    if artifact != nomination["artifact"]:
        raise MLStudioServiceError("artifact_binding_invalid", "The artifact no longer matches the nomination.", "Restore the original verified artifact.", status_code=409)
    config = service._repository.get_experiment(final["experiment_id"], final["specification_version"])
    if config["task_type"] == "forecasting":
        artifact = next((item for item in service._repository.list_artifacts(final["run_id"]) if item["name"] == f"inference-{nomination['family']}.joblib"), None)
        if artifact is None:
            raise MLStudioServiceError("inference_artifact_missing", "The evaluated forecast context is unavailable.", "Restore the final inference artifact before selecting.", status_code=409)
        service._artifact_store.read_verified(artifact)
    value = {"contract_version": "ml_studio_selection_v1", "selection_id": f"selection-{uuid4().hex}",
        "experiment_id": experiment_id, "workspace_id": workspace_id, "nomination_id": nomination["nomination_id"],
        "development_run_id": nomination["development_run_id"], "final_run_id": final["run_id"],
        "configuration_id": nomination["configuration_id"], "specification_version": nomination["specification_version"],
        "snapshot_id": nomination["snapshot_id"], "input_fingerprint": nomination["input_fingerprint"], "family": nomination["family"],
        "artifact": artifact, "task_type": config["task_type"],
        "inference_context": final["evaluation_result"]["evidence"].get("inference_context"),
        "decision": "selected", "selected_at": service._clock().isoformat(),
        **{key: payload[key].strip() for key in ("reviewed_by", "intended_use", "prohibited_use")}}
    try:
        return service._repository.save_selection(value, etag)
    except PersistenceError as exc:
        raise service._translate_persistence(exc) from exc


def review_state(service, experiment_id, workspace_id):
    envelope = service.get_draft(experiment_id, workspace_id)
    nominations = service._repository.list_nominations(experiment_id, workspace_id)
    runs = service._repository.list_runs(experiment_id=f"studio-{experiment_id}", workspace_id=workspace_id, run_purpose="development_comparison", limit=20)
    # Keep a selected/nominated run reachable even after the recent-run window.
    known = {item["run_id"] for item in runs}
    for item in nominations:
        if item["development_run_id"] not in known:
            runs.append(service._repository.get_run(item["development_run_id"]))
            known.add(item["development_run_id"])
    return {"runs": runs,
        "nominations": [{**item, "final_run": service._repository.get_run(item["final_run_id"])} for item in nominations],
        "selections": service._repository.list_selections(experiment_id, workspace_id), "workflow_state": envelope["workflow_state"],
        "input_fingerprint": dependency_fingerprint(envelope["draft"])}
