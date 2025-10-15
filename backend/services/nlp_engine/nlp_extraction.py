"""Dataset and column extraction utilities for the NLP chart engine."""
from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Sequence

from dateutil import parser as date_parser


def extract_dataset(dataset_obj: Any) -> List[Dict[str, Any]]:
    """Normalize incoming dataset payloads into a list of records."""

    if dataset_obj is None:
        return []

    if isinstance(dataset_obj, str):
        try:
            parsed = json.loads(dataset_obj)
        except json.JSONDecodeError:
            return []
        return extract_dataset(parsed)

    if isinstance(dataset_obj, list):
        if all(isinstance(row, dict) for row in dataset_obj):
            return dataset_obj
        return []

    if isinstance(dataset_obj, dict):
        if "data_preview" in dataset_obj:
            return extract_dataset(dataset_obj["data_preview"])

        for key in ("cleanedData", "uploadedData", "rows", "data", "preview"):
            if key in dataset_obj:
                extracted = extract_dataset(dataset_obj[key])
                if extracted:
                    return extracted

        values = list(dataset_obj.values())
        if values and all(isinstance(value, dict) for value in values):
            return values

    return []


def _safe_float(value: Any) -> Optional[float]:
    """Attempt to convert a value to float, returning None on failure."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return None
        cleaned = cleaned.replace(",", "")
        match = re.search(r"-?\d+(?:\.\d+)?", cleaned)
        if not match:
            return None
        try:
            return float(match.group())
        except ValueError:
            return None
    return None


def _temporal_score(name: str, values: Sequence[Any]) -> float:
    """Return a confidence score (0-1) that a column is temporal."""

    lowered = name.lower()
    temporal_keywords = [
        "date",
        "time",
        "year",
        "month",
        "day",
        "week",
        "quarter",
        "timestamp",
    ]

    score = 0.0
    if any(keyword in lowered for keyword in temporal_keywords):
        score += 0.4

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
                value = value.to_pydatetime()
                if isinstance(value, datetime):
                    parsed += 1
                    continue
            except Exception:  # pragma: no cover - defensive
                pass

        text = str(value).strip()
        if not text:
            continue

        try:
            date_parser.parse(text)
            parsed += 1
        except (ValueError, TypeError, OverflowError):
            numeric_value = _safe_float(text)
            if numeric_value is not None and 1800 <= numeric_value <= 2200 and float(numeric_value).is_integer():
                numeric_years += 1
            if iso_pattern.match(text):
                iso_like += 1

    if total:
        score += 0.6 * (parsed / total)
        score += 0.25 * (numeric_years / total)
        score += 0.15 * (iso_like / total)

    return min(score, 1.0)


def _is_temporal_column(name: str, values: Sequence[Any]) -> bool:
    return _temporal_score(name, values) >= 0.6


def _numeric_ratio(values: Sequence[Any]) -> float:
    numeric = 0
    total = 0
    for value in values[:200]:
        if value in (None, ""):
            continue
        total += 1
        if _safe_float(value) is not None:
            numeric += 1
    if not total:
        return 0.0
    return numeric / total


def _is_numeric_column(values: Sequence[Any]) -> bool:
    return _numeric_ratio(values) >= 0.6


def analyse_columns(dataset: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not dataset:
        return []

    columns: List[Dict[str, Any]] = []
    seen = set()
    ordered_names: List[str] = []
    for row in dataset:
        for key in row.keys():
            if key not in seen:
                seen.add(key)
                ordered_names.append(key)

    for name in ordered_names:
        values = [row.get(name) for row in dataset]
        temporal_confidence = _temporal_score(name, values)
        numeric_confidence = _numeric_ratio(values)
        non_null_values = [value for value in values if value not in (None, "")]
        unique_values = {str(value) for value in non_null_values}

        if temporal_confidence >= 0.6:
            inferred_type = "temporal"
        elif numeric_confidence >= 0.6:
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
                "numericRatio": numeric_confidence,
                "temporalScore": temporal_confidence,
            }
        )
    return columns
