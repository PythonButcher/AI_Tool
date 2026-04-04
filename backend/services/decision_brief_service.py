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


def _signal_rank(signal: Dict[str, Any]) -> tuple:
    severity_rank = {
        "low": 1,
        "medium": 2,
        "high": 3,
        "critical": 4,
    }
    return (
        signal.get("importance_score") or 0,
        severity_rank.get(signal.get("severity"), 0),
        signal.get("confidence") or 0,
    )


def _pick_relevant_metrics(signals: List[Dict[str, Any]], metrics: List[Dict[str, Any]], limit: int = 4) -> List[Dict[str, Any]]:
    selected = []
    seen_metric_ids = set()

    signal_metric_ids = [
        (signal.get("metric_ref") or {}).get("metric_id")
        for signal in sorted(signals, key=_signal_rank, reverse=True)
        if isinstance(signal.get("metric_ref"), dict)
    ]
    ordered_metric_ids = [metric_id for metric_id in signal_metric_ids if metric_id]

    for metric_id in ordered_metric_ids:
        metric = next((candidate for candidate in metrics if (candidate.get("id") or candidate.get("metric_id")) == metric_id), None)
        if metric is None:
            continue
        seen_metric_ids.add(metric_id)
        selected.append(metric)
        if len(selected) >= limit:
            return selected

    for metric in metrics:
        metric_id = metric.get("id") or metric.get("metric_id")
        if metric_id in seen_metric_ids:
            continue
        selected.append(metric)
        if len(selected) >= limit:
            break
    return selected


def _build_key_metrics(context: Dict[str, Any], metrics: List[Dict[str, Any]], filters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    key_metrics = []
    for metric in metrics:
        metric_ref = build_metric_ref(metric)
        result = resolve_metric_result(context, metric, filters=filters)
        change = latest_metric_change(context, metric, filters=filters)
        delta_pct = change.get("delta_pct") if change else None
        status = "baseline_only"
        if change:
            status = "steady" if delta_pct is not None and abs(delta_pct) < 0.03 else "changed"

        key_metrics.append(
            {
                "metric_ref": metric_ref,
                "current_value": result.get("summary", {}).get("value"),
                "previous_value": change.get("previous_value") if change else None,
                "delta_value": change.get("delta_value") if change else None,
                "delta_pct": delta_pct,
                "status": status,
            }
        )
    return key_metrics


def _first_metric_change(context: Dict[str, Any], metrics: List[Dict[str, Any]], filters: List[Dict[str, Any]]):
    for metric in metrics:
        change = latest_metric_change(context, metric, filters=filters)
        if change is not None:
            return change
    return None


def _build_brief_summary(context: Dict[str, Any], signals: List[Dict[str, Any]], themes: List[str]) -> str:
    if context["dataframe"].empty:
        return "The resolved dataset is empty, so no decision brief highlights could be generated yet."
    if not signals:
        return "No material decision signals were detected in the current dataset slice."

    top_signal = signals[0]
    high_priority_count = len([signal for signal in signals if signal.get("severity") in {"high", "critical"}])
    theme_text = ", ".join(themes[:2]) if themes else "decision monitoring"

    if high_priority_count:
        return (
            f"{top_signal['title']}. {high_priority_count} high-priority signal"
            f"{'s were' if high_priority_count != 1 else ' was'} surfaced in this slice, with themes centered on {theme_text}."
        )
    return (
        f"{top_signal['title']}. {len(signals)} signals were surfaced for this slice, led by {theme_text}."
    )


def _brief_confidence(signals: List[Dict[str, Any]]) -> float:
    if not signals:
        return 0.6
    top_signals = signals[:3]
    total = sum(float(signal.get("confidence") or 0.0) for signal in top_signals)
    return round(min(0.95, max(0.65, total / float(len(top_signals)))), 4)


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
    signals = sorted(signal_response["signals"], key=_signal_rank, reverse=True)
    selected_metrics = select_metrics(context, metric_ids=metric_ids, metric_names=metric_names, max_metrics=5)
    relevant_metrics = _pick_relevant_metrics(signals, selected_metrics, limit=4)
    key_metrics = _build_key_metrics(context, relevant_metrics, filters)
    primary_change = _first_metric_change(context, relevant_metrics, filters)
    generated_at = iso_timestamp()
    themes = derive_themes(signals)
    summary = _build_brief_summary(context, signals, themes)

    brief = {
        "brief_id": make_identifier("brief", context["dataset"]["dataset_name"], generated_at),
        "title": signals[0]["title"] if signals else f"Decision brief for {context['dataset']['dataset_name']}",
        "summary": summary,
        "dataset": context["dataset"],
        "time_context": signals[0].get("time_context") if signals and signals[0].get("time_context") else build_time_context(primary_change, context.get("time_dimension")),
        "headline_signal_ids": [signal["signal_id"] for signal in signals[:3]],
        "key_metrics": key_metrics,
        "themes": themes,
        "confidence": _brief_confidence(signals),
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
