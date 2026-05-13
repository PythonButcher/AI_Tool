from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import logging
import re
from typing import Any, Dict, List, Optional, Sequence, Set

import pandas as pd
from pandas.api.types import is_bool_dtype, is_datetime64_any_dtype, is_numeric_dtype


RATE_KEYWORDS = ("rate", "ratio", "pct", "percent", "average", "avg", "mean")
CURRENCY_KEYWORDS = ("revenue", "sales", "amount", "cost", "price", "profit", "income", "spend")
IDENTIFIER_KEYWORDS = ("id", "key", "code", "uuid", "identifier")
TEMPORAL_KEYWORDS = ("date", "time", "timestamp", "year", "month", "day", "week", "quarter")
OBJECTIVE_KEYWORDS = (
    "revenue",
    "sales",
    "profit",
    "margin",
    "growth",
    "delivery",
    "retention",
    "conversion",
    "satisfaction",
    "score",
    "risk",
    "return",
    "stockout",
    "cost",
)
LEVER_KEYWORDS = (
    "spend",
    "discount",
    "price",
    "budget",
    "inventory",
    "capacity",
    "staffing",
    "headcount",
    "allocation",
    "mix",
    "promotion",
    "campaign",
)
GUARDRAIL_KEYWORDS = (
    "margin",
    "risk",
    "rate",
    "cost",
    "delivery",
    "return",
    "stockout",
    "quality",
    "sla",
    "compliance",
    "churn",
)
POSITIVE_POLARITY_KEYWORDS = ("revenue", "sales", "profit", "margin", "delivery", "retention", "conversion", "satisfaction")
NEGATIVE_POLARITY_KEYWORDS = ("cost", "spend", "discount", "risk", "return", "churn", "stockout", "defect", "delay")
GRAIN_KEYWORDS = ("day", "week", "month", "quarter", "year")
SUPPORTED_AGGREGATIONS = {"sum", "avg", "average", "mean", "min", "max", "count", "count_distinct", "distinct_count", "nunique"}
SUPPORTED_FORMAT_HINTS = {None, "", "number", "currency", "percentage", "date"}
FORMULA_COLUMN_PATTERN = re.compile(r"\[([^\]]+)\]")
logger = logging.getLogger(__name__)


def _iso_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower())
    return slug.strip("_") or "field"


def normalize_records(dataset_obj: Any) -> List[Dict[str, Any]]:
    if dataset_obj is None:
        return []

    if isinstance(dataset_obj, pd.DataFrame):
        return dataset_obj.to_dict(orient="records")

    if isinstance(dataset_obj, str):
        try:
            parsed = pd.read_json(dataset_obj)
            return parsed.to_dict(orient="records")
        except ValueError:
            return []

    if isinstance(dataset_obj, list):
        return [row for row in dataset_obj if isinstance(row, dict)]

    if isinstance(dataset_obj, dict):
        for key in ("data", "rows", "records", "data_preview", "full_data", "cleaned_data"):
            candidate = dataset_obj.get(key)
            if candidate is not None:
                return normalize_records(candidate)

    return []


def infer_semantic_model_from_records(
    records: Sequence[Dict[str, Any]],
    dataset_name: Optional[str] = None,
    dataset_id: Optional[str] = None,
    source: str = "inferred",
    existing_model: Optional[Dict[str, Any]] = None,
    preserve_user_metrics: bool = False,
) -> Dict[str, Any]:
    df = pd.DataFrame(list(records)) if records else pd.DataFrame()
    return infer_semantic_model_from_dataframe(
        df,
        dataset_name=dataset_name,
        dataset_id=dataset_id,
        source=source,
        existing_model=existing_model,
        preserve_user_metrics=preserve_user_metrics,
    )


def infer_semantic_model_from_dataframe(
    df: pd.DataFrame,
    dataset_name: Optional[str] = None,
    dataset_id: Optional[str] = None,
    source: str = "inferred",
    existing_model: Optional[Dict[str, Any]] = None,
    preserve_user_metrics: bool = False,
) -> Dict[str, Any]:
    dataframe = df.copy() if df is not None else pd.DataFrame()
    row_count = len(dataframe.index)
    column_names = [str(col) for col in dataframe.columns]
    resolved_dataset_name = dataset_name or dataset_id or "Active Dataset"
    entity_id = "entity_primary_dataset"
    timestamp = _iso_timestamp()

    field_profiles: List[Dict[str, Any]] = []
    dimensions: List[Dict[str, Any]] = []
    inferred_metrics: List[Dict[str, Any]] = []
    identifier_candidates: List[str] = []

    for column in column_names:
        series = dataframe[column]
        profile = _build_field_profile(series, row_count)
        profile["field"] = column
        field_profiles.append(profile)

        if profile["semantic_role"] in {"dimension", "identifier"}:
            dimensions.append(_build_dimension_definition(column, profile, entity_id, timestamp))
        if profile["semantic_role"] == "metric":
            inferred_metrics.append(_build_metric_definition(column, profile, entity_id, timestamp))
        if profile["semantic_role"] == "identifier":
            identifier_candidates.append(column)

    entity_definition = {
        "id": entity_id,
        "name": resolved_dataset_name,
        "label": resolved_dataset_name,
        "grain": "record",
        "description": "Default inferred entity representing one row in the active dataset.",
        "key_candidates": identifier_candidates,
        "fields": column_names,
        "status": "inferred",
        "is_inferred": True,
        "created_at": timestamp,
        "updated_at": timestamp,
    }

    metrics = inferred_metrics
    if preserve_user_metrics and isinstance(existing_model, dict):
        metrics = merge_user_defined_metrics(
            inferred_metrics=inferred_metrics,
            semantic_model=existing_model,
            available_columns=set(column_names),
        )

    model = {
        "version": 2,
        "generated_at": timestamp,
        "updated_at": timestamp,
        "source": source,
        "dataset": {
            "id": dataset_id or (existing_model.get("dataset", {}).get("id") if isinstance(existing_model, dict) else None),
            "name": resolved_dataset_name,
            "row_count": row_count,
            "column_count": len(column_names),
        },
        "field_profiles": field_profiles,
        "entities": [entity_definition],
        "dimensions": dimensions,
        "metrics": metrics,
        "relationships": deepcopy(existing_model.get("relationships", [])) if isinstance(existing_model, dict) else [],
        "business_terms": deepcopy(existing_model.get("business_terms", [])) if isinstance(existing_model, dict) else [],
        "compatibility": {
            "dataset_first_mode": True,
            "backward_compatible": True,
            "notes": "The semantic model is additive and does not replace the existing dataset pipeline.",
        },
    }
    logger.info(
        "Inferred semantic model for dataset %s with %s columns, %s metrics, and %s dimensions.",
        resolved_dataset_name,
        len(column_names),
        len(metrics),
        len(dimensions),
    )
    return finalize_semantic_model(model)


def finalize_semantic_model(semantic_model: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    model = deepcopy(semantic_model) if isinstance(semantic_model, dict) else {}
    timestamp = _iso_timestamp()

    model["version"] = max(int(model.get("version") or 1), 2)
    model["generated_at"] = model.get("generated_at") or timestamp
    model["updated_at"] = timestamp
    model["dataset"] = model.get("dataset") if isinstance(model.get("dataset"), dict) else {}
    model["field_profiles"] = model.get("field_profiles") if isinstance(model.get("field_profiles"), list) else []
    model["entities"] = model.get("entities") if isinstance(model.get("entities"), list) else []
    model["dimensions"] = model.get("dimensions") if isinstance(model.get("dimensions"), list) else []
    model["relationships"] = model.get("relationships") if isinstance(model.get("relationships"), list) else []
    model["business_terms"] = model.get("business_terms") if isinstance(model.get("business_terms"), list) else []
    model["compatibility"] = {
        "dataset_first_mode": True,
        "backward_compatible": True,
        "notes": "The semantic model is additive and does not replace the existing dataset pipeline.",
        **(model.get("compatibility") if isinstance(model.get("compatibility"), dict) else {}),
    }

    normalized_dimensions = []
    for dimension in model.get("dimensions") if isinstance(model.get("dimensions"), list) else []:
        if isinstance(dimension, dict):
            normalized_dimensions.append(_normalize_existing_dimension(dimension, timestamp))
    model["dimensions"] = normalized_dimensions

    normalized_metrics = []
    for metric in model.get("metrics") if isinstance(model.get("metrics"), list) else []:
        if isinstance(metric, dict):
            normalized_metrics.append(_normalize_existing_metric(metric, timestamp))
    model["metrics"] = normalized_metrics

    model["summary"] = {
        "metric_count": len(model["metrics"]),
        "inferred_metric_count": len([metric for metric in model["metrics"] if metric.get("is_inferred")]),
        "user_defined_metric_count": len([metric for metric in model["metrics"] if metric.get("is_user_defined")]),
        "dimension_count": len(model["dimensions"]),
        "entity_count": len(model["entities"]),
    }

    return model


def list_semantic_metrics(semantic_model: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    model = finalize_semantic_model(semantic_model)
    return model["metrics"]


def create_user_defined_metric(
    semantic_model: Dict[str, Any],
    payload: Dict[str, Any],
    dataframe: Optional[pd.DataFrame] = None,
) -> Dict[str, Any]:
    model = finalize_semantic_model(semantic_model)
    available_columns = _available_columns(model, dataframe)
    existing_metrics = model.get("metrics", [])
    metric = build_user_metric_definition(
        payload=payload,
        existing_metrics=existing_metrics,
        available_columns=available_columns,
        existing_metric=None,
    )
    model["metrics"] = sorted([*existing_metrics, metric], key=_metric_sort_key)
    return finalize_semantic_model(model)


def update_user_defined_metric(
    semantic_model: Dict[str, Any],
    metric_id: str,
    payload: Dict[str, Any],
    dataframe: Optional[pd.DataFrame] = None,
) -> Dict[str, Any]:
    model = finalize_semantic_model(semantic_model)
    metrics = model.get("metrics", [])
    existing_metric = next((metric for metric in metrics if metric.get("id") == metric_id), None)
    if existing_metric is None:
        raise ValueError(f"Metric '{metric_id}' was not found.")
    if existing_metric.get("is_inferred"):
        raise ValueError("Inferred metrics are read-only. Create a user-defined metric instead.")

    available_columns = _available_columns(model, dataframe)
    updated_metric = build_user_metric_definition(
        payload=payload,
        existing_metrics=metrics,
        available_columns=available_columns,
        existing_metric=existing_metric,
    )
    model["metrics"] = sorted(
        [updated_metric if metric.get("id") == metric_id else metric for metric in metrics],
        key=_metric_sort_key,
    )
    return finalize_semantic_model(model)


def delete_user_defined_metric(semantic_model: Dict[str, Any], metric_id: str) -> Dict[str, Any]:
    model = finalize_semantic_model(semantic_model)
    metrics = model.get("metrics", [])
    existing_metric = next((metric for metric in metrics if metric.get("id") == metric_id), None)
    if existing_metric is None:
        raise ValueError(f"Metric '{metric_id}' was not found.")
    if existing_metric.get("is_inferred"):
        raise ValueError("Inferred metrics cannot be deleted.")

    model["metrics"] = [metric for metric in metrics if metric.get("id") != metric_id]
    return finalize_semantic_model(model)


def build_user_metric_definition(
    payload: Dict[str, Any],
    existing_metrics: Sequence[Dict[str, Any]],
    available_columns: Set[str],
    existing_metric: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Metric payload must be a JSON object.")

    timestamp = _iso_timestamp()
    name = str(payload.get("name") or payload.get("label") or payload.get("display_name") or "").strip()
    if not name:
        raise ValueError("Metric name is required.")

    description = str(payload.get("description") or "").strip()
    requested_id = payload.get("metric_id") or payload.get("id")
    base_id = str(requested_id or f"metric_{_slugify(name)}").strip()
    if not base_id:
        raise ValueError("Metric identifier could not be generated.")

    metric_id = _ensure_unique_metric_id(
        base_id=base_id,
        existing_metrics=existing_metrics,
        current_metric_id=existing_metric.get("id") if isinstance(existing_metric, dict) else None,
    )

    expression_input = payload.get("expression") if isinstance(payload.get("expression"), dict) else {}
    definition_kind = str(
        payload.get("definition_kind")
        or payload.get("definitionKind")
        or expression_input.get("type")
        or ("derived_formula" if payload.get("formula") or expression_input.get("formula") else "column_aggregation")
    ).strip().lower()

    aggregation = str(
        payload.get("aggregation_behavior")
        or payload.get("aggregationBehavior")
        or payload.get("default_aggregation")
        or payload.get("aggregation")
        or expression_input.get("aggregation")
        or "sum"
    ).strip().lower()
    if aggregation not in SUPPORTED_AGGREGATIONS:
        raise ValueError(f"Unsupported aggregation '{aggregation}'.")

    field = str(payload.get("field") or payload.get("column") or expression_input.get("column") or "").strip() or None
    formula = str(payload.get("formula") or expression_input.get("formula") or "").strip()
    expression_filters = payload.get("filters") if payload.get("filters") is not None else expression_input.get("filters")
    normalized_filters = _normalize_metric_filters(expression_filters, available_columns)

    if definition_kind == "count_rows":
        aggregation = "count"
        expression = {
            "type": "count_rows",
            "aggregation": "count",
            "filters": normalized_filters,
        }
        field = None
    elif definition_kind in {"column_aggregation", "column"}:
        if not field:
            raise ValueError("A source column is required for column aggregation metrics.")
        if available_columns and field not in available_columns:
            raise ValueError(f"Source column '{field}' does not exist in the active dataset.")
        expression = {
            "type": "column_aggregation",
            "column": field,
            "aggregation": aggregation,
            "filters": normalized_filters,
        }
    elif definition_kind in {"derived_formula", "formula"}:
        if not formula:
            raise ValueError("A formula definition is required for formula metrics.")
        formula_columns = extract_formula_columns(formula)
        if not formula_columns:
            raise ValueError("Formula metrics must reference one or more dataset columns using [Column Name] syntax.")
        missing_columns = [column for column in formula_columns if available_columns and column not in available_columns]
        if missing_columns:
            raise ValueError(f"Formula references missing columns: {', '.join(missing_columns)}.")
        expression = {
            "type": "derived_formula",
            "formula": formula,
            "columns": formula_columns,
            "aggregation": aggregation,
            "filters": normalized_filters,
        }
        field = field or formula_columns[0]
    else:
        raise ValueError(f"Unsupported metric definition type '{definition_kind}'.")

    existing_format_hint = existing_metric.get("format_hint") if isinstance(existing_metric, dict) else ""
    format_hint = str(
        payload.get("format_hint")
        or payload.get("formatHint")
        or ((payload.get("format") or {}).get("hint") if isinstance(payload.get("format"), dict) else "")
        or (payload.get("format_options") or {}).get("hint")
        or (payload.get("formatOptions") or {}).get("hint")
        or existing_format_hint
    ).strip().lower()
    if format_hint not in SUPPORTED_FORMAT_HINTS:
        raise ValueError(f"Unsupported format hint '{format_hint}'.")
    format_hint = format_hint or None

    format_options = payload.get("format_options") or payload.get("formatOptions") or {}
    if isinstance(payload.get("format"), dict):
        format_options = payload.get("format")
    if not isinstance(format_options, dict):
        raise ValueError("format_options must be a JSON object when provided.")
    normalized_format = {
        **(deepcopy(existing_metric.get("format")) if isinstance(existing_metric, dict) and isinstance(existing_metric.get("format"), dict) else {}),
        **deepcopy(format_options),
    }
    if format_hint is not None:
        normalized_format["hint"] = format_hint

    incoming_ownership = payload.get("ownership") if isinstance(payload.get("ownership"), dict) else {}
    base_ownership = deepcopy(existing_metric.get("ownership")) if isinstance(existing_metric, dict) and isinstance(existing_metric.get("ownership"), dict) else {}
    ownership = {
        "owner": incoming_ownership.get("owner") or base_ownership.get("owner") or "user",
        "created_by": base_ownership.get("created_by") or incoming_ownership.get("created_by") or "user",
        "updated_by": incoming_ownership.get("updated_by") or incoming_ownership.get("owner") or "user",
    }

    created_at = existing_metric.get("created_at") if isinstance(existing_metric, dict) else timestamp

    metric = {
        "id": metric_id,
        "metric_id": metric_id,
        "name": name,
        "label": str(payload.get("label") or payload.get("display_name") or name).strip() or name,
        "display_name": str(payload.get("display_name") or payload.get("label") or name).strip() or name,
        "description": description,
        "field": field,
        "entity_id": payload.get("entity_id") or payload.get("entityId") or (existing_metric.get("entity_id") if isinstance(existing_metric, dict) else "entity_primary_dataset"),
        "semantic_kind": "numeric",
        "data_type": "number",
        "definition_kind": expression["type"],
        "default_aggregation": aggregation,
        "aggregation_behavior": aggregation,
        "format_hint": format_hint,
        "format": normalized_format,
        "expression": expression,
        "filters": normalized_filters,
        "ownership": ownership,
        "status": "user_defined",
        "origin": "user_defined",
        "is_inferred": False,
        "is_user_defined": True,
        "decision_semantics": deepcopy(
            payload.get("decision_semantics")
            if isinstance(payload.get("decision_semantics"), dict)
            else (
                existing_metric.get("decision_semantics")
                if isinstance(existing_metric, dict) and isinstance(existing_metric.get("decision_semantics"), dict)
                else {}
            )
        ),
        "created_at": created_at,
        "updated_at": timestamp,
    }
    metric["decision_semantics"] = _build_metric_decision_semantics(metric)
    return metric


def merge_user_defined_metrics(
    inferred_metrics: Sequence[Dict[str, Any]],
    semantic_model: Dict[str, Any],
    available_columns: Set[str],
) -> List[Dict[str, Any]]:
    preserved_metrics = []
    for metric in finalize_semantic_model(semantic_model).get("metrics", []):
        if metric.get("is_inferred"):
            continue
        if _metric_is_compatible(metric, available_columns):
            preserved_metrics.append(_normalize_existing_metric(metric, _iso_timestamp()))
    return sorted([*list(inferred_metrics), *preserved_metrics], key=_metric_sort_key)


def extract_formula_columns(formula: str) -> List[str]:
    if not formula:
        return []
    seen = []
    for match in FORMULA_COLUMN_PATTERN.findall(formula):
        column = str(match).strip()
        if column and column not in seen:
            seen.append(column)
    return seen


def _build_field_profile(series: pd.Series, row_count: int) -> Dict[str, Any]:
    non_null = series.dropna()
    non_null_count = int(non_null.shape[0])
    null_count = max(row_count - non_null_count, 0)
    unique_count = int(non_null.nunique(dropna=True)) if non_null_count else 0
    unique_ratio = (unique_count / non_null_count) if non_null_count else 0.0
    column_name = str(series.name)
    normalized_name = column_name.lower()

    data_type = _infer_data_type(series, non_null)
    semantic_kind = _infer_semantic_kind(column_name, data_type, non_null)
    semantic_role = _infer_semantic_role(column_name, semantic_kind, unique_ratio, row_count, unique_count)

    return {
        "name": column_name,
        "data_type": data_type,
        "semantic_kind": semantic_kind,
        "semantic_role": semantic_role,
        "non_null_count": non_null_count,
        "null_count": null_count,
        "null_rate": round((null_count / row_count), 4) if row_count else 0.0,
        "unique_count": unique_count,
        "unique_ratio": round(unique_ratio, 4),
        "sample_values": _sample_values(non_null),
        "format_hint": _infer_format_hint(normalized_name, data_type),
        "default_aggregation": _default_aggregation(normalized_name, data_type),
    }


def _infer_data_type(series: pd.Series, non_null: pd.Series) -> str:
    if non_null.empty:
        return "unknown"
    if is_bool_dtype(series):
        return "boolean"
    if is_datetime64_any_dtype(series):
        return "datetime"
    if is_numeric_dtype(series):
        return "number"

    datetime_ratio = _coerce_ratio(non_null, kind="datetime")
    if datetime_ratio >= 0.6:
        return "datetime"

    numeric_ratio = _coerce_ratio(non_null, kind="numeric")
    if numeric_ratio >= 0.8:
        return "number"

    return "string"


def _infer_semantic_kind(column_name: str, data_type: str, non_null: pd.Series) -> str:
    lowered = column_name.lower()
    if data_type == "datetime" or any(keyword in lowered for keyword in TEMPORAL_KEYWORDS):
        return "temporal"
    if data_type == "number":
        return "numeric"
    if data_type == "boolean":
        return "categorical"
    if non_null.nunique(dropna=True) <= 12:
        return "categorical"
    return "categorical"


def _infer_semantic_role(
    column_name: str,
    semantic_kind: str,
    unique_ratio: float,
    row_count: int,
    unique_count: int,
) -> str:
    lowered = column_name.lower()
    looks_like_identifier = any(
        lowered == keyword
        or lowered.endswith(f"_{keyword}")
        or lowered.endswith(keyword)
        for keyword in IDENTIFIER_KEYWORDS
    )

    if looks_like_identifier and row_count > 0 and unique_count >= max(row_count - 1, 1):
        return "identifier"
    if semantic_kind == "numeric":
        return "metric"
    return "dimension"


def _sample_values(non_null: pd.Series, limit: int = 3) -> List[Any]:
    values: List[Any] = []
    for value in non_null.head(limit).tolist():
        if hasattr(value, "isoformat"):
            values.append(value.isoformat())
        else:
            values.append(value)
    return values


def _coerce_ratio(non_null: pd.Series, kind: str) -> float:
    if non_null.empty:
        return 0.0
    try:
        if kind == "numeric":
            coerced = pd.to_numeric(non_null, errors="coerce")
        else:
            try:
                coerced = pd.to_datetime(non_null, errors="coerce", utc=False, format="mixed")
            except TypeError:
                coerced = pd.to_datetime(non_null, errors="coerce", utc=False)
    except Exception:
        return 0.0
    return float(coerced.notna().sum()) / float(non_null.shape[0])


def _default_aggregation(normalized_name: str, data_type: str) -> Optional[str]:
    if data_type != "number":
        return None
    if any(keyword in normalized_name for keyword in RATE_KEYWORDS):
        return "avg"
    return "sum"


def _infer_format_hint(normalized_name: str, data_type: str) -> Optional[str]:
    if data_type == "datetime":
        return "date"
    if data_type != "number":
        return None
    if any(keyword in normalized_name for keyword in CURRENCY_KEYWORDS):
        return "currency"
    if any(keyword in normalized_name for keyword in ("rate", "ratio", "pct", "percent")):
        return "percentage"
    return "number"


def _build_dimension_definition(
    column_name: str,
    profile: Dict[str, Any],
    entity_id: str,
    timestamp: str,
) -> Dict[str, Any]:
    dimension = {
        "id": f"dimension_{_slugify(column_name)}",
        "name": column_name,
        "label": column_name,
        "field": column_name,
        "entity_id": entity_id,
        "semantic_kind": profile["semantic_kind"],
        "data_type": profile["data_type"],
        "description": f"Inferred dimension backed by the '{column_name}' field.",
        "status": "inferred",
        "is_inferred": True,
        "sample_values": profile["sample_values"],
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    dimension["decision_semantics"] = _build_dimension_decision_semantics(dimension)
    return dimension


def _build_metric_definition(
    column_name: str,
    profile: Dict[str, Any],
    entity_id: str,
    timestamp: str,
) -> Dict[str, Any]:
    aggregation = profile.get("default_aggregation") or "sum"
    metric_id = f"metric_{_slugify(column_name)}_{aggregation}"
    format_hint = profile.get("format_hint")
    metric = {
        "id": metric_id,
        "metric_id": metric_id,
        "name": column_name,
        "label": column_name,
        "display_name": column_name,
        "field": column_name,
        "entity_id": entity_id,
        "semantic_kind": profile["semantic_kind"],
        "data_type": profile["data_type"],
        "definition_kind": "column_aggregation",
        "default_aggregation": aggregation,
        "aggregation_behavior": aggregation,
        "format_hint": format_hint,
        "format": {"hint": format_hint} if format_hint else {},
        "expression": {
            "type": "column_aggregation",
            "column": column_name,
            "aggregation": aggregation,
        },
        "description": f"Inferred metric backed by the '{column_name}' field using {aggregation} aggregation.",
        "ownership": {
            "owner": "system",
            "created_by": "system",
            "updated_by": "system",
        },
        "status": "inferred",
        "origin": "inferred",
        "is_inferred": True,
        "is_user_defined": False,
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    metric["decision_semantics"] = _build_metric_decision_semantics(metric)
    return metric


def _available_columns(semantic_model: Dict[str, Any], dataframe: Optional[pd.DataFrame]) -> Set[str]:
    if isinstance(dataframe, pd.DataFrame):
        return {str(column) for column in dataframe.columns}
    field_profiles = semantic_model.get("field_profiles") if isinstance(semantic_model.get("field_profiles"), list) else []
    if field_profiles:
        return {str(item.get("name")) for item in field_profiles if item.get("name")}
    dimensions = semantic_model.get("dimensions") if isinstance(semantic_model.get("dimensions"), list) else []
    return {str(item.get("field")) for item in dimensions if item.get("field")}


def _ensure_unique_metric_id(
    base_id: str,
    existing_metrics: Sequence[Dict[str, Any]],
    current_metric_id: Optional[str],
) -> str:
    normalized_base = _slugify(base_id)
    candidate = normalized_base if normalized_base.startswith("metric_") else f"metric_{normalized_base}"
    existing_ids = {
        str(metric.get("id")).strip().lower()
        for metric in existing_metrics
        if metric.get("id") and metric.get("id") != current_metric_id
    }

    if candidate.lower() not in existing_ids:
        return candidate

    index = 2
    while f"{candidate}_{index}".lower() in existing_ids:
        index += 1
    return f"{candidate}_{index}"


def _normalize_metric_filters(filters: Any, available_columns: Set[str]) -> List[Dict[str, Any]]:
    if filters is None:
        return []
    if isinstance(filters, dict):
        filters = [filters]
    if not isinstance(filters, list):
        raise ValueError("Metric filters must be an object or an array of objects.")

    normalized_filters = []
    for item in filters:
        if not isinstance(item, dict):
            raise ValueError("Metric filters must be objects.")
        field = str(item.get("field") or item.get("column") or item.get("dimension_id") or item.get("dimension") or item.get("name") or "").strip()
        if not field:
            raise ValueError("Metric filters require a field reference.")
        if available_columns and field not in available_columns:
            raise ValueError(f"Metric filter field '{field}' does not exist in the active dataset.")
        operator = str(item.get("operator") or "eq").strip().lower()
        normalized_filters.append({
            "field": field,
            "operator": operator,
            "value": item.get("value"),
            "values": item.get("values"),
        })
    return normalized_filters


def _metric_is_compatible(metric: Dict[str, Any], available_columns: Set[str]) -> bool:
    expression = metric.get("expression") if isinstance(metric.get("expression"), dict) else {}
    expression_type = expression.get("type") or metric.get("definition_kind")
    referenced_columns = set()

    if expression_type == "column_aggregation":
        column = expression.get("column") or metric.get("field")
        if column:
            referenced_columns.add(str(column))
    elif expression_type == "derived_formula":
        referenced_columns.update(extract_formula_columns(expression.get("formula") or ""))

    for filter_def in metric.get("filters") or expression.get("filters") or []:
        if isinstance(filter_def, dict) and filter_def.get("field"):
            referenced_columns.add(str(filter_def.get("field")))

    return referenced_columns.issubset(available_columns)


def _normalize_existing_metric(metric: Dict[str, Any], fallback_timestamp: str) -> Dict[str, Any]:
    metric_copy = deepcopy(metric)
    metric_copy["id"] = metric_copy.get("id") or metric_copy.get("metric_id") or f"metric_{_slugify(metric_copy.get('name') or metric_copy.get('label') or 'metric')}"
    metric_copy["metric_id"] = metric_copy["id"]
    metric_copy["name"] = metric_copy.get("name") or metric_copy.get("display_name") or metric_copy.get("label") or metric_copy["id"]
    metric_copy["label"] = metric_copy.get("label") or metric_copy.get("display_name") or metric_copy["name"]
    metric_copy["display_name"] = metric_copy.get("display_name") or metric_copy["label"]
    metric_copy["default_aggregation"] = metric_copy.get("default_aggregation") or metric_copy.get("aggregation_behavior") or (metric_copy.get("expression") or {}).get("aggregation") or "sum"
    metric_copy["aggregation_behavior"] = metric_copy.get("aggregation_behavior") or metric_copy["default_aggregation"]
    metric_copy["definition_kind"] = metric_copy.get("definition_kind") or (metric_copy.get("expression") or {}).get("type") or "column_aggregation"
    metric_copy["format_hint"] = metric_copy.get("format_hint") or (metric_copy.get("format") or {}).get("hint")
    metric_copy["format"] = deepcopy(metric_copy.get("format")) if isinstance(metric_copy.get("format"), dict) else {}
    if metric_copy.get("format_hint") and "hint" not in metric_copy["format"]:
        metric_copy["format"]["hint"] = metric_copy["format_hint"]
    metric_copy["status"] = metric_copy.get("status") or ("user_defined" if metric_copy.get("is_user_defined") else "inferred")
    metric_copy["is_inferred"] = bool(metric_copy.get("is_inferred") or metric_copy["status"] == "inferred")
    metric_copy["is_user_defined"] = not metric_copy["is_inferred"]
    metric_copy["ownership"] = deepcopy(metric_copy.get("ownership")) if isinstance(metric_copy.get("ownership"), dict) else {
        "owner": "system" if metric_copy["is_inferred"] else "user",
        "created_by": "system" if metric_copy["is_inferred"] else "user",
        "updated_by": "system" if metric_copy["is_inferred"] else "user",
    }
    metric_copy["created_at"] = metric_copy.get("created_at") or fallback_timestamp
    metric_copy["updated_at"] = metric_copy.get("updated_at") or fallback_timestamp
    metric_copy["expression"] = deepcopy(metric_copy.get("expression")) if isinstance(metric_copy.get("expression"), dict) else {}
    metric_copy["filters"] = metric_copy.get("filters") if isinstance(metric_copy.get("filters"), list) else (
        metric_copy["expression"].get("filters") if isinstance(metric_copy["expression"].get("filters"), list) else []
    )
    metric_copy["decision_semantics"] = _build_metric_decision_semantics(metric_copy)
    return metric_copy


def _normalize_existing_dimension(dimension: Dict[str, Any], fallback_timestamp: str) -> Dict[str, Any]:
    dimension_copy = deepcopy(dimension)
    dimension_copy["id"] = dimension_copy.get("id") or dimension_copy.get("dimension_id") or f"dimension_{_slugify(dimension_copy.get('name') or dimension_copy.get('field') or 'dimension')}"
    dimension_copy["dimension_id"] = dimension_copy["id"]
    dimension_copy["name"] = dimension_copy.get("name") or dimension_copy.get("label") or dimension_copy.get("field") or dimension_copy["id"]
    dimension_copy["label"] = dimension_copy.get("label") or dimension_copy["name"]
    dimension_copy["field"] = dimension_copy.get("field") or dimension_copy["name"]
    dimension_copy["semantic_kind"] = dimension_copy.get("semantic_kind") or "categorical"
    dimension_copy["data_type"] = dimension_copy.get("data_type")
    dimension_copy["status"] = dimension_copy.get("status") or ("inferred" if dimension_copy.get("is_inferred") else "configured")
    dimension_copy["is_inferred"] = bool(dimension_copy.get("is_inferred") or dimension_copy["status"] == "inferred")
    dimension_copy["created_at"] = dimension_copy.get("created_at") or fallback_timestamp
    dimension_copy["updated_at"] = dimension_copy.get("updated_at") or fallback_timestamp
    dimension_copy["decision_semantics"] = _build_dimension_decision_semantics(dimension_copy)
    return dimension_copy


def _build_metric_decision_semantics(metric: Dict[str, Any]) -> Dict[str, Any]:
    existing = metric.get("decision_semantics") if isinstance(metric.get("decision_semantics"), dict) else {}
    text = _semantic_text(metric, ("id", "metric_id", "name", "label", "display_name", "field", "description"))
    aliases = _semantic_aliases(metric, ("name", "label", "display_name", "field"))
    objective_hits = _matched_keywords(text, OBJECTIVE_KEYWORDS)
    lever_hits = _matched_keywords(text, LEVER_KEYWORDS)
    guardrail_hits = _matched_keywords(text, GUARDRAIL_KEYWORDS)
    format_hint = str(metric.get("format_hint") or "").strip().lower()
    aggregation = str(metric.get("default_aggregation") or metric.get("aggregation_behavior") or "").strip().lower()

    objective_score = 0.2
    lever_score = 0.2
    guardrail_score = 0.2
    evidence: List[str] = []

    if objective_hits:
        objective_score += 0.45
        evidence.append(f"objective keywords: {', '.join(objective_hits[:3])}")
    if format_hint == "currency" and aggregation in {"sum", "avg", "average", "mean"}:
        objective_score += 0.12
        evidence.append("business metric format and aggregation")
    if lever_hits:
        lever_score += 0.5
        evidence.append(f"controllable lever keywords: {', '.join(lever_hits[:3])}")
    if guardrail_hits:
        guardrail_score += 0.45
        evidence.append(f"guardrail keywords: {', '.join(guardrail_hits[:3])}")
    if format_hint == "percentage":
        guardrail_score += 0.08
        evidence.append("percentage metric often acts as a threshold or guardrail")

    confidence = round(min(max(objective_score, lever_score, guardrail_score), 0.9), 2)
    objective_candidate = objective_score >= 0.62
    lever_candidate = lever_score >= 0.62
    guardrail_candidate = guardrail_score >= 0.62
    unresolved_reasons: List[str] = []
    if confidence < 0.55:
        unresolved_reasons.append("No strong business-role evidence was found for this metric.")
    if sum([objective_candidate, lever_candidate, guardrail_candidate]) > 1:
        unresolved_reasons.append("Multiple plausible decision roles were detected; prompt context should choose the role.")

    inferred = {
        "objective_candidate": objective_candidate,
        "lever_candidate": lever_candidate,
        "guardrail_candidate": guardrail_candidate,
        "polarity": _infer_metric_polarity(text),
        "controllability": _infer_metric_controllability(text, lever_candidate),
        "aliases": aliases,
        "business_terms": _dedupe_strings([*objective_hits, *lever_hits, *guardrail_hits]),
        "confidence": confidence,
        "confidence_reason": "; ".join(evidence) if evidence else "Only generic metric structure was available.",
        "unresolved_reasons": unresolved_reasons,
    }
    return _merge_decision_semantics(inferred, existing)


def _build_dimension_decision_semantics(dimension: Dict[str, Any]) -> Dict[str, Any]:
    existing = dimension.get("decision_semantics") if isinstance(dimension.get("decision_semantics"), dict) else {}
    text = _semantic_text(dimension, ("id", "dimension_id", "name", "label", "field", "description"))
    aliases = _semantic_aliases(dimension, ("name", "label", "field"))
    semantic_kind = str(dimension.get("semantic_kind") or "").strip().lower()
    data_type = str(dimension.get("data_type") or "").strip().lower()
    is_temporal = semantic_kind == "temporal" or data_type == "datetime" or bool(_matched_keywords(text, TEMPORAL_KEYWORDS))
    is_identifier = bool(_matched_keywords(text, IDENTIFIER_KEYWORDS))

    segment_candidate = not is_temporal and not is_identifier
    comparison_candidate = segment_candidate or is_temporal
    confidence = 0.84 if is_temporal else (0.72 if segment_candidate else 0.42)
    evidence = []
    if is_temporal:
        evidence.append("temporal semantic kind, data type, or name evidence")
    if segment_candidate:
        evidence.append("categorical or configured dimension suitable for segmentation")
    if is_identifier:
        evidence.append("identifier-like name reduces segmentation confidence")

    unresolved_reasons = []
    if confidence < 0.55:
        unresolved_reasons.append("Dimension appears identifier-like or lacks role evidence.")

    inferred = {
        "segment_candidate": segment_candidate,
        "comparison_candidate": comparison_candidate,
        "temporal_candidate": is_temporal,
        "grain": _infer_dimension_grain(text) if is_temporal else None,
        "aliases": aliases,
        "business_terms": _dedupe_strings(_matched_keywords(text, TEMPORAL_KEYWORDS)),
        "confidence": round(confidence, 2),
        "confidence_reason": "; ".join(evidence) if evidence else "Only generic dimension structure was available.",
        "unresolved_reasons": unresolved_reasons,
    }
    return _merge_decision_semantics(inferred, existing)


def _semantic_text(item: Dict[str, Any], keys: Sequence[str]) -> str:
    return " ".join(str(item.get(key) or "").lower() for key in keys)


def _semantic_aliases(item: Dict[str, Any], keys: Sequence[str]) -> List[str]:
    aliases: List[str] = []
    for key in keys:
        value = str(item.get(key) or "").strip()
        if value:
            aliases.append(value)
            normalized = " ".join(re.findall(r"[a-z0-9%]+", value.lower()))
            if normalized and normalized != value.lower():
                aliases.append(normalized)
    return _dedupe_strings(aliases)


def _matched_keywords(text: str, keywords: Sequence[str]) -> List[str]:
    normalized = " " + re.sub(r"[^a-z0-9%]+", " ", str(text or "").lower()) + " "
    return [
        keyword
        for keyword in keywords
        if f" {keyword} " in normalized or keyword in normalized.strip().split()
    ]


def _infer_metric_polarity(text: str) -> str:
    positive_hits = _matched_keywords(text, POSITIVE_POLARITY_KEYWORDS)
    negative_hits = _matched_keywords(text, NEGATIVE_POLARITY_KEYWORDS)
    if positive_hits and not negative_hits:
        return "increase_is_good"
    if negative_hits and not positive_hits:
        return "decrease_is_good"
    if positive_hits and negative_hits:
        return "context_dependent"
    return "unknown"


def _infer_metric_controllability(text: str, lever_candidate: bool) -> str:
    if lever_candidate:
        return "controllable"
    if _matched_keywords(text, ("revenue", "profit", "margin", "delivery", "return", "risk", "stockout")):
        return "outcome"
    return "unknown"


def _infer_dimension_grain(text: str) -> Optional[str]:
    for grain in GRAIN_KEYWORDS:
        if grain in text:
            return grain
    return "observed_value"


def _merge_decision_semantics(inferred: Dict[str, Any], existing: Dict[str, Any]) -> Dict[str, Any]:
    merged = deepcopy(inferred)
    for key, value in existing.items():
        if value is not None:
            merged[key] = deepcopy(value)
    merged["aliases"] = _dedupe_strings(list(inferred.get("aliases") or []) + list(existing.get("aliases") or []))
    merged["business_terms"] = _dedupe_strings(
        list(inferred.get("business_terms") or []) + list(existing.get("business_terms") or [])
    )
    merged["unresolved_reasons"] = _dedupe_strings(
        list(inferred.get("unresolved_reasons") or []) + list(existing.get("unresolved_reasons") or [])
    )
    return merged


def _dedupe_strings(items: Sequence[str]) -> List[str]:
    ordered: List[str] = []
    for item in items:
        text = str(item or "").strip()
        if text and text not in ordered:
            ordered.append(text)
    return ordered


def _metric_sort_key(metric: Dict[str, Any]) -> tuple:
    return (0 if metric.get("is_inferred") else 1, str(metric.get("label") or metric.get("name") or metric.get("id")).lower())
