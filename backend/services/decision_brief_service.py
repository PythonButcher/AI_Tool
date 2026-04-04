from __future__ import annotations

from typing import Any, Dict, List

from backend.services.decision_signal_service import generate_decision_signals
from backend.services.decision_support import (
    build_metric_ref,
    build_semantic_summary,
    build_time_context,
    derive_themes,
    iso_timestamp,
    latest_metric_change,
    make_identifier,
    normalize_filters,
    normalize_reference_list,
    resolve_decision_context,
    resolve_metric_result,
    select_metrics,
)


def _build_key_metrics(context: Dict[str, Any], metrics: List[Dict[str, Any]], filters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    key_metrics = []
    for metric in metrics[:3]:
        metric_ref = build_metric_ref(metric)
        result = resolve_metric_result(context, metric, filters=filters)
        change = latest_metric_change(context, metric, filters=filters)

        key_metrics.append(
            {
                "metric_ref": metric_ref,
                "current_value": result.get("summary", {}).get("value"),
                "previous_value": change.get("previous_value") if change else None,
                "delta_value": change.get("delta_value") if change else None,
                "delta_pct": change.get("delta_pct") if change else None,
                "status": "changed" if change else "baseline_only",
            }
        )
    return key_metrics


def _first_metric_change(context: Dict[str, Any], metrics: List[Dict[str, Any]], filters: List[Dict[str, Any]]):
    for metric in metrics:
        change = latest_metric_change(context, metric, filters=filters)
        if change is not None:
            return change
    return None


def generate_decision_brief(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = payload if isinstance(payload, dict) else {}
    context = resolve_decision_context(
        dataset=payload.get("dataset"),
        dataset_ref=payload.get("dataset_ref") or payload.get("datasetRef"),
        semantic_model=payload.get("semantic_model") or payload.get("semanticModel"),
        source="decision_brief",
    )
    filters = normalize_filters(payload)
    metric_ids = normalize_reference_list(payload, "metric_ids", "metricIds")
    metric_names = normalize_reference_list(payload, "metric_names", "metricNames")

    signal_response = generate_decision_signals(payload)
    signals = signal_response["signals"]
    selected_metrics = select_metrics(context, metric_ids=metric_ids, metric_names=metric_names, max_metrics=3)
    key_metrics = _build_key_metrics(context, selected_metrics, filters)
    primary_change = _first_metric_change(context, selected_metrics, filters)
    generated_at = iso_timestamp()

    if context["dataframe"].empty:
        summary = "The resolved dataset is empty, so no decision brief highlights could be generated yet."
    elif signals:
        summary = (
            f"{len(signals)} actionable signals were detected across tracked metrics. "
            f"{signals[0]['title']} is the leading headline for this dataset slice."
        )
    else:
        summary = "No material decision signals were detected in the current dataset slice."

    brief = {
        "brief_id": make_identifier("brief", context["dataset"]["dataset_name"], generated_at),
        "title": f"Decision brief for {context['dataset']['dataset_name']}",
        "summary": summary,
        "dataset": context["dataset"],
        "time_context": build_time_context(primary_change, context.get("time_dimension")),
        "headline_signal_ids": [signal["signal_id"] for signal in signals[:3]],
        "key_metrics": key_metrics,
        "themes": derive_themes(signals),
        "confidence": 0.8 if signals else 0.6,
        "generated_at": generated_at,
    }

    return {
        "status": "success",
        "request": {
            "metric_ids": metric_ids,
            "metric_names": metric_names,
            "filters": filters,
        },
        "dataset": context["dataset"],
        "semantic_model": build_semantic_summary(context["semantic_model"]),
        "brief": brief,
        "supporting_signals": signals,
        "meta": {
            "headline_signal_count": len(brief["headline_signal_ids"]),
            "key_metric_count": len(key_metrics),
            "empty_dataset": context["dataframe"].empty,
            "generated_at": generated_at,
        },
        "warnings": signal_response.get("warnings", []),
    }
