from flask import Blueprint, jsonify, request

from backend.services.metric_resolver import MetricResolutionError, MetricResolver


semantic_metrics_bp = Blueprint("semantic_metrics_bp", __name__, url_prefix="/api/semantic-metrics")


@semantic_metrics_bp.route("/resolve", methods=["POST"])
def resolve_semantic_metric():
    payload = request.get_json(silent=True) or {}

    try:
        result = MetricResolver.resolve(
            metric=payload.get("metric"),
            metric_id=payload.get("metric_id") or payload.get("metricId"),
            metric_name=payload.get("metric_name") or payload.get("metricName"),
            dataset=payload.get("dataset"),
            dataset_ref=payload.get("dataset_ref") or payload.get("datasetRef"),
            semantic_model=payload.get("semantic_model") or payload.get("semanticModel"),
            group_by=payload.get("group_by") or payload.get("groupBy") or [],
            filters=payload.get("filters") or [],
            limit=payload.get("limit"),
            sort=payload.get("sort"),
        )
        return jsonify(result), 200
    except MetricResolutionError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Failed to resolve semantic metric: {exc}"}), 500
