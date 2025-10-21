"""Utility functions that power the natural language chart builder used by the AI chat."""
from __future__ import annotations

# --------------------------------------------------------------------
# Updated imports for refactored NLP Engine (deterministic version)
# --------------------------------------------------------------------
from .nlp_engine.chart_builder import (
    COLOR_PALETTE,
    _build_chart_data,
    _limit_categories,
    _palette_color,
    build_chart_response,
)
from .nlp_engine.nlp_extraction import (
    _is_numeric_column,
    _is_temporal_column,
    _numeric_ratio,
    _safe_float,
    _temporal_score,
    analyse_columns,
    extract_dataset,
)
from .nlp_engine.nlp_interpreter import (
    NLP_QUERY_FORMAT,
    QueryInterpretation,
    _apply_filters,
    _choose_chart_type,
    _detect_explicit_chart_type,
    _detect_visual_intent,
    _extract_dimension_from_query,
    _find_mentioned_columns,
    _normalize,
    _parse_directives,
    _parse_filters,
    _resolve_column,
    _resolve_field_from_tokens,
    _score_columns,
    interpret_nl_query,
)
from .nlp_engine.temporal_utils import (
    _aggregate_time_series,         # ✅ moved here — this fixes your ImportError
    _classify_temporal_value,
    _ensure_datetime_from_info,
    _format_time_bucket,
    _infer_temporal_granularity,
)

__all__ = [
    "COLOR_PALETTE",
    "NLP_QUERY_FORMAT",
    "QueryInterpretation",
    "_aggregate_time_series",
    "_apply_filters",
    "_classify_temporal_value",
    "_choose_chart_type",
    "_detect_explicit_chart_type",
    "_detect_visual_intent",
    "_ensure_datetime_from_info",
    "_extract_dimension_from_query",
    "_find_mentioned_columns",
    "_format_time_bucket",
    "_infer_temporal_granularity",
    "_is_numeric_column",
    "_is_temporal_column",
    "_limit_categories",
    "_normalize",
    "_numeric_ratio",
    "_palette_color",
    "_parse_directives",
    "_parse_filters",
    "_resolve_column",
    "_resolve_field_from_tokens",
    "_safe_float",
    "_score_columns",
    "_temporal_score",
    "analyse_columns",
    "build_chart_response",
    "extract_dataset",
    "interpret_nl_query",
]
