from __future__ import annotations

from typing import Any, Dict, List

from backend.services.decision_support import (
    build_dimension_ref,
    build_metric_ref,
    build_semantic_summary,
    build_time_context,
    iso_timestamp,
    latest_metric_change,
    list_candidate_dimensions,
    make_identifier,
    normalize_bool,
    normalize_filters,
    normalize_positive_int,
    normalize_reference_list,
    resolve_decision_context,
    rounded,
    safe_float,
    select_metrics,
    serialize_value,
)
from backend.services.ml_logic import detect_anomalies


def _severity_from_ratio(value: float) -> str:
    absolute_value = abs(value)
    if absolute_value >= 0.75:
        return "high"
    if absolute_value >= 0.25:
        return "medium"
    return "low"


def _confidence_from_row_count(row_count: int) -> float:
    if row_count >= 500:
        return 0.88
    if row_count >= 100:
        return 0.78
    if row_count >= 20:
        return 0.68
    return 0.55


def _build_signal(
    signal_type: str,
    title: str,
    summary: str,
    severity: str,
    direction: str,
    dataset: Dict[str, Any],
    evidence: Dict[str, Any],
    confidence: float,
    importance_score: float,
    metric_ref: Dict[str, Any] | None = None,
    dimension_ref: Dict[str, Any] | None = None,
    time_context: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    created_at = iso_timestamp()
    if metric_ref and metric_ref.get("metric_id"):
        reference_key = metric_ref["metric_id"]
    elif dimension_ref and dimension_ref.get("dimension_id"):
        reference_key = dimension_ref["dimension_id"]
    else:
        reference_key = dataset.get("dataset_name")

    return {
        "signal_id": make_identifier("signal", signal_type, reference_key, created_at),
        "signal_type": signal_type,
        "title": title,
        "summary": summary,
        "severity": severity,
        "status": "active",
        "direction": direction,
        "dataset": dataset,
        "metric_ref": metric_ref,
        "dimension_ref": dimension_ref,
        "time_context": time_context,
        "evidence": evidence,
        "confidence": rounded(confidence),
        "importance_score": rounded(importance_score, 2),
        "created_at": created_at,
    }


def _build_metric_delta_signals(context: Dict[str, Any], metrics: List[Dict[str, Any]], filters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    signals = []
    for metric in metrics:
        change = latest_metric_change(context, metric, filters=filters)
        if change is None:
            continue

        delta_pct = change.get("delta_pct")
        delta_value = change.get("delta_value")
        if delta_pct is None and not delta_value:
            continue
        if delta_pct is not None and abs(delta_pct) < 0.1:
            continue

        direction = "up" if (delta_value or 0) > 0 else "down"
        severity = _severity_from_ratio(delta_pct if delta_pct is not None else 0.25)
        importance_score = min(100.0, (abs(delta_pct or 0.0) * 100.0) + 45.0)
        metric_ref = build_metric_ref(metric)
        time_context = build_time_context(change, context.get("time_dimension"))
        current_value = change["current_value"]
        previous_value = change["previous_value"]
        percentage_text = f"{abs((delta_pct or 0.0) * 100):.1f}%" if delta_pct is not None else "from a zero baseline"

        title = f"{metric_ref['label']} {'increased' if direction == 'up' else 'decreased'} in the latest observed period"
        summary = (
            f"{metric_ref['label']} moved from {previous_value} to {current_value} "
            f"({percentage_text}) between the two latest observed time values."
        )

        signals.append(
            _build_signal(
                signal_type="metric_delta",
                title=title,
                summary=summary,
                severity=severity,
                direction=direction,
                dataset=context["dataset"],
                metric_ref=metric_ref,
                dimension_ref=None,
                time_context=time_context,
                evidence={
                    "kind": "metric_comparison",
                    "current_value": current_value,
                    "previous_value": previous_value,
                    "delta_value": delta_value,
                    "delta_pct": delta_pct,
                    "row_count": change["row_count"],
                    "chart_hint": {
                        "metric_id": metric_ref["metric_id"],
                        "group_by": [context["time_dimension"]["field"]] if context.get("time_dimension") else [],
                    },
                },
                confidence=_confidence_from_row_count(change["row_count"]),
                importance_score=importance_score,
            )
        )
    return signals


def _build_concentration_signals(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    dataframe = context["dataframe"]
    signals = []
    for dimension in list_candidate_dimensions(context):
        series = dataframe[dimension["field"]].dropna()
        if series.empty:
            continue
        counts = series.value_counts(dropna=False)
        top_count = int(counts.iloc[0])
        top_share = top_count / float(len(series.index))
        if top_share < 0.6:
            continue

        top_value = serialize_value(counts.index[0])
        severity = "high" if top_share >= 0.85 else "medium" if top_share >= 0.7 else "low"
        signals.append(
            _build_signal(
                signal_type="dimension_concentration",
                title=f"{dimension.get('label') or dimension['field']} is concentrated in a single value",
                summary=(
                    f"{top_value} accounts for {top_share:.1%} of non-null rows in "
                    f"{dimension.get('label') or dimension['field']}."
                ),
                severity=severity,
                direction="mixed",
                dataset=context["dataset"],
                metric_ref=None,
                dimension_ref=build_dimension_ref(dimension),
                time_context=None,
                evidence={
                    "kind": "dimension_distribution",
                    "top_value": top_value,
                    "top_count": top_count,
                    "top_share": rounded(top_share),
                    "distinct_count": int(series.nunique(dropna=True)),
                    "row_count": int(len(series.index)),
                },
                confidence=_confidence_from_row_count(int(len(series.index))),
                importance_score=min(100.0, (top_share * 100.0) + 10.0),
            )
        )
        if len(signals) >= 2:
            break
    return signals


def _build_data_quality_signals(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    profile_candidates = []
    for profile in context.get("field_profiles", []):
        if not isinstance(profile, dict):
            continue
        null_rate = safe_float(profile.get("null_rate"))
        if null_rate is None or null_rate < 0.25:
            continue
        profile_candidates.append(profile)

    profile_candidates.sort(key=lambda item: item.get("null_rate") or 0, reverse=True)
    signals = []
    for profile in profile_candidates[:2]:
        null_rate = float(profile["null_rate"])
        field_name = str(profile.get("field") or profile.get("name"))
        severity = "high" if null_rate >= 0.5 else "medium"
        signals.append(
            _build_signal(
                signal_type="data_quality",
                title=f"{field_name} has elevated missingness",
                summary=f"{field_name} is null in {null_rate:.1%} of rows and may affect downstream decisions.",
                severity=severity,
                direction="unknown",
                dataset=context["dataset"],
                metric_ref=None,
                dimension_ref=None,
                time_context=None,
                evidence={
                    "kind": "field_null_rate",
                    "field": field_name,
                    "null_count": int(profile.get("null_count") or 0),
                    "null_rate": rounded(null_rate),
                    "row_count": int(context["dataset"]["row_count"]),
                },
                confidence=0.9,
                importance_score=min(100.0, (null_rate * 100.0) + 20.0),
            )
        )
    return signals


def _build_anomaly_signal(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    dataframe = context["dataframe"]
    numeric_columns = dataframe.select_dtypes(include="number").columns.tolist()
    if dataframe.empty or not numeric_columns:
        return []

    try:
        anomaly_indices = detect_anomalies(dataframe)
    except ValueError:
        return []

    anomaly_count = len(anomaly_indices)
    if anomaly_count == 0:
        return []

    row_count = int(len(dataframe.index))
    anomaly_rate = anomaly_count / float(row_count) if row_count else 0.0
    severity = "high" if anomaly_rate >= 0.1 else "medium" if anomaly_rate >= 0.03 else "low"

    signal = _build_signal(
        signal_type="anomaly_rate",
        title=f"Detected {anomaly_count} anomalous rows",
        summary=f"{anomaly_count} of {row_count} rows ({anomaly_rate:.1%}) look atypical across numeric fields.",
        severity=severity,
        direction="mixed",
        dataset=context["dataset"],
        metric_ref=None,
        dimension_ref=None,
        time_context=None,
        evidence={
            "kind": "dataset_anomaly_scan",
            "anomaly_count": anomaly_count,
            "anomaly_rate": rounded(anomaly_rate),
            "numeric_field_count": len(numeric_columns),
            "row_count": row_count,
        },
        confidence=_confidence_from_row_count(row_count),
        importance_score=min(100.0, (anomaly_rate * 100.0) + 30.0),
    )
    return [signal]


def generate_decision_signals(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = payload if isinstance(payload, dict) else {}
    context = resolve_decision_context(
        dataset=payload.get("dataset"),
        dataset_ref=payload.get("dataset_ref") or payload.get("datasetRef"),
        semantic_model=payload.get("semantic_model") or payload.get("semanticModel"),
        source="decision_signals",
    )

    filters = normalize_filters(payload)
    metric_ids = normalize_reference_list(payload, "metric_ids", "metricIds")
    metric_names = normalize_reference_list(payload, "metric_names", "metricNames")
    max_signals = normalize_positive_int(payload.get("max_signals") or payload.get("maxSignals"), 10, "max_signals")
    include_anomaly_detection = normalize_bool(
        payload.get("include_anomaly_detection", payload.get("includeAnomalyDetection")),
        default=True,
    )
    selected_metrics = select_metrics(context, metric_ids=metric_ids, metric_names=metric_names, max_metrics=max_signals)

    warnings = []
    signals = []
    if context["dataframe"].empty:
        warnings.append("The resolved dataset is empty. No decision signals were generated.")
    else:
        signals.extend(_build_metric_delta_signals(context, selected_metrics, filters))
        signals.extend(_build_concentration_signals(context))
        signals.extend(_build_data_quality_signals(context))
        if include_anomaly_detection:
            signals.extend(_build_anomaly_signal(context))

    signals = sorted(signals, key=lambda item: item.get("importance_score") or 0, reverse=True)[:max_signals]
    return {
        "status": "success",
        "request": {
            "metric_ids": metric_ids,
            "metric_names": metric_names,
            "filters": filters,
            "max_signals": max_signals,
            "include_anomaly_detection": include_anomaly_detection,
        },
        "dataset": context["dataset"],
        "semantic_model": build_semantic_summary(context["semantic_model"]),
        "signals": signals,
        "meta": {
            "signal_count": len(signals),
            "tracked_metric_count": len(selected_metrics),
            "empty_dataset": context["dataframe"].empty,
            "generated_at": iso_timestamp(),
        },
        "warnings": warnings,
    }
