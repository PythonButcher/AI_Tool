from __future__ import annotations

import ast
import operator
from typing import Any, Dict, List, Optional, Sequence

import pandas as pd

from backend.services.dataset_context import resolve_dataset_bundle
from backend.services.semantic_model import FORMULA_COLUMN_PATTERN, extract_formula_columns


_AGGREGATION_ALIASES = {
    "sum": "sum",
    "total": "sum",
    "avg": "mean",
    "average": "mean",
    "mean": "mean",
    "min": "min",
    "max": "max",
    "count": "count",
    "count_non_null": "count",
    "count_distinct": "nunique",
    "distinct_count": "nunique",
    "nunique": "nunique",
}
_ALLOWED_BINARY_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_ALLOWED_UNARY_OPERATORS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


class MetricResolutionError(ValueError):
    """Stable semantic-metric execution failure."""

    def __init__(self, message: str, *, code: str = "metric_resolution_failed"):
        super().__init__(message)
        self.code = code


class MetricResolver:
    @staticmethod
    def resolve(
        metric: Optional[Dict[str, Any]] = None,
        metric_id: Optional[str] = None,
        metric_name: Optional[str] = None,
        dataset: Any = None,
        dataset_ref: Optional[Dict[str, Any]] = None,
        semantic_model: Optional[Dict[str, Any]] = None,
        group_by: Optional[Sequence[Any]] = None,
        filters: Optional[Sequence[Dict[str, Any]]] = None,
        limit: Optional[int] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        bundle = resolve_dataset_bundle(
            dataset=dataset,
            dataset_ref=dataset_ref,
            semantic_model=semantic_model,
            source="metric_resolver",
        )
        dataframe = bundle["dataframe"].copy()
        resolved_model = bundle["semantic_model"]
        resolved_metric = MetricResolver._resolve_metric_definition(
            metric=metric,
            metric_id=metric_id,
            metric_name=metric_name,
            semantic_model=resolved_model,
        )
        group_defs = MetricResolver._resolve_group_dimensions(group_by or [], resolved_model, dataframe)

        request_filters = MetricResolver._normalize_filters(filters, resolved_model, dataframe)
        metric_filters = MetricResolver._normalize_filters(
            resolved_metric.get("filters") or resolved_metric.get("where") or (resolved_metric.get("expression") or {}).get("filters"),
            resolved_model,
            dataframe,
        )
        all_filters = [*metric_filters, *request_filters]
        filtered_df = MetricResolver._apply_filters(dataframe, all_filters)

        result = MetricResolver._execute_metric(
            dataframe=filtered_df,
            metric=resolved_metric,
            group_defs=group_defs,
            limit=limit,
            sort=sort,
        )

        execution = result.pop("execution")
        rows = result["rows"]
        summary_value = result["summary"]["value"]

        return {
            "metric": {
                "id": resolved_metric.get("id"),
                "name": resolved_metric.get("name"),
                "label": resolved_metric.get("label") or resolved_metric.get("name"),
                "field": resolved_metric.get("field"),
                "default_aggregation": resolved_metric.get("default_aggregation"),
                "format_hint": resolved_metric.get("format_hint"),
                "expression": resolved_metric.get("expression") or {},
                "status": resolved_metric.get("status"),
                "is_inferred": resolved_metric.get("is_inferred"),
                "is_user_defined": resolved_metric.get("is_user_defined"),
            },
            "dataset": {
                **bundle["dataset_ref"],
                "row_count": int(len(filtered_df.index)),
                "source_row_count": int(len(dataframe.index)),
            },
            "group_by": group_defs,
            "filters": all_filters,
            "summary": {
                **result["summary"],
                "value": MetricResolver._serialize_value(summary_value),
            },
            "rows": rows,
            "chart_ready": {
                "labels": [
                    MetricResolver._build_group_label(
                        row.get("group") or {},
                        group_defs,
                    )
                    for row in rows
                ],
                "values": [row.get("value") for row in rows],
            },
            "execution": execution,
        }

    @staticmethod
    def _resolve_metric_definition(
        metric: Optional[Dict[str, Any]],
        metric_id: Optional[str],
        metric_name: Optional[str],
        semantic_model: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        if isinstance(metric, dict):
            return metric

        metrics = semantic_model.get("metrics") if isinstance(semantic_model, dict) else []
        for candidate in metrics or []:
            if metric_id and MetricResolver._matches_reference(candidate, metric_id):
                return candidate
            if metric_name and MetricResolver._matches_reference(candidate, metric_name):
                return candidate

        ref = metric_id or metric_name
        if ref:
            raise MetricResolutionError(f"Metric '{ref}' was not found in the semantic model.")
        raise MetricResolutionError("A semantic metric definition or metric identifier is required.")

    @staticmethod
    def _resolve_group_dimensions(
        group_by: Sequence[Any],
        semantic_model: Optional[Dict[str, Any]],
        dataframe: pd.DataFrame,
    ) -> List[Dict[str, Any]]:
        dimensions = semantic_model.get("dimensions") if isinstance(semantic_model, dict) else []
        resolved: List[Dict[str, Any]] = []

        for item in group_by:
            definition = None
            if isinstance(item, dict):
                reference = item.get("id") or item.get("dimension_id") or item.get("field") or item.get("name")
                definition = MetricResolver._find_dimension(dimensions, reference)
                if definition is None and item.get("field") in dataframe.columns:
                    definition = {
                        "id": item.get("id") or f"field_{item['field']}",
                        "field": item["field"],
                        "label": item.get("label") or item["field"],
                        "name": item.get("name") or item["field"],
                    }
            elif isinstance(item, str):
                definition = MetricResolver._find_dimension(dimensions, item)
                if definition is None and item in dataframe.columns:
                    definition = {
                        "id": f"field_{item}",
                        "field": item,
                        "label": item,
                        "name": item,
                    }

            if definition is None:
                raise MetricResolutionError(f"Grouping dimension '{item}' could not be resolved.")

            field_name = definition.get("field")
            if field_name not in dataframe.columns:
                raise MetricResolutionError(f"Grouping field '{field_name}' does not exist in the dataset.")

            resolved.append({
                "id": definition.get("id"),
                "name": definition.get("name") or field_name,
                "label": definition.get("label") or field_name,
                "field": field_name,
                "semantic_kind": definition.get("semantic_kind"),
                "data_type": definition.get("data_type"),
            })

        return resolved

    @staticmethod
    def _find_dimension(dimensions: Optional[Sequence[Dict[str, Any]]], reference: Optional[str]) -> Optional[Dict[str, Any]]:
        if not reference:
            return None
        for dimension in dimensions or []:
            if MetricResolver._matches_reference(dimension, reference):
                return dimension
        return None

    @staticmethod
    def _matches_reference(candidate: Dict[str, Any], reference: str) -> bool:
        if not reference:
            return False
        normalized_reference = str(reference).strip().lower()
        candidate_values = [
            candidate.get("id"),
            candidate.get("name"),
            candidate.get("label"),
            candidate.get("field"),
        ]
        return any(str(value).strip().lower() == normalized_reference for value in candidate_values if value is not None)

    @staticmethod
    def _coerce_to_filter_list(filters: Optional[Any]) -> List[Dict[str, Any]]:
        if filters is None:
            return []
        if isinstance(filters, dict):
            return [filters]
        if isinstance(filters, list):
            return [item for item in filters if item is not None]
        raise MetricResolutionError("Filters must be an object or an array of objects.")

    @staticmethod
    def _normalize_filters(
        filters: Optional[Any],
        semantic_model: Optional[Dict[str, Any]],
        dataframe: pd.DataFrame,
    ) -> List[Dict[str, Any]]:
        dimensions = semantic_model.get("dimensions") if isinstance(semantic_model, dict) else []
        normalized: List[Dict[str, Any]] = []

        for item in MetricResolver._coerce_to_filter_list(filters):
            if not isinstance(item, dict):
                raise MetricResolutionError("Filters must be objects.")

            field_name = item.get("field")
            definition = None
            if not field_name:
                reference = item.get("dimension_id") or item.get("dimension") or item.get("name")
                definition = MetricResolver._find_dimension(dimensions, reference)
                if definition is not None:
                    field_name = definition.get("field")
                elif reference in dataframe.columns:
                    field_name = reference
            else:
                definition = MetricResolver._find_dimension(dimensions, field_name)

            if not field_name:
                raise MetricResolutionError(f"Filter field could not be resolved for {item}.")
            if field_name not in dataframe.columns:
                raise MetricResolutionError(f"Filter field '{field_name}' does not exist in the dataset.")

            normalized.append({
                "field": field_name,
                "dimension_id": (
                    definition.get("id")
                    if isinstance(definition, dict)
                    else item.get("dimension_id")
                ),
                "label": (
                    definition.get("label")
                    if isinstance(definition, dict)
                    else item.get("label")
                ) or field_name,
                "operator": str(item.get("operator") or "eq").lower(),
                "value": item.get("value"),
                "values": item.get("values"),
            })

        return normalized

    @staticmethod
    def _apply_filters(dataframe: pd.DataFrame, filters: Sequence[Dict[str, Any]]) -> pd.DataFrame:
        filtered_df = dataframe
        for filter_def in filters:
            series = filtered_df[filter_def["field"]]
            operator_name = filter_def.get("operator", "eq")
            value = filter_def.get("value")
            values = filter_def.get("values")

            if operator_name == "eq":
                mask = series == MetricResolver._coerce_filter_value(series, value)
            elif operator_name == "neq":
                mask = series != MetricResolver._coerce_filter_value(series, value)
            elif operator_name == "gt":
                mask = series > MetricResolver._coerce_filter_value(series, value)
            elif operator_name == "gte":
                mask = series >= MetricResolver._coerce_filter_value(series, value)
            elif operator_name == "lt":
                mask = series < MetricResolver._coerce_filter_value(series, value)
            elif operator_name == "lte":
                mask = series <= MetricResolver._coerce_filter_value(series, value)
            elif operator_name == "in":
                raw_values = values if values is not None else value
                if not isinstance(raw_values, list):
                    raw_values = [raw_values]
                coerced = [MetricResolver._coerce_filter_value(series, item) for item in raw_values]
                mask = series.isin(coerced)
            elif operator_name == "not_in":
                raw_values = values if values is not None else value
                if not isinstance(raw_values, list):
                    raw_values = [raw_values]
                coerced = [MetricResolver._coerce_filter_value(series, item) for item in raw_values]
                mask = ~series.isin(coerced)
            elif operator_name == "contains":
                mask = series.astype(str).str.contains(str(value), case=False, na=False)
            elif operator_name == "starts_with":
                mask = series.astype(str).str.startswith(str(value), na=False)
            elif operator_name == "ends_with":
                mask = series.astype(str).str.endswith(str(value), na=False)
            elif operator_name == "is_null":
                mask = series.isna()
            elif operator_name == "not_null":
                mask = series.notna()
            else:
                raise MetricResolutionError(f"Unsupported filter operator '{operator_name}'.")

            filtered_df = filtered_df.loc[mask]

        return filtered_df

    @staticmethod
    def _coerce_filter_value(series: pd.Series, value: Any) -> Any:
        if value is None:
            return None
        try:
            if pd.api.types.is_numeric_dtype(series):
                coerced = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
                return value if pd.isna(coerced) else coerced
            if pd.api.types.is_datetime64_any_dtype(series):
                coerced = pd.to_datetime(pd.Series([value]), errors="coerce").iloc[0]
                return value if pd.isna(coerced) else coerced
        except Exception:
            return value
        return value

    @staticmethod
    def _execute_metric(
        dataframe: pd.DataFrame,
        metric: Dict[str, Any],
        group_defs: Sequence[Dict[str, Any]],
        limit: Optional[int],
        sort: Optional[str],
    ) -> Dict[str, Any]:
        expression = metric.get("expression") or {}
        expression_type = expression.get("type") or "column_aggregation"
        aggregation = expression.get("aggregation") or metric.get("default_aggregation") or "sum"
        resolved_aggregation = _AGGREGATION_ALIASES.get(str(aggregation).lower())
        if expression_type != "count_rows" and resolved_aggregation is None:
            raise MetricResolutionError(f"Unsupported aggregation '{aggregation}'.")

        group_fields = [item["field"] for item in group_defs]
        group_count = 0
        execution_field = None

        if expression_type == "count_rows":
            summary_value = int(len(dataframe.index))
            execution_aggregation = "row_count"
            if group_fields:
                result_frame = dataframe.groupby(list(group_fields), dropna=False).size().reset_index(name="value")
                result_frame["row_count"] = result_frame["value"]
                result_frame = MetricResolver._sort_result_frame(result_frame, group_fields, sort)
                if isinstance(limit, int) and limit > 0:
                    result_frame = result_frame.head(limit)
                group_count = int(len(result_frame.index))
                rows = [MetricResolver._result_row_from_series(row, group_defs) for _, row in result_frame.iterrows()]
            else:
                rows = [{
                    "group": {},
                    "value": summary_value,
                    "row_count": int(len(dataframe.index)),
                }]
        elif expression_type == "column_aggregation":
            value_field = expression.get("column") or metric.get("field")
            if not value_field:
                raise MetricResolutionError("Metric expression is missing a column reference.")
            if value_field not in dataframe.columns:
                raise MetricResolutionError(f"Metric field '{value_field}' does not exist in the dataset.")
            if resolved_aggregation in {"sum", "mean", "min", "max"}:
                numeric_values = pd.to_numeric(
                    dataframe[value_field],
                    errors="coerce",
                )
                if int(numeric_values.notna().sum()) == 0:
                    raise MetricResolutionError(
                        f"Selected metric '{value_field}' has no usable numeric values.",
                        code="metric_measure_not_numeric",
                    )
            execution_field = value_field
            summary_value = MetricResolver._scalar_aggregate(dataframe, value_field, resolved_aggregation)
            execution_aggregation = resolved_aggregation
            if group_fields:
                result_frame = MetricResolver._build_grouped_aggregate_frame(
                    dataframe=dataframe,
                    group_fields=group_fields,
                    value_field=value_field,
                    aggregation=resolved_aggregation,
                )
                result_frame = MetricResolver._sort_result_frame(result_frame, group_fields, sort)
                if isinstance(limit, int) and limit > 0:
                    result_frame = result_frame.head(limit)
                group_count = int(len(result_frame.index))
                rows = [MetricResolver._result_row_from_series(row, group_defs) for _, row in result_frame.iterrows()]
            else:
                rows = [{
                    "group": {},
                    "value": MetricResolver._serialize_value(summary_value),
                    "row_count": int(len(dataframe.index)),
                }]
        elif expression_type == "derived_formula":
            formula = expression.get("formula") or ""
            formula_columns = expression.get("columns") or extract_formula_columns(formula)
            if not formula or not formula_columns:
                raise MetricResolutionError("Formula metrics require a valid formula with [Column] references.")
            missing_columns = [column for column in formula_columns if column not in dataframe.columns]
            if missing_columns:
                raise MetricResolutionError(f"Formula references missing dataset fields: {', '.join(missing_columns)}.")
            execution_field = ", ".join(formula_columns)
            summary_value = MetricResolver._evaluate_formula_scalar(
                dataframe=dataframe,
                formula=formula,
                columns=formula_columns,
                aggregation=resolved_aggregation,
            )
            execution_aggregation = f"{resolved_aggregation}_formula"
            if group_fields:
                result_frame = MetricResolver._build_grouped_formula_frame(
                    dataframe=dataframe,
                    group_fields=group_fields,
                    formula=formula,
                    columns=formula_columns,
                    aggregation=resolved_aggregation,
                )
                result_frame = MetricResolver._sort_result_frame(result_frame, group_fields, sort)
                if isinstance(limit, int) and limit > 0:
                    result_frame = result_frame.head(limit)
                group_count = int(len(result_frame.index))
                rows = [MetricResolver._result_row_from_series(row, group_defs) for _, row in result_frame.iterrows()]
            else:
                rows = [{
                    "group": {},
                    "value": MetricResolver._serialize_value(summary_value),
                    "row_count": int(len(dataframe.index)),
                }]
        else:
            raise MetricResolutionError(f"Unsupported metric expression type '{expression_type}'.")

        return {
            "rows": rows,
            "summary": {
                "value": summary_value,
                "row_count": int(len(dataframe.index)),
                "group_count": group_count,
            },
            "execution": {
                "expression_type": expression_type,
                "resolved_aggregation": execution_aggregation,
                "resolved_field": execution_field,
            },
        }

    @staticmethod
    def _build_grouped_aggregate_frame(
        dataframe: pd.DataFrame,
        group_fields: Sequence[str],
        value_field: str,
        aggregation: str,
    ) -> pd.DataFrame:
        grouped = dataframe.groupby(list(group_fields), dropna=False)
        row_counts = grouped.size().reset_index(name="row_count")

        if aggregation in {"sum", "mean", "min", "max"}:
            metric_series = pd.to_numeric(dataframe[value_field], errors="coerce")
            metric_frame = dataframe.loc[:, list(group_fields)].copy()
            metric_frame["_metric_value"] = metric_series
            if aggregation == "sum":
                aggregated = metric_frame.groupby(list(group_fields), dropna=False)["_metric_value"].sum(min_count=1)
            elif aggregation == "mean":
                aggregated = metric_frame.groupby(list(group_fields), dropna=False)["_metric_value"].mean()
            elif aggregation == "min":
                aggregated = metric_frame.groupby(list(group_fields), dropna=False)["_metric_value"].min()
            else:
                aggregated = metric_frame.groupby(list(group_fields), dropna=False)["_metric_value"].max()
            result_frame = aggregated.reset_index(name="value")
        elif aggregation == "count":
            result_frame = grouped[value_field].count().reset_index(name="value")
        elif aggregation == "nunique":
            result_frame = grouped[value_field].nunique(dropna=True).reset_index(name="value")
        else:
            raise MetricResolutionError(f"Unsupported aggregation '{aggregation}'.")

        return result_frame.merge(row_counts, on=list(group_fields), how="left")

    @staticmethod
    def _build_grouped_formula_frame(
        dataframe: pd.DataFrame,
        group_fields: Sequence[str],
        formula: str,
        columns: Sequence[str],
        aggregation: str,
    ) -> pd.DataFrame:
        result_frame = None
        for index, column in enumerate(columns):
            aggregated = MetricResolver._build_grouped_aggregate_frame(
                dataframe=dataframe,
                group_fields=group_fields,
                value_field=column,
                aggregation=aggregation,
            )
            aggregated = aggregated.rename(columns={"value": f"_operand_{index}"})
            aggregated = aggregated.drop(columns=["row_count"], errors="ignore")
            result_frame = aggregated if result_frame is None else result_frame.merge(
                aggregated,
                on=list(group_fields),
                how="outer",
            )

        if result_frame is None:
            raise MetricResolutionError("Formula metric could not be evaluated.")

        row_counts = dataframe.groupby(list(group_fields), dropna=False).size().reset_index(name="row_count")
        variables = {
            column: result_frame[f"_operand_{index}"].fillna(0)
            for index, column in enumerate(columns)
        }
        result_frame["value"] = MetricResolver._evaluate_formula(formula, variables)
        result_frame = result_frame.merge(row_counts, on=list(group_fields), how="left")
        return result_frame

    @staticmethod
    def _evaluate_formula_scalar(
        dataframe: pd.DataFrame,
        formula: str,
        columns: Sequence[str],
        aggregation: str,
    ) -> Any:
        variables = {
            column: MetricResolver._normalize_formula_operand(MetricResolver._scalar_aggregate(dataframe, column, aggregation))
            for column in columns
        }
        return MetricResolver._serialize_value(MetricResolver._evaluate_formula(formula, variables))

    @staticmethod
    def _scalar_aggregate(dataframe: pd.DataFrame, value_field: str, aggregation: str) -> Any:
        if aggregation in {"sum", "mean", "min", "max"}:
            numeric_series = pd.to_numeric(dataframe[value_field], errors="coerce")
            if aggregation == "sum":
                result = numeric_series.sum(min_count=1)
                return 0 if pd.isna(result) else MetricResolver._serialize_value(result)
            if aggregation == "mean":
                return MetricResolver._serialize_value(numeric_series.mean())
            if aggregation == "min":
                return MetricResolver._serialize_value(numeric_series.min())
            return MetricResolver._serialize_value(numeric_series.max())

        if aggregation == "count":
            return int(dataframe[value_field].count())
        if aggregation == "nunique":
            return int(dataframe[value_field].nunique(dropna=True))

        raise MetricResolutionError(f"Unsupported aggregation '{aggregation}'.")

    @staticmethod
    def _evaluate_formula(formula: str, variables: Dict[str, Any]) -> Any:
        alias_by_column: Dict[str, str] = {}

        def replace_column(match: Any) -> str:
            column = str(match.group(1)).strip()
            alias = alias_by_column.get(column)
            if alias is None:
                alias = f"v{len(alias_by_column)}"
                alias_by_column[column] = alias
            return alias

        rewritten_formula = extract_formula_columns(formula)
        if not rewritten_formula:
            raise MetricResolutionError("Formula metrics require [Column] references.")

        expression_text = FORMULA_COLUMN_PATTERN.sub(replace_column, formula)
        try:
            compiled_formula = ast.parse(expression_text, mode="eval")
        except SyntaxError as exc:
            raise MetricResolutionError(f"Invalid metric formula syntax: {exc.msg}.") from exc
        scoped_variables = {
            alias: variables[column]
            for column, alias in alias_by_column.items()
        }
        return MetricResolver._evaluate_formula_node(compiled_formula.body, scoped_variables)

    @staticmethod
    def _evaluate_formula_node(node: ast.AST, variables: Dict[str, Any]) -> Any:
        if isinstance(node, ast.BinOp):
            operator_fn = _ALLOWED_BINARY_OPERATORS.get(type(node.op))
            if operator_fn is None:
                raise MetricResolutionError("Unsupported operator used in metric formula.")
            left_value = MetricResolver._evaluate_formula_node(node.left, variables)
            right_value = MetricResolver._evaluate_formula_node(node.right, variables)
            return operator_fn(left_value, right_value)

        if isinstance(node, ast.UnaryOp):
            operator_fn = _ALLOWED_UNARY_OPERATORS.get(type(node.op))
            if operator_fn is None:
                raise MetricResolutionError("Unsupported unary operator used in metric formula.")
            operand_value = MetricResolver._evaluate_formula_node(node.operand, variables)
            return operator_fn(operand_value)

        if isinstance(node, ast.Name):
            if node.id not in variables:
                raise MetricResolutionError(f"Unknown formula variable '{node.id}'.")
            return variables[node.id]

        if isinstance(node, ast.Constant):
            return node.value

        if isinstance(node, ast.Expr):
            return MetricResolver._evaluate_formula_node(node.value, variables)

        raise MetricResolutionError("Formula contains unsupported syntax.")

    @staticmethod
    def _normalize_formula_operand(value: Any) -> Any:
        if value is None:
            return 0
        try:
            if pd.isna(value):
                return 0
        except Exception:
            return value
        return value

    @staticmethod
    def _sort_result_frame(result_frame: pd.DataFrame, group_fields: Sequence[str], sort: Optional[str]) -> pd.DataFrame:
        resolved_sort = (sort or "group_asc").lower()
        if resolved_sort == "value_desc":
            return result_frame.sort_values(by=["value"], ascending=[False], na_position="last")
        if resolved_sort == "value_asc":
            return result_frame.sort_values(by=["value"], ascending=[True], na_position="last")
        if resolved_sort == "group_desc":
            return result_frame.sort_values(by=list(group_fields), ascending=False, na_position="last")
        return result_frame.sort_values(by=list(group_fields), ascending=True, na_position="last")

    @staticmethod
    def _result_row_from_series(row: pd.Series, group_defs: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
        group_values = {
            group_def["field"]: MetricResolver._serialize_value(row[group_def["field"]])
            for group_def in group_defs
        }
        return {
            "group": group_values,
            "value": MetricResolver._serialize_value(row.get("value")),
            "row_count": int(row.get("row_count", 0)),
        }

    @staticmethod
    def _build_group_label(
        group_values: Dict[str, Any],
        group_defs: Sequence[Dict[str, Any]] = (),
    ) -> str:
        """Render readable values while result rows retain qualified field keys."""
        if not group_values:
            return "All Data"
        if len(group_values) == 1:
            return str(next(iter(group_values.values())))
        labels_by_field = {
            definition.get("field"): definition.get("label") or definition.get("name")
            for definition in group_defs
            if isinstance(definition, dict) and definition.get("field")
        }
        parts = [
            f"{labels_by_field.get(field) or field}: {value}"
            for field, value in group_values.items()
        ]
        return " | ".join(parts)

    @staticmethod
    def _serialize_value(value: Any) -> Any:
        if value is None or pd.isna(value):
            return None
        if isinstance(value, pd.Timestamp):
            return value.isoformat()
        if hasattr(value, "item"):
            return value.item()
        return value
