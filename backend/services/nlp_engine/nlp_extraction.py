"""
Dataset and column extraction utilities for the NLP chart engine.
Refactored for deterministic type inference, consistent metadata,
and resilience to mixed or partially missing data.
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence
from dateutil import parser as date_parser


# --------------------------------------------------------------------
# Dataset normalization
# --------------------------------------------------------------------
def extract_dataset(dataset_obj: Any) -> List[Dict[str, Any]]:
    """Normalize incoming dataset payloads into a list of records deterministically."""
    if dataset_obj is None:
        return []

    # Parse JSON string payloads
    if isinstance(dataset_obj, str):
        try:
            parsed = json.loads(dataset_obj)
        except json.JSONDecodeError:
            return []
        return extract_dataset(parsed)

    # List of dictionaries (valid dataset)
    if isinstance(dataset_obj, list):
        if all(isinstance(row, dict) for row in dataset_obj):
            return dataset_obj
        return []

    # Dictionary containers
    if isinstance(dataset_obj, dict):
        # Known keys commonly used across upload and preview endpoints
        for key in ("data_preview", "cleanedData", "uploadedData", "rows", "data", "preview"):
            if key in dataset_obj:
                extracted = extract_dataset(dataset_obj[key])
                if extracted:
                    return extracted

        # Handle dict-of-dicts structures
        values = list(dataset_obj.values())
        if values and all(isinstance(v, dict) for v in values):
            return values

    return []


# --------------------------------------------------------------------
# Safe numeric conversion
# --------------------------------------------------------------------
def _safe_float(value: Any) -> Optional[float]:
    """Attempt to convert a value to float safely and deterministically."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().replace(",", "")
        if not cleaned:
            return None
        match = re.search(r"-?\d+(?:\.\d+)?", cleaned)
        if not match:
            return None
        try:
            return float(match.group())
        except ValueError:
            return None
    return None


# --------------------------------------------------------------------
# Temporal scoring & detection
# --------------------------------------------------------------------
def _temporal_score(name: str, values: Sequence[Any]) -> float:
    """
    Compute a 0–1 confidence score that a column is temporal.
    Deterministic, based on both name hints and value parsing.
    """
    lowered = name.lower()
    temporal_keywords = ("date", "time", "year", "month", "day", "week", "quarter", "timestamp")
    score = 0.4 if any(k in lowered for k in temporal_keywords) else 0.0

    parsed = 0
    total = 0
    numeric_years = 0
    iso_like = 0
    iso_pattern = re.compile(r"^\d{4}[-/](?:\d{1,2})(?:[-/]\d{1,2})?$")

    for value in values[:200]:
        if value in (None, ""):
            continue
        total += 1

        if isinstance(value, datetime):
            parsed += 1
            continue

        if hasattr(value, "to_pydatetime"):
            try:
                val = value.to_pydatetime()
                if isinstance(val, datetime):
                    parsed += 1
                    continue
            except Exception:
                pass

        text = str(value).strip()
        if not text:
            continue
        try:
            date_parser.parse(text)
            parsed += 1
        except Exception:
            numeric_value = _safe_float(text)
            if numeric_value is not None and 1800 <= numeric_value <= 2200 and float(numeric_value).is_integer():
                numeric_years += 1
            if iso_pattern.match(text):
                iso_like += 1

    if total > 0:
        score += 0.6 * (parsed / total)
        score += 0.25 * (numeric_years / total)
        score += 0.15 * (iso_like / total)
    return min(score, 1.0)


def _is_temporal_column(name: str, values: Sequence[Any]) -> bool:
    """True if the column is confidently temporal."""
    return _temporal_score(name, values) >= 0.6


# --------------------------------------------------------------------
# Numeric detection
# --------------------------------------------------------------------
def _numeric_ratio(values: Sequence[Any]) -> float:
    """Return fraction of values that can be interpreted as numeric."""
    numeric, total = 0, 0
    for v in values[:200]:
        if v in (None, ""):
            continue
        total += 1
        if _safe_float(v) is not None:
            numeric += 1
    return (numeric / total) if total else 0.0


def _is_numeric_column(values: Sequence[Any]) -> bool:
    """True if at least 60% of values can be parsed as numbers."""
    return _numeric_ratio(values) >= 0.6


# --------------------------------------------------------------------
# Column analysis and typing
# --------------------------------------------------------------------
def analyse_columns(dataset: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Analyse dataset columns deterministically to infer type and metadata.
    Returns a list of dictionaries describing each column.
    """
    if not dataset:
        return []

    columns: List[Dict[str, Any]] = []
    seen = set()
    ordered_names: List[str] = []

    # Preserve deterministic order
    for row in dataset:
        for key in row.keys():
            if key not in seen:
                seen.add(key)
                ordered_names.append(key)

    for name in ordered_names:
        values = [row.get(name) for row in dataset]
        temporal_conf = _temporal_score(name, values)
        numeric_conf = _numeric_ratio(values)
        non_null_values = [v for v in values if v not in (None, "")]
        unique_values = {str(v) for v in non_null_values}

        # Deterministic type assignment
        if temporal_conf >= 0.6:
            inferred_type = "temporal"
        elif numeric_conf >= 0.6:
            inferred_type = "numeric"
        else:
            inferred_type = "categorical"

        columns.append(
            {
                "name": name,
                "type": inferred_type,
                "values": values,
                "nonNullCount": len(non_null_values),
                "uniqueCount": len(unique_values),
                "numericRatio": numeric_conf,
                "temporalScore": temporal_conf,
            }
        )

    return columns
