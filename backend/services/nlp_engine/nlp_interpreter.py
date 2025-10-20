"""Query parsing and scoring logic for the NLP chart engine (deterministic refactor)."""
from __future__ import annotations

import difflib
import re
import textwrap
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from .nlp_extraction import _safe_float

# --------------------------------------------------------------------
# User-facing guidance (left intact)
# --------------------------------------------------------------------
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


# --------------------------------------------------------------------
# Intent & normalization helpers (unchanged behavior)
# --------------------------------------------------------------------
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
    for match in re.finditer(
        r"(chart|value|dimension|filter|time|group)\s*[:=]\s*([^;\n]+)",
        query,
        flags=re.IGNORECASE,
    ):
        key = match.group(1).lower()
        directives.setdefault(key, []).append(match.group(2).strip())
    return directives


# --------------------------------------------------------------------
# Deterministic column scoring
#  - Precedence: quoted > exact phrase > exact name token > verbatim > token overlap > fuzzy.
#  - Fuzzy is capped very low to avoid overpowering exact matches.
# --------------------------------------------------------------------
def _score_columns(query: str, columns: Sequence[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    tokens = _normalize(query).split()
    normalized_query = _normalize(query)
    quoted_phrases: set[str] = set()
    for double, single in re.findall(r"\"([^\"]+)\"|'([^']+)'", query):
        phrase = double or single
        normalized_phrase = _normalize(phrase)
        if normalized_phrase:
            quoted_phrases.add(normalized_phrase)

    match_details: Dict[str, Dict[str, Any]] = {}
    for column in columns:
        name = column["name"]
        normalized_name = _normalize(name)
        col_tokens = [token for token in normalized_name.split() if token]
        score = 0.0
        reasons: List[str] = []

        # Highest priority: explicit quoted reference to the exact column name
        if normalized_name in quoted_phrases:
            score += 50.0
            reasons.append("explicitly quoted in query")

        # Exact phrase match inside the normalized query text
        if normalized_name and normalized_query:
            haystack = f" {normalized_query} "
            needle = f" {normalized_name} "
            if needle in haystack:
                score += 15.0
                reasons.append("exact column phrase mentioned")

        # Exact token equals the entire normalized name
        if normalized_name and any(token == normalized_name for token in tokens):
            score += 12.0
            reasons.append("exact column name mentioned")

        # Verbatim (case-sensitive) literal hit in the original query string
        direct_phrase = re.search(
            rf"(?i)(?<!\w){re.escape(name)}(?!\w)",
            query,
        )
        if direct_phrase:
            score += 10.0
            reasons.append("column referenced verbatim")

        # Token overlap (deterministic, small nudge)
        direct_tokens = [token for token in tokens if token in col_tokens]
        for token in direct_tokens:
            score += 4.0
            reasons.append(f"matched token '{token}'")

        # Very low-weight fuzzy match (never outweighs explicit/phrase/name/token)
        if not direct_tokens:
            for token in tokens:
                if not token:
                    continue
                similarity = difflib.SequenceMatcher(None, token, normalized_name).ratio()
                if similarity >= 0.8:
                    fuzzy_score = min(1.0, similarity)  # tighter cap than before
                    score += fuzzy_score
                    reasons.append(f"fuzzy matched token '{token}' ({similarity:.2f})")

        # Partial overlap as last resort
        if not reasons and normalized_name:
            if any(token in normalized_name for token in tokens):
                score += 0.25
                reasons.append("partial token overlap")

        match_details[name] = {"score": score, "reasons": reasons}
    return match_details


# --------------------------------------------------------------------
# Deterministic resolution: exact > token overlap > fuzzy; no randomness.
# --------------------------------------------------------------------
def _resolve_column(label: str, columns: Sequence[Dict[str, Any]]) -> Optional[str]:
    normalized_label = _normalize(label.strip("'\""))
    if not normalized_label:
        return None

    # Exact normalized name match
    for column in columns:
        if normalized_label == _normalize(column["name"]):
            return column["name"]

    # Token-overlap ratio
    label_tokens = [token for token in normalized_label.split() if token]
    if label_tokens:
        best_token_match: Tuple[float, Optional[str]] = (0.0, None)
        for column in columns:
            normalized_name = _normalize(column["name"])
            if not normalized_name:
                continue
            name_tokens = normalized_name.split()
            overlap = sum(1 for token in label_tokens if token in name_tokens)
            if overlap:
                score = overlap / max(len(label_tokens), len(name_tokens))
                if score > best_token_match[0]:
                    best_token_match = (score, column["name"])
        if best_token_match[1]:
            return best_token_match[1]

    # Low-impact fuzzy backup
    best_fuzzy: Tuple[float, Optional[str]] = (0.0, None)
    for column in columns:
        normalized_name = _normalize(column["name"])
        if not normalized_name:
            continue
        similarity = difflib.SequenceMatcher(None, normalized_label, normalized_name).ratio()
        if similarity > best_fuzzy[0]:
            best_fuzzy = (similarity, column["name"])
    return best_fuzzy[1]


def _resolve_field_from_tokens(
    tokens: Iterable[str], columns: Sequence[Dict[str, Any]]
) -> Optional[str]:
    normalized_tokens = [_normalize(token) for token in tokens if token]
    if not normalized_tokens:
        return None
    joined = " ".join(normalized_tokens)
    return _resolve_column(joined, columns)


def _extract_dimension_from_query(
    query: str, columns: Sequence[Dict[str, Any]]
) -> Optional[str]:
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


# --------------------------------------------------------------------
# Explicit chart-type detection: explicit keywords ALWAYS win.
# --------------------------------------------------------------------
def _detect_explicit_chart_type(query: str) -> Optional[str]:
    lowered = query.lower()
    if (
        "over time" in lowered
        or "over-time" in lowered
        or "time series" in lowered
        or "timeseries" in lowered
    ):
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


def _find_mentioned_columns(query: str, columns: Sequence[Dict[str, Any]]) -> List[str]:
    mentions: List[Tuple[int, str]] = []
    normalized_query = _normalize(query)

    for column in columns:
        name = column["name"]
        normalized_name = _normalize(name)
        position: Optional[int] = None

        # Verbatim hit
        if name:
            direct_match = re.search(
                rf"(?i)(?<!\w){re.escape(name)}(?!\w)",
                query,
            )
            if direct_match:
                position = direct_match.start()

        # Exact normalized phrase hit
        if position is None and normalized_name and normalized_query:
            haystack = f" {normalized_query} "
            needle = f" {normalized_name} "
            idx = haystack.find(needle)
            if idx != -1:
                position = idx

        if position is not None:
            mentions.append((position, name))

    mentions.sort(key=lambda item: item[0])

    ordered_names: List[str] = []
    seen: set[str] = set()
    for _, name in mentions:
        if name not in seen:
            seen.add(name)
            ordered_names.append(name)

    return ordered_names


# --------------------------------------------------------------------
# Deterministic chart-type choice:
#  - Explicit request always wins.
#  - If any time field exists (and no explicit type), prefer Line (your rule).
#  - Otherwise, Bar when category+value, Pie for "share/percentage" with low cardinality,
#    Scatter when two numeric values are present or "versus/vs/against" is used.
# --------------------------------------------------------------------
def _choose_chart_type(
    query: str, fields: Dict[str, Optional[str]], columns: Sequence[Dict[str, Any]]
) -> str:
    query_lower = query.lower()

    # Hard override: explicit phrases have absolute priority
    explicit_phrases = {
        "bar chart": "Bar",
        "line chart": "Line",
        "pie chart": "Pie",
        "doughnut chart": "Doughnut",
        "scatter plot": "Scatter",
        "histogram": "Histogram",
    }
    for phrase, chart in explicit_phrases.items():
        if phrase in query_lower:
            return chart

    explicit = _detect_explicit_chart_type(query)
    if explicit:
        return explicit

    has_time = bool(fields.get("time"))
    has_category = bool(fields.get("category"))
    has_value = bool(fields.get("value"))
    has_secondary = bool(fields.get("secondary_value"))

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
    share_keywords = ["share", "percentage", "percent", "portion", "breakdown"]
    scatter_keywords = ["scatter", "versus", "vs", "against"]

    # Scatter when explicitly implied or two numeric values identified
    if has_secondary or any(keyword in query_lower for keyword in scatter_keywords):
        if has_value and has_secondary:
            return "Scatter"

    # Prefer Line if any time field is present (per your directive)
    if has_time:
        return "Line"

    # Pie when "share" semantics and manageable category cardinality
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

    if has_category and (has_value or not has_value) and any(
        keyword in query_lower for keyword in share_keywords
    ):
        if category_cardinality is None or category_cardinality <= 8:
            return "Pie"

    # Default deterministic fallbacks
    if has_category and has_value:
        return "Bar"
    if has_category and not has_value:
        return "Bar"
    if has_value and has_secondary:
        return "Scatter"

    return "Bar"


# --------------------------------------------------------------------
# Filters (kept intact, deterministic)
# --------------------------------------------------------------------
def _parse_filters(
    filter_texts: Sequence[str], columns: Sequence[Dict[str, Any]]
) -> List[Dict[str, Any]]:
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


def _apply_filters(
    dataset: Sequence[Dict[str, Any]], filters: Sequence[Dict[str, Any]]
) -> List[Dict[str, Any]]:
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


# --------------------------------------------------------------------
# Main entry: deterministic interpretation
#  - Honors explicit chart type.
#  - Prefers time -> Line.
#  - Resolves fields using stable scoring; avoids random fuzzy outcomes.
# --------------------------------------------------------------------
def interpret_nl_query(
    query: str, columns: Sequence[Dict[str, Any]]
) -> QueryInterpretation:
    directives = _parse_directives(query)
    query_lower = query.lower()
    match_details = _score_columns(query, columns)
    explicit_chart = _detect_explicit_chart_type(query)

    value_field: Optional[str] = None
    category_field: Optional[str] = None
    time_field: Optional[str] = None
    secondary_value: Optional[str] = None

    column_lookup = {col["name"]: col for col in columns}
    mentioned_columns = _find_mentioned_columns(query, columns)

    # Directive hints (exact > token > fuzzy)
    if "value" in directives:
        value_hint = directives["value"][0].strip()
        if value_hint.lower() not in {"count", "records", "rows"}:
            value_field = _resolve_column(value_hint, columns)
    if "dimension" in directives:
        category_field = _resolve_column(directives["dimension"][0], columns)
    if "time" in directives:
        time_field = _resolve_column(directives["time"][0], columns)

    # Dimension via "by/per/versus/vs"
    if not category_field:
        category_field = _extract_dimension_from_query(query, columns)

    temporal_candidates = [col["name"] for col in columns if col["type"] == "temporal"]
    numeric_candidates = [col["name"] for col in columns if col["type"] == "numeric"]
    categorical_candidates = [col["name"] for col in columns if col["type"] == "categorical"]
    ranked_temporal = [
        name
        for _, name in sorted(
            ((col.get("temporalScore", 0.0), col["name"]) for col in columns),
            reverse=True,
        )
        if name
    ]

    # Helper: best scored candidate among a type set (deterministic by score then appearance)
    def _best_match(candidates: Sequence[str], min_score: float = 0.0) -> Optional[str]:
        # Prefer columns explicitly mentioned in the query (in textual order)
        for mentioned in mentioned_columns:
            if mentioned in candidates:
                mentioned_score = match_details.get(mentioned, {"score": 0.0})["score"]
                if mentioned_score >= min_score or min_score == 0.0:
                    return mentioned
        # Otherwise highest score, tie broken by dataset order
        best_name: Optional[str] = None
        best_score = min_score
        for name in candidates:
            score = match_details.get(name, {"score": 0.0})["score"]
            if score > best_score:
                best_name = name
                best_score = score
        return best_name

    # Assign fields from explicit mentions first (in order of appearance)
    for name in mentioned_columns:
        meta = column_lookup.get(name, {})
        col_type = meta.get("type")
        if col_type == "temporal" and not time_field:
            time_field = name
            continue
        if col_type == "numeric" and not value_field:
            value_field = name
            continue
        if col_type == "categorical" and not category_field:
            category_field = name

    # Fill missing fields deterministically
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

    # If a line/time was explicitly requested but no time field resolved, pick highest temporal score
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
            time_field = ranked_temporal[0]
        if not time_field and category_field:
            # As a last resort, treat the dimension as time for a line chart
            time_field = category_field
            category_field = None

    # If the query implies time but the user didn't say "by <dimension>", drop category to avoid double-grouping
    grouping_keywords = [" by ", " per ", " versus ", " vs ", " against "]
    if mentions_time and time_field and "dimension" not in directives:
        if not any(keyword in query_lower for keyword in grouping_keywords):
            category_field = None

    # Ensure fields are not self-conflicting
    if category_field and time_field and category_field == time_field:
        category_field = None
    if time_field and value_field and value_field == time_field:
        alternative_numeric = next((name for name in numeric_candidates if name != time_field), None)
        value_field = alternative_numeric

    # Scatter detection: choose two numeric axes deterministically
    scatter_keywords = {"scatter", "versus", "vs", "against"}
    scatter_requested = any(keyword in query_lower for keyword in scatter_keywords)
    if scatter_requested:
        numeric_scores = sorted(
            ((match_details.get(name, {"score": 0.0})["score"], name) for name in numeric_candidates),
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

    # Final deterministic chart type
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
        chart_type = explicit_chart  # explicit always wins

    filters = _parse_filters(directives.get("filter", []), columns)

    # Output structure consumed by downstream builder
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
