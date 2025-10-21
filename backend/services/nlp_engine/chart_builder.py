"""
Chart construction and aggregation logic for the AI chart engine (deterministic refactor).
Supports multiple aggregations, top-N limiting, and chronological sorting.
"""

import math
from collections import defaultdict
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .temporal_utils import _ensure_datetime_from_info

# --------------------------------------------------------------------
# Deterministic color palette for categories and datasets
# --------------------------------------------------------------------
COLOR_PALETTE = [
    "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f",
    "#edc949", "#af7aa1", "#ff9da7", "#9c755f", "#bab0ab"
]


def _palette_color(label: str) -> str:
    """Deterministic color assignment using hashing across the fixed palette."""
    return COLOR_PALETTE[hash(label) % len(COLOR_PALETTE)]


# --------------------------------------------------------------------
# Aggregation utilities
# --------------------------------------------------------------------
def _aggregate(values: List[float], method: str = "sum") -> float:
    """Apply deterministic aggregation method."""
    if not values:
        return 0.0
    method = method.lower()
    if method in ("sum", "total"):
        return sum(values)
    if method in ("average", "mean"):
        return sum(values) / len(values)
    if method == "count":
        return len(values)
    if method == "min":
        return min(values)
    if method == "max":
        return max(values)
    # Safe fallback
    return sum(values)


# --------------------------------------------------------------------
# Category limiting (default: Top N by aggregated value)
# --------------------------------------------------------------------
def _limit_categories(
    aggregated: Dict[str, float],
    top_n: int = 10,
    show_all: bool = False
) -> Tuple[Dict[str, float], Dict[str, Any]]:
    """
    Limit to top N categories by aggregated value unless show_all=True.
    Returns (limited_dict, meta_info).
    """
    if show_all:
        return aggregated, {"limited": False, "totalCategories": len(aggregated), "topN": None}

    sorted_items = sorted(aggregated.items(), key=lambda x: x[1], reverse=True)
    limited = dict(sorted_items[:top_n])
    meta = {
        "limited": True,
        "totalCategories": len(aggregated),
        "topN": top_n,
    }
    return limited, meta


# --------------------------------------------------------------------
# Histogram binning (10 equal-width bins)
# --------------------------------------------------------------------
def _auto_bin_numeric(values: List[float], bins: int = 10) -> Tuple[List[str], List[float]]:
    """Auto-bin numeric data into approximately 10 equal-width bins."""
    if not values:
        return [], []
    vmin, vmax = min(values), max(values)
    if vmin == vmax:
        return [str(vmin)], [len(values)]
    width = (vmax - vmin) / bins
    bins_data = [0 for _ in range(bins)]
    edges = [vmin + i * width for i in range(bins + 1)]
    for v in values:
        idx = min(int((v - vmin) / width), bins - 1)
        bins_data[idx] += 1
    labels = [f"{round(edges[i], 2)}–{round(edges[i+1], 2)}" for i in range(bins)]
    return labels, bins_data


# --------------------------------------------------------------------
# Chart data construction
# --------------------------------------------------------------------
def _build_chart_data(
    dataset: Sequence[Dict[str, Any]],
    chart_type: str,
    fields: Dict[str, Optional[str]],
    aggregation: str = "sum",
    show_all: bool = False
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Build deterministic Chart.js-compatible data and metadata.
    """
    value_field = fields.get("value")
    category_field = fields.get("category")
    time_field = fields.get("time")
    secondary_value = fields.get("secondary_value")

    # Aggregation-aware Y label
    y_label = f"{aggregation.title()} of {value_field}" if value_field else "Value"
    x_label = category_field or time_field or "Category"

    aggregated: Dict[str, float] = {}

    # ----------------------------------------------------------------
    # Line / Time-based charts
    # ----------------------------------------------------------------
    if chart_type == "Line" and time_field and value_field:
        time_to_values = defaultdict(list)
        for row in dataset:
            tval = _ensure_datetime_from_info(row.get(time_field))
            val = row.get(value_field)
            if tval is not None and isinstance(val, (int, float)):
                time_to_values[tval].append(val)

        # Aggregate and sort chronologically (ascending)
        sorted_pairs = sorted(
            ((t, _aggregate(vals, aggregation)) for t, vals in time_to_values.items()),
            key=lambda x: x[0]
        )
        labels = [t.strftime("%Y-%m-%d") for t, _ in sorted_pairs]
        data_points = [v for _, v in sorted_pairs]

        chart_data = {
            "labels": labels,
            "datasets": [{
                "label": y_label,
                "data": data_points,
                "borderColor": _palette_color(y_label),
                "fill": False,
                "tension": 0.3
            }]
        }
        meta = {"xLabel": x_label, "yLabel": y_label, "type": "Line", "sorted": True}
        return chart_data, meta

    # ----------------------------------------------------------------
    # Histogram (auto-bin)
    # ----------------------------------------------------------------
    if chart_type == "Histogram" and value_field:
        numeric_values = [float(row.get(value_field)) for row in dataset if isinstance(row.get(value_field), (int, float))]
        labels, bin_counts = _auto_bin_numeric(numeric_values, bins=10)

        chart_data = {
            "labels": labels,
            "datasets": [{
                "label": f"Frequency of {value_field}",
                "data": bin_counts,
                "backgroundColor": _palette_color(value_field)
            }]
        }
        meta = {"xLabel": f"{value_field} (binned)", "yLabel": "Frequency", "type": "Histogram"}
        return chart_data, meta

    # ----------------------------------------------------------------
    # Scatter plots
    # ----------------------------------------------------------------
    if chart_type == "Scatter" and value_field and secondary_value:
        points = []
        for row in dataset:
            x_val = row.get(value_field)
            y_val = row.get(secondary_value)
            if isinstance(x_val, (int, float)) and isinstance(y_val, (int, float)):
                points.append({"x": x_val, "y": y_val})
        chart_data = {
            "datasets": [{
                "label": f"{secondary_value} vs {value_field}",
                "data": points,
                "backgroundColor": _palette_color(f"{value_field}_{secondary_value}")
            }]
        }
        meta = {"xLabel": value_field, "yLabel": secondary_value, "type": "Scatter"}
        return chart_data, meta

    # ----------------------------------------------------------------
    # Pie / Doughnut charts (top N by aggregated value)
    # ----------------------------------------------------------------
    if chart_type in ("Pie", "Doughnut") and category_field and value_field:
        cat_to_values = defaultdict(list)
        for row in dataset:
            cat = str(row.get(category_field))
            val = row.get(value_field)
            if cat and isinstance(val, (int, float)):
                cat_to_values[cat].append(val)

        aggregated = {c: _aggregate(vals, aggregation) for c, vals in cat_to_values.items()}
        limited, limit_meta = _limit_categories(aggregated, top_n=10, show_all=show_all)
        labels = list(limited.keys())
        data_points = list(limited.values())

        chart_data = {
            "labels": labels,
            "datasets": [{
                "data": data_points,
                "backgroundColor": [_palette_color(label) for label in labels]
            }]
        }
        meta = {
            "xLabel": category_field,
            "yLabel": y_label,
            "type": chart_type,
            **limit_meta
        }
        return chart_data, meta

    # ----------------------------------------------------------------
    # Bar and default categorical charts
    # ----------------------------------------------------------------
    if category_field and value_field:
        cat_to_values = defaultdict(list)
        for row in dataset:
            cat = str(row.get(category_field))
            val = row.get(value_field)
            if cat and isinstance(val, (int, float)):
                cat_to_values[cat].append(val)

        aggregated = {c: _aggregate(vals, aggregation) for c, vals in cat_to_values.items()}
        limited, limit_meta = _limit_categories(aggregated, top_n=10, show_all=show_all)

        labels = list(limited.keys())
        data_points = list(limited.values())

        chart_data = {
            "labels": labels,
            "datasets": [{
                "label": y_label,
                "data": data_points,
                "backgroundColor": [_palette_color(label) for label in labels]
            }]
        }
        meta = {
            "xLabel": x_label,
            "yLabel": y_label,
            "type": "Bar" if chart_type != "Line" else "Line",
            **limit_meta
        }
        return chart_data, meta

    # ----------------------------------------------------------------
    # Fallback when structure is incomplete
    # ----------------------------------------------------------------
    chart_data = {"labels": [], "datasets": []}
    meta = {"xLabel": x_label, "yLabel": y_label, "type": chart_type, "note": "No valid data"}
    return chart_data, meta


# --------------------------------------------------------------------
# Entry point wrapper
# --------------------------------------------------------------------
def build_chart_response(
    dataset: Sequence[Dict[str, Any]],
    interpretation: Dict[str, Any],
    aggregation: str = "sum",
    show_all: bool = False
) -> Dict[str, Any]:
    """
    Main entry point combining interpreted query with dataset to produce
    Chart.js-ready configuration.
    """
    chart_type = interpretation.get("chart_type", "Bar")
    fields = interpretation.get("fields", {})

    chart_data, meta = _build_chart_data(
        dataset,
        chart_type=chart_type,
        fields=fields,
        aggregation=aggregation,
        show_all=show_all
    )

    return {
        "chartType": chart_type,
        "chartData": chart_data,
        "meta": meta
    }
