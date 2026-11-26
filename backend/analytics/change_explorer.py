"""Explain an Analytics metric change using a single explicit source snapshot."""

from __future__ import annotations

import hashlib
import math
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from fractions import Fraction
from itertools import repeat
from numbers import Integral, Real
from typing import Any

import pandas as pd

from backend.analytics.query import AnalyticsError, clean, dates, fail, field, filter_mask, segment_label, source_bundle


MAX_SEGMENTS = 20_000
ISO_DAY = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
BRIDGE_FIELDS = ("baseline_value", "current_value", "delta", "baseline_count", "current_count", "volume_effect", "rate_effect")
Number = int | Fraction
Label = str | bool | int | float | None


@dataclass
class Cohort:
    count: int = 0
    value: Number = 0


def _period(payload: dict, name: str) -> tuple[date, date]:
    period = payload.get(name)
    fail(not isinstance(period, dict), f"Provide start and end dates for the {name} period.", "invalid_dates")
    start, end = period.get("start"), period.get("end")
    message = f"Use valid YYYY-MM-DD dates for the {name} period."
    fail(not all(isinstance(day, str) and ISO_DAY.fullmatch(day) for day in (start, end)), message, "invalid_dates")
    try:
        start_day, end_day = date.fromisoformat(start), date.fromisoformat(end)
    except ValueError as exc:
        raise AnalyticsError(message, "invalid_dates") from exc
    fail(start_day > end_day, f"The {name} start date must be on or before its end date.", "invalid_dates")
    return start_day, end_day


def _observation(value: Any, name: str) -> Number | None:
    if value is None or value is pd.NA or value is pd.NaT:
        return None
    if isinstance(value, Real) and not isinstance(value, Integral) and math.isnan(value):
        return None
    message = f"'{name}' must contain only finite numeric values or nulls."
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            try:
                value = float(value)
            except ValueError as exc:
                raise AnalyticsError(message, "invalid_measure") from exc
    if isinstance(value, Integral) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, Real) and not isinstance(value, Integral) and math.isfinite(value):
        return Fraction(*value.as_integer_ratio())
    raise AnalyticsError(message, "invalid_measure")


def _bridge(baseline: Cohort, current: Cohort, count_rows: bool) -> dict[str, Number]:
    delta = current.value - baseline.value
    volume, rate = delta, 0
    if not count_rows and baseline.count and current.count:
        # With one cohort absent, adopting the observed mean puts its entire change in volume.
        baseline_mean = Fraction(baseline.value, baseline.count)
        current_mean = Fraction(current.value, current.count)
        volume = (current.count - baseline.count) * (baseline_mean + current_mean) / 2
        rate = (current_mean - baseline_mean) * Fraction(baseline.count + current.count, 2)
    return {
        "baseline_value": baseline.value,
        "current_value": current.value,
        "delta": delta,
        "baseline_count": baseline.count,
        "current_count": current.count,
        "volume_effect": volume,
        "rate_effect": rate,
    }


def _sum_bridges(rows: list[dict]) -> dict[str, Number]:
    return {key: sum(row[key] for row in rows) for key in BRIDGE_FIELDS}


def _json_numbers(bridge: dict) -> dict:
    # Convert only at the API boundary. Keep exact integers, including sums beyond int64.
    result = dict(bridge)
    for key in BRIDGE_FIELDS:
        value = bridge[key]
        try:
            as_float = float(value)
        except OverflowError as exc:
            raise AnalyticsError("The comparison exceeds the supported numeric range.", "invalid_measure") from exc
        result[key] = value.numerator if value.denominator == 1 else as_float
    return result


def execute_change_explorer(payload: dict) -> dict:
    fail(not isinstance(payload, dict), "Request must be an object.")
    baseline = _period(payload, "baseline")
    current = _period(payload, "current")
    fail(baseline[1] >= current[0], "The baseline must end before the current period starts.", "invalid_dates")
    metric = payload.get("metric")
    fail(not isinstance(metric, dict), "Choose a count_rows or sum metric.")
    aggregation = metric.get("aggregation")
    fail(aggregation not in ("count_rows", "sum"), "The metric aggregation must be count_rows or sum.")
    limit = payload.get("limit", 12)
    fail(type(limit) is not int or not 1 <= limit <= 30, "The driver limit must be an integer from 1 to 30.")

    bundle = source_bundle(payload)
    frame = bundle["dataframe"]
    fail(frame.columns.duplicated().any(), "Source contains duplicate column names.")
    fail(len(frame) > 1_000_000, "This local query exceeds the one-million-row execution limit.", "source_too_large")
    date_field = field(frame, payload.get("date_field"))
    segment_field = field(frame, payload.get("segment_field"))
    metric_field = field(frame, metric.get("field")) if aggregation == "sum" else None

    # Match the Analytics query fingerprint so callers can reuse source metadata.
    try:
        row_hashes = pd.util.hash_pandas_object(frame, index=False).values.tobytes()
    except (TypeError, ValueError) as exc:
        raise AnalyticsError("The dataset contains unsupported column values. Use scalar values for analysis.") from exc
    fingerprint = hashlib.sha256(row_hashes + str(list(frame.columns)).encode()).hexdigest()
    expected = payload.get("expected_fingerprint")
    fail(bool(expected and expected != fingerprint), "Dataset contents changed. Revalidate and run again.", "dataset_changed")

    if not frame.index.is_unique:
        frame = frame.reset_index(drop=True)
    selected_fields = dict.fromkeys(name for name in (date_field, segment_field, metric_field) if name is not None)
    filtered = frame.loc[filter_mask(frame, payload.get("filters")), list(selected_fields)]
    # Parse once and compare UTC calendar dates so both endpoints are inclusive.
    days = dates(filtered[date_field].dropna()).dt.date.astype(object)
    groups: dict[tuple[bool, Label], tuple[Cohort, Cohort]] = {}
    for period_index, (start, end) in enumerate((baseline, current)):
        matched = filtered.loc[days.index[days.between(start, end)]]
        values = repeat(1) if metric_field is None else matched[metric_field]
        for raw_label, value in zip(matched[segment_field], values):
            label = segment_label(raw_label, segment_field)
            key = (isinstance(label, bool), label)  # Python considers True and 1 equal.
            pair = groups.get(key)
            if pair is None:
                fail(len(groups) >= MAX_SEGMENTS, "Too many segments. Add filters or choose a coarser segment field.",
                     "result_too_large")
                pair = groups[key] = (Cohort(), Cohort())
            observation = value if metric_field is None else _observation(value, metric_field)
            if observation is not None:
                cohort = pair[period_index]
                cohort.count += 1
                cohort.value += observation

    rows = [
        {"kind": "missing" if label is None else "segment", "segment": label,
         **_bridge(before, after, metric_field is None)}
        for (_, label), (before, after) in groups.items()
    ]
    rows.sort(key=lambda row: (-abs(row["delta"]), row["kind"] == "missing", str(row["segment"]),
                               type(row["segment"]).__name__))
    totals = _sum_bridges(rows)
    drivers = rows[:limit]
    if len(rows) > limit:
        drivers.append({"kind": "other", "segment": None, **_sum_bridges(rows[limit:])})

    source = payload["source"]
    dataset = {key: value for key, value in bundle["dataset_ref"].items() if key != "path"}
    dataset.update(fingerprint=fingerprint, source_row_count=len(frame),
                   scope=source.get("row_scope", "unknown" if source["kind"] == "inline" else "full"))
    return clean({
        "schema_version": 1,
        "dataset": dataset,
        "analysis_lineage": bundle.get("analysis_lineage"),
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "baseline": {"start": baseline[0].isoformat(), "end": baseline[1].isoformat()},
        "current": {"start": current[0].isoformat(), "end": current[1].isoformat()},
        "date_field": date_field,
        "segment_field": segment_field,
        "metric": {"aggregation": aggregation} if metric_field is None else {"aggregation": aggregation, "field": metric_field},
        "segment_count": len(rows),
        "totals": _json_numbers(totals),
        "drivers": [_json_numbers(row) for row in drivers],
    })
