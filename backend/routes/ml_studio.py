"""Versioned Flask adapter for the identity-first ML Studio API."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from io import BytesIO
from typing import Any

from flask import Blueprint, current_app, jsonify, request, send_file
from pandas.api.types import (
    is_bool_dtype,
    is_datetime64_any_dtype,
    is_numeric_dtype,
    is_string_dtype,
)

from backend.ml_studio.artifacts import ManagedArtifactStore
from backend.ml_studio.execution import AsyncRunExecutor
from backend.ml_studio.repository import MLStudioRepository
from backend.ml_studio.preparation import DraftPreparationService
from backend.ml_studio.service import MLStudioService, MLStudioServiceError
from backend.repositories.source_workspace_repository import get_workspace
from backend.repositories.source_workspace_repository import get_source
from backend.services.relationship_execution import (
    RelationshipExecutionError,
    execute_analysis_context,
    resolve_active_model_analysis_context,
)


ml_studio_bp = Blueprint("ml_studio_bp", __name__, url_prefix="/api/ml-studio/v1")


def _digest(value: Any) -> str:
    encoded = json.dumps(value, allow_nan=False, sort_keys=True, separators=(",", ":"), default=str)
    return f"sha256:{hashlib.sha256(encoded.encode('utf-8')).hexdigest()}"


def _logical_type(series) -> str:
    if is_bool_dtype(series.dtype):
        return "boolean"
    if is_datetime64_any_dtype(series.dtype):
        return "datetime"
    if is_numeric_dtype(series.dtype):
        return "numeric"
    if is_string_dtype(series.dtype):
        distinct = int(series.nunique(dropna=True))
        return "categorical" if distinct <= max(50, len(series) // 20) else "text"
    return "text"


def _resolve_workspace_state(workspace_id: str) -> tuple[Any, dict[str, Any]]:
    """Resolve trusted rows and path-free identity from one workspace execution."""
    try:
        context = resolve_active_model_analysis_context(workspace_id)
        bundle = execute_analysis_context(context)
    except RelationshipExecutionError as exc:
        status = 404 if exc.code in {"workspace_not_found", "source_not_found"} else 409
        raise MLStudioServiceError(
            exc.code,
            "The governed workspace Data Model cannot be resolved for ML Studio.",
            "Repair or reload the current workspace Data Model and retry.",
            status_code=status,
        ) from exc

    dataframe = bundle["dataframe"]
    lineage = bundle.get("analysis_lineage") or {}
    lineage_sources = {
        item["source_id"]: item for item in lineage.get("sources") or []
    }
    source_fingerprints = []
    schema_versions = []
    for source_id in context["source_ids"]:
        item = lineage_sources.get(source_id)
        if item is None:
            source = get_source(source_id)
            if source is None:
                raise MLStudioServiceError(
                    "source_not_found",
                    "A governed source is unavailable.",
                    "Reload the workspace sources and retry.",
                    status_code=404,
                )
            item = {
                "source_id": source_id,
                "content_fingerprint": source["content_fingerprint"],
                "schema_version": source["schema_version"],
            }
        source_fingerprints.append(
            {
                "source_id": source_id,
                "content_fingerprint": item["content_fingerprint"],
                "schema_version": int(item["schema_version"]),
            }
        )
        schema_versions.append(int(item["schema_version"]))

    semantic_model = bundle.get("semantic_model") or {}
    governance = bundle.get("governance_readiness") or {}
    recipe_identity = {
        "analysis_context": context,
        "source_fingerprints": source_fingerprints,
        "relationships": lineage.get("relationships") or [],
        "field_origins": lineage.get("field_origins") or {},
    }
    truth = {
        "workspace_id": context["workspace_id"],
        "workspace_version": context["workspace_version"],
        "source_ids": list(context["source_ids"]),
        "relationship_ids": list(context["relationship_ids"]),
        "source_fingerprints": source_fingerprints,
        "schema_version": max(schema_versions),
        "semantic_model_version": _digest(semantic_model),
        "governance_result": governance,
        "transformation_recipe_hash": _digest(recipe_identity),
        "row_count": len(dataframe),
        "column_profile": [
            {
                "name": str(column),
                "logical_type": _logical_type(dataframe[column]),
                "null_count": int(dataframe[column].isna().sum()),
                "distinct_count": int(dataframe[column].nunique(dropna=True)),
            }
            for column in dataframe.columns
        ],
    }
    return dataframe, truth


def _resolve_snapshot_truth(workspace_id: str) -> dict[str, Any]:
    """Adapt authoritative workspace execution into path-free snapshot metadata."""
    _, truth = _resolve_workspace_state(workspace_id)
    return truth


def _resolve_run_data(snapshot) -> tuple[Any, int, dict[str, tuple[str, int]]]:
    """Resolve server-owned rows plus the identity evidence required by evaluation."""
    dataframe, truth = _resolve_workspace_state(snapshot.workspace_id)
    fingerprints = {
        item["source_id"]: (item["content_fingerprint"], int(item["schema_version"]))
        for item in truth["source_fingerprints"]
    }
    return dataframe, int(truth["workspace_version"]), fingerprints


def get_ml_studio_service() -> MLStudioService:
    configured = current_app.config.get("ML_STUDIO_SERVICE")
    if configured is not None:
        return configured
    cached = current_app.extensions.get("ml_studio_service")
    if cached is not None:
        return cached
    default_database = Path(current_app.root_path).parent / "backend" / "storage" / "ml_studio" / "ml_studio.sqlite3"
    default_artifacts = Path(current_app.root_path).parent / "backend" / "storage" / "ml_studio" / "artifacts"
    repository = MLStudioRepository(current_app.config.get("ML_STUDIO_DATABASE_PATH", default_database))
    artifact_store = ManagedArtifactStore(current_app.config.get("ML_STUDIO_ARTIFACT_ROOT", default_artifacts))
    resolver = current_app.config.get("ML_STUDIO_SNAPSHOT_RESOLVER", _resolve_snapshot_truth)
    run_data_resolver = current_app.config.get("ML_STUDIO_RUN_DATA_RESOLVER", _resolve_run_data)

    def verify_artifact(metadata):
        verified = artifact_store.verify(metadata["run_id"], metadata["name"])
        if verified.sha256 != metadata["sha256"] or verified.size_bytes != metadata["size_bytes"]:
            raise ValueError("artifact metadata mismatch")

    service = MLStudioService(repository, resolver, verify_artifact, run_data_resolver=run_data_resolver, workspace_resolver=get_workspace, artifact_store=artifact_store)
    service.recover_incomplete_runs()
    executor = AsyncRunExecutor(
        service.execute_run,
        max_workers=int(current_app.config.get("ML_STUDIO_MAX_WORKERS", 2)),
    )
    service.set_run_scheduler(executor.schedule)
    current_app.extensions["ml_studio_run_executor"] = executor
    current_app.extensions["ml_studio_service"] = service
    return service


def _error_response(error: MLStudioServiceError):
    return jsonify({"error": error.to_dict()}), error.status_code


def get_draft_preparation_service() -> DraftPreparationService:
    """Inject the catalog boundary into framework-independent ML orchestration."""
    from backend.repositories.source_workspace_repository import get_preparation_commit
    from backend.services.workspace_cleaning import clean_workspace
    from backend.services.workspace_context import WorkspaceContextError

    def cleaner(*args, **kwargs):
        try:
            return clean_workspace(*args, **kwargs)
        except WorkspaceContextError as exc:
            status = 409 if exc.code in {"workspace_version_conflict", "source_version_conflict", "source_not_in_workspace", "preparation_relationships_unsupported"} else 404 if exc.code == "workspace_not_found" else 422 if exc.code == "governance_blocked" else 400
            raise MLStudioServiceError(exc.code, str(exc), "Reload the governed workspace and preparation context.", status_code=status) from exc

    service = get_ml_studio_service()
    return DraftPreparationService(service, service._repository, cleaner, get_preparation_commit)


@ml_studio_bp.route("/drafts/<experiment_id>/preparation", methods=["GET", "POST"])
def draft_preparation(experiment_id):
    try:
        service = get_draft_preparation_service()
        workspace_id = request.args.get("workspace_id")
        if request.method == "GET":
            return jsonify(service.options(experiment_id, workspace_id)), 200
        return jsonify(service.begin(experiment_id, workspace_id, request.headers.get("If-Match"), request.headers.get("Idempotency-Key"), request.get_json(silent=True))), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/drafts/<experiment_id>/preparation/<operation_id>", methods=["GET", "POST"])
def draft_preparation_operation(experiment_id, operation_id):
    try:
        service = get_draft_preparation_service()
        workspace_id = request.args.get("workspace_id")
        if request.method == "GET":
            return jsonify({"preparation": service._operation(operation_id, experiment_id, workspace_id)}), 200
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or set(payload) != {"action"} or not isinstance(payload["action"], str):
            raise service._invalid("Supply exactly one action: preview, apply, or cancel.")
        if payload["action"] == "preview":
            return jsonify(service.preview(operation_id, experiment_id, workspace_id)), 200
        return jsonify(service.finish(operation_id, experiment_id, workspace_id, request.headers.get("If-Match"), payload["action"])), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


def _unexpected_error():
    return jsonify({
        "error": {
            "code": "ml_studio_internal_error",
            "message": "ML Studio could not complete the request.",
            "remediation": "Retry the request or inspect server health.",
        }
    }), 500


@ml_studio_bp.route("/drafts", methods=["POST", "GET"])
def drafts():
    try:
        service = get_ml_studio_service()
        if request.method == "POST":
            return jsonify(service.create_draft(request.get_json(silent=True))), 201
        return jsonify({"drafts": service.list_drafts(request.args.get("workspace_id"))}), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/drafts/<experiment_id>", methods=["GET", "PATCH", "DELETE"])
def draft(experiment_id):
    try:
        service = get_ml_studio_service()
        workspace_id = request.args.get("workspace_id")
        if request.method == "GET":
            return jsonify(service.get_draft(experiment_id, workspace_id)), 200
        if request.method == "DELETE":
            service.delete_draft(experiment_id, workspace_id, request.headers.get("If-Match"))
            return "", 204
        return jsonify(service.update_draft(experiment_id, workspace_id, request.headers.get("If-Match"), request.get_json(silent=True))), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/drafts/<experiment_id>/duplicate", methods=["POST"])
def duplicate_draft(experiment_id):
    try:
        return jsonify(get_ml_studio_service().duplicate_draft(experiment_id, request.args.get("workspace_id"))), 201
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/drafts/<experiment_id>/workflow", methods=["GET"])
def draft_workflow(experiment_id):
    try:
        return jsonify({"workflow_state": get_ml_studio_service().get_draft(experiment_id, request.args.get("workspace_id"))["workflow_state"]}), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/drafts/<experiment_id>/assessment", methods=["POST"])
def assess_draft(experiment_id):
    try:
        return jsonify(get_ml_studio_service().assess_draft(experiment_id, request.args.get("workspace_id"),
                       request.headers.get("If-Match"), request.get_json(silent=True))), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/snapshots", methods=["POST"])
def create_snapshot():
    try:
        return jsonify({"snapshot": get_ml_studio_service().create_snapshot(request.get_json(silent=True))}), 201
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/drafts/<experiment_id>/runs", methods=["GET", "POST"])
def draft_runs(experiment_id):
    from backend.ml_studio.workflow_execution import submit_draft_run
    try:
        service = get_ml_studio_service()
        workspace_id = request.args.get("workspace_id")
        if request.method == "POST":
            value, created = submit_draft_run(service, experiment_id, workspace_id, request.headers.get("If-Match"),
                request.headers.get("Idempotency-Key"), request.get_json(silent=True))
            return jsonify({"run": value, "created": created}), 201 if created else 200
        service.get_draft(experiment_id, workspace_id)
        runs = service._repository.list_runs(experiment_id=f"studio-{experiment_id}", workspace_id=workspace_id, run_purpose="development_comparison", limit=20)
        return jsonify({"runs": [{key: value for key, value in run.items() if key != "evaluation_result"} for run in runs]}), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/drafts/<experiment_id>/runs/<run_id>", methods=["GET", "POST"])
def draft_run(experiment_id, run_id):
    from backend.ml_studio.workflow_execution import scoped_run
    try:
        service = get_ml_studio_service()
        run = scoped_run(service, experiment_id, request.args.get("workspace_id"), run_id)
        if request.method == "POST":
            if request.get_json(silent=True) != {"action": "cancel"}:
                raise MLStudioServiceError("run_action_invalid", "Supply the cancel action.", "Use {action: cancel} to request cancellation.")
            run = service.cancel_run(run_id)
        return jsonify({"run": run, "events": service.get_events(run_id, limit=100)}), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/drafts/<experiment_id>/review", methods=["GET"])
def draft_review(experiment_id):
    from backend.ml_studio.review import review_state
    try:
        return jsonify(review_state(get_ml_studio_service(), experiment_id, request.args.get("workspace_id"))), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/drafts/<experiment_id>/nominations", methods=["POST"])
def draft_nomination(experiment_id):
    from backend.ml_studio.review import nominate
    try:
        value = nominate(get_ml_studio_service(), experiment_id, request.args.get("workspace_id"), request.headers.get("If-Match"), request.get_json(silent=True))
        return jsonify({"nomination": value}), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/drafts/<experiment_id>/nominations/<nomination_id>/final-evaluation", methods=["POST"])
def draft_final_evaluation(experiment_id, nomination_id):
    from backend.ml_studio.review import submit_final_evaluation
    try:
        value = submit_final_evaluation(get_ml_studio_service(), experiment_id, request.args.get("workspace_id"), nomination_id, request.get_json(silent=True))
        return jsonify({"run": value}), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/drafts/<experiment_id>/selections", methods=["POST"])
def draft_selection(experiment_id):
    from backend.ml_studio.review import select_candidate
    try:
        service = get_ml_studio_service()
        workspace_id = request.args.get("workspace_id")
        value = select_candidate(service, experiment_id, workspace_id, request.headers.get("If-Match"), request.get_json(silent=True))
        return jsonify({"selection": value, "workflow_state": service.get_draft(experiment_id, workspace_id)["workflow_state"]}), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


def _verified_download(content, metadata, filename):
    response = send_file(BytesIO(content), mimetype=metadata["media_type"], download_name=filename,
        as_attachment=True, etag=metadata["sha256"].removeprefix("sha256:"))
    response.headers["X-Artifact-SHA256"] = metadata["sha256"]
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "private, no-store"
    return response


@ml_studio_bp.route("/drafts/<experiment_id>/selections/<selection_id>", methods=["GET"])
def selected_candidate_details(experiment_id, selection_id):
    from backend.ml_studio.outputs import selection_details
    try:
        return jsonify(selection_details(get_ml_studio_service(), experiment_id, request.args.get("workspace_id"), selection_id)), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/drafts/<experiment_id>/selections/<selection_id>/exports", methods=["POST"])
def prepare_selected_exports(experiment_id, selection_id):
    from backend.ml_studio.outputs import prepare_exports
    try:
        return jsonify(prepare_exports(get_ml_studio_service(), experiment_id, request.args.get("workspace_id"), selection_id, request.get_json(silent=True))), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/drafts/<experiment_id>/selections/<selection_id>/exports/<kind>", methods=["GET"])
def selected_export_download(experiment_id, selection_id, kind):
    from backend.ml_studio.outputs import download_export
    try:
        descriptor, content = download_export(get_ml_studio_service(), experiment_id, request.args.get("workspace_id"), selection_id, kind)
        return _verified_download(content, descriptor["artifact"], descriptor["filename"])
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/drafts/<experiment_id>/selections/<selection_id>/batch-predictions", methods=["POST"])
def selected_batch_prediction(experiment_id, selection_id):
    from backend.ml_studio.outputs import predict_batch, MAX_INPUT_BYTES
    try:
        if not request.is_json:
            raise MLStudioServiceError("prediction_request_invalid", "Prediction input must be JSON containing rows or CSV text.", "Use the selected model's prediction form.")
        raw = request.stream.read(MAX_INPUT_BYTES + 1)
        if len(raw) > MAX_INPUT_BYTES:
            raise MLStudioServiceError("prediction_input_too_large", "Prediction input exceeds 2 MB.", "Choose a smaller batch.", status_code=413)
        try:
            payload = json.loads(raw)
        except (ValueError, UnicodeError) as exc:
            raise MLStudioServiceError("prediction_request_invalid", "The prediction request is not valid JSON.", "Provide rows or CSV text using the selected schema.") from exc
        receipt = predict_batch(get_ml_studio_service(), experiment_id, request.args.get("workspace_id"), selection_id, request.headers.get("Idempotency-Key"), payload)
        return jsonify({"prediction": receipt}), 200
    except MLStudioServiceError as exc:
        if hasattr(exc, "validation_issues"):
            return jsonify({"error": exc.error.to_dict(), "validation_issues": exc.validation_issues}), exc.status_code
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/drafts/<experiment_id>/selections/<selection_id>/batch-predictions/<prediction_id>/download", methods=["GET"])
def selected_prediction_download(experiment_id, selection_id, prediction_id):
    from backend.ml_studio.outputs import selection_for
    try:
        service = get_ml_studio_service()
        selection_for(service, experiment_id, request.args.get("workspace_id"), selection_id)
        receipt = service._repository.get_prediction_receipt(selection_id, prediction_id)
        if receipt is None:
            raise MLStudioServiceError("prediction_not_found", "The prediction output is unavailable in this selection.", "Choose a saved prediction batch.", status_code=404)
        return _verified_download(service._artifact_store.read_verified(receipt["output_artifact"]), receipt["output_artifact"], "predictions.csv")
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/snapshots/<snapshot_id>", methods=["GET"])
def get_snapshot(snapshot_id):
    try:
        return jsonify({"snapshot": get_ml_studio_service().get_snapshot(snapshot_id)}), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/experiments", methods=["POST"])
def create_experiment():
    try:
        return jsonify({"experiment": get_ml_studio_service().create_experiment(request.get_json(silent=True))}), 201
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/experiments/<experiment_id>/versions", methods=["GET"])
def list_experiment_versions(experiment_id):
    try:
        return jsonify({"experiments": get_ml_studio_service().list_experiment_versions(experiment_id)}), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/preparation-assessments", methods=["POST"])
def create_preparation_assessment():
    try:
        assessment = get_ml_studio_service().create_preparation_assessment(request.get_json(silent=True))
        return jsonify({"assessment": assessment}), 201
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/runs", methods=["POST"])
def submit_run():
    try:
        value, created = get_ml_studio_service().submit_run(
            request.get_json(silent=True), idempotency_key=request.headers.get("Idempotency-Key")
        )
        return jsonify({"run": value, "created": created}), 201 if created else 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/runs", methods=["GET"])
def list_runs():
    try:
        return jsonify({"runs": get_ml_studio_service().list_runs(limit=request.args.get("limit", 100), workspace_id=request.args.get("workspace_id"))}), 200
    except (MLStudioServiceError, TypeError, ValueError) as exc:
        if isinstance(exc, MLStudioServiceError):
            return _error_response(exc)
        return _error_response(MLStudioServiceError("invalid_limit", "Run list limit is invalid.", "Use an integer from 1 to 500."))
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/runs/<run_id>", methods=["GET"])
def get_run(run_id):
    try:
        return jsonify({"run": get_ml_studio_service().get_run(run_id)}), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/runs/<run_id>/events", methods=["GET"])
def get_run_events(run_id):
    try:
        events = get_ml_studio_service().get_events(run_id, limit=request.args.get("limit", 100))
        return jsonify({"run_id": run_id, "events": events}), 200
    except (MLStudioServiceError, TypeError, ValueError) as exc:
        if isinstance(exc, MLStudioServiceError):
            return _error_response(exc)
        return _error_response(MLStudioServiceError("invalid_limit", "Run event limit is invalid.", "Use an integer from 1 to 1000."))
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/runs/<run_id>/cancel", methods=["POST"])
def cancel_run(run_id):
    try:
        return jsonify({"run": get_ml_studio_service().cancel_run(run_id)}), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/runs/<run_id>/evaluation", methods=["GET"])
def get_run_evaluation(run_id):
    try:
        return jsonify({"evaluation": get_ml_studio_service().get_evaluation(run_id)}), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/runs/<run_id>/evidence", methods=["GET"])
def get_run_evidence(run_id):
    try:
        return jsonify({"evidence": get_ml_studio_service().get_run_evidence(run_id)}), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/runs/compare", methods=["POST"])
def compare_runs():
    try:
        return jsonify({"comparison": get_ml_studio_service().compare_runs(request.get_json(silent=True))}), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/candidates", methods=["POST"])
def review_candidate():
    try:
        return jsonify({"candidate": get_ml_studio_service().review_candidate(request.get_json(silent=True))}), 201
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()


@ml_studio_bp.route("/candidates/<candidate_id>", methods=["GET"])
def get_candidate(candidate_id):
    try:
        return jsonify({"candidate": get_ml_studio_service().get_candidate(candidate_id)}), 200
    except MLStudioServiceError as exc:
        return _error_response(exc)
    except Exception:
        return _unexpected_error()
