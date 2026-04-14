from __future__ import annotations

from typing import Any, Dict, List

from backend.services.decision_support import (
    build_dimension_profile,
    build_period_context,
    build_dimension_ref,
    build_dimension_semantic_context,
    build_metric_semantic_context,
    build_metric_ref,
    build_semantic_summary,
    build_time_context,
    describe_period_window,
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


SEVERITY_RANK = {
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}


def _metric_change_threshold(metric: Dict[str, Any]) -> float:
    semantic_context = build_metric_semantic_context({"metrics": []}, metric)
    metric_type = semantic_context.get("metric_type")
    if metric_type == "rate":
        return 0.04
    if metric_type == "volume":
        return 0.08
    if metric_type == "total":
        return 0.07
    return 0.1


def _severity_from_metric_change(delta_pct: float | None, metric: Dict[str, Any]) -> str:
    metric_type = build_metric_semantic_context({"metrics": []}, metric).get("metric_type")
    absolute_value = abs(delta_pct or 0.0)
    sensitivity = 1.15 if metric_type == "rate" else 1.0
    adjusted = absolute_value * sensitivity
    if adjusted >= 0.5:
        return "critical"
    if adjusted >= 0.25:
        return "high"
    if adjusted >= 0.1:
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


def _importance_from_components(
    magnitude: float,
    confidence: float,
    business_weight: float,
    severity: str,
    extra_weight: float = 0.0,
) -> float:
    severity_bonus = {
        "low": 0.0,
        "medium": 6.0,
        "high": 12.0,
        "critical": 18.0,
    }.get(severity, 0.0)
    score = (min(1.0, magnitude) * 52.0) + (confidence * 18.0) + (business_weight * 20.0) + severity_bonus + extra_weight
    return min(100.0, score)


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
        threshold = _metric_change_threshold(metric)
        if delta_pct is not None and abs(delta_pct) < threshold:
            continue

        direction = "up" if (delta_value or 0) > 0 else "down"
        confidence = _confidence_from_row_count(change["row_count"])
        metric_ref = build_metric_ref(metric)
        metric_semantics = build_metric_semantic_context(context, metric)
        time_context = build_time_context(change, context.get("time_dimension"))
        period_context = build_period_context(time_context)
        severity = _severity_from_metric_change(delta_pct, metric)
        magnitude = abs(delta_pct or 0.0)
        importance_score = _importance_from_components(
            magnitude=magnitude,
            confidence=confidence,
            business_weight=metric_semantics.get("business_weight") or 0.6,
            severity=severity,
            extra_weight=4.0 if time_context and time_context.get("grain") in {"day", "week", "month", "quarter"} else 0.0,
        )
        current_value = change["current_value"]
        previous_value = change["previous_value"]
        percentage_text = f"{abs((delta_pct or 0.0) * 100):.1f}%" if delta_pct is not None else "from a zero baseline"
        metric_type = metric_semantics.get("metric_type") or "metric"
        period_window = describe_period_window(period_context)

        title = f"{metric_ref['label']} {'increased' if direction == 'up' else 'decreased'} {period_window}"
        summary = (
            f"{metric_ref['label']} moved from {previous_value} to {current_value} "
            f"({percentage_text}) {period_window}. "
            f"This is treated as a {metric_type} metric with {metric_ref.get('default_aggregation') or 'resolved'} aggregation."
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
                    "semantic_context": {
                        **metric_semantics,
                        "time_grain": time_context.get("grain") if time_context else None,
                    },
                    "chart_hint": {
                        "metric_id": metric_ref["metric_id"],
                        "group_by": [context["time_dimension"]["field"]] if context.get("time_dimension") else [],
                    },
                },
                confidence=confidence,
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
        profile = build_dimension_profile(context, dimension)
        dimension_importance = safe_float(profile.get("importance_score")) or 0.0
        if top_share < 0.65 or dimension_importance < 0.35:
            continue

        top_value = serialize_value(counts.index[0])
        severity = "critical" if top_share >= 0.92 else "high" if top_share >= 0.82 else "medium" if top_share >= 0.72 else "low"
        confidence = _confidence_from_row_count(int(len(series.index)))
        importance_score = _importance_from_components(
            magnitude=top_share,
            confidence=confidence,
            business_weight=min(1.0, max(0.45, dimension_importance)),
            severity=severity,
            extra_weight=dimension_importance * 12.0,
        )
        signals.append(
            _build_signal(
                signal_type="dimension_concentration",
                title=f"{dimension.get('label') or dimension['field']} is concentrated in a single value",
                summary=(
                    f"{top_value} accounts for {top_share:.1%} of non-null rows in "
                    f"{dimension.get('label') or dimension['field']}, limiting segmentation value across this slice."
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
                    "semantic_context": build_dimension_semantic_context(context, dimension),
                },
                confidence=confidence,
                importance_score=importance_score,
            )
        )
        if len(signals) >= 2:
            break
    return signals


def _build_data_quality_signals(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    profile_candidates = []
    metric_fields = {
        str(metric.get("field"))
        for metric in context.get("metrics", [])
        if isinstance(metric, dict) and metric.get("field")
    }
    for profile in context.get("field_profiles", []):
        if not isinstance(profile, dict):
            continue
        null_rate = safe_float(profile.get("null_rate"))
        field_name = str(profile.get("field") or profile.get("name") or "")
        if null_rate is None or null_rate < 0.2 or not field_name:
            continue
        field_weight = 0.72 if field_name in metric_fields else 0.56
        profile_candidates.append((profile, field_weight))

    profile_candidates.sort(key=lambda item: ((item[0].get("null_rate") or 0), item[1]), reverse=True)
    signals = []
    for profile, field_weight in profile_candidates[:2]:
        null_rate = float(profile["null_rate"])
        field_name = str(profile.get("field") or profile.get("name"))
        severity = "critical" if null_rate >= 0.7 else "high" if null_rate >= 0.45 else "medium"
        confidence = 0.92 if context["dataset"]["row_count"] >= 50 else 0.82
        importance_score = _importance_from_components(
            magnitude=null_rate,
            confidence=confidence,
            business_weight=field_weight,
            severity=severity,
            extra_weight=8.0 if field_name in metric_fields else 0.0,
        )
        signals.append(
            _build_signal(
                signal_type="data_quality",
                title=f"{field_name} has elevated missingness",
                summary=(
                    f"{field_name} is null in {null_rate:.1%} of rows and may reduce confidence in "
                    f"segment-level comparisons or metric interpretation."
                ),
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
                    "semantic_context": {
                        "field_role": profile.get("semantic_role"),
                        "field_format_hint": profile.get("format_hint"),
                        "is_metric_backed": field_name in metric_fields,
                    },
                },
                confidence=confidence,
                importance_score=importance_score,
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
    if anomaly_rate < 0.02:
        return []

    severity = "critical" if anomaly_rate >= 0.18 else "high" if anomaly_rate >= 0.1 else "medium" if anomaly_rate >= 0.05 else "low"
    confidence = _confidence_from_row_count(row_count)
    importance_score = _importance_from_components(
        magnitude=anomaly_rate,
        confidence=confidence,
        business_weight=0.74,
        severity=severity,
        extra_weight=min(10.0, len(numeric_columns) * 0.8),
    )

    signal = _build_signal(
        signal_type="anomaly_rate",
        title=f"Detected {anomaly_count} anomalous rows",
        summary=(
            f"{anomaly_count} of {row_count} rows ({anomaly_rate:.1%}) look atypical across numeric fields, "
            f"suggesting either an operational shift or data inconsistency worth validating."
        ),
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
            "semantic_context": {
                "numeric_fields_scanned": numeric_columns[:5],
                "scan_scope": "dataset_level",
            },
        },
        confidence=confidence,
        importance_score=importance_score,
    )
    return [signal]


def _dedupe_and_rank_signals(signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    deduped: Dict[tuple, Dict[str, Any]] = {}
    for signal in signals:
        evidence = signal.get("evidence") if isinstance(signal.get("evidence"), dict) else {}
        key = (
            signal.get("signal_type"),
            (signal.get("metric_ref") or {}).get("metric_id"),
            (signal.get("dimension_ref") or {}).get("dimension_id"),
            evidence.get("field"),
        )
        existing = deduped.get(key)
        if existing is None:
            deduped[key] = signal
            continue

        existing_rank = (
            existing.get("importance_score") or 0,
            SEVERITY_RANK.get(existing.get("severity"), 0),
            existing.get("confidence") or 0,
        )
        candidate_rank = (
            signal.get("importance_score") or 0,
            SEVERITY_RANK.get(signal.get("severity"), 0),
            signal.get("confidence") or 0,
        )
        if candidate_rank > existing_rank:
            deduped[key] = signal

    return sorted(
        deduped.values(),
        key=lambda item: (
            item.get("importance_score") or 0,
            SEVERITY_RANK.get(item.get("severity"), 0),
            item.get("confidence") or 0,
        ),
        reverse=True,
    )


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

    signals = _dedupe_and_rank_signals(signals)[:max_signals]
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
