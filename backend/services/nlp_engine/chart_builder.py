"""Chart construction and aggregation utilities for the NLP chart engine."""
from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any, Dict, List, Optional, Sequence, Tuple

from .nlp_extraction import _safe_float
from .nlp_interpreter import QueryInterpretation, _apply_filters
from .temporal_utils import _format_time_bucket, _infer_temporal_granularity

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


def _limit_categories(category_totals: Dict[Any, float], limit: int = 10) -> List[Any]:
    if len(category_totals) <= limit:
        return list(category_totals.keys())
    most_common = Counter(category_totals).most_common(limit)
    return [item[0] for item in most_common]


def _palette_color(index: int) -> str:
    if not COLOR_PALETTE:
        return "#3366CC"
    return COLOR_PALETTE[index % len(COLOR_PALETTE)]


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


def _build_chart_data(
    chart_type: str, dataset: Sequence[Dict[str, Any]], fields: Dict[str, Optional[str]]
):
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


def build_chart_response(
    dataset: Sequence[Dict[str, Any]], interpretation: QueryInterpretation
):
    filtered_dataset = _apply_filters(dataset, interpretation.get("filters", []))
    chart_data, explanation = _build_chart_data(
        interpretation.get("chart_type", "Bar"),
        filtered_dataset,
        interpretation.get("fields", {}),
    )
    return chart_data, explanation, filtered_dataset
