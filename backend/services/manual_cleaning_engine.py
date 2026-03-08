import pandas as pd
from typing import List, Dict, Any, Callable


class ManualCleaningEngine:
    """Extensible manual cleaning engine similar to Power Query."""

    def __init__(self):
        self.registry: Dict[str, Callable[[pd.DataFrame, Dict[str, Any]], pd.DataFrame]] = {
            "trim_whitespace": self._trim_whitespace,
            "change_case": self._change_case,
            "replace_values": self._replace_values,
            "replace_nulls": self._replace_nulls,
            "remove_nulls": self._remove_nulls,
            "filter_rows": self._filter_rows,
            "remove_top_rows": self._remove_top_rows,
            "remove_bottom_rows": self._remove_bottom_rows,
            "keep_top_rows": self._keep_top_rows,
            "keep_bottom_rows": self._keep_bottom_rows,
            "convert_type": self._convert_type,
            "split_column": self._split_column,
            "merge_columns": self._merge_columns,
            "extract_date_component": self._extract_date_component,
            "sort_rows": self._sort_rows,
            "group_by": self._group_by,
            "pivot": self._pivot,
            "unpivot": self._unpivot,
            "remove_duplicates": self._remove_duplicates,
            "reorder_columns": self._reorder_columns,
            "rename_columns": self._rename_columns,
        }

    def apply_steps(self, steps: List[Dict[str, Any]], dataframe: pd.DataFrame) -> pd.DataFrame:
        df = dataframe.copy(deep=True)
        for step in steps:
            step_type = step.get("type")
            params = step.get("params", {})
            handler = self.registry.get(step_type)
            if not handler:
                # Skip unknown steps to remain forward compatible
                continue
            df = handler(df, params)
        return df

    def _get_columns(self, df: pd.DataFrame, params: Dict[str, Any]) -> List[str]:
        columns = params.get("columns") or []
        if not columns:
            return list(df.columns)
        return [col for col in columns if col in df.columns]

    def _trim_whitespace(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        columns = self._get_columns(df, params)
        for col in columns:
            df[col] = df[col].apply(lambda x: x.strip() if isinstance(x, str) else x)
        return df

    def _change_case(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        case_type = params.get("case", "lower")
        columns = self._get_columns(df, params)
        fn_map = {
            "lower": str.lower,
            "upper": str.upper,
            "title": str.title,
        }
        fn = fn_map.get(case_type, str.lower)
        for col in columns:
            df[col] = df[col].apply(lambda x: fn(x) if isinstance(x, str) else x)
        return df

    def _replace_values(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        columns = self._get_columns(df, params)
        replacements = params.get("replacements") or []
        replace_map = {item.get("from"): item.get("to") for item in replacements if "from" in item}
        if not columns:
            return df.replace(replace_map)
        for col in columns:
            df[col] = df[col].replace(replace_map)
        return df

    def _replace_nulls(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        columns = self._get_columns(df, params)
        strategy = params.get("strategy", "value")
        fill_value = params.get("value", "")
        if strategy == "value":
            fill_map = {col: fill_value for col in columns}
            df = df.fillna(fill_map if columns else fill_value)
        elif strategy == "ffill":
            df[columns] = df[columns].fillna(method="ffill") if columns else df.fillna(method="ffill")
        elif strategy == "bfill":
            df[columns] = df[columns].fillna(method="bfill") if columns else df.fillna(method="bfill")
        elif strategy == "median":
            for col in columns:
                if pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = df[col].fillna(df[col].median())
        elif strategy == "mean":
            for col in columns:
                if pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = df[col].fillna(df[col].mean())
        elif strategy == "mode":
            for col in columns:
                mode_series = df[col].mode()
                if not mode_series.empty:
                    df[col] = df[col].fillna(mode_series.iloc[0])
        return df

    def _remove_nulls(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        columns = params.get("columns")
        subset = [col for col in columns if col in df.columns] if columns else None
        return df.dropna(subset=subset)

    def _filter_rows(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        conditions = params.get("conditions") or []
        mask = pd.Series([True] * len(df), index=df.index)
        for cond in conditions:
            col = cond.get("column")
            op = cond.get("operator", "eq")
            value = cond.get("value")
            if col not in df.columns:
                continue
            series = df[col]
            if op == "eq":
                mask &= series == value
            elif op == "neq":
                mask &= series != value
            elif op == "gt":
                mask &= series > value
            elif op == "gte":
                mask &= series >= value
            elif op == "lt":
                mask &= series < value
            elif op == "lte":
                mask &= series <= value
            elif op == "contains":
                mask &= series.astype(str).str.contains(str(value), na=False)
            elif op == "not_contains":
                mask &= ~series.astype(str).str.contains(str(value), na=False)
            elif op == "in":
                mask &= series.isin(value if isinstance(value, list) else [value])
            elif op == "not_in":
                mask &= ~series.isin(value if isinstance(value, list) else [value])
            elif op == "startswith":
                mask &= series.astype(str).str.startswith(str(value), na=False)
            elif op == "endswith":
                mask &= series.astype(str).str.endswith(str(value), na=False)
        return df.loc[mask]

    def _remove_top_rows(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        n = int(params.get("count", 0))
        return df.iloc[n:]

    def _remove_bottom_rows(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        n = int(params.get("count", 0))
        if n == 0:
            return df
        return df.iloc[:-n]

    def _keep_top_rows(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        n = int(params.get("count", 0))
        return df.iloc[:n]

    def _keep_bottom_rows(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        n = int(params.get("count", 0))
        return df.iloc[-n:]

    def _convert_type(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        columns = self._get_columns(df, params)
        target_type = params.get("target", "string")
        for col in columns:
            if target_type == "datetime":
                df[col] = pd.to_datetime(df[col], errors="coerce")
            elif target_type == "numeric":
                df[col] = pd.to_numeric(df[col], errors="coerce")
            elif target_type == "int":
                df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
            elif target_type == "float":
                df[col] = pd.to_numeric(df[col], errors="coerce").astype(float)
            elif target_type == "bool":
                df[col] = df[col].astype(bool)
            else:
                df[col] = df[col].astype(str)
        return df

    def _split_column(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        column = params.get("column")
        delimiter = params.get("delimiter", " ")
        new_columns = params.get("new_columns") or []
        drop_original = params.get("drop_original", False)
        if column in df.columns:
            split_df = df[column].astype(str).str.split(delimiter, expand=True)
            for idx, new_col in enumerate(new_columns):
                if idx < split_df.shape[1]:
                    df[new_col] = split_df[idx]
            if drop_original:
                df = df.drop(columns=[column])
        return df

    def _merge_columns(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        columns = params.get("columns") or []
        separator = params.get("separator", " ")
        new_column = params.get("new_column", "merged")
        if columns:
            df[new_column] = df[columns].astype(str).agg(separator.join, axis=1)
        return df

    def _extract_date_component(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        column = params.get("column")
        component = params.get("component", "year")
        new_column = params.get("new_column") or f"{column}_{component}"
        if column in df.columns:
            dt_series = pd.to_datetime(df[column], errors="coerce")
            if component == "year":
                df[new_column] = dt_series.dt.year
            elif component == "month":
                df[new_column] = dt_series.dt.month
            elif component == "day":
                df[new_column] = dt_series.dt.day
            elif component == "weekday":
                df[new_column] = dt_series.dt.weekday
            elif component == "week":
                df[new_column] = dt_series.dt.isocalendar().week
        return df

    def _sort_rows(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        sort_by = params.get("sort_by") or []
        if not sort_by:
            return df
        by_cols = []
        ascending = []
        for rule in sort_by:
            col = rule.get("column")
            direction = rule.get("direction", "asc")
            if col in df.columns:
                by_cols.append(col)
                ascending.append(direction != "desc")
        if by_cols:
            df = df.sort_values(by=by_cols, ascending=ascending)
        return df

    def _group_by(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        group_columns = params.get("group_columns") or []
        aggregations = params.get("aggregations") or []
        if not group_columns or not aggregations:
            return df
        agg_dict = {}
        rename_map = {}
        for agg in aggregations:
            col = agg.get("column")
            func = agg.get("agg", "sum")
            alias = agg.get("as")
            if col in df.columns:
                agg_key = alias or f"{col}_{func}"
                agg_dict[agg_key] = (col, func)
                rename_map[agg_key] = agg_key
        if not agg_dict:
            return df
        grouped = df.groupby(group_columns).agg(**agg_dict).reset_index()
        grouped = grouped.rename(columns=rename_map)
        return grouped

    def _pivot(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        index = params.get("index") or []
        columns = params.get("columns")
        values = params.get("values")
        aggfunc = params.get("aggfunc", "sum")
        if not columns or not values:
            return df
        index_param = index if index else None
        if index_param is not None and not isinstance(index_param, list):
            index_param = [index_param]
        pivoted = df.pivot_table(index=index_param,
                                 columns=columns,
                                 values=values,
                                 aggfunc=aggfunc)
        pivoted = pivoted.reset_index()
        pivoted.columns = ["_".join([str(c) for c in col]).strip("_") if isinstance(col, tuple) else col for col in pivoted.columns]
        return pivoted

    def _unpivot(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        id_vars = params.get("id_vars") or []
        value_vars = params.get("value_vars")
        var_name = params.get("var_name", "variable")
        value_name = params.get("value_name", "value")
        if not value_vars:
            return df
        melted = pd.melt(df, id_vars=id_vars if isinstance(id_vars, list) else [id_vars],
                         value_vars=value_vars,
                         var_name=var_name,
                         value_name=value_name)
        return melted

    def _remove_duplicates(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        subset = params.get("subset") or None
        keep = params.get("keep", "first")
        subset_cols = [col for col in subset if col in df.columns] if subset else None
        return df.drop_duplicates(subset=subset_cols, keep=keep)

    def _reorder_columns(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        order = params.get("order") or []
        remaining_cols = [col for col in df.columns if col not in order]
        new_order = [col for col in order if col in df.columns] + remaining_cols
        return df[new_order]

    def _rename_columns(self, df: pd.DataFrame, params: Dict[str, Any]) -> pd.DataFrame:
        mappings = params.get("mappings") or {}
        valid_map = {old: new for old, new in mappings.items() if old in df.columns and new}
        if not valid_map:
            return df
        return df.rename(columns=valid_map)


def apply_steps(steps: List[Dict[str, Any]], dataframe: pd.DataFrame) -> pd.DataFrame:
    engine = ManualCleaningEngine()
    return engine.apply_steps(steps, dataframe)

