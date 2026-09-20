"""Versioned Flask adapter for the identity-first ML Studio API."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from flask import Blueprint, current_app, jsonify, request
from pandas.api.types import (
    is_bool_dtype,
    is_datetime64_any_dtype,
    is_numeric_dtype,
    is_string_dtype,
)

from backend.ml_studio.artifacts import ManagedArtifactStore
from backend.ml_studio.repository import MLStudioRepository
from backend.ml_studio.service import MLStudioService, MLStudioServiceError
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


def _resolve_snapshot_truth(workspace_id: str) -> dict[str, Any]:
    """Adapt authoritative workspace execution into path-free snapshot metadata."""
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
    return {
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

    def verify_artifact(metadata):
        verified = artifact_store.verify(metadata["run_id"], metadata["name"])
        if verified.sha256 != metadata["sha256"] or verified.size_bytes != metadata["size_bytes"]:
            raise ValueError("artifact metadata mismatch")

    service = MLStudioService(repository, resolver, verify_artifact)
    current_app.extensions["ml_studio_service"] = service
    return service


def _error_response(error: MLStudioServiceError):
    return jsonify({"error": error.to_dict()}), error.status_code


def _unexpected_error():
    return jsonify({
        "error": {
            "code": "ml_studio_internal_error",
            "message": "ML Studio could not complete the request.",
            "remediation": "Retry the request or inspect server health.",
        }
    }), 500


@ml_studio_bp.route("/snapshots", methods=["POST"])
def create_snapshot():
    try:
        return jsonify({"snapshot": get_ml_studio_service().create_snapshot(request.get_json(silent=True))}), 201
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
        return jsonify({"runs": get_ml_studio_service().list_runs(limit=request.args.get("limit", 100))}), 200
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
