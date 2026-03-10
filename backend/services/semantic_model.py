from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional, Sequence

import pandas as pd
from pandas.api.types import is_bool_dtype, is_datetime64_any_dtype, is_numeric_dtype


RATE_KEYWORDS = ('rate', 'ratio', 'pct', 'percent', 'average', 'avg', 'mean')
CURRENCY_KEYWORDS = ('revenue', 'sales', 'amount', 'cost', 'price', 'profit', 'income', 'spend')
IDENTIFIER_KEYWORDS = ('id', 'key', 'code', 'uuid', 'identifier')
TEMPORAL_KEYWORDS = ('date', 'time', 'timestamp', 'year', 'month', 'day', 'week', 'quarter')


def _iso_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _slugify(value: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '_', str(value).strip().lower())
    return slug.strip('_') or 'field'


def normalize_records(dataset_obj: Any) -> List[Dict[str, Any]]:
    if dataset_obj is None:
        return []

    if isinstance(dataset_obj, pd.DataFrame):
        return dataset_obj.to_dict(orient='records')

    if isinstance(dataset_obj, str):
        try:
            parsed = pd.read_json(dataset_obj)
            return parsed.to_dict(orient='records')
        except ValueError:
            return []

    if isinstance(dataset_obj, list):
        return [row for row in dataset_obj if isinstance(row, dict)]

    if isinstance(dataset_obj, dict):
        for key in ('data', 'rows', 'records', 'data_preview', 'full_data', 'cleaned_data'):
            candidate = dataset_obj.get(key)
            if candidate is not None:
                return normalize_records(candidate)

    return []


def infer_semantic_model_from_records(
    records: Sequence[Dict[str, Any]],
    dataset_name: Optional[str] = None,
    dataset_id: Optional[str] = None,
    source: str = 'inferred',
) -> Dict[str, Any]:
    df = pd.DataFrame(list(records)) if records else pd.DataFrame()
    return infer_semantic_model_from_dataframe(
        df,
        dataset_name=dataset_name,
        dataset_id=dataset_id,
        source=source,
    )


def infer_semantic_model_from_dataframe(
    df: pd.DataFrame,
    dataset_name: Optional[str] = None,
    dataset_id: Optional[str] = None,
    source: str = 'inferred',
) -> Dict[str, Any]:
    dataframe = df.copy() if df is not None else pd.DataFrame()
    row_count = len(dataframe.index)
    column_names = [str(col) for col in dataframe.columns]
    resolved_dataset_name = dataset_name or dataset_id or 'Active Dataset'
    entity_id = 'entity_primary_dataset'

    field_profiles: List[Dict[str, Any]] = []
    dimensions: List[Dict[str, Any]] = []
    metrics: List[Dict[str, Any]] = []
    identifier_candidates: List[str] = []

    for column in column_names:
        series = dataframe[column]
        profile = _build_field_profile(series, row_count)
        profile['field'] = column
        field_profiles.append(profile)

        if profile['semantic_role'] in {'dimension', 'identifier'}:
            dimensions.append(_build_dimension_definition(column, profile, entity_id))
        if profile['semantic_role'] == 'metric':
            metrics.append(_build_metric_definition(column, profile, entity_id))
        if profile['semantic_role'] == 'identifier':
            identifier_candidates.append(column)

    entity_definition = {
        'id': entity_id,
        'name': resolved_dataset_name,
        'label': resolved_dataset_name,
        'grain': 'record',
        'description': 'Default inferred entity representing one row in the active dataset.',
        'key_candidates': identifier_candidates,
        'fields': column_names,
        'status': 'inferred',
    }

    return {
        'version': 1,
        'generated_at': _iso_timestamp(),
        'source': source,
        'dataset': {
            'id': dataset_id,
            'name': resolved_dataset_name,
            'row_count': row_count,
            'column_count': len(column_names),
        },
        'field_profiles': field_profiles,
        'entities': [entity_definition],
        'dimensions': dimensions,
        'metrics': metrics,
        'relationships': [],
        'business_terms': [],
        'compatibility': {
            'dataset_first_mode': True,
            'backward_compatible': True,
            'notes': 'The semantic model is additive and does not replace the existing dataset pipeline.',
        },
    }


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
        'name': column_name,
        'data_type': data_type,
        'semantic_kind': semantic_kind,
        'semantic_role': semantic_role,
        'non_null_count': non_null_count,
        'null_count': null_count,
        'null_rate': round((null_count / row_count), 4) if row_count else 0.0,
        'unique_count': unique_count,
        'unique_ratio': round(unique_ratio, 4),
        'sample_values': _sample_values(non_null),
        'format_hint': _infer_format_hint(normalized_name, data_type),
        'default_aggregation': _default_aggregation(normalized_name, data_type),
    }


def _infer_data_type(series: pd.Series, non_null: pd.Series) -> str:
    if non_null.empty:
        return 'unknown'
    if is_bool_dtype(series):
        return 'boolean'
    if is_datetime64_any_dtype(series):
        return 'datetime'
    if is_numeric_dtype(series):
        return 'number'

    datetime_ratio = _coerce_ratio(non_null, kind='datetime')
    if datetime_ratio >= 0.6:
        return 'datetime'

    numeric_ratio = _coerce_ratio(non_null, kind='numeric')
    if numeric_ratio >= 0.8:
        return 'number'

    return 'string'


def _infer_semantic_kind(column_name: str, data_type: str, non_null: pd.Series) -> str:
    lowered = column_name.lower()
    if data_type == 'datetime' or any(keyword in lowered for keyword in TEMPORAL_KEYWORDS):
        return 'temporal'
    if data_type == 'number':
        return 'numeric'
    if data_type == 'boolean':
        return 'categorical'
    if non_null.nunique(dropna=True) <= 12:
        return 'categorical'
    return 'categorical'


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
        or lowered.endswith(f'_{keyword}')
        or lowered.endswith(keyword)
        for keyword in IDENTIFIER_KEYWORDS
    )

    if looks_like_identifier and row_count > 0 and unique_count >= max(row_count - 1, 1):
        return 'identifier'
    if semantic_kind == 'numeric':
        return 'metric'
    return 'dimension'


def _sample_values(non_null: pd.Series, limit: int = 3) -> List[Any]:
    values: List[Any] = []
    for value in non_null.head(limit).tolist():
        if hasattr(value, 'isoformat'):
            values.append(value.isoformat())
        else:
            values.append(value)
    return values


def _coerce_ratio(non_null: pd.Series, kind: str) -> float:
    if non_null.empty:
        return 0.0
    try:
        if kind == 'numeric':
            coerced = pd.to_numeric(non_null, errors='coerce')
        else:
            coerced = pd.to_datetime(non_null, errors='coerce', utc=False)
    except Exception:
        return 0.0
    return float(coerced.notna().sum()) / float(non_null.shape[0])


def _default_aggregation(normalized_name: str, data_type: str) -> Optional[str]:
    if data_type != 'number':
        return None
    if any(keyword in normalized_name for keyword in RATE_KEYWORDS):
        return 'avg'
    return 'sum'


def _infer_format_hint(normalized_name: str, data_type: str) -> Optional[str]:
    if data_type == 'datetime':
        return 'date'
    if data_type != 'number':
        return None
    if any(keyword in normalized_name for keyword in CURRENCY_KEYWORDS):
        return 'currency'
    if any(keyword in normalized_name for keyword in ('rate', 'ratio', 'pct', 'percent')):
        return 'percentage'
    return 'number'


def _build_dimension_definition(column_name: str, profile: Dict[str, Any], entity_id: str) -> Dict[str, Any]:
    return {
        'id': f"dimension_{_slugify(column_name)}",
        'name': column_name,
        'label': column_name,
        'field': column_name,
        'entity_id': entity_id,
        'semantic_kind': profile['semantic_kind'],
        'data_type': profile['data_type'],
        'description': f"Inferred dimension backed by the '{column_name}' field.",
        'status': 'inferred',
        'sample_values': profile['sample_values'],
    }


def _build_metric_definition(column_name: str, profile: Dict[str, Any], entity_id: str) -> Dict[str, Any]:
    aggregation = profile.get('default_aggregation') or 'sum'
    return {
        'id': f"metric_{_slugify(column_name)}_{aggregation}",
        'name': column_name,
        'label': column_name,
        'field': column_name,
        'entity_id': entity_id,
        'semantic_kind': profile['semantic_kind'],
        'data_type': profile['data_type'],
        'default_aggregation': aggregation,
        'format_hint': profile.get('format_hint'),
        'expression': {
            'type': 'column_aggregation',
            'column': column_name,
            'aggregation': aggregation,
        },
        'description': f"Inferred metric backed by the '{column_name}' field using {aggregation} aggregation.",
        'status': 'inferred',
    }
