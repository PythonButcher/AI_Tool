"""Bounded, provider-free analytical queries. Presentation never recomputes values."""
from __future__ import annotations

import ast
import hashlib
import json
import math
from datetime import date, datetime, timezone
from typing import Any

import pandas as pd

from backend.services.dataset_context import resolve_dataset_bundle, resolve_analysis_dataset_bundle
from backend.services.metric_resolver import MetricResolver, MetricResolutionError
from backend.services.data_catalog_lineage import evaluate_dataset_readiness, is_blocked


class AnalyticsError(ValueError):
    def __init__(self, message: str, code: str = "invalid_query"):
        super().__init__(message)
        self.code = code


AGGREGATIONS = ("sum", "avg", "min", "max", "count", "count_distinct", "count_rows", "median", "percentile")
GRAINS = ("day", "week", "month", "quarter", "year")
POST = ("none", "percent_total", "running_total", "moving_average", "rank", "cumulative_percent")


def fail(condition: bool, message: str, code: str = "invalid_query") -> None:
    if condition:
        raise AnalyticsError(message, code)


def clean(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(k): clean(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [clean(v) for v in value]
    if value is None or pd.isna(value):
        return None
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if hasattr(value, "item"):
        value = value.item()
    return None if isinstance(value, float) and not math.isfinite(value) else value


def source_bundle(payload: dict) -> dict:
    source = payload.get("source")
    fail(not isinstance(source, dict), "Choose a dataset.", "dataset_required")
    try:
        if source.get("kind") == "workspace":
            fail(not isinstance(source.get("analysis_context"), dict), "Workspace context is required.")
            return resolve_analysis_dataset_bundle(source["analysis_context"])
        if source.get("kind") == "datahub":
            fail(not isinstance(source.get("id"), str) or not source["id"].strip(), "Dataset ID is required.")
            bundle = resolve_dataset_bundle(dataset_ref={"source": "datahub", "dataset_id": source["id"]},
                                            allow_active_fallback=False)
            readiness = evaluate_dataset_readiness(bundle["dataframe"], bundle.get("governance_policy"))
            fail(is_blocked(readiness), "Dataset governance blocks this analysis. Review the dataset's policy in Data Hub.", "governance_blocked")
            return bundle
        fail(source.get("kind") != "inline", "Unsupported source type.")
        fail(not source.get("id"), "An inline attachment identity is required.")
        rows = payload.get("dataset")
        fail(not isinstance(rows, list) or not rows, "Reattach this dataset before running the analysis.", "dataset_required")
        fail(len(rows) > 100000, "Inline execution is limited to 100,000 rows. Use Data Hub for larger data.")
        fail(any(not isinstance(r, dict) for r in rows), "Dataset rows must be objects.")
        return resolve_dataset_bundle(dataset=rows, semantic_model=payload.get("semantic_model"),
                                      dataset_ref={"source": "inline", "dataset_name": source.get("name")},
                                      allow_active_fallback=False)
    except AnalyticsError:
        raise
    except (ValueError, OSError) as exc:
        raise AnalyticsError("The selected source is unavailable or its workspace version changed. Reload its context.",
                             getattr(exc, "code", "dataset_unavailable")) from exc


def field(frame: pd.DataFrame, name: Any) -> str:
    fail(not isinstance(name, str) or name not in frame.columns, f"Field '{name}' is unavailable.", "missing_field")
    return name


def dates(series: pd.Series) -> pd.Series:
    fail(pd.api.types.is_numeric_dtype(series) and not series.empty, "Convert numeric date encodings before analysis.")
    parsed = pd.to_datetime(series, format="mixed", utc=True, errors="coerce")
    fail(bool((parsed.isna() & series.notna()).any()), f"'{series.name}' contains invalid dates.", "invalid_dates")
    return parsed


def describe_field(series: pd.Series) -> dict:
    values = series.dropna()
    examples = values.head(3)
    dtype = series.dtype
    if pd.api.types.is_datetime64_any_dtype(dtype):
        kind = "date"
    elif pd.api.types.is_numeric_dtype(dtype) and not pd.api.types.is_bool_dtype(dtype):
        kind = "number"
    else:
        kind = "string"
        # ISO dates are common in CSV/JSON uploads. Require a date-shaped sample
        # and validate the entire column before offering it for a trend.
        if len(examples) and examples.astype("string").str.match(r"^\d{4}-\d{2}-\d{2}(?:$|[T ])").all():
            shaped = values.astype("string").str.match(r"^\d{4}-\d{2}-\d{2}(?:$|[T ])").all()
            if shaped and pd.to_datetime(values, format="mixed", utc=True, errors="coerce").notna().all():
                kind = "date"
    return {"name": str(series.name), "type": kind, "examples": clean(examples.tolist())}


def date_value(value: Any) -> pd.Timestamp:
    parsed = pd.Timestamp(value)
    if pd.isna(parsed):
        raise ValueError("A date is required.")
    return parsed.tz_localize("UTC") if parsed.tzinfo is None else parsed.tz_convert("UTC")


def segment_label(value: Any, name: str) -> str | bool | int | float | None:
    message = f"'{name}' contains a segment label that is not a finite scalar."
    fail(not pd.api.types.is_scalar(value), message, "invalid_segment")
    if pd.isna(value):
        return None
    label = value.isoformat() if isinstance(value, date) else clean(value)
    fail(type(label) not in (str, bool, int, float), message, "invalid_segment")
    return label


def filter_mask(frame: pd.DataFrame, node: Any, depth: int = 0) -> pd.Series:
    fail(depth > 5, "Filter groups may be nested at most five levels.")
    if node is None or node == []:
        return pd.Series(True, index=frame.index)
    if isinstance(node, list):
        node = {"op": "and", "rules": node}
    fail(not isinstance(node, dict), "A filter must be an object.")
    if "rules" in node:
        rules = node["rules"]
        op = node.get("op", "and")
        fail(op not in ("and", "or") or not isinstance(rules, list) or len(rules) > 30, "Invalid filter group.")
        result = pd.Series(op == "and", index=frame.index)
        for rule in rules:
            mask = filter_mask(frame, rule, depth + 1)
            result = result & mask if op == "and" else result | mask
        return result
    name = field(frame, node.get("field"))
    series = frame[name]
    op, value = node.get("operator", "eq"), node.get("value")
    if node.get("type") == "segment":
        fail(op != "eq", "A segment drill requires an equality filter.")
        expected = segment_label(value, name)

        def matches(raw: Any) -> bool:
            label = segment_label(raw, name)
            return isinstance(label, bool) == isinstance(expected, bool) and label == expected

        return series.map(matches).astype(bool)
    if node.get("type") == "date":
        series = dates(series)
        if op not in ("is_null", "not_null", "in", "not_in", "contains"):
            try:
                value = date_value(value)
                if len(str(node.get("value"))) == 10:
                    tomorrow = value + pd.Timedelta(days=1)
                    if op in ("eq", "neq"):
                        matches = series.ge(value) & series.lt(tomorrow)
                        return matches if op == "eq" else series.notna() & ~matches
                    if op in ("lte", "gt"):
                        op, value = ("lt" if op == "lte" else "gte"), tomorrow
            except (ValueError, TypeError) as exc:
                raise AnalyticsError("Invalid date filter.", "invalid_dates") from exc
    elif pd.api.types.is_numeric_dtype(series) and op in ("eq", "neq", "gt", "gte", "lt", "lte"):
        try:
            value = float(value)
            if not math.isfinite(value):
                raise ValueError("Expected a finite value.")
        except (TypeError, ValueError) as exc:
            raise AnalyticsError(f"'{name}' requires a numeric filter.") from exc
    if op in ("eq", "neq", "gt", "gte", "lt", "lte"):
        operations = {"eq": series.eq, "neq": series.ne, "gt": series.gt, "gte": series.ge, "lt": series.lt, "lte": series.le}
        try:
            return operations[op](value).fillna(False)
        except TypeError as exc:
            raise AnalyticsError(f"The filter type does not match '{name}'.") from exc
    if op in ("in", "not_in"):
        values = node.get("values", value)
        fail(not isinstance(values, list) or len(values) > 1000, "Membership filters require a bounded value list.")
        if node.get("type") == "date":
            try:
                values = [date_value(v) for v in values]
            except (ValueError, TypeError) as exc:
                raise AnalyticsError("Invalid date membership value.", "invalid_dates") from exc
        elif pd.api.types.is_numeric_dtype(series):
            try:
                values = [float(v) for v in values]
            except (ValueError, TypeError) as exc:
                raise AnalyticsError("Membership values must match the numeric field.") from exc
        mask = series.isin(values)
        return ~mask if op == "not_in" else mask
    if op == "contains":
        return series.astype("string").str.contains(str(value), regex=False, case=False, na=False)
    if op == "is_null":
        return series.isna()
    if op == "not_null":
        return series.notna()
    raise AnalyticsError(f"Unsupported filter operator '{op}'.")


def formula(expression: str, values: dict) -> float | None:
    """Only arithmetic over already computed measure IDs; no calls or attributes."""
    fail(not isinstance(expression, str) or len(expression) > 500, "Formula must be at most 500 characters.")
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise AnalyticsError("Invalid calculated measure expression.") from exc
    fail(sum(1 for _ in ast.walk(tree)) > 100, "Formula is too complex.")

    def evaluate(node):
        if isinstance(node, ast.Expression):
            return evaluate(node.body)
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            fail(abs(node.value) > 1e15, "Formula constant is too large.")
            return node.value
        if isinstance(node, ast.Name):
            fail(node.id not in values, f"Formula references unknown or later measure '{node.id}'.")
            return values[node.id]
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            value = evaluate(node.operand)
            return None if value is None else (-value if isinstance(node.op, ast.USub) else value)
        if isinstance(node, ast.BinOp) and isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)):
            left, right = evaluate(node.left), evaluate(node.right)
            if left is None or right is None or (isinstance(node.op, ast.Div) and right == 0):
                return None
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            return left / right
        raise AnalyticsError("Formulas support numbers, measure IDs, parentheses and + - * / only.")
    return clean(evaluate(tree))


def measure_value(frame: pd.DataFrame, measure: dict, model: dict) -> Any:
    if measure.get("metric_id"):
        metric = MetricResolver._resolve_metric_definition(None, measure["metric_id"], None, model)
        built_filters = metric.get("filters") or metric.get("where") or (metric.get("expression") or {}).get("filters")
        normalized = MetricResolver._normalize_filters(built_filters, model, frame)
        restricted = MetricResolver._apply_filters(frame, normalized)
        if restricted.empty:
            return None
        return clean(MetricResolver._execute_metric(restricted, metric, [], None, None)["summary"]["value"])
    agg = measure.get("aggregation", "sum")
    fail(agg not in AGGREGATIONS, f"Unsupported aggregation '{agg}'.")
    if agg == "count_rows":
        return len(frame)
    series = frame[field(frame, measure.get("field"))]
    if agg == "count":
        return int(series.count())
    if agg == "count_distinct":
        return int(series.nunique())
    numeric = pd.to_numeric(series, errors="coerce")
    fail(bool((series.notna() & numeric.isna()).any()), f"'{series.name}' contains nonnumeric values.", "invalid_measure")
    if agg == "percentile":
        p = measure.get("percentile", 0.5)
        fail(type(p) not in (int, float) or not 0 <= p <= 1, "Percentile must be between zero and one.")
        return clean(numeric.quantile(p, interpolation="linear"))
    return clean(numeric.sum(min_count=1) if agg == "sum" else getattr(numeric, "mean" if agg == "avg" else agg)())


def summarize(frame: pd.DataFrame, measures: list, model: dict) -> dict:
    values = {}
    for measure in measures:
        values[measure["id"]] = formula(measure["formula"], values) if measure.get("formula") else measure_value(frame, measure, model)
    return values


def prepare_groups(frame: pd.DataFrame, groups: list) -> tuple[pd.DataFrame, list[str]]:
    result, names = frame.copy(), []
    for group in groups:
        fail(not isinstance(group, dict), "Grouping fields must be objects.")
        name = field(result, group.get("field"))
        fail(name in names, "Grouping fields must be unique.")
        names.append(name)
        grain = group.get("grain")
        if grain:
            fail(grain not in GRAINS, "Unsupported date grain.")
            values = dates(result[name])
            if grain == "week":
                result[name] = (values - pd.to_timedelta(values.dt.weekday, unit="D")).dt.strftime("%Y-%m-%d")
            elif grain == "quarter":
                result[name] = values.dt.year.astype("Int64").astype(str) + "-Q" + values.dt.quarter.astype("Int64").astype(str)
                result.loc[values.isna(), name] = None
            else:
                result[name] = values.dt.strftime({"day": "%Y-%m-%d", "month": "%Y-%m", "year": "%Y"}[grain])
    return result, names


def aggregate(frame: pd.DataFrame, query: dict, model: dict) -> tuple[list, dict, list]:
    measures, groups = query.get("measures", []), query.get("group_by", [])
    fail(not isinstance(measures, list) or not 1 <= len(measures) <= 12, "Select between one and twelve measures.")
    fail(not isinstance(groups, list) or len(groups) > 4, "At most four grouping fields are supported.")
    ids = []
    for measure in measures:
        fail(not isinstance(measure, dict), "Measures must be objects.")
        name = measure.get("id")
        fail(not isinstance(name, str) or not name.isidentifier() or len(name) > 64 or name in ids, "Measure IDs must be unique identifiers.")
        post = measure.get("post", "none")
        fail(post not in POST, "Unsupported post-aggregation calculation.")
        if post == "moving_average":
            window = measure.get("window", 3)
            fail(type(window) is not int or not 1 <= window <= 100, "Moving average window must be 1–100.")
        ids.append(name)
    grouped, names = prepare_groups(frame, groups)
    fail(bool(set(names) & set(ids)), "Measure IDs cannot equal grouping field names.")
    totals = summarize(frame, measures, model)
    rows = []
    if not names:
        rows = [totals] if len(frame) else []
    else:
        iterator = grouped.groupby(names[0] if len(names) == 1 else names, dropna=False, sort=True)
        fail(iterator.ngroups > 20000, "Too many groups. Add filters or a coarser grouping.", "result_too_large")
        for key, part in iterator:
            keys = key if isinstance(key, tuple) else (key,)
            # Aggregate original values, not date buckets substituted into measures.
            rows.append({**dict(zip(names, clean(keys))), **summarize(frame.loc[part.index], measures, model)})
    sort = query.get("sort") or {"field": names[0] if names else ids[0], "direction": "asc"}
    fail(not isinstance(sort, dict) or sort.get("field") not in names + ids or sort.get("direction", "asc") not in ("asc", "desc"), "Invalid sort field or direction.")
    if rows:
        output = pd.DataFrame(rows).sort_values(sort["field"], ascending=sort.get("direction") != "desc", na_position="last", kind="stable")
        for measure in measures:
            post = measure.get("post", "none")
            if post == "none":
                continue
            col = measure["id"]
            values = pd.to_numeric(output[col], errors="coerce")
            denominator = values.sum(min_count=1)
            if post == "percent_total":
                output[col] = values / denominator * 100 if denominator else None
            elif post == "running_total":
                output[col] = values.cumsum()
            elif post == "moving_average":
                output[col] = values.rolling(measure.get("window", 3), min_periods=1).mean()
            elif post == "rank":
                output[col] = values.rank(method="min", ascending=False)
            elif post == "cumulative_percent":
                output[col] = values.cumsum() / denominator * 100 if denominator else None
        rows = clean(output.to_dict("records"))
        if query.get("normalize_stack"):
            for row in rows:
                denominator = sum(row[name] or 0 for name in ids)
                fail(any((row[name] or 0) < 0 for name in ids), "Percentage stacking requires nonnegative measures.")
                for name in ids:
                    row[name] = row[name] / denominator * 100 if row[name] is not None and denominator else None
    return rows, totals, names + ids


def execute_query(payload: dict) -> dict:
    fail(not isinstance(payload, dict), "Request must be an object.")
    bundle = source_bundle(payload)
    frame = bundle["dataframe"].copy().reset_index(drop=True)
    fail(frame.columns.duplicated().any(), "Source contains duplicate column names.")
    fail(len(frame) > 1000000, "This local query exceeds the one-million-row execution limit.", "source_too_large")
    model = bundle.get("semantic_model") or {}
    query = payload.get("query", {})
    fail(not isinstance(query, dict), "query must be an object.")
    fingerprint = hashlib.sha256(pd.util.hash_pandas_object(frame, index=False).values.tobytes() + str(list(frame.columns)).encode()).hexdigest()
    expected = payload.get("expected_fingerprint")
    fail(bool(expected and expected != fingerprint), "Dataset contents changed. Revalidate and run again.", "dataset_changed")
    fields = [describe_field(frame[name]) for name in frame.columns]
    dataset = {**{k: v for k, v in bundle["dataset_ref"].items() if k != "path"}, "fingerprint": fingerprint,
               "source_row_count": len(frame), "scope": payload.get("source", {}).get("row_scope", "full" if payload["source"]["kind"] != "inline" else "unknown")}
    base = {"schema_version": 1, "dataset": dataset, "fields": fields, "metrics": model.get("metrics", []),
            "analysis_lineage": bundle.get("analysis_lineage"), "executed_at": datetime.now(timezone.utc).isoformat()}
    if payload.get("metadata_only"):
        return base
    filters = query.get("filters", [])
    filtered = frame.loc[filter_mask(frame, filters)]
    period = query.get("period")
    period_field = None
    start = end = None
    if period:
        fail(not isinstance(period, dict), "period must be an object.")
        period_field = field(frame, period.get("field"))
        try:
            end = date_value(period.get("end") or datetime.now(timezone.utc).date()).normalize()
            relative = period.get("last_days")
            if relative is not None:
                fail(type(relative) is not int or not 1 <= relative <= 3660, "Relative period must be 1–3660 days.")
            start = end - pd.Timedelta(days=relative - 1) if relative else date_value(period.get("start")).normalize()
            fail(start > end, "Invalid period boundaries.")
        except (ValueError, TypeError) as exc:
            raise AnalyticsError("Use valid YYYY-MM-DD period boundaries.") from exc
    def select_period(data, left, right):
        values = dates(data[period_field])
        return data.loc[(values >= left) & (values < right + pd.Timedelta(days=1))]
    current = select_period(filtered, start, end) if period else filtered
    mode = query.get("mode", "aggregate")
    fail(mode not in ("aggregate", "rows", "histogram", "pivot"), "Unknown query mode.")
    limit, offset = query.get("limit", 1000), query.get("offset", 0)
    fail(type(limit) is not int or not 1 <= limit <= 10000 or type(offset) is not int or not 0 <= offset <= 1000000, "Invalid result limit or offset.")
    summary, pivot = {}, None
    if mode == "rows":
        # Governed relationship execution has already checked source readiness;
        # this API grants no additional field or identity permissions.
        columns = query.get("columns") or list(current.columns)
        fail(not isinstance(columns, list) or len(columns) > 100, "Choose at most 100 detail columns.")
        for name in columns:
            field(current, name)
        fail(len(set(columns)) != len(columns), "Detail columns must be unique.")
        detail = current[columns].copy()
        numeric_columns = query.get("numeric_columns", [])
        fail(not isinstance(numeric_columns, list) or len(numeric_columns) > 2, "Select at most two scatter fields.")
        for name in numeric_columns:
            field(detail, name)
            numeric = pd.to_numeric(detail[name], errors="coerce")
            fail(bool((detail[name].notna() & numeric.isna()).any()), f"Scatter field '{name}' must be numeric.")
            detail[name] = numeric
        sort = query.get("sort")
        if sort:
            fail(not isinstance(sort, dict) or sort.get("direction", "asc") not in ("asc", "desc"), "Invalid sort field or direction.")
            field(detail, sort.get("field"))
            detail = detail.sort_values(sort["field"], ascending=sort.get("direction") != "desc", kind="stable")
        total = len(detail)
        rows = clean(detail.iloc[offset:offset + limit].to_dict("records"))
    elif mode == "histogram":
        name = field(current, query.get("field"))
        bins = query.get("bins", 10)
        fail(type(bins) is not int or not 1 <= bins <= 100, "Histogram requires 1–100 bins.")
        numeric = pd.to_numeric(current[name], errors="coerce")
        fail(bool((current[name].notna() & numeric.isna()).any()), "Histogram field must be numeric.")
        columns = ["bin_start", "bin_end", "count"]
        if numeric.notna().any():
            counts = pd.cut(numeric, bins=bins, include_lowest=True).value_counts(sort=False)
            rows = [{"bin_start": float(k.left), "bin_end": float(k.right), "count": int(v)} for k, v in counts.items()]
        else:
            rows = []
        total = len(rows)
        rows = rows[offset:offset + limit]
    else:
        rows, summary, columns = aggregate(current, query, model)
        if mode == "pivot":
            groups = query.get("group_by", [])
            fail(len(groups) < 2, "Pivot needs row and column grouping fields.")
            fail(any(m.get("post", "none") != "none" for m in query["measures"]), "Pivot post-calculations require an ordinary analysis first.")
            row_query = {**query, "group_by": groups[:-1], "sort": {"field": groups[0]["field"], "direction": "asc"}}
            row_totals, _, _ = aggregate(current, row_query, model)
            column_query = {**query, "group_by": groups[-1:], "sort": {"field": groups[-1]["field"], "direction": "asc"}}
            column_totals, _, _ = aggregate(current, column_query, model)
            pivot = {"row_fields": [g["field"] for g in groups[:-1]], "column_field": groups[-1]["field"],
                     "row_totals": row_totals, "column_totals": column_totals, "grand_totals": summary}
        total = len(rows)
        rows = rows[offset:offset + limit]
    comparison = None
    compare = query.get("comparison")
    if compare:
        fail(not isinstance(compare, dict), "comparison must be an object.")
        kind = compare.get("kind")
        fail(mode not in ("aggregate", "pivot") or (not period and kind != "segment"), "Comparison requires an aggregate query and a date period or segment.")
        if kind == "segment":
            # The baseline has its own full filter tree, allowing East vs West.
            # The active date period remains shared by both populations.
            prior_start, prior_end = start, end
            prior = frame.loc[filter_mask(frame, compare.get("filters", []))]
            if period:
                prior = select_period(prior, start, end)
        elif kind == "previous_period":
            prior_end = start - pd.Timedelta(days=1)
            prior_start = prior_end - (end - start)
        elif kind == "previous_year":
            prior_start, prior_end = start - pd.DateOffset(years=1), end - pd.DateOffset(years=1)
        elif kind == "custom":
            try:
                prior_start, prior_end = date_value(compare["start"]).normalize(), date_value(compare["end"]).normalize()
                fail(prior_start > prior_end, "Comparison start exceeds end.")
            except (KeyError, ValueError, TypeError) as exc:
                raise AnalyticsError("Invalid custom comparison dates.") from exc
        else:
            raise AnalyticsError("Unknown comparison period.")
        if kind != "segment":
            prior = select_period(filtered, prior_start, prior_end)
        prior_rows, prior_summary, _ = aggregate(prior, query, model)
        def alignment_key(row, period_start):
            parts = []
            for group in query.get("group_by", []):
                value, grain = row.get(group["field"]), group.get("grain")
                if kind != "segment" and group["field"] == period_field and grain and value is not None:
                    if grain == "quarter":
                        year, quarter = str(value).split("-Q")
                        value = int(year) * 4 + int(quarter) - (period_start.year * 4 + period_start.quarter)
                    elif grain == "year":
                        value = int(value) - period_start.year
                    elif grain == "month":
                        date = pd.Timestamp(str(value) + "-01")
                        value = date.year * 12 + date.month - (period_start.year * 12 + period_start.month)
                    else:
                        date = pd.Timestamp(value, tz="UTC")
                        anchor = period_start - pd.Timedelta(days=period_start.weekday()) if grain == "week" else period_start
                        value = (date - anchor).days // (7 if grain == "week" else 1)
                parts.append(value)
            return json.dumps(clean(parts), sort_keys=True)
        indexed_prior = {alignment_key(row, prior_start): row for row in prior_rows}
        aligned_rows = [{**{g["field"]: row.get(g["field"]) for g in query.get("group_by", [])},
                         **{m["id"]: indexed_prior.get(alignment_key(row, start), {}).get(m["id"])
                            for m in query.get("measures", [])}} for row in rows]
        deltas = {}
        for key, value in summary.items():
            baseline = prior_summary.get(key)
            delta = value - baseline if value is not None and baseline is not None and len(prior) and len(current) else None
            deltas[key] = {"absolute": delta, "percent": delta / abs(baseline) * 100 if delta is not None and baseline else None}
        comparison = {"kind": kind, "start": prior_start.date().isoformat() if prior_start is not None else None,
                      "end": prior_end.date().isoformat() if prior_end is not None else None,
                      "row_count": len(prior), "rows": prior_rows[:10000], "summary": prior_summary, "deltas": deltas,
                      "aligned_rows": aligned_rows,
                      "filters": compare.get("filters", filters),
                      "alignment": "category" if kind == "segment" else "period_position", "truncated": len(prior_rows) > 10000}
    return clean({**base, "columns": columns, "rows": rows, "summary": summary, "pivot": pivot, "comparison": comparison,
                  "row_count": len(current), "total_result_rows": total, "limit": limit, "offset": offset,
                  "truncated": offset + len(rows) < total, "filters": filters,
                  "period": {"field": period_field, "start": str(start.date()), "end": str(end.date())} if period else None})
