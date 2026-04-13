from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional, Sequence, Set

import pandas as pd

from backend.services.dataset_context import resolve_dataset_bundle
from backend.services.metric_resolver import MetricResolutionError, MetricResolver
from backend.services.semantic_model import finalize_semantic_model


DEFAULT_METRIC_LIMIT = 5
RATE_AGGREGATIONS = {"avg", "average", "mean"}
COUNT_AGGREGATIONS = {"count", "count_distinct", "distinct_count", "nunique"}
RATE_KEYWORDS = {"rate", "ratio", "pct", "percent", "conversion", "share"}
VOLUME_KEYWORDS = {"volume", "units", "orders", "transactions", "count"}


class DecisionServiceError(ValueError):
    pass


def iso_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def slugify(value: Any) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower())
    return normalized.strip("_") or "item"


def make_identifier(prefix: str, *parts: Any) -> str:
    slug_parts = [slugify(part) for part in parts if str(part or "").strip()]
    return "_".join([prefix, *slug_parts]) if slug_parts else prefix


def serialize_value(value: Any) -> Any:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass

    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            return value
    return value


def safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if pd.isna(numeric):
        return None
    return numeric


def rounded(value: Optional[float], digits: int = 4) -> Optional[float]:
    if value is None:
        return None
    return round(float(value), digits)


def normalize_filters(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    filters = payload.get("filters") or []
    if filters is None:
        return []
    if isinstance(filters, dict):
        return [filters]
    if isinstance(filters, list):
        return [item for item in filters if isinstance(item, dict)]
    raise DecisionServiceError("filters must be an object or an array of objects.")


def normalize_group_by(payload: Dict[str, Any]) -> List[Any]:
    group_by = payload.get("group_by") or payload.get("groupBy") or []
    if group_by is None:
        return []
    if isinstance(group_by, list):
        return group_by
    raise DecisionServiceError("group_by must be an array when provided.")


def normalize_reference_list(payload: Dict[str, Any], snake_key: str, camel_key: str) -> List[str]:
    raw_value = payload.get(snake_key)
    if raw_value is None:
        raw_value = payload.get(camel_key)
    if raw_value is None:
        return []
    if not isinstance(raw_value, list):
        raise DecisionServiceError(f"{snake_key} must be an array when provided.")
    return [str(item).strip() for item in raw_value if str(item).strip()]


def normalize_positive_int(
    value: Any,
    default: int,
    field_name: str,
    minimum: int = 1,
    maximum: int = 50,
) -> int:
    if value is None:
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise DecisionServiceError(f"{field_name} must be an integer.") from exc
    return max(minimum, min(maximum, parsed))


def normalize_bool(value: Any, default: bool = True) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes"}:
            return True
        if lowered in {"false", "0", "no"}:
            return False
    raise DecisionServiceError("Boolean fields must be true or false.")


def resolve_decision_context(
    dataset: Any = None,
    dataset_ref: Optional[Dict[str, Any]] = None,
    semantic_model: Optional[Dict[str, Any]] = None,
    source: str = "decision",
) -> Dict[str, Any]:
    try:
        bundle = resolve_dataset_bundle(
            dataset=dataset,
            dataset_ref=dataset_ref,
            semantic_model=semantic_model,
            source=source,
            allow_active_fallback=False,
        )
    except ValueError as exc:
        raise DecisionServiceError(str(exc)) from exc
    dataframe = bundle["dataframe"].copy()
    resolved_model = finalize_semantic_model(bundle["semantic_model"])

    context = {
        "dataframe": dataframe,
        "semantic_model": resolved_model,
        "dataset": build_dataset_summary(bundle, dataframe),
        "dataset_ref": bundle["dataset_ref"],
        "metrics": resolved_model.get("metrics", []),
        "dimensions": resolved_model.get("dimensions", []),
        "field_profiles": resolved_model.get("field_profiles", []),
    }
    context["field_profile_map"] = build_field_profile_map(context)
    context["time_dimension"] = find_time_dimension(context)
    return context


def build_dataset_summary(bundle: Dict[str, Any], dataframe: pd.DataFrame) -> Dict[str, Any]:
    dataset_ref = bundle.get("dataset_ref") or {}
    return {
        "source": dataset_ref.get("source") or "active",
        "dataset_id": dataset_ref.get("dataset_id"),
        "dataset_name": dataset_ref.get("dataset_name") or "Active Dataset",
        "row_count": int(len(dataframe.index)),
        "column_count": int(len(dataframe.columns)),
    }


def build_semantic_summary(semantic_model: Dict[str, Any]) -> Dict[str, Any]:
    dataset_meta = semantic_model.get("dataset") if isinstance(semantic_model.get("dataset"), dict) else {}
    return {
        "version": semantic_model.get("version"),
        "dataset": {
            "id": dataset_meta.get("id"),
            "name": dataset_meta.get("name"),
        },
        "summary": semantic_model.get("summary") or {
            "metric_count": len(semantic_model.get("metrics", [])),
            "dimension_count": len(semantic_model.get("dimensions", [])),
            "entity_count": len(semantic_model.get("entities", [])),
        },
    }


def build_metric_ref(metric: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not isinstance(metric, dict):
        return None
    return {
        "metric_id": metric.get("id") or metric.get("metric_id"),
        "name": metric.get("name") or metric.get("label") or metric.get("display_name"),
        "label": metric.get("label") or metric.get("display_name") or metric.get("name"),
        "field": metric.get("field"),
        "default_aggregation": metric.get("default_aggregation"),
        "format_hint": metric.get("format_hint"),
    }


def build_dimension_ref(dimension: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not isinstance(dimension, dict):
        return None
    return {
        "dimension_id": dimension.get("id"),
        "name": dimension.get("name") or dimension.get("field"),
        "label": dimension.get("label") or dimension.get("field"),
        "field": dimension.get("field"),
        "semantic_kind": dimension.get("semantic_kind"),
        "data_type": dimension.get("data_type"),
    }


def build_field_profile_map(context: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    return {
        str(profile.get("field") or profile.get("name")): profile
        for profile in context.get("field_profiles", [])
        if isinstance(profile, dict) and (profile.get("field") or profile.get("name"))
    }


def get_field_profile(context: Dict[str, Any], field_name: Optional[str]) -> Dict[str, Any]:
    if not field_name:
        return {}
    profile_map = context.get("field_profile_map") if isinstance(context.get("field_profile_map"), dict) else build_field_profile_map(context)
    return profile_map.get(str(field_name), {})


def metric_expression_columns(metric: Optional[Dict[str, Any]]) -> Set[str]:
    if not isinstance(metric, dict):
        return set()
    expression = metric.get("expression") if isinstance(metric.get("expression"), dict) else {}
    expression_type = expression.get("type") or metric.get("definition_kind")
    columns: Set[str] = set()
    if expression_type == "column_aggregation":
        field = expression.get("column") or metric.get("field")
        if field:
            columns.add(str(field))
    elif expression_type == "derived_formula":
        columns.update(str(column) for column in expression.get("columns") or [] if str(column).strip())
    return columns


def classify_metric_type(metric: Optional[Dict[str, Any]]) -> str:
    if not isinstance(metric, dict):
        return "metric"

    aggregation = str(metric.get("default_aggregation") or metric.get("aggregation_behavior") or "").strip().lower()
    format_hint = str(metric.get("format_hint") or "").strip().lower()
    name = str(metric.get("name") or metric.get("label") or metric.get("field") or "").strip().lower()

    if aggregation in COUNT_AGGREGATIONS or any(keyword in name for keyword in VOLUME_KEYWORDS):
        return "volume"
    if format_hint == "percentage" or aggregation in RATE_AGGREGATIONS or any(keyword in name for keyword in RATE_KEYWORDS):
        return "rate"
    if aggregation in {"min", "max"}:
        return "extrema"
    if aggregation == "sum":
        return "total"
    return "metric"


def metric_business_weight(metric: Optional[Dict[str, Any]]) -> float:
    if not isinstance(metric, dict):
        return 0.5

    metric_type = classify_metric_type(metric)
    format_hint = str(metric.get("format_hint") or "").strip().lower()
    weight = 0.6

    if metric_type == "rate":
        weight = 0.82
    elif metric_type == "total":
        weight = 0.78
    elif metric_type == "volume":
        weight = 0.72
    elif metric_type == "extrema":
        weight = 0.65

    if format_hint == "currency":
        weight += 0.12
    elif format_hint == "percentage":
        weight += 0.08

    return min(1.0, round(weight, 4))


def infer_time_grain(current_value: Any, previous_value: Any) -> Optional[str]:
    if current_value is None or previous_value is None:
        return None

    try:
        current_ts = pd.to_datetime(current_value, errors="coerce")
        previous_ts = pd.to_datetime(previous_value, errors="coerce")
    except Exception:
        return "observed_value"

    if pd.isna(current_ts) or pd.isna(previous_ts):
        return "observed_value"

    delta_days = abs((current_ts - previous_ts).total_seconds()) / 86400.0
    if delta_days <= 1.5:
        return "day"
    if delta_days <= 8.5:
        return "week"
    if delta_days <= 32:
        return "month"
    if delta_days <= 95:
        return "quarter"
    if delta_days <= 370:
        return "year"
    return "observed_value"


def list_related_metrics(
    context: Dict[str, Any],
    metric: Optional[Dict[str, Any]],
    max_related: int = 3,
) -> List[Dict[str, Any]]:
    if not isinstance(metric, dict):
        return []

    metric_id = metric.get("id") or metric.get("metric_id")
    metric_columns = metric_expression_columns(metric)
    related = []
    for candidate in context.get("metrics", []):
        if not isinstance(candidate, dict):
            continue
        candidate_id = candidate.get("id") or candidate.get("metric_id")
        if candidate_id == metric_id:
            continue
        candidate_columns = metric_expression_columns(candidate)
        same_field_family = bool(metric_columns and candidate_columns and metric_columns.intersection(candidate_columns))
        same_format_family = (
            str(candidate.get("format_hint") or "").strip().lower()
            and str(candidate.get("format_hint") or "").strip().lower() == str(metric.get("format_hint") or "").strip().lower()
        )
        if same_field_family or same_format_family:
            related.append(build_metric_ref(candidate))
        if len(related) >= max_related:
            break
    return [item for item in related if item]


def build_metric_semantic_context(context: Dict[str, Any], metric: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(metric, dict):
        return {}

    return {
        "metric_type": classify_metric_type(metric),
        "aggregation": metric.get("default_aggregation"),
        "format_hint": metric.get("format_hint"),
        "business_weight": rounded(metric_business_weight(metric)),
        "related_metrics": list_related_metrics(context, metric),
    }


def build_dimension_profile(context: Dict[str, Any], dimension: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(dimension, dict):
        return {}

    field_name = dimension.get("field")
    dataframe = context.get("dataframe")
    if field_name is None or not isinstance(dataframe, pd.DataFrame) or field_name not in dataframe.columns:
        return {}

    profile = get_field_profile(context, field_name)
    series = dataframe[field_name]
    non_null = series.dropna()
    unique_count = int(profile.get("unique_count") or non_null.nunique(dropna=True))
    null_rate = safe_float(profile.get("null_rate"))
    null_rate = 0.0 if null_rate is None else null_rate
    top_share = 0.0
    if not non_null.empty:
        counts = non_null.value_counts(dropna=False)
        top_share = float(counts.iloc[0]) / float(len(non_null.index))

    profile_summary = {
        "field": field_name,
        "unique_count": unique_count,
        "unique_ratio": rounded(safe_float(profile.get("unique_ratio")) or 0.0),
        "null_rate": rounded(null_rate),
        "top_share": rounded(top_share),
        "semantic_kind": dimension.get("semantic_kind"),
        "data_type": dimension.get("data_type"),
    }
    profile_summary["importance_score"] = rounded(score_dimension_importance(profile_summary), 2)
    return profile_summary


def score_dimension_importance(profile: Dict[str, Any]) -> float:
    unique_count = int(profile.get("unique_count") or 0)
    null_rate = safe_float(profile.get("null_rate")) or 0.0
    top_share = safe_float(profile.get("top_share")) or 0.0
    semantic_kind = str(profile.get("semantic_kind") or "").strip().lower()

    if unique_count <= 1:
        return 0.0
    if semantic_kind == "temporal":
        return 0.92

    if unique_count <= 8:
        cardinality_score = 0.95
    elif unique_count <= 20:
        cardinality_score = 0.82
    elif unique_count <= 50:
        cardinality_score = 0.62
    elif unique_count <= 150:
        cardinality_score = 0.35
    else:
        cardinality_score = 0.12

    completeness_score = max(0.0, 1.0 - null_rate)
    balance_score = max(0.0, 1.0 - top_share)
    return round((cardinality_score * 0.5) + (completeness_score * 0.3) + (balance_score * 0.2), 4)


def build_dimension_semantic_context(context: Dict[str, Any], dimension: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    profile = build_dimension_profile(context, dimension)
    if not profile:
        return {}
    return {
        "importance_score": profile.get("importance_score"),
        "unique_count": profile.get("unique_count"),
        "null_rate": profile.get("null_rate"),
        "top_share": profile.get("top_share"),
    }


def matches_reference(candidate: Dict[str, Any], reference: str) -> bool:
    normalized_reference = str(reference).strip().lower()
    values = [
        candidate.get("id"),
        candidate.get("metric_id"),
        candidate.get("name"),
        candidate.get("label"),
        candidate.get("field"),
    ]
    return any(str(value).strip().lower() == normalized_reference for value in values if value is not None)


def select_metrics(
    context: Dict[str, Any],
    metric_ids: Optional[Sequence[str]] = None,
    metric_names: Optional[Sequence[str]] = None,
    max_metrics: int = DEFAULT_METRIC_LIMIT,
) -> List[Dict[str, Any]]:
    metrics = [metric for metric in context.get("metrics", []) if isinstance(metric, dict)]
    references = [*(metric_ids or []), *(metric_names or [])]

    if references:
        selected = []
        missing = []
        for reference in references:
            match = next((metric for metric in metrics if matches_reference(metric, reference)), None)
            if match is None:
                missing.append(reference)
            elif match not in selected:
                selected.append(match)
        if missing:
            missing_text = ", ".join(missing)
            raise DecisionServiceError(f"Referenced semantic metrics were not found: {missing_text}.")
        return selected[:max_metrics]

    compatible_metrics = []
    available_fields = {str(column) for column in context["dataframe"].columns}
    for metric in metrics:
        expression = metric.get("expression") if isinstance(metric.get("expression"), dict) else {}
        expression_type = expression.get("type") or metric.get("definition_kind")
        if expression_type == "count_rows":
            compatible_metrics.append(metric)
            continue
        referenced_fields = set()
        if expression_type == "column_aggregation":
            field = expression.get("column") or metric.get("field")
            if field:
                referenced_fields.add(str(field))
        elif expression_type == "derived_formula":
            for column in expression.get("columns") or []:
                referenced_fields.add(str(column))
        if referenced_fields and referenced_fields.issubset(available_fields):
            compatible_metrics.append(metric)

    return compatible_metrics[:max_metrics]


def resolve_metric_result(
    context: Dict[str, Any],
    metric: Dict[str, Any],
    filters: Optional[Sequence[Dict[str, Any]]] = None,
    group_by: Optional[Sequence[Any]] = None,
    limit: Optional[int] = None,
    sort: Optional[str] = None,
) -> Dict[str, Any]:
    try:
        return MetricResolver.resolve(
            metric=metric,
            dataset=context["dataframe"],
            semantic_model=context["semantic_model"],
            filters=list(filters or []),
            group_by=list(group_by or []),
            limit=limit,
            sort=sort,
        )
    except MetricResolutionError as exc:
        raise DecisionServiceError(str(exc)) from exc


def find_time_dimension(context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    dataframe = context["dataframe"]
    for dimension in context.get("dimensions", []):
        field = dimension.get("field")
        if not field or field not in dataframe.columns:
            continue
        if dimension.get("data_type") == "datetime" or dimension.get("semantic_kind") == "temporal":
            return dimension
    return None


def build_time_context(change: Optional[Dict[str, Any]], time_dimension: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if change is None and time_dimension is None:
        return None
    current_value = change.get("current_period") if isinstance(change, dict) else None
    previous_value = change.get("previous_period") if isinstance(change, dict) else None
    return {
        "dimension_id": time_dimension.get("id") if isinstance(time_dimension, dict) else None,
        "field": time_dimension.get("field") if isinstance(time_dimension, dict) else None,
        "grain": infer_time_grain(current_value, previous_value) if change is not None else None,
        "current_value": current_value,
        "previous_value": previous_value,
    }


def _format_calendar_label(timestamp: pd.Timestamp, grain: Optional[str]) -> str:
    normalized_grain = str(grain or "").strip().lower()
    if normalized_grain == "year":
        return str(timestamp.year)
    if normalized_grain == "quarter":
        quarter = ((int(timestamp.month) - 1) // 3) + 1
        return f"Q{quarter} {timestamp.year}"
    if normalized_grain == "month":
        return f"{timestamp.strftime('%b')} {timestamp.year}"
    if normalized_grain == "week":
        iso_week = timestamp.isocalendar()
        return f"Week {int(iso_week.week)}, {int(iso_week.year)}"
    return f"{timestamp.strftime('%b')} {int(timestamp.day)}, {timestamp.year}"


def format_period_label(value: Any, grain: Optional[str]) -> Optional[str]:
    serialized = serialize_value(value)
    if serialized is None:
        return None

    try:
        timestamp = pd.to_datetime(serialized, errors="coerce")
    except Exception:
        timestamp = pd.NaT

    if pd.isna(timestamp):
        text = str(serialized).strip()
        return text or None
    return _format_calendar_label(timestamp, grain)


def build_period_context(
    time_context: Optional[Dict[str, Any]],
    fiscal_calendar: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    if not isinstance(time_context, dict):
        return None

    grain = time_context.get("grain")
    current_label = format_period_label(time_context.get("current_value"), grain)
    previous_label = format_period_label(time_context.get("previous_value"), grain)
    has_calendar_values = bool(current_label or previous_label) and grain in {"day", "week", "month", "quarter", "year"}

    fallback_label = None
    if grain:
        normalized_grain = str(grain).replace("_", " ").strip()
        fallback_label = f"Latest {normalized_grain} period"

    return {
        "label": current_label or fallback_label,
        "comparison_label": previous_label or ("Previous period" if time_context.get("previous_value") is not None else None),
        "current_label": current_label,
        "previous_label": previous_label,
        "grain": grain,
        "comparison_type": "sequential_period" if time_context.get("previous_value") is not None else None,
        "calendar_type": "calendar" if has_calendar_values else ("observed_value" if (current_label or previous_label) else None),
        "fiscal_calendar": fiscal_calendar if isinstance(fiscal_calendar, dict) else None,
    }


def describe_period_window(period_context: Optional[Dict[str, Any]]) -> str:
    if not isinstance(period_context, dict):
        return "in the latest observed period"

    current_label = str(
        period_context.get("current_label")
        or period_context.get("label")
        or ""
    ).strip()
    previous_label = str(
        period_context.get("previous_label")
        or period_context.get("comparison_label")
        or ""
    ).strip()
    grain = str(period_context.get("grain") or "").strip().lower()

    if current_label and previous_label:
        return f"between {previous_label} and {current_label}"
    if current_label:
        return f"in {current_label}"
    if grain == "day":
        return "in the latest observed date"
    if grain:
        return f"in the latest observed {grain}"
    return "in the latest observed period"


def build_projection_labels(period_context: Optional[Dict[str, Any]]) -> Dict[str, str]:
    if not isinstance(period_context, dict):
        return {
            "baseline_label": "Current Context",
            "projected_label": "Projected Context",
        }

    period_label = str(period_context.get("label") or "").strip()
    if not period_label:
        return {
            "baseline_label": "Current Context",
            "projected_label": "Projected Context",
        }

    return {
        "baseline_label": f"Current Context ({period_label})",
        "projected_label": f"Projected Context ({period_label})",
    }


def latest_metric_change(
    context: Dict[str, Any],
    metric: Dict[str, Any],
    filters: Optional[Sequence[Dict[str, Any]]] = None,
) -> Optional[Dict[str, Any]]:
    time_dimension = context.get("time_dimension")
    if not isinstance(time_dimension, dict):
        return None

    result = resolve_metric_result(
        context=context,
        metric=metric,
        filters=filters,
        group_by=[time_dimension],
        sort="group_asc",
    )
    valid_rows = [row for row in result.get("rows", []) if row.get("value") is not None]
    if len(valid_rows) < 2:
        return None

    current_row = valid_rows[-1]
    previous_row = valid_rows[-2]
    current_value = safe_float(current_row.get("value"))
    previous_value = safe_float(previous_row.get("value"))
    if current_value is None or previous_value is None:
        return None

    delta_value = current_value - previous_value
    delta_pct = None if previous_value == 0 else delta_value / abs(previous_value)
    return {
        "metric_result": result,
        "current_value": rounded(current_value),
        "previous_value": rounded(previous_value),
        "delta_value": rounded(delta_value),
        "delta_pct": rounded(delta_pct),
        "current_period": current_row.get("group", {}).get(time_dimension["field"]),
        "previous_period": previous_row.get("group", {}).get(time_dimension["field"]),
        "row_count": result.get("dataset", {}).get("row_count", context["dataset"]["row_count"]),
    }


def list_candidate_dimensions(
    context: Dict[str, Any],
    max_dimensions: int = 5,
    include_profiles: bool = False,
    include_temporal: bool = False,
) -> List[Dict[str, Any]]:
    dataframe = context["dataframe"]
    candidates = []
    for dimension in context.get("dimensions", []):
        field = dimension.get("field")
        if not field or field not in dataframe.columns:
            continue
        if not include_temporal and (dimension.get("data_type") == "datetime" or dimension.get("semantic_kind") == "temporal"):
            continue
        profile = build_dimension_profile(context, dimension)
        unique_count = int(profile.get("unique_count") or 0)
        if unique_count <= 1 or unique_count > 60:
            continue
        candidates.append({
            "dimension": dimension,
            "profile": profile,
        })

    candidates.sort(
        key=lambda item: (
            item["profile"].get("importance_score") or 0,
            -(item["profile"].get("null_rate") or 0),
            -(item["profile"].get("unique_count") or 0),
        ),
        reverse=True,
    )
    trimmed = candidates[:max_dimensions]
    if include_profiles:
        return trimmed
    return [item["dimension"] for item in trimmed]


def select_breakdown_dimensions(
    context: Dict[str, Any],
    metric: Optional[Dict[str, Any]] = None,
    max_dimensions: int = 2,
    exclude_fields: Optional[Sequence[str]] = None,
) -> List[Dict[str, Any]]:
    excluded = {str(field) for field in exclude_fields or [] if str(field).strip()}
    if metric:
        excluded.update(metric_expression_columns(metric))

    selected = []
    for item in list_candidate_dimensions(context, max_dimensions=max_dimensions + len(excluded), include_profiles=True):
        dimension = item["dimension"]
        field = str(dimension.get("field") or "")
        if not field or field in excluded:
            continue
        selected.append(dimension)
        if len(selected) >= max_dimensions:
            break
    return selected


def derive_themes(signals: Sequence[Dict[str, Any]]) -> List[str]:
    ordered = []
    for signal in signals:
        signal_type = signal.get("signal_type")
        direction = signal.get("direction")
        severity = signal.get("severity")

        if signal_type == "metric_delta" and direction == "up":
            theme = "Growth opportunity"
        elif signal_type == "metric_delta" and direction == "down":
            theme = "Performance risk"
        elif signal_type == "metric_delta":
            theme = "Performance shift"
        elif signal_type == "anomaly_rate":
            theme = "Operational anomaly"
        elif signal_type == "dimension_concentration":
            theme = "Concentration risk"
        elif signal_type == "data_quality":
            theme = "Data quality risk"
        else:
            theme = "Decision signal"

        if severity in {"high", "critical"} and theme not in {"Growth opportunity", "Performance shift"} and not theme.endswith("risk"):
            theme = f"{theme} risk"
        if theme not in ordered:
            ordered.append(theme)
    return ordered
