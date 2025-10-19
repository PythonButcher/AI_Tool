"""Temporal parsing helpers for the NLP chart engine."""
from __future__ import annotations

import re
from collections import Counter
from datetime import datetime
from typing import Any, Dict, Optional, Sequence, Tuple

from dateutil import parser as date_parser

_QUARTER_PATTERN = re.compile(r"(?i)(?:q([1-4])|([1-4])q)")
_YEAR_PATTERN = re.compile(r"^(18|19|20|21)\d{2}$")
_YEAR_MONTH_PATTERN = re.compile(
    r"^(?:(?:19|20|21)\d{2}[-/](0?[1-9]|1[0-2])|(0?[1-9]|1[0-2])[-/](?:19|20|21)\d{2})$"
)
_MONTH_NAME_PATTERN = re.compile(
    r"^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(?:19|20|21)\d{2}$",
    re.IGNORECASE,
)
_TIME_PATTERN = re.compile(r"\d{1,2}:\d{2}")


def _classify_temporal_value(value: Any) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    if value in (None, ""):
        return None, None

    if isinstance(value, datetime):
        classification = (
            "datetime"
            if any((value.hour, value.minute, value.second, value.microsecond))
            else "date"
        )
        return classification, {"datetime": value}

    if isinstance(value, (int, float)):
        numeric = float(value)
        if numeric.is_integer() and 1800 <= int(numeric) <= 2200:
            year = int(numeric)
            return "year", {"year": year}

    text = str(value).strip()
    if not text:
        return None, None

    upper_text = text.upper()
    quarter_match = _QUARTER_PATTERN.search(upper_text)
    if quarter_match:
        quarter_str = quarter_match.group(1) or quarter_match.group(2)
        year_match = re.search(r"(18|19|20|21)\d{2}", upper_text)
        if year_match:
            year = int(year_match.group())
            quarter = int(quarter_str)
            return "quarter", {"year": year, "quarter": quarter}

    if _YEAR_PATTERN.match(text):
        year = int(text)
        return "year", {"year": year}

    if _YEAR_MONTH_PATTERN.match(text):
        parts = re.split(r"[-/]", text)
        if len(parts) == 2:
            first, second = parts
            if len(first) == 4:
                year, month = int(first), int(second)
            else:
                year, month = int(second), int(first)
            return "month", {"year": year, "month": month}

    if _MONTH_NAME_PATTERN.match(text):
        month_name, year_part = text.split()
        month_lookup = {
            "JAN": 1,
            "FEB": 2,
            "MAR": 3,
            "APR": 4,
            "MAY": 5,
            "JUN": 6,
            "JUL": 7,
            "AUG": 8,
            "SEP": 9,
            "SEPT": 9,
            "OCT": 10,
            "NOV": 11,
            "DEC": 12,
        }
        month = month_lookup.get(month_name[:3].upper())
        if month:
            return "month", {"year": int(year_part), "month": month}

    try:
        parsed = date_parser.parse(text)
    except (ValueError, TypeError, OverflowError):
        return None, None

    has_time_component = bool(_TIME_PATTERN.search(text)) or any(
        (parsed.hour, parsed.minute, parsed.second, parsed.microsecond)
    )
    classification = "datetime" if has_time_component else "date"
    return classification, {"datetime": parsed}


def _infer_temporal_granularity(values: Sequence[Any]) -> str:
    counts: Counter[str] = Counter()
    for value in values:
        classification, _ = _classify_temporal_value(value)
        if classification:
            counts[classification] += 1

    if not counts:
        return "date"

    bucket_scores = {
        "year": counts.get("year", 0),
        "quarter": counts.get("quarter", 0),
        "month": counts.get("month", 0) + counts.get("datetime", 0),
        "date": counts.get("date", 0),
    }

    preference = {"year": 0, "quarter": 1, "month": 2, "date": 3}
    granularity = max(
        bucket_scores.items(),
        key=lambda item: (item[1], -preference[item[0]]),
    )[0]

    return granularity


def _ensure_datetime_from_info(classification: str, info: Dict[str, Any]) -> Optional[datetime]:
    if not info:
        return None
    if classification in {"date", "datetime"}:
        return info.get("datetime")
    if classification == "month":
        return datetime(info["year"], info["month"], 1)
    if classification == "quarter":
        month = (info["quarter"] - 1) * 3 + 1
        return datetime(info["year"], month, 1)
    if classification == "year":
        return datetime(info["year"], 1, 1)
    return None


def _format_time_bucket(value: Any, granularity: str) -> Tuple[Optional[str], Any]:
    classification, info = _classify_temporal_value(value)
    if not classification:
        return None, None

    dt = _ensure_datetime_from_info(classification, info)

    if granularity == "year":
        if classification == "year" and info:
            year = info["year"]
        elif dt:
            year = dt.year
        else:
            return None, None
        return str(year), year

    if granularity == "quarter":
        if classification == "quarter" and info:
            year = info["year"]
            quarter = info["quarter"]
        elif dt:
            year = dt.year
            quarter = ((dt.month - 1) // 3) + 1
        else:
            return None, None
        return f"{year}-Q{quarter}", (year, quarter)

    if granularity == "month":
        if dt:
            return f"{dt.year}-{dt.month:02d}", (dt.year, dt.month)
        if classification == "quarter" and info:
            month = (info["quarter"] - 1) * 3 + 1
            return f"{info['year']}-{month:02d}", (info["year"], month)
        return None, None

    if dt:
        return dt.strftime("%Y-%m-%d"), dt
    return None, None
