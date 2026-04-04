from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional, Sequence

import pandas as pd

from backend.services.dataset_context import resolve_dataset_bundle
from backend.services.metric_resolver import MetricResolutionError, MetricResolver
from backend.services.semantic_model import finalize_semantic_model


DEFAULT_METRIC_LIMIT = 5


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
    return {
        "dimension_id": time_dimension.get("id") if isinstance(time_dimension, dict) else None,
        "field": time_dimension.get("field") if isinstance(time_dimension, dict) else None,
        "grain": "observed_value" if change is not None else None,
        "current_value": change.get("current_period") if isinstance(change, dict) else None,
        "previous_value": change.get("previous_period") if isinstance(change, dict) else None,
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


def list_candidate_dimensions(context: Dict[str, Any], max_dimensions: int = 5) -> List[Dict[str, Any]]:
    dataframe = context["dataframe"]
    field_profile_by_name = {
        str(profile.get("name")): profile
        for profile in context.get("field_profiles", [])
        if isinstance(profile, dict) and profile.get("name")
    }
    candidates = []
    for dimension in context.get("dimensions", []):
        field = dimension.get("field")
        if not field or field not in dataframe.columns:
            continue
        if dimension.get("data_type") == "datetime" or dimension.get("semantic_kind") == "temporal":
            continue
        profile = field_profile_by_name.get(str(field), {})
        unique_count = int(profile.get("unique_count") or dataframe[field].nunique(dropna=True))
        if unique_count <= 1 or unique_count > 25:
            continue
        candidates.append(dimension)
        if len(candidates) >= max_dimensions:
            break
    return candidates


def derive_themes(signals: Sequence[Dict[str, Any]]) -> List[str]:
    theme_map = {
        "metric_delta": "Performance change",
        "anomaly_rate": "Anomaly monitoring",
        "dimension_concentration": "Concentration risk",
        "data_quality": "Data quality",
    }
    ordered = []
    for signal in signals:
        theme = theme_map.get(signal.get("signal_type"), "Decision signal")
        if theme not in ordered:
            ordered.append(theme)
    return ordered
