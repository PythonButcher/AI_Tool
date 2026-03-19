from flask import Blueprint, jsonify, request
import pandas as pd

from backend.db.backend_db import get_dataset_record, update_dataset_semantic_model
from backend.services.dataset_context import resolve_active_dataframe
from backend.services.semantic_model import (
    create_user_defined_metric,
    delete_user_defined_metric,
    finalize_semantic_model,
    infer_semantic_model_from_dataframe,
    list_semantic_metrics,
    normalize_records,
    update_user_defined_metric,
)
from backend.utils.global_state import (
    get_semantic_model,
    set_semantic_model,
)

semantic_model_bp = Blueprint("semantic_model_bp", __name__, url_prefix="/api/semantic-model")


def _persist_semantic_model(semantic_model, dataset_id=None):
    finalized_model = finalize_semantic_model(semantic_model)
    set_semantic_model(finalized_model)

    resolved_dataset_id = dataset_id or finalized_model.get("dataset", {}).get("id")
    if resolved_dataset_id and get_dataset_record(resolved_dataset_id):
        update_dataset_semantic_model(resolved_dataset_id, finalized_model)

    return finalized_model


def _get_or_build_current_model():
    semantic_model = get_semantic_model()
    if isinstance(semantic_model, dict):
        return finalize_semantic_model(semantic_model)

    dataframe = resolve_active_dataframe()
    if dataframe is None or dataframe.empty:
        raise ValueError("No semantic model is available yet.")

    inferred = infer_semantic_model_from_dataframe(dataframe, source="current_inferred")
    return _persist_semantic_model(inferred)


@semantic_model_bp.route("/infer", methods=["POST"])
def infer_semantic_model_route():
    payload = request.get_json(silent=True) or {}
    dataset = payload.get("dataset")
    dataset_name = payload.get("dataset_name")
    dataset_id = payload.get("dataset_id")
    persist_current = payload.get("persist_current", True)
    source = payload.get("source", "inferred")
    preserve_user_metrics = payload.get("preserve_user_metrics", False)
    base_model = payload.get("base_semantic_model") or payload.get("baseSemanticModel")

    if dataset is not None:
        records = normalize_records(dataset)
        if not records:
            return jsonify({"error": "A valid dataset is required to infer a semantic model."}), 400
        dataframe = pd.DataFrame(records)
    else:
        dataframe = resolve_active_dataframe()
        if dataframe is None or dataframe.empty:
            return jsonify({"error": "No dataset is currently available."}), 400

    if base_model is None and preserve_user_metrics:
        base_model = get_semantic_model()

    semantic_model = infer_semantic_model_from_dataframe(
        dataframe,
        dataset_name=dataset_name,
        dataset_id=dataset_id,
        source=source,
        existing_model=base_model if isinstance(base_model, dict) else None,
        preserve_user_metrics=bool(preserve_user_metrics),
    )

    if persist_current:
        semantic_model = _persist_semantic_model(semantic_model, dataset_id=dataset_id)

    return jsonify({"semantic_model": semantic_model}), 200


@semantic_model_bp.route("/current", methods=["GET"])
def get_current_semantic_model_route():
    try:
        semantic_model = _get_or_build_current_model()
        return jsonify({"semantic_model": semantic_model}), 200
    except ValueError:
        return jsonify({"error": "No semantic model is available yet."}), 404


@semantic_model_bp.route("/current", methods=["PUT"])
def set_current_semantic_model_route():
    payload = request.get_json(silent=True) or {}
    semantic_model = payload.get("semantic_model") or payload

    if not isinstance(semantic_model, dict):
        return jsonify({"error": "semantic_model must be a JSON object."}), 400

    finalized_model = _persist_semantic_model(semantic_model)
    return jsonify({"semantic_model": finalized_model, "message": "Semantic model updated."}), 200


@semantic_model_bp.route("/metrics", methods=["GET"])
def list_semantic_metrics_route():
    try:
        semantic_model = _get_or_build_current_model()
    except ValueError:
        return jsonify({"error": "No semantic model is available yet."}), 404

    return jsonify({
        "metrics": list_semantic_metrics(semantic_model),
        "semantic_model": semantic_model,
    }), 200


@semantic_model_bp.route("/metrics", methods=["POST"])
def create_semantic_metric_route():
    payload = request.get_json(silent=True) or {}
    try:
        semantic_model = _get_or_build_current_model()
        dataframe = resolve_active_dataframe()
        existing_ids = {metric.get("id") for metric in semantic_model.get("metrics", [])}
        updated_model = create_user_defined_metric(
            semantic_model=semantic_model,
            payload=payload,
            dataframe=dataframe,
        )
        persisted_model = _persist_semantic_model(updated_model)
        created_metric = next(
            (
                metric
                for metric in persisted_model["metrics"]
                if metric.get("id") not in existing_ids and metric.get("is_user_defined")
            ),
            None,
        )
        return jsonify({
            "message": "Semantic metric created successfully.",
            "metric": created_metric,
            "metrics": persisted_model["metrics"],
            "semantic_model": persisted_model,
        }), 201
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Failed to create semantic metric: {exc}"}), 500


@semantic_model_bp.route("/metrics/<metric_id>", methods=["PUT"])
def update_semantic_metric_route(metric_id):
    payload = request.get_json(silent=True) or {}
    try:
        semantic_model = _get_or_build_current_model()
        dataframe = resolve_active_dataframe()
        updated_model = update_user_defined_metric(
            semantic_model=semantic_model,
            metric_id=metric_id,
            payload=payload,
            dataframe=dataframe,
        )
        persisted_model = _persist_semantic_model(updated_model)
        updated_metric = next((metric for metric in persisted_model["metrics"] if metric.get("id") == metric_id), None)
        return jsonify({
            "message": "Semantic metric updated successfully.",
            "metric": updated_metric,
            "metrics": persisted_model["metrics"],
            "semantic_model": persisted_model,
        }), 200
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Failed to update semantic metric: {exc}"}), 500


@semantic_model_bp.route("/metrics/<metric_id>", methods=["DELETE"])
def delete_semantic_metric_route(metric_id):
    try:
        semantic_model = _get_or_build_current_model()
        updated_model = delete_user_defined_metric(semantic_model, metric_id)
        persisted_model = _persist_semantic_model(updated_model)
        return jsonify({
            "message": "Semantic metric deleted successfully.",
            "metrics": persisted_model["metrics"],
            "semantic_model": persisted_model,
        }), 200
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Failed to delete semantic metric: {exc}"}), 500
