from __future__ import annotations

from typing import Any, Dict

from backend.services.decision_signal_service import generate_decision_signals
from backend.services.decision_support import (
    build_dimension_ref,
    build_metric_ref,
    build_semantic_summary,
    iso_timestamp,
    make_identifier,
    normalize_positive_int,
    resolve_decision_context,
    rounded,
    select_breakdown_dimensions,
    select_metrics,
)


PRIORITY_RANK = {
    "low": 1,
    "medium": 2,
    "high": 3,
}


def _priority_from_signal(signal: Dict[str, Any]) -> str:
    severity = signal.get("severity")
    importance_score = float(signal.get("importance_score") or 0.0)
    if severity in {"critical", "high"} or importance_score >= 80:
        return "high"
    if severity == "medium" or importance_score >= 55:
        return "medium"
    return "low"


def _chart_action(
    action_type: str,
    label: str,
    description: str,
    metric_ref: Dict[str, Any] | None,
    group_by: list[str],
    extra_payload: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    payload = {
        "metric_id": metric_ref.get("metric_id") if isinstance(metric_ref, dict) else None,
        "group_by": group_by,
    }
    if isinstance(extra_payload, dict):
        payload.update(extra_payload)
    return {
        "action_type": action_type,
        "label": label,
        "description": description,
        "payload": payload,
    }


def _resolve_reference_metric(
    context: Dict[str, Any],
    signal: Dict[str, Any],
    selected_metrics: list[Dict[str, Any]],
) -> Dict[str, Any] | None:
    signal_metric_ref = signal.get("metric_ref") if isinstance(signal.get("metric_ref"), dict) else None
    if signal_metric_ref:
        signal_metric_id = signal_metric_ref.get("metric_id")
        if signal_metric_id:
            match = next(
                (
                    metric
                    for metric in selected_metrics
                    if (metric.get("id") or metric.get("metric_id")) == signal_metric_id
                ),
                None,
            )
            if match is not None:
                return match

    if selected_metrics:
        return selected_metrics[0]

    fallback_metrics = select_metrics(context, max_metrics=1)
    return fallback_metrics[0] if fallback_metrics else None


def _build_time_action(metric_ref: Dict[str, Any] | None, time_dimension: Dict[str, Any] | None) -> Dict[str, Any] | None:
    if not metric_ref or not isinstance(time_dimension, dict) or not time_dimension.get("field"):
        return None
    return _chart_action(
        action_type="compare_metric_over_time",
        label=f"Review {metric_ref['label']} over time",
        description="Use the existing metric + group by chart flow to confirm whether the pattern is persistent or recent.",
        metric_ref=metric_ref,
        group_by=[time_dimension["field"]],
    )


def _recommendation_from_signal(context: Dict[str, Any], signal: Dict[str, Any], selected_metrics: list[Dict[str, Any]]) -> Dict[str, Any]:
    created_at = iso_timestamp()
    signal_type = signal.get("signal_type")
    signal_payload = {"signal_id": signal["signal_id"]}
    metric = _resolve_reference_metric(context, signal, selected_metrics)
    metric_ref = signal.get("metric_ref") if isinstance(signal.get("metric_ref"), dict) else build_metric_ref(metric)
    dimension_ref = signal.get("dimension_ref")
    evidence = signal.get("evidence") if isinstance(signal.get("evidence"), dict) else {}
    time_dimension = context.get("time_dimension") if isinstance(context.get("time_dimension"), dict) else None
    breakdown_dimensions = select_breakdown_dimensions(
        context,
        metric=metric,
        max_dimensions=2,
        exclude_fields=[(dimension_ref or {}).get("field")] if isinstance(dimension_ref, dict) else None,
    )
    fallback_dimension = build_dimension_ref(breakdown_dimensions[0]) if breakdown_dimensions else None
    secondary_dimension = build_dimension_ref(breakdown_dimensions[1]) if len(breakdown_dimensions) > 1 else None
    resolved_dimension_ref = dimension_ref or fallback_dimension

    if signal_type == "metric_delta":
        direction = signal.get("direction")
        recommendation_type = "optimize" if direction == "up" else "investigate"
        title = (
            f"Break down the {metric_ref['label']} increase"
            if direction == "up"
            else f"Break down the {metric_ref['label']} decline"
        )
        actions = []
        if resolved_dimension_ref:
            actions.append(
                _chart_action(
                    action_type="break_down_metric",
                    label=f"Break {metric_ref['label']} down by {resolved_dimension_ref['label']}",
                    description="Use the current chart workflow to isolate which segment drove the shift.",
                    metric_ref=metric_ref,
                    group_by=[resolved_dimension_ref["field"]],
                    extra_payload=signal_payload,
                )
            )
        time_action = _build_time_action(metric_ref, time_dimension)
        if time_action:
            time_action["payload"].update(signal_payload)
            actions.append(time_action)
        if secondary_dimension:
            actions.append(
                _chart_action(
                    action_type="compare_segments",
                    label=f"Compare {metric_ref['label']} by {secondary_dimension['label']}",
                    description="Use a second simple breakdown if the first segmentation does not isolate the driver cleanly.",
                    metric_ref=metric_ref,
                    group_by=[secondary_dimension["field"]],
                    extra_payload=signal_payload,
                )
            )
        expected_outcome = (
            "Identify which business segment is sustaining the increase."
            if direction == "up"
            else "Identify which business segment is responsible for the decline."
        )
        breakdown_suffix = f" by {resolved_dimension_ref['label']}" if resolved_dimension_ref else ""
        summary = (
            f"{signal.get('summary')} Start with a simple breakdown"
            f"{breakdown_suffix} to find the driver."
        )
    elif signal_type == "anomaly_rate":
        title = "Isolate where anomalous behavior is clustering"
        recommendation_type = "investigate"
        actions = []
        if resolved_dimension_ref and metric_ref:
            actions.append(
                _chart_action(
                    action_type="break_down_metric",
                    label=f"Break {metric_ref['label']} down by {resolved_dimension_ref['label']}",
                    description="Use a simple metric + group by view to see whether anomalies cluster in one segment.",
                    metric_ref=metric_ref,
                    group_by=[resolved_dimension_ref["field"]],
                    extra_payload=signal_payload,
                )
            )
        time_action = _build_time_action(metric_ref, time_dimension)
        if time_action:
            time_action["payload"].update(signal_payload)
            actions.append(time_action)
        expected_outcome = "Separate data quality issues from real operational changes."
        summary = (
            f"{signal.get('summary')} Use one segmentation view and one time view before deciding whether to treat this as noise or a real business shift."
        )
    elif signal_type == "dimension_concentration":
        target_dimension_ref = dimension_ref or resolved_dimension_ref or {"label": "the dominant segment", "field": None}
        title = f"Quantify concentration in {target_dimension_ref['label']}"
        recommendation_type = "monitor"
        actions = []
        if metric_ref and target_dimension_ref.get("field"):
            actions.append(
                _chart_action(
                    action_type="break_down_metric",
                    label=f"Break {metric_ref['label']} down by {target_dimension_ref['label']}",
                    description="Use the simplest segmentation view to size the dependence on the dominant segment.",
                    metric_ref=metric_ref,
                    group_by=[target_dimension_ref["field"]],
                    extra_payload=signal_payload,
                )
            )
        time_action = _build_time_action(metric_ref, time_dimension)
        if time_action:
            time_action["payload"].update(signal_payload)
            actions.append(time_action)
        expected_outcome = "Reduce concentration risk and understand whether it is structural or temporary."
        summary = (
            f"{signal.get('summary')} Measure how much of {metric_ref['label'] if metric_ref else 'performance'} depends on this segment before deciding whether to diversify or monitor."
        )
    else:
        title = "Validate the affected field before relying on it"
        recommendation_type = "validate"
        field_name = evidence.get("field")
        actions = []
        if metric_ref and field_name:
            actions.append(
                _chart_action(
                    action_type="break_down_metric",
                    label=f"Break {metric_ref['label']} down by {field_name}",
                    description="Use a quick chart to see whether missingness aligns to a specific segment or shows up broadly.",
                    metric_ref=metric_ref,
                    group_by=[field_name],
                    extra_payload=signal_payload,
                )
            )
        time_action = _build_time_action(metric_ref, time_dimension)
        if time_action:
            time_action["payload"].update(signal_payload)
            actions.append(time_action)
        expected_outcome = "Improve data reliability before downstream decisions use the field."
        summary = (
            f"{signal.get('summary')} Check whether the issue is concentrated in one segment or recent periods before trusting downstream comparisons."
        )

    if not actions and metric_ref:
        actions.append(
            _chart_action(
                action_type="review_metric",
                label=f"Review {metric_ref['label']}",
                description="Fallback chart action using the existing metric workflow.",
                metric_ref=metric_ref,
                group_by=[],
                extra_payload=signal_payload,
            )
        )

    return {
        "recommendation_id": make_identifier("recommendation", recommendation_type, signal.get("signal_id"), created_at),
        "recommendation_type": recommendation_type,
        "priority": _priority_from_signal(signal),
        "status": "proposed",
        "title": title,
        "summary": summary,
        "dataset": context["dataset"],
        "based_on_signal_ids": [signal["signal_id"]],
        "metric_ref": metric_ref,
        "dimension_ref": dimension_ref or resolved_dimension_ref,
        "actions": actions,
        "expected_outcome": expected_outcome,
        "confidence": rounded(signal.get("confidence") or 0.6),
        "created_at": created_at,
    }


def _action_signature(action: Dict[str, Any]) -> tuple:
    payload = action.get("payload") if isinstance(action.get("payload"), dict) else {}
    group_by = payload.get("group_by")
    if not isinstance(group_by, list):
        group_by = []
    return (
        action.get("action_type"),
        payload.get("metric_id"),
        tuple(str(item) for item in group_by),
    )


def _dedupe_actions(actions: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    deduped = {}
    for action in actions:
        signature = _action_signature(action)
        if signature not in deduped:
            deduped[signature] = action
    return list(deduped.values())


def _recommendation_rank(recommendation: Dict[str, Any]) -> tuple:
    return (
        PRIORITY_RANK.get(recommendation.get("priority"), 0),
        recommendation.get("confidence") or 0,
        len(recommendation.get("based_on_signal_ids") or []),
    )


def _recommendation_signature(recommendation: Dict[str, Any]) -> tuple:
    metric_ref = recommendation.get("metric_ref") if isinstance(recommendation.get("metric_ref"), dict) else {}
    dimension_ref = recommendation.get("dimension_ref") if isinstance(recommendation.get("dimension_ref"), dict) else {}
    action_signatures = tuple(_action_signature(action) for action in recommendation.get("actions") or [])
    return (
        recommendation.get("recommendation_type"),
        metric_ref.get("metric_id"),
        dimension_ref.get("dimension_id") or dimension_ref.get("field"),
        action_signatures,
    )


def _dedupe_recommendations(recommendations: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    deduped: Dict[tuple, Dict[str, Any]] = {}
    for recommendation in recommendations:
        recommendation["actions"] = _dedupe_actions(list(recommendation.get("actions") or []))
        signature = _recommendation_signature(recommendation)
        existing = deduped.get(signature)
        if existing is None:
            deduped[signature] = recommendation
            continue

        merged_signal_ids = []
        for signal_id in [*(existing.get("based_on_signal_ids") or []), *(recommendation.get("based_on_signal_ids") or [])]:
            if signal_id and signal_id not in merged_signal_ids:
                merged_signal_ids.append(signal_id)

        winning = recommendation if _recommendation_rank(recommendation) > _recommendation_rank(existing) else existing
        merged = dict(winning)
        merged["based_on_signal_ids"] = merged_signal_ids
        deduped[signature] = merged

    return sorted(deduped.values(), key=_recommendation_rank, reverse=True)


def build_recommendation_artifacts(
    context: Dict[str, Any],
    signals: list[Dict[str, Any]],
    selected_metrics: list[Dict[str, Any]],
    max_recommendations: int,
    generated_at: str | None = None,
) -> Dict[str, Any]:
    ordered_signals = sorted(
        list(signals or []),
        key=lambda signal: (
            signal.get("importance_score") or 0,
            PRIORITY_RANK.get(_priority_from_signal(signal), 0),
            signal.get("confidence") or 0,
        ),
        reverse=True,
    )
    raw_recommendations = [
        _recommendation_from_signal(context, signal, selected_metrics)
        for signal in ordered_signals
    ]
    recommendations = _dedupe_recommendations(raw_recommendations)[:max_recommendations]
    supporting_signal_ids = {
        signal_id
        for recommendation in recommendations
        for signal_id in recommendation.get("based_on_signal_ids") or []
    }
    supporting_signals = [
        signal
        for signal in ordered_signals
        if signal.get("signal_id") in supporting_signal_ids
    ]
    resolved_generated_at = generated_at or iso_timestamp()
    return {
        "recommendations": recommendations,
        "supporting_signals": supporting_signals,
        "meta": {
            "recommendation_count": len(recommendations),
            "empty_dataset": context["dataframe"].empty,
            "generated_at": resolved_generated_at,
        },
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
    selected_metrics = select_metrics(
        context,
        metric_ids=signal_response["request"]["metric_ids"],
        metric_names=signal_response["request"]["metric_names"],
        max_metrics=max_recommendations,
    ) if not context["dataframe"].empty else []
    recommendation_artifacts = build_recommendation_artifacts(
        context=context,
        signals=signal_response["signals"],
        selected_metrics=selected_metrics,
        max_recommendations=max_recommendations,
    )

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
        "recommendations": recommendation_artifacts["recommendations"],
        "supporting_signals": recommendation_artifacts["supporting_signals"],
        "meta": recommendation_artifacts["meta"],
        "warnings": signal_response.get("warnings", []),
    }
