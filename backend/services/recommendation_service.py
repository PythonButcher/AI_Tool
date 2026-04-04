from __future__ import annotations

from typing import Any, Dict

from backend.services.decision_signal_service import generate_decision_signals
from backend.services.decision_support import (
    build_dimension_ref,
    build_semantic_summary,
    iso_timestamp,
    list_candidate_dimensions,
    make_identifier,
    normalize_positive_int,
    resolve_decision_context,
    rounded,
)


def _priority_from_severity(severity: str) -> str:
    if severity in {"critical", "high"}:
        return "high"
    if severity == "medium":
        return "medium"
    return "low"


def _recommendation_from_signal(context: Dict[str, Any], signal: Dict[str, Any]) -> Dict[str, Any]:
    created_at = iso_timestamp()
    signal_type = signal.get("signal_type")
    metric_ref = signal.get("metric_ref")
    dimension_ref = signal.get("dimension_ref")
    fallback_dimension = None
    candidate_dimensions = list_candidate_dimensions(context, max_dimensions=1)
    if candidate_dimensions:
        fallback_dimension = build_dimension_ref(candidate_dimensions[0])
    resolved_dimension_ref = dimension_ref or fallback_dimension

    if signal_type == "metric_delta":
        title = f"Investigate the latest {metric_ref['label']} shift"
        recommendation_type = "investigate"
        actions = [
            {
                "action_type": "break_down_metric",
                "label": f"Break {metric_ref['label']} down by {resolved_dimension_ref['label']}" if resolved_dimension_ref else f"Review {metric_ref['label']}",
                "description": "Use a simple metric + group by breakdown to isolate the change driver.",
                "payload": {
                    "metric_id": metric_ref["metric_id"],
                    "group_by": [resolved_dimension_ref["field"]] if resolved_dimension_ref else [],
                },
            }
        ]
        expected_outcome = "Identify the segment responsible for the latest change."
    elif signal_type == "anomaly_rate":
        title = "Review anomalous rows before acting"
        recommendation_type = "investigate"
        actions = [
            {
                "action_type": "review_anomalies",
                "label": "Inspect anomalous records",
                "description": "Validate whether the anomaly cluster reflects bad data or a true operating change.",
                "payload": {
                    "signal_id": signal["signal_id"],
                    "scan_kind": "dataset_anomaly_scan",
                },
            }
        ]
        expected_outcome = "Separate data quality issues from real operational changes."
    elif signal_type == "dimension_concentration":
        title = f"Monitor concentration in {dimension_ref['label']}"
        recommendation_type = "monitor"
        actions = [
            {
                "action_type": "monitor_dimension_share",
                "label": f"Track {dimension_ref['label']} share over time",
                "description": "Watch whether the dominant segment continues to grow or normalize.",
                "payload": {
                    "dimension": dimension_ref["field"],
                    "signal_id": signal["signal_id"],
                },
            }
        ]
        expected_outcome = "Reduce concentration risk and understand whether it is structural or temporary."
    else:
        title = "Audit the affected field before relying on it"
        recommendation_type = "validate"
        field_name = signal.get("evidence", {}).get("field")
        actions = [
            {
                "action_type": "audit_field_quality",
                "label": f"Audit {field_name}",
                "description": "Check ingestion, cleaning, and null handling for the affected field.",
                "payload": {
                    "field": field_name,
                    "signal_id": signal["signal_id"],
                },
            }
        ]
        expected_outcome = "Improve data reliability before downstream decisions use the field."

    return {
        "recommendation_id": make_identifier("recommendation", recommendation_type, signal.get("signal_id"), created_at),
        "recommendation_type": recommendation_type,
        "priority": _priority_from_severity(signal.get("severity")),
        "status": "proposed",
        "title": title,
        "summary": signal.get("summary"),
        "dataset": context["dataset"],
        "based_on_signal_ids": [signal["signal_id"]],
        "metric_ref": metric_ref,
        "dimension_ref": dimension_ref or resolved_dimension_ref,
        "actions": actions,
        "expected_outcome": expected_outcome,
        "confidence": rounded(signal.get("confidence") or 0.6),
        "created_at": created_at,
    }


def generate_recommendations(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = payload if isinstance(payload, dict) else {}
    context = resolve_decision_context(
        dataset=payload.get("dataset"),
        dataset_ref=payload.get("dataset_ref") or payload.get("datasetRef"),
        semantic_model=payload.get("semantic_model") or payload.get("semanticModel"),
        source="recommendations",
    )
    max_recommendations = normalize_positive_int(
        payload.get("max_recommendations") or payload.get("maxRecommendations"),
        5,
        "max_recommendations",
    )

    signal_response = generate_decision_signals(payload)
    signals = signal_response["signals"][:max_recommendations]
    recommendations = [_recommendation_from_signal(context, signal) for signal in signals]

    return {
        "status": "success",
        "request": {
            "max_recommendations": max_recommendations,
            "filters": signal_response["request"]["filters"],
            "metric_ids": signal_response["request"]["metric_ids"],
            "metric_names": signal_response["request"]["metric_names"],
        },
        "dataset": context["dataset"],
        "semantic_model": build_semantic_summary(context["semantic_model"]),
        "recommendations": recommendations,
        "supporting_signals": signals,
        "meta": {
            "recommendation_count": len(recommendations),
            "empty_dataset": context["dataframe"].empty,
            "generated_at": iso_timestamp(),
        },
        "warnings": signal_response.get("warnings", []),
    }
