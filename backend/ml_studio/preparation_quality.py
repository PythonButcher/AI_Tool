"""Deterministic quality evidence; domain meaning is deliberately not inferred."""

import json

import numpy as np
import pandas as pd


def inspect_quality(dataframe: pd.DataFrame) -> dict:
    findings = []
    checks = ["whitespace", "non_finite_values"]
    try:
        duplicate_count = int(dataframe.duplicated().sum())
        checks.append("duplicate_rows")
        if duplicate_count:
            findings.append({"code": "duplicate_rows", "field": None, "count": duplicate_count,
                             "message": "Repeated rows match across every column.",
                             "remediation": "Review whether repeats are legitimate observations before keeping only the first occurrence."})
    except TypeError:
        # Nested values cannot always be hashed. Do not label an unrun check clean.
        pass
    for column in dataframe.columns:
        values = dataframe[column]
        whitespace_count = int(values.map(lambda value: isinstance(value, str) and value != value.strip()).sum())
        if whitespace_count:
            findings.append({"code": "whitespace", "field": str(column), "count": whitespace_count,
                             "message": "Text contains leading or trailing spaces.",
                             "remediation": "Trim surrounding spaces while preserving the text's case and contents."})
        if pd.api.types.is_numeric_dtype(values.dtype):
            infinite_count = int(values.isin([np.inf, -np.inf]).sum())
            if infinite_count:
                findings.append({"code": "non_finite_values", "field": str(column), "count": infinite_count,
                                 "message": "Numeric values include positive or negative infinity.",
                                 "remediation": "Inspect these values and define a valid replacement or filter in the editor."})
    return {"findings": findings, "checks": checks,
            "data_preview": json.loads(dataframe.head(20).to_json(orient="records", date_format="iso"))}
