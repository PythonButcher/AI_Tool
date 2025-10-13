"""Utility functions that power the natural language chart builder used by the AI chat."""
from __future__ import annotations

import json
import re
import difflib
import textwrap
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from dateutil import parser as date_parser

COLOR_PALETTE = [
    "#3366CC",
    "#DC3912",
    "#FF9900",
    "#109618",
    "#990099",
    "#0099C6",
    "#DD4477",
    "#66AA00",
    "#B82E2E",
    "#316395",
    "#994499",
    "#22AA99",
    "#AAAA11",
    "#6633CC",
    "#E67300",
]

_QUARTER_PATTERN = re.compile(r"(?i)(?:q([1-4])|([1-4])q)")
_YEAR_PATTERN = re.compile(r"^(18|19|20|21)\d{2}$")
_YEAR_MONTH_PATTERN = re.compile(r"^(?:(?:19|20|21)\d{2}[-/](0?[1-9]|1[0-2])|(0?[1-9]|1[0-2])[-/](?:19|20|21)\d{2})$")
_MONTH_NAME_PATTERN = re.compile(
    r"^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(?:19|20|21)\d{2}$",
    re.IGNORECASE,
)
_TIME_PATTERN = re.compile(r"\d{1,2}:\d{2}")

# Public guidance returned to the frontend so users know how to phrase queries.
NLP_QUERY_FORMAT = textwrap.dedent(
    """
    Recommended natural language structure:
    Chart: <Bar|Line|Pie|Doughnut|Scatter|Histogram>
    Value: <numeric column to measure or the keyword COUNT>
    Dimension: <category or time column to group by>
    Filter: <column> <operator> <value>  (optional, repeat for more filters)

    Example -> Chart: Bar; Value: Revenue; Dimension: Region; Filter: Year = 2023
    """
)


class QueryInterpretation(Dict[str, Any]):
    """Typed dictionary describing how the NLP parser understood the query."""


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
        # Frontend state frequently stores the preview rows as a plain list.
        if all(isinstance(row, dict) for row in dataset_obj):
            return dataset_obj
        return []

    if isinstance(dataset_obj, dict):
        # Direct preview payload {"data_preview": [...]}
        if "data_preview" in dataset_obj:
            return extract_dataset(dataset_obj["data_preview"])

        # Some callers forward the cleaned/uploaded wrapper objects untouched.
        for key in ("cleanedData", "uploadedData", "rows", "data", "preview"):
            if key in dataset_obj:
                extracted = extract_dataset(dataset_obj[key])
                if extracted:
                    return extracted

        # Occurs when previews are serialised as {"0": {...}, "1": {...}}
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
            except Exception:  # pragma: no cover - very defensive
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


def _detect_visual_intent(query: str) -> str:
    lowered = query.lower()
    visual_keywords = [
        "plot",
        "chart",
        "graph",
        "visualize",
        "visualise",
        "show",
        "display",
        "trend",
        "over time",
        "distribution",
        "breakdown",
        "compare",
    ]
    if any(keyword in lowered for keyword in visual_keywords):
        return "visualize"
    if "filter" in lowered or "subset" in lowered:
        return "filter"
    if "average" in lowered or "sum" in lowered or "total" in lowered:
        return "summarize"
    return "chat"


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _parse_directives(query: str) -> Dict[str, List[str]]:
    directives: Dict[str, List[str]] = {}
    for match in re.finditer(r"(chart|value|dimension|filter|time|group)\s*[:=]\s*([^;\n]+)", query, flags=re.IGNORECASE):
        key = match.group(1).lower()
        directives.setdefault(key, []).append(match.group(2).strip())
    return directives


def _score_columns(query: str, columns: Sequence[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    tokens = _normalize(query).split()
    quoted = {
        _normalize(match)
        for match in re.findall(r"\"([^\"]+)\"|'([^']+)'", query)
        if match
    }

    match_details: Dict[str, Dict[str, Any]] = {}
    for column in columns:
        name = column["name"]
        normalized_name = _normalize(name)
        col_tokens = [token for token in normalized_name.split() if token]
        score = 0.0
        reasons: List[str] = []

        if normalized_name in quoted:
            score += 6.0
            reasons.append("explicitly quoted in query")

        direct_tokens = [token for token in tokens if token in col_tokens]
        for token in direct_tokens:
            score += 3.0
            reasons.append(f"matched token '{token}'")

        if tokens:
            for token in tokens:
                if token == normalized_name:
                    score += 5.0
                    reasons.append("exact column name mentioned")

        if not direct_tokens:
            for token in tokens:
                if not token:
                    continue
                similarity = difflib.SequenceMatcher(None, token, normalized_name).ratio()
                if similarity >= 0.8:
                    score += similarity
                    reasons.append(f"fuzzy matched token '{token}' ({similarity:.2f})")

        if not reasons and normalized_name:
            if any(token in normalized_name for token in tokens):
                score += 0.5
                reasons.append("partial token overlap")

        match_details[name] = {"score": score, "reasons": reasons}
    return match_details


def _resolve_column(label: str, columns: Sequence[Dict[str, Any]]) -> Optional[str]:
    normalized_label = _normalize(label)
    best_match: Tuple[float, Optional[str]] = (0.0, None)
    for column in columns:
        normalized_name = _normalize(column["name"])
        if normalized_label == normalized_name:
            return column["name"]
        if normalized_label in normalized_name or normalized_name in normalized_label:
            score = len(normalized_label)
        else:
            score = difflib.SequenceMatcher(None, normalized_label, normalized_name).ratio()
        if score > best_match[0]:
            best_match = (score, column["name"])
    return best_match[1]


def _resolve_field_from_tokens(tokens: Iterable[str], columns: Sequence[Dict[str, Any]]) -> Optional[str]:
    normalized_tokens = [_normalize(token) for token in tokens if token]
    if not normalized_tokens:
        return None
    joined = " ".join(normalized_tokens)
    return _resolve_column(joined, columns)


def _extract_dimension_from_query(query: str, columns: Sequence[Dict[str, Any]]) -> Optional[str]:
    lowered = query.lower()
    patterns = [" by ", " per ", " grouped by ", " versus ", " vs "]
    for pattern in patterns:
        if pattern in lowered:
            segment = lowered.split(pattern, 1)[1]
            tokens = segment.split()
            candidate = _resolve_field_from_tokens(tokens[:3], columns)
            if candidate:
                return candidate
    return None


def _detect_explicit_chart_type(query: str) -> Optional[str]:
    lowered = query.lower()
    if "over time" in lowered or "over-time" in lowered or "time series" in lowered or "timeseries" in lowered:
        return "Line"
    chart_map = {
        "line": "Line",
        "line chart": "Line",
        "line graph": "Line",
        "bar": "Bar",
        "bar chart": "Bar",
        "bar graph": "Bar",
        "column": "Bar",
        "trend": "Line",
        "timeline": "Line",
        "pie": "Pie",
        "doughnut": "Doughnut",
        "donut": "Doughnut",
        "scatter": "Scatter",
        "bubble": "Scatter",
        "histogram": "Histogram",
        "distribution": "Histogram",
    }
    for keyword, chart in chart_map.items():
        if keyword in lowered:
            return chart
    return None


def _choose_chart_type(
    query: str, fields: Dict[str, Optional[str]], columns: Sequence[Dict[str, Any]]
) -> str:
    explicit = _detect_explicit_chart_type(query)
    if explicit:
        return explicit

    query_lower = query.lower()
    has_time = bool(fields.get("time"))
    has_category = bool(fields.get("category"))
    has_value = bool(fields.get("value"))
    has_secondary = bool(fields.get("secondary_value"))

    time_keywords = ["over time", "trend", "timeline", "by month", "by year", "monthly", "weekly", "daily"]
    share_keywords = ["share", "percentage", "percent", "portion", "breakdown"]
    scatter_keywords = ["scatter", "versus", "vs", "against"]

    if has_secondary or any(keyword in query_lower for keyword in scatter_keywords):
        if has_value and has_secondary:
            return "Scatter"

    if has_time:
        if has_value or not has_category:
            return "Line"
        if any(keyword in query_lower for keyword in time_keywords):
            return "Line"

    category_cardinality: Optional[int] = None
    if has_category:
        category_meta = next(
            (col for col in columns if col["name"] == fields.get("category")),
            None,
        )
        if category_meta:
            category_cardinality = category_meta.get("uniqueCount")
            if category_cardinality is None:
                category_cardinality = len(
                    {
                        str(value)
                        for value in category_meta.get("values", [])
                        if value not in (None, "")
                    }
                )

    if has_category and has_value and any(keyword in query_lower for keyword in share_keywords):
        if category_cardinality is None or category_cardinality <= 8:
            return "Pie"

    if has_category and not has_value and any(keyword in query_lower for keyword in share_keywords):
        if category_cardinality is None or category_cardinality <= 8:
            return "Pie"

    if has_category and has_value:
        return "Bar"

    if has_time:
        return "Line"

    if has_category and not has_value:
        return "Bar"

    if has_value and has_secondary:
        return "Scatter"

    return "Bar"


def _parse_filters(filter_texts: Sequence[str], columns: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    filters: List[Dict[str, Any]] = []
    pattern = re.compile(r"([^!=<>]+?)\s*(=|!=|>=|<=|>|<)\s*(.+)")
    for raw in filter_texts:
        match = pattern.match(raw.strip())
        if not match:
            continue
        column_hint, operator, value_text = match.groups()
        column_name = _resolve_column(column_hint, columns)
        if not column_name:
            continue
        value_text = value_text.strip().strip('"').strip("'")
        value: Any = value_text
        numeric_value = _safe_float(value_text)
        if numeric_value is not None:
            value = numeric_value
        filters.append(
            {
                "column": column_name,
                "operator": operator,
                "value": value,
                "raw": raw.strip(),
            }
        )
    return filters


def _apply_filters(dataset: Sequence[Dict[str, Any]], filters: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not filters:
        return list(dataset)

    def _passes(row: Dict[str, Any], flt: Dict[str, Any]) -> bool:
        raw_value = row.get(flt["column"])
        if raw_value is None:
            return False
        operator = flt["operator"]
        target = flt["value"]
        row_value = raw_value

        if isinstance(target, (int, float)):
            numeric_row = _safe_float(raw_value)
            if numeric_row is None:
                return False
            row_value = numeric_row
        elif isinstance(raw_value, str):
            row_value = raw_value.strip()
            target = str(target)

        try:
            if operator == "=":
                return row_value == target
            if operator == "!=":
                return row_value != target
            if operator == ">":
                return row_value > target
            if operator == "<":
                return row_value < target
            if operator == ">=":
                return row_value >= target
            if operator == "<=":
                return row_value <= target
        except TypeError:
            return False
        return False

    filtered: List[Dict[str, Any]] = []
    for row in dataset:
        if all(_passes(row, flt) for flt in filters):
            filtered.append(row)
    return filtered


def interpret_nl_query(query: str, columns: Sequence[Dict[str, Any]]) -> QueryInterpretation:
    directives = _parse_directives(query)
    query_lower = query.lower()
    match_details = _score_columns(query, columns)
    explicit_chart = _detect_explicit_chart_type(query)

    value_field: Optional[str] = None
    category_field: Optional[str] = None
    time_field: Optional[str] = None
    secondary_value: Optional[str] = None

    column_lookup = {col["name"]: col for col in columns}

    if "value" in directives:
        value_hint = directives["value"][0].strip()
        if value_hint.lower() not in {"count", "records", "rows"}:
            value_field = _resolve_column(value_hint, columns)
    if "dimension" in directives:
        category_field = _resolve_column(directives["dimension"][0], columns)
    if "time" in directives:
        time_field = _resolve_column(directives["time"][0], columns)

    if not category_field:
        category_field = _extract_dimension_from_query(query, columns)

    temporal_candidates = [col["name"] for col in columns if col["type"] == "temporal"]
    numeric_candidates = [col["name"] for col in columns if col["type"] == "numeric"]
    categorical_candidates = [col["name"] for col in columns if col["type"] == "categorical"]
    ranked_temporal = [
        name
        for _, name in sorted(
            (
                (col.get("temporalScore", 0.0), col["name"])
                for col in columns
            ),
            reverse=True,
        )
        if name
    ]

    def _best_match(candidates: Sequence[str], min_score: float = 0.0) -> Optional[str]:
        best_name: Optional[str] = None
        best_score = min_score
        for name in candidates:
            score = match_details.get(name, {"score": 0.0})["score"]
            if score > best_score:
                best_name = name
                best_score = score
        return best_name

    if not value_field:
        value_field = _best_match(numeric_candidates, 0.1)
        if not value_field and len(numeric_candidates) == 1:
            value_field = numeric_candidates[0]

    if not category_field:
        category_field = _best_match(categorical_candidates, 0.1)
        if not category_field and len(categorical_candidates) == 1:
            category_field = categorical_candidates[0]

    time_keywords = [
        "over time",
        "trend",
        "timeline",
        "by month",
        "by year",
        "monthly",
        "weekly",
        "daily",
    ]
    mentions_time = any(keyword in query_lower for keyword in time_keywords)

    if not time_field:
        time_field = _best_match(temporal_candidates, 0.1)
        if not time_field and mentions_time and temporal_candidates:
            time_field = temporal_candidates[0]

    explicit_line_requested = (
        explicit_chart == "Line"
        or "over time" in query_lower
        or "over-time" in query_lower
        or "time series" in query_lower
        or "timeseries" in query_lower
    )

    if explicit_line_requested and not time_field:
        for name in ranked_temporal:
            if name and name != value_field:
                candidate_meta = column_lookup.get(name, {})
                if candidate_meta.get("temporalScore", 0.0) > 0:
                    time_field = name
                    break
        if not time_field and ranked_temporal:
            fallback_name = ranked_temporal[0]
            if fallback_name:
                time_field = fallback_name
        if not time_field and category_field:
            time_field = category_field
            category_field = None

    grouping_keywords = [" by ", " per ", " versus ", " vs ", " against "]
    if mentions_time and time_field and "dimension" not in directives:
        if not any(keyword in query_lower for keyword in grouping_keywords):
            category_field = None

    if category_field and time_field and category_field == time_field:
        category_field = None

    if time_field and value_field and value_field == time_field:
        alternative_numeric = next(
            (name for name in numeric_candidates if name != time_field),
            None,
        )
        if alternative_numeric:
            value_field = alternative_numeric
        else:
            value_field = None

    scatter_keywords = {"scatter", "versus", "vs", "against"}
    scatter_requested = any(keyword in query_lower for keyword in scatter_keywords)

    if scatter_requested:
        numeric_scores = sorted(
            (
                (match_details.get(name, {"score": 0.0})["score"], name)
                for name in numeric_candidates
            ),
            reverse=True,
        )
        ranked_numeric = [name for score, name in numeric_scores if score > 0]
        if len(ranked_numeric) >= 2:
            if not value_field:
                value_field = ranked_numeric[0]
            if not secondary_value or secondary_value == value_field:
                secondary_value = ranked_numeric[1]
        elif len(numeric_candidates) >= 2:
            if not value_field:
                value_field = numeric_candidates[0]
            if not secondary_value or secondary_value == value_field:
                secondary_value = numeric_candidates[1]

    if secondary_value == value_field or (time_field and secondary_value == time_field):
        secondary_value = None

    chart_type = _choose_chart_type(
        query,
        {
            "value": value_field,
            "secondary_value": secondary_value,
            "category": category_field,
            "time": time_field,
        },
        columns,
    )
    if explicit_chart:
        chart_type = explicit_chart

    filters = _parse_filters(directives.get("filter", []), columns)

    interpretation: QueryInterpretation = QueryInterpretation(
        intent=_detect_visual_intent(query),
        chart_type=chart_type,
        fields={
            "value": value_field,
            "secondary_value": secondary_value,
            "category": category_field,
            "time": time_field,
        },
        filters=filters,
        matchDetails=[
            {
                "column": name,
                "score": details["score"],
                "reasons": details["reasons"],
            }
            for name, details in sorted(
                match_details.items(), key=lambda item: item[1]["score"], reverse=True
            )
        ],
    )
    return interpretation
def _limit_categories(category_totals: Dict[Any, float], limit: int = 10) -> List[Any]:
    if len(category_totals) <= limit:
        return list(category_totals.keys())
    most_common = Counter(category_totals).most_common(limit)
    return [item[0] for item in most_common]


def _palette_color(index: int) -> str:
    if not COLOR_PALETTE:
        return "#3366CC"
    return COLOR_PALETTE[index % len(COLOR_PALETTE)]


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

    # Default to daily resolution
    if dt:
        return dt.strftime("%Y-%m-%d"), dt
    return None, None


def _aggregate_time_series(
    dataset: Sequence[Dict[str, Any]],
    *,
    time_field: str,
    granularity: str,
    category_field: Optional[str],
    value_field: Optional[str],
) -> Tuple[Dict[str, Dict[str, Any]], Dict[Any, float]]:
    time_buckets: Dict[str, Dict[str, Any]] = {}
    category_totals: Dict[Any, float] = defaultdict(float)

    value_key = value_field or "Count"

    for row in dataset:
        label, sort_key = _format_time_bucket(row.get(time_field), granularity)
        if label is None:
            continue
        if label not in time_buckets:
            time_buckets[label] = {"sort": sort_key, "values": defaultdict(float)}

        if category_field:
            category_value = row.get(category_field, "Other")
            if value_field:
                numeric = _safe_float(row.get(value_field))
                if numeric is None:
                    continue
                time_buckets[label]["values"][category_value] += numeric
                category_totals[category_value] += numeric
            else:
                time_buckets[label]["values"][category_value] += 1
                category_totals[category_value] += 1
        else:
            if value_field:
                numeric = _safe_float(row.get(value_field))
                if numeric is None:
                    continue
                time_buckets[label]["values"].setdefault(value_key, 0.0)
                time_buckets[label]["values"][value_key] += numeric
            else:
                time_buckets[label]["values"].setdefault(value_key, 0)
                time_buckets[label]["values"][value_key] += 1

    return time_buckets, category_totals


def _value_axis_label(value_field: Optional[str], aggregation: str = "Sum") -> str:
    if not value_field:
        return "Record Count"
    return f"{aggregation} of {value_field}"


def _build_chart_data(chart_type: str, dataset: Sequence[Dict[str, Any]], fields: Dict[str, Optional[str]]):
    value_field = fields.get("value")
    secondary_value = fields.get("secondary_value")
    category_field = fields.get("category")
    time_field = fields.get("time")

    if not dataset:
        return None, "No data available to build a chart."

    explanation_parts: List[str] = []

    def _finalize_chart(
        chart_payload: Dict[str, Any],
        *,
        axis_x: Optional[str] = None,
        axis_y: Optional[str] = None,
        series_field: Optional[str] = None,
        series_values: Optional[Sequence[Any]] = None,
        legend: Optional[bool] = None,
        legend_position: Optional[str] = None,
        sorted_labels: bool = False,
        time_granularity: Optional[str] = None,
        x_scale_type: Optional[str] = None,
        begin_at_zero: Optional[bool] = None,
    ) -> Dict[str, Any]:
        base_meta = {
            "chartType": chart_type,
            "fields": {
                "value": value_field,
                "secondaryValue": secondary_value,
                "category": category_field,
                "time": time_field,
            },
            "sortedLabels": bool(sorted_labels),
        }

        axis_labels: Dict[str, str] = {}
        if axis_x:
            axis_labels["x"] = axis_x
        if axis_y:
            axis_labels["y"] = axis_y
        if axis_labels:
            base_meta["axisLabels"] = axis_labels

        if series_field:
            series_meta: Dict[str, Any] = {"field": series_field}
            if series_values is not None:
                series_meta["values"] = list(series_values)
            base_meta["series"] = series_meta

        if time_granularity:
            base_meta["timeGranularity"] = time_granularity

        if x_scale_type:
            base_meta["xScaleType"] = x_scale_type

        if begin_at_zero is not None:
            base_meta["beginAtZero"] = begin_at_zero

        if legend is None:
            if chart_type in {"Pie", "Doughnut"}:
                legend = True
            elif chart_type == "Scatter":
                legend = False
            else:
                legend = len(chart_payload.get("datasets", [])) > 1

        base_meta["legend"] = {"display": bool(legend)}
        if legend_position:
            base_meta["legend"]["position"] = legend_position

        combined_meta = dict(chart_payload.get("meta", {}))
        combined_meta.update(base_meta)

        finalized = dict(chart_payload)
        finalized["meta"] = combined_meta
        return finalized

    if chart_type == "Scatter" and value_field and secondary_value:
        explanation_parts.append(f"scatter of {secondary_value} versus {value_field}")
        points = []
        for row in dataset:
            x_val = _safe_float(row.get(value_field))
            y_val = _safe_float(row.get(secondary_value))
            if x_val is None or y_val is None:
                continue
            points.append({"x": x_val, "y": y_val})

        if not points:
            return None, "Not enough numeric values to build a scatter plot."

        chart_data = {
            "labels": [],
            "datasets": [
                {
                    "label": f"{secondary_value} vs {value_field}",
                    "data": points,
                    "backgroundColor": _palette_color(0),
                    "borderColor": _palette_color(0),
                    "pointRadius": 4,
                    "showLine": False,
                }
            ],
        }
        chart_data = _finalize_chart(
            chart_data,
            axis_x=value_field or "Value",
            axis_y=secondary_value or "Comparison",
            legend=False,
            x_scale_type="linear",
            begin_at_zero=False,
        )
        return chart_data, ", ".join(explanation_parts)

    if chart_type == "Line" and time_field:
        time_values = [row.get(time_field) for row in dataset]
        granularity = _infer_temporal_granularity(time_values)
        time_buckets, category_totals = _aggregate_time_series(
            dataset,
            time_field=time_field,
            granularity=granularity,
            category_field=category_field,
            value_field=value_field,
        )

        if not time_buckets:
            return None, "Unable to interpret the requested time field."

        sorted_labels = sorted(
            time_buckets.keys(),
            key=lambda lbl: time_buckets[lbl]["sort"],
        )

        if granularity == "date" and len(sorted_labels) > 60:
            granularity = "month"
            time_buckets, category_totals = _aggregate_time_series(
                dataset,
                time_field=time_field,
                granularity=granularity,
                category_field=category_field,
                value_field=value_field,
            )
            sorted_labels = sorted(
                time_buckets.keys(),
                key=lambda lbl: time_buckets[lbl]["sort"],
            )

        if not sorted_labels:
            return None, "Unable to interpret the requested time field."

        if category_field:
            limited_categories = _limit_categories(category_totals) if category_totals else []
            if not limited_categories:
                limited_categories = list(time_buckets[sorted_labels[0]]["values"].keys())
            series_names = [str(category) for category in limited_categories]
        else:
            value_key = value_field or "Count"
            limited_categories = [value_key]
            series_names = None

        datasets = []
        for index, category in enumerate(limited_categories):
            datasets.append(
                {
                    "label": str(category),
                    "data": [time_buckets[label]["values"].get(category, 0) for label in sorted_labels],
                    "tension": 0.35,
                    "fill": False,
                    "borderColor": _palette_color(index),
                    "backgroundColor": _palette_color(index),
                    "pointRadius": 3,
                }
            )

        granularity_label = {
            "year": "Year",
            "quarter": "Quarter",
            "month": "Month",
            "date": "Day",
        }.get(granularity, "Time")

        axis_x_label = (
            f"{time_field} ({granularity_label})" if time_field else granularity_label
        )
        axis_y_label = _value_axis_label(value_field)
        explanation_parts.append(f"{axis_y_label.lower()} across {axis_x_label.lower()}")

        chart_data = {
            "labels": sorted_labels,
            "datasets": datasets,
        }
        chart_data = _finalize_chart(
            chart_data,
            axis_x=axis_x_label,
            axis_y=axis_y_label,
            series_field=category_field,
            series_values=series_names,
            sorted_labels=True,
            time_granularity=granularity,
            x_scale_type="category",
            begin_at_zero=True,
        )
        return chart_data, ", ".join(explanation_parts)

    if chart_type in {"Pie", "Doughnut"} and category_field:
        totals: Dict[Any, float] = defaultdict(float)
        for row in dataset:
            category_value = row.get(category_field, "Other")
            if value_field:
                numeric = _safe_float(row.get(value_field))
                if numeric is None:
                    continue
                totals[category_value] += numeric
            else:
                totals[category_value] += 1

        if not totals:
            return None, "No measurable values found for the requested fields."

        labels = _limit_categories(totals)
        label_strings = [str(label) for label in labels]
        axis_y_label = _value_axis_label(value_field)
        explanation_parts.append(f"{axis_y_label.lower()} by {category_field}")

        colors = [_palette_color(idx) for idx in range(len(label_strings))]
        chart_data = {
            "labels": label_strings,
            "datasets": [
                {
                    "label": axis_y_label,
                    "data": [totals[label] for label in labels],
                    "backgroundColor": colors,
                    "hoverBackgroundColor": colors,
                }
            ],
        }
        chart_data = _finalize_chart(
            chart_data,
            series_field=category_field,
            series_values=label_strings,
            legend=True,
            legend_position="right",
        )
        return chart_data, ", ".join(explanation_parts)

    if category_field:
        totals = defaultdict(float)
        for row in dataset:
            category_value = row.get(category_field, "Other")
            if value_field:
                numeric = _safe_float(row.get(value_field))
                if numeric is None:
                    continue
                totals[category_value] += numeric
            else:
                totals[category_value] += 1

        if not totals:
            return None, "No measurable values found for the requested fields."

        labels = _limit_categories(totals)
        data_values = [totals[label] for label in labels]
        label_strings = [str(label) for label in labels]
        axis_y_label = _value_axis_label(value_field)
        explanation_parts.append(f"{axis_y_label.lower()} by {category_field}")

        colors = [_palette_color(idx) for idx in range(len(label_strings))]
        chart_data = {
            "labels": label_strings,
            "datasets": [
                {
                    "label": axis_y_label,
                    "data": data_values,
                    "backgroundColor": colors,
                    "borderColor": colors,
                    "borderWidth": 1,
                }
            ],
        }
        chart_data = _finalize_chart(
            chart_data,
            axis_x=category_field,
            axis_y=axis_y_label,
            begin_at_zero=True,
        )
        return chart_data, ", ".join(explanation_parts)

    if time_field:
        time_values = [row.get(time_field) for row in dataset]
        granularity = _infer_temporal_granularity(time_values)
        time_buckets, _ = _aggregate_time_series(
            dataset,
            time_field=time_field,
            granularity=granularity,
            category_field=None,
            value_field=value_field,
        )

        if not time_buckets:
            return None, "Unable to build a chart with the requested fields."

        sorted_labels = sorted(
            time_buckets.keys(),
            key=lambda lbl: time_buckets[lbl]["sort"],
        )

        granularity_label = {
            "year": "Year",
            "quarter": "Quarter",
            "month": "Month",
            "date": "Day",
        }.get(granularity, "Time")

        axis_x_label = (
            f"{time_field} ({granularity_label})" if time_field else granularity_label
        )
        axis_y_label = _value_axis_label(value_field)
        explanation_parts.append(f"{axis_y_label.lower()} by {axis_x_label.lower()}")

        value_key = value_field or "Count"
        colors = [_palette_color(idx) for idx in range(len(sorted_labels))]
        chart_data = {
            "labels": sorted_labels,
            "datasets": [
                {
                    "label": axis_y_label,
                    "data": [time_buckets[label]["values"].get(value_key, 0) for label in sorted_labels],
                    "backgroundColor": colors,
                    "borderColor": colors,
                    "borderWidth": 1,
                }
            ],
        }
        chart_data = _finalize_chart(
            chart_data,
            axis_x=axis_x_label,
            axis_y=axis_y_label,
            sorted_labels=True,
            time_granularity=granularity,
            x_scale_type="category",
            begin_at_zero=True,
        )
        return chart_data, ", ".join(explanation_parts)

    if value_field:
        values = [
            _safe_float(row.get(value_field))
            for row in dataset
            if _safe_float(row.get(value_field)) is not None
        ]
        if not values:
            return None, "No numeric values available for the requested field."
        values.sort()
        bins = min(10, max(3, int(len(values) ** 0.5)))
        min_val, max_val = values[0], values[-1]
        if min_val == max_val:
            labels = [str(min_val)]
            frequencies = [len(values)]
        else:
            step = (max_val - min_val) / bins
            edges = [min_val + i * step for i in range(bins + 1)]
            frequencies = [0] * bins
            for value in values:
                index = min(int((value - min_val) / step), bins - 1)
                frequencies[index] += 1
            labels = [f"{round(edges[i], 2)}–{round(edges[i + 1], 2)}" for i in range(bins)]
        axis_y_label = "Frequency"
        explanation_parts = [f"distribution of {value_field}"]
        chart_data = {
            "labels": labels,
            "datasets": [
                {
                    "label": value_field,
                    "data": frequencies,
                    "backgroundColor": _palette_color(0),
                    "borderColor": _palette_color(0),
                    "borderWidth": 1,
                }
            ],
        }
        chart_data = _finalize_chart(
            chart_data,
            axis_x=value_field,
            axis_y=axis_y_label,
            legend=False,
            begin_at_zero=True,
        )
        return chart_data, ", ".join(explanation_parts)

    return None, "Unable to determine appropriate fields for charting."


def build_chart_response(dataset: Sequence[Dict[str, Any]], interpretation: QueryInterpretation):
    filtered_dataset = _apply_filters(dataset, interpretation.get("filters", []))
    chart_data, explanation = _build_chart_data(
        interpretation.get("chart_type", "Bar"),
        filtered_dataset,
        interpretation.get("fields", {}),
    )
    return chart_data, explanation, filtered_dataset
