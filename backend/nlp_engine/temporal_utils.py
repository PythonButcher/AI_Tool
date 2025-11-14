"""
Temporal utility functions for deterministic time handling.
Handles parsing, classification, normalization, and formatting
of dates/times for use in chart generation.
"""

import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

# --------------------------------------------------------------------
# Core safe parsing function
# --------------------------------------------------------------------
def _parse_date_safe(value: Any) -> Optional[datetime.datetime]:
    """
    Attempt to parse a date from various input formats.
    Returns None if parsing fails.
    """
    if value is None:
        return None
    if isinstance(value, datetime.datetime):
        return value
    if isinstance(value, datetime.date):
        return datetime.datetime(value.year, value.month, value.day)
    if not isinstance(value, str):
        return None

    # Common date formats to check
    formats = [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%Y-%m",
        "%Y/%m",
        "%Y",
        "%b %Y",
        "%B %Y",
        "%Y %b",
        "%Y %B",
        "%d-%b-%Y",
        "%d-%B-%Y",
        "%m/%d/%Y",
        "%d/%m/%Y",
    ]
    for fmt in formats:
        try:
            return datetime.datetime.strptime(value.strip(), fmt)
        except Exception:
            continue
    return None


# --------------------------------------------------------------------
# Classification
# --------------------------------------------------------------------
def _classify_temporal_value(value: Any) -> Optional[str]:
    """
    Classify a temporal value into 'year', 'quarter', 'month', or 'date'.
    Returns None if no valid classification is found.
    """
    dt = _parse_date_safe(value)
    if not dt:
        return None

    # Heuristic classification based on precision
    if dt.day != 1:
        return "date"
    if dt.month != 1:
        return "month"
    if dt.month in (1, 4, 7, 10):
        return "quarter"
    return "year"


# --------------------------------------------------------------------
# Granularity inference
# --------------------------------------------------------------------
def _infer_temporal_granularity(values: List[Any]) -> Optional[str]:
    """
    Infer the overall granularity from a list of temporal values.
    Chooses the most specific consistent level (year < month < date).
    """
    detected = {"year": 0, "quarter": 0, "month": 0, "date": 0}
    for v in values:
        t = _classify_temporal_value(v)
        if t:
            detected[t] += 1

    if not any(detected.values()):
        return None

    # Pick the finest granularity that exists
    for level in ("date", "month", "quarter", "year"):
        if detected[level] > 0:
            return level
    return "date"


# --------------------------------------------------------------------
# Date normalization (main entry for builder)
# --------------------------------------------------------------------
def _ensure_datetime_from_info(value: Any) -> Optional[datetime.datetime]:
    """
    Convert an input value into a datetime object deterministically.
    Compatible with all builder/aggregator logic.
    """
    return _parse_date_safe(value)


# --------------------------------------------------------------------
# Time bucket formatting (for consistent labels)
# --------------------------------------------------------------------
def _format_time_bucket(dt: datetime.datetime, granularity: str = "date") -> str:
    """
    Format datetime objects into uniform string buckets:
      - Year: "2025"
      - Quarter: "2025-Q1"
      - Month: "2025-01"
      - Date: "2025-01-31"
    """
    if not isinstance(dt, datetime.datetime):
        return str(dt)

    if granularity == "year":
        return dt.strftime("%Y")
    if granularity == "quarter":
        q = (dt.month - 1) // 3 + 1
        return f"{dt.year}-Q{q}"
    if granularity == "month":
        return dt.strftime("%Y-%m")
    return dt.strftime("%Y-%m-%d")


# --------------------------------------------------------------------
# Aggregation utility for grouping data by time bucket
# --------------------------------------------------------------------
def _aggregate_time_series(
    dataset: List[Dict[str, Any]],
    time_field: str,
    value_field: str,
    aggregation: str = "sum"
) -> Dict[str, float]:
    """
    Deterministically aggregate time series data into buckets based on
    detected granularity. Returns a mapping {bucket_label: aggregated_value}.
    """
    from .chart_builder import _aggregate  # local import to avoid circular ref

    # Extract valid date/value pairs
    valid_pairs: List[Tuple[datetime.datetime, float]] = []
    for row in dataset:
        date_obj = _ensure_datetime_from_info(row.get(time_field))
        value = row.get(value_field)
        if date_obj and isinstance(value, (int, float)):
            valid_pairs.append((date_obj, value))

    if not valid_pairs:
        return {}

    # Detect consistent granularity
    granularity = _infer_temporal_granularity([d for d, _ in valid_pairs]) or "date"

    # Group and aggregate
    buckets: Dict[str, List[float]] = {}
    for dt, val in valid_pairs:
        label = _format_time_bucket(dt, granularity)
        buckets.setdefault(label, []).append(val)

    aggregated = {label: _aggregate(vals, aggregation) for label, vals in buckets.items()}

    # Sort ascending by chronological order of labels
    sorted_aggregated = dict(sorted(aggregated.items(), key=lambda kv: kv[0]))
    return sorted_aggregated


# --------------------------------------------------------------------
# Temporal confidence scoring (for interpreter)
# --------------------------------------------------------------------
def _temporal_score(value: Any) -> float:
    """
    Assign a numeric confidence score that a given value is temporal.
    Used by NLP interpreter to rank candidate time fields.
    """
    if isinstance(value, (datetime.date, datetime.datetime)):
        return 1.0
    if isinstance(value, (int, float)) and 1900 <= value <= 2100:
        return 0.8
    if isinstance(value, str):
        dt = _parse_date_safe(value)
        return 0.9 if dt else 0.0
    return 0.0
