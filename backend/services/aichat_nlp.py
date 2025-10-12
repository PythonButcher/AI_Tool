"""Utility functions that power the natural language chart builder used by the AI chat."""
from __future__ import annotations

import re
import difflib
import textwrap
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from dateutil import parser as date_parser

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
    if isinstance(dataset_obj, dict) and "data_preview" in dataset_obj:
        preview = dataset_obj["data_preview"]
        if isinstance(preview, str):
            try:
                import json

                return json.loads(preview)
            except json.JSONDecodeError:
                return []
        if isinstance(preview, list):
            return preview
    if isinstance(dataset_obj, list):
        return dataset_obj
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


def _is_temporal_column(name: str, values: Sequence[Any]) -> bool:
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
    if any(keyword in lowered for keyword in temporal_keywords):
        return True
    parsed = 0
    total = 0
    for value in values[:50]:
        if value in (None, ""):
            continue
        total += 1
        try:
            date_parser.parse(str(value))
            parsed += 1
        except (ValueError, TypeError, OverflowError):
            continue
    return total > 0 and parsed / total >= 0.5


def _is_numeric_column(values: Sequence[Any]) -> bool:
    numeric = 0
    total = 0
    for value in values[:200]:
        if value in (None, ""):
            continue
        total += 1
        if _safe_float(value) is not None:
            numeric += 1
    return total > 0 and numeric / total >= 0.6


def analyse_columns(dataset: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not dataset:
        return []
    columns: List[Dict[str, Any]] = []
    sample_record = dataset[0]
    for name in sample_record.keys():
        values = [row.get(name) for row in dataset]
        if _is_temporal_column(name, values):
            inferred_type = "temporal"
        elif _is_numeric_column(values):
            inferred_type = "numeric"
        else:
            inferred_type = "categorical"
        columns.append(
            {
                "name": name,
                "type": inferred_type,
                "values": values,
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
    chart_map = {
        "bar": "Bar",
        "column": "Bar",
        "line": "Line",
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


def _choose_chart_type(query: str, fields: Dict[str, Optional[str]]) -> str:
    explicit = _detect_explicit_chart_type(query)
    if explicit:
        return explicit

    if fields.get("time"):
        return "Line"

    if fields.get("category") and fields.get("value"):
        return "Bar"

    if fields.get("category") and not fields.get("value"):
        return "Bar"

    if fields.get("value") and fields.get("secondary_value"):
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
    match_details = _score_columns(query, columns)

    value_field: Optional[str] = None
    category_field: Optional[str] = None
    time_field: Optional[str] = None
    secondary_value: Optional[str] = None

    if "value" in directives:
        value_field = _resolve_column(directives["value"][0], columns)
    if "dimension" in directives:
        category_field = _resolve_column(directives["dimension"][0], columns)
    if "time" in directives:
        time_field = _resolve_column(directives["time"][0], columns)

    if not category_field:
        category_field = _extract_dimension_from_query(query, columns)

    temporal_candidates = [col["name"] for col in columns if col["type"] == "temporal"]
    numeric_candidates = [col["name"] for col in columns if col["type"] == "numeric"]
    categorical_candidates = [col["name"] for col in columns if col["type"] == "categorical"]

    def _best_match(candidates: Sequence[str]) -> Optional[str]:
        best = (0.0, None)
        for name in candidates:
            detail = match_details.get(name, {"score": 0.0})
            if detail["score"] > best[0]:
                best = (detail["score"], name)
        return best[1]

    if not value_field:
        value_field = _best_match(numeric_candidates)
    if not category_field:
        category_field = _best_match(categorical_candidates)
    if not time_field:
        time_field = _best_match(temporal_candidates)

    # If the query emphasises time-based words, prefer the time field as dimension.
    if any(keyword in query.lower() for keyword in ["over time", "trend", "timeline", "by month", "by year"]):
        if time_field:
            category_field = None

    # Detect requests involving two numeric fields.
    if " vs " in query.lower() or " versus " in query.lower():
        parts = re.split(r"versus|vs", query, flags=re.IGNORECASE)
        if len(parts) >= 2:
            left = _resolve_column(parts[0], columns)
            right = _resolve_column(parts[1], columns)
            numeric_matches = [
                match
                for match in [left, right]
                if match and match in {col["name"] for col in columns if col["type"] == "numeric"}
            ]
            if len(numeric_matches) >= 2:
                value_field, secondary_value = numeric_matches[:2]

    explicit_chart = _detect_explicit_chart_type(query)
    chart_type = _choose_chart_type(query, {
        "value": value_field,
        "secondary_value": secondary_value,
        "category": category_field,
        "time": time_field,
    })
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


def _format_time_value(value: Any) -> Tuple[Optional[str], Any]:
    if value in (None, ""):
        return None, None
    if isinstance(value, (int, float)):
        return str(value), float(value)
    text = str(value).strip()
    if not text:
        return None, None
    try:
        parsed = date_parser.parse(text)
        return parsed.strftime("%Y-%m-%d"), parsed
    except (ValueError, TypeError, OverflowError):
        return text, text.lower()


def _limit_categories(category_totals: Dict[Any, float], limit: int = 10) -> List[Any]:
    if len(category_totals) <= limit:
        return list(category_totals.keys())
    most_common = Counter(category_totals).most_common(limit)
    return [item[0] for item in most_common]


def _build_chart_data(chart_type: str, dataset: Sequence[Dict[str, Any]], fields: Dict[str, Optional[str]]):
    value_field = fields.get("value")
    secondary_value = fields.get("secondary_value")
    category_field = fields.get("category")
    time_field = fields.get("time")

    if not dataset:
        return None, "No data available to build a chart."

    explanation_parts: List[str] = []

    if chart_type == "Scatter" and value_field and secondary_value:
        explanation_parts.append(f"{secondary_value} versus {value_field}")
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
                    "backgroundColor": "rgba(75, 192, 192, 0.6)",
                    "pointRadius": 4,
                    "showLine": False,
                }
            ],
        }
        return chart_data, ", ".join(explanation_parts)

    if chart_type == "Line" and time_field:
        explanation_parts.append(f"trends in {value_field or 'records'} over {time_field}")
        time_buckets: Dict[str, Dict[str, Any]] = {}
        category_totals: Dict[Any, float] = defaultdict(float)
        for row in dataset:
            label, sort_key = _format_time_value(row.get(time_field))
            if label is None:
                continue
            if label not in time_buckets:
                time_buckets[label] = {"sort": sort_key, "values": defaultdict(float)}
            if category_field:
                category_value = row.get(category_field, "Other")
                if value_field:
                    numeric = _safe_float(row.get(value_field))
                    if numeric is not None:
                        time_buckets[label]["values"][category_value] += numeric
                        category_totals[category_value] += numeric
                else:
                    time_buckets[label]["values"][category_value] += 1
                    category_totals[category_value] += 1
            else:
                if value_field:
                    numeric = _safe_float(row.get(value_field))
                    if numeric is not None:
                        time_buckets[label]["values"]["Value"] += numeric
                else:
                    time_buckets[label]["values"]["Count"] += 1

        sorted_labels = sorted(
            time_buckets.keys(),
            key=lambda lbl: (0 if isinstance(time_buckets[lbl]["sort"], datetime) else 1, time_buckets[lbl]["sort"]),
        )

        if not sorted_labels:
            return None, "Unable to interpret the requested time field."

        if category_field:
            limited_categories = _limit_categories(category_totals) if category_totals else []
            if not limited_categories:
                limited_categories = [
                    next(
                        iter(time_buckets[sorted_labels[0]]["values"].keys()),
                        "Value",
                    )
                ]
        else:
            limited_categories = [
                next(iter(time_buckets[sorted_labels[0]]["values"].keys()), "Value")
            ]

        datasets = []
        for category in limited_categories:
            datasets.append(
                {
                    "label": str(category),
                    "data": [time_buckets[label]["values"].get(category, 0) for label in sorted_labels],
                    "tension": 0.3,
                    "fill": False,
                }
            )

        chart_data = {"labels": sorted_labels, "datasets": datasets}
        return chart_data, ", ".join(explanation_parts)

    if chart_type in {"Pie", "Doughnut"} and category_field:
        explanation_parts.append(f"the share of {value_field or 'records'} by {category_field}")
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
        chart_data = {
            "labels": [str(label) for label in labels],
            "datasets": [
                {
                    "label": value_field or "Count",
                    "data": [totals[label] for label in labels],
                }
            ],
        }
        return chart_data, ", ".join(explanation_parts)

    explanation_parts.append(
        f"{value_field or 'record counts'} by {category_field or (time_field or 'observations')}"
    )

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
        chart_data = {
            "labels": [str(label) for label in labels],
            "datasets": [
                {
                    "label": value_field or "Count",
                    "data": data_values,
                }
            ],
        }
        return chart_data, ", ".join(explanation_parts)

    if time_field:
        buckets: Dict[str, float] = defaultdict(float)
        for row in dataset:
            label, sort_key = _format_time_value(row.get(time_field))
            if label is None:
                continue
            value = 1 if value_field is None else _safe_float(row.get(value_field)) or 0
            buckets[label] += value
        if not buckets:
            return None, "Unable to build a chart with the requested fields."
        sorted_labels = sorted(
            buckets.keys(),
            key=lambda lbl: (0 if isinstance(_format_time_value(lbl)[1], datetime) else 1, _format_time_value(lbl)[1]),
        )
        chart_data = {
            "labels": sorted_labels,
            "datasets": [
                {
                    "label": value_field or "Count",
                    "data": [buckets[label] for label in sorted_labels],
                }
            ],
        }
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
        chart_data = {
            "labels": labels,
            "datasets": [
                {
                    "label": value_field,
                    "data": frequencies,
                }
            ],
        }
        explanation_parts = [f"distribution of {value_field}"]
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
