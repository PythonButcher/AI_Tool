from __future__ import annotations

import csv
import json
import logging
import warnings
from io import StringIO
from os import PathLike
from typing import Any, Dict, Optional

import pandas as pd
from pandas.errors import EmptyDataError, ParserError
from pandas.api.types import is_object_dtype, is_string_dtype

from backend.db.backend_db import get_db_connection
from backend.services.semantic_model import (
    infer_semantic_model_from_dataframe,
    normalize_records,
)
from backend.utils.global_state import (
    get_cleaned_data,
    get_semantic_model,
    get_uploaded_df,
)

logger = logging.getLogger(__name__)
CSV_DELIMITERS = [",", ";", "\t", "|", ":"]
NUMERIC_INFERENCE_THRESHOLD = 0.8


def _normalize_path(path: Any) -> str:
    return str(path).strip('"').strip("'")


def _resolve_dataset_name(source: Any, filename: Optional[str] = None) -> str:
    if filename:
        return str(filename)
    if isinstance(source, (str, PathLike)):
        return _normalize_path(source)
    return "dataset"


def _read_text_source(source: Any) -> str:
    if hasattr(source, "read"):
        payload = source.read()
        if hasattr(source, "seek"):
            try:
                source.seek(0)
            except Exception:
                pass
        if isinstance(payload, bytes):
            return payload.decode("utf-8-sig", errors="replace")
        return str(payload).lstrip("\ufeff")

    normalized_path = _normalize_path(source)
    with open(normalized_path, "r", encoding="utf-8", errors="replace", newline="") as handle:
        return handle.read().lstrip("\ufeff")


def _sniff_csv_delimiter(text: str) -> Optional[str]:
    sample = text[:8192]
    if not sample.strip():
        return None

    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=CSV_DELIMITERS)
        return dialect.delimiter
    except csv.Error:
        return None


def _log_parse_warnings(source_name: str, strategy: str, captured_warnings: list[warnings.WarningMessage]) -> None:
    for warning in captured_warnings:
        logger.warning(
            "Dataset %s parsed with %s produced warning: %s",
            source_name,
            strategy,
            warning.message,
        )


def _collect_csv_rows(text: str, delimiter: str) -> list[list[str]]:
    reader = csv.reader(StringIO(text), delimiter=delimiter, skipinitialspace=True)
    return [row for row in reader if row]


def _cleanup_inconsistent_csv_rows(text: str, delimiter: str, source_name: str) -> Optional[pd.DataFrame]:
    rows = _collect_csv_rows(text, delimiter)
    if not rows:
        return None

    header = rows[0]
    expected_columns = len(header)
    if expected_columns == 0:
        return None

    normalized_rows: list[list[str]] = []
    short_rows = 0
    extra_rows = 0
    trailing_delimiter_rows = 0
    inconsistent_rows = 0

    for row in rows[1:]:
        if len(row) == expected_columns:
            normalized_rows.append(row)
            continue

        inconsistent_rows += 1
        if len(row) < expected_columns:
            short_rows += 1
            normalized_rows.append([*row, *([""] * (expected_columns - len(row)))])
            continue

        extras = row[expected_columns:]
        if all(not str(value).strip() for value in extras):
            trailing_delimiter_rows += 1
        else:
            extra_rows += 1
        normalized_rows.append(row[:expected_columns])

    if inconsistent_rows == 0:
        return None

    logger.warning(
        "Dataset %s required CSV structural cleanup. inconsistent_rows=%s short_rows=%s extra_rows=%s trailing_delimiter_rows=%s",
        source_name,
        inconsistent_rows,
        short_rows,
        extra_rows,
        trailing_delimiter_rows,
    )

    dataframe = pd.DataFrame(normalized_rows, columns=header)
    return _normalize_loaded_dataframe(dataframe, source_name)


def _normalize_loaded_dataframe(dataframe: pd.DataFrame, source_name: str) -> pd.DataFrame:
    normalized = dataframe.copy()
    dtype_changes: Dict[str, Dict[str, str]] = {}

    for column in normalized.columns:
        series = normalized[column]
        original_dtype = str(series.dtype)

        if is_object_dtype(series) or is_string_dtype(series):
            text_series = series.map(lambda value: value.strip() if isinstance(value, str) else value)
            text_series = text_series.replace(r"^\s*$", pd.NA, regex=True)
            normalized[column] = text_series

            non_null = text_series.dropna()
            if non_null.empty:
                continue

            numeric_candidate = pd.to_numeric(
                non_null.astype("string").str.replace(r"[\$, ]", "", regex=True),
                errors="coerce",
            )
            numeric_ratio = float(numeric_candidate.notna().sum()) / float(non_null.shape[0])

            if numeric_ratio >= NUMERIC_INFERENCE_THRESHOLD:
                normalized[column] = pd.to_numeric(
                    text_series.astype("string").str.replace(r"[\$, ]", "", regex=True),
                    errors="coerce",
                )

        updated_dtype = str(normalized[column].dtype)
        if updated_dtype != original_dtype:
            dtype_changes[str(column)] = {"from": original_dtype, "to": updated_dtype}

    if dtype_changes:
        logger.info("Dataset %s normalized dataframe dtypes: %s", source_name, dtype_changes)
    return normalized


def _read_csv_with_fallback(source: Any, source_name: str) -> pd.DataFrame:
    text = _read_text_source(source)
    detected_delimiter = _sniff_csv_delimiter(text)
    cleanup_delimiter = detected_delimiter or ","
    cleaned_dataframe = _cleanup_inconsistent_csv_rows(text, cleanup_delimiter, source_name)
    if cleaned_dataframe is not None:
        return cleaned_dataframe

    attempts = [
        ("auto-detected delimiter", {"sep": None, "engine": "python", "on_bad_lines": "warn", "skipinitialspace": True}),
        ("auto-detected delimiter with skip", {"sep": None, "engine": "python", "on_bad_lines": "skip", "skipinitialspace": True}),
    ]

    if detected_delimiter:
        attempts.append(
            (
                f"sniffed delimiter '{detected_delimiter}'",
                {"sep": detected_delimiter, "engine": "python", "on_bad_lines": "warn", "skipinitialspace": True},
            )
        )
        attempts.append(
            (
                f"sniffed delimiter '{detected_delimiter}' with skip",
                {"sep": detected_delimiter, "engine": "python", "on_bad_lines": "skip", "skipinitialspace": True},
            )
        )

    for delimiter in CSV_DELIMITERS:
        if delimiter == detected_delimiter:
            continue
        attempts.append(
            (
                f"delimiter '{delimiter}'",
                {"sep": delimiter, "engine": "python", "on_bad_lines": "warn", "skipinitialspace": True},
            )
        )
        attempts.append(
            (
                f"delimiter '{delimiter}' with skip",
                {"sep": delimiter, "engine": "python", "on_bad_lines": "skip", "skipinitialspace": True},
            )
        )

    for strategy_name, kwargs in attempts:
        buffer = StringIO(text)
        try:
            with warnings.catch_warnings(record=True) as caught_warnings:
                warnings.simplefilter("always")
                dataframe = pd.read_csv(buffer, **kwargs)
            if caught_warnings:
                _log_parse_warnings(source_name, strategy_name, caught_warnings)
            if strategy_name != "auto-detected delimiter":
                logger.warning("Dataset %s required CSV fallback strategy: %s", source_name, strategy_name)
            dataframe = _normalize_loaded_dataframe(dataframe, source_name)
            return dataframe
        except (EmptyDataError, ParserError, ValueError, UnicodeDecodeError) as exc:
            logger.warning(
                "CSV parse attempt failed for %s using %s: %s",
                source_name,
                strategy_name,
                exc,
            )
            continue

    raise ValueError(f"Unable to parse CSV dataset '{source_name}' after trying multiple delimiter and bad-row fallback strategies.")


def _read_json_with_fallback(source: Any, source_name: str) -> pd.DataFrame:
    text = _read_text_source(source)
    attempts = [
        ("standard JSON", {"lines": False}),
        ("line-delimited JSON", {"lines": True}),
    ]

    last_error: Optional[Exception] = None
    for strategy_name, kwargs in attempts:
        buffer = StringIO(text)
        try:
            dataframe = pd.read_json(buffer, **kwargs)
            if strategy_name != "standard JSON":
                logger.warning("Dataset %s required JSON fallback strategy: %s", source_name, strategy_name)
            dataframe = _normalize_loaded_dataframe(dataframe, source_name)
            return dataframe
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            last_error = exc
            logger.warning(
                "JSON parse attempt failed for %s using %s: %s",
                source_name,
                strategy_name,
                exc,
            )

    message = f"Unable to parse JSON dataset '{source_name}' as standard JSON or line-delimited JSON."
    if last_error is not None:
        raise ValueError(f"{message} Last error: {last_error}") from last_error
    raise ValueError(message)


def resolve_active_dataframe() -> Optional[pd.DataFrame]:
    cleaned = get_cleaned_data()
    if isinstance(cleaned, pd.DataFrame) and not cleaned.empty:
        return cleaned

    uploaded = get_uploaded_df()
    if isinstance(uploaded, pd.DataFrame):
        return uploaded

    return None


def build_dataframe_from_dataset(dataset_obj: Any) -> pd.DataFrame:
    records = normalize_records(dataset_obj)
    if not records:
        raise ValueError("A valid dataset is required.")
    return pd.DataFrame(records)


def read_dataset_file(path_or_source: Any, filename: Optional[str] = None) -> pd.DataFrame:
    source_name = _resolve_dataset_name(path_or_source, filename=filename)
    lower_name = source_name.lower()

    if lower_name.endswith(".csv"):
        return _read_csv_with_fallback(path_or_source, source_name)
    if lower_name.endswith((".xls", ".xlsx")):
        dataframe = _normalize_loaded_dataframe(pd.read_excel(path_or_source), source_name)
        return dataframe
    if lower_name.endswith(".geojson"):
        text = _read_text_source(path_or_source)
        geojson_obj = json.loads(text)
        dataframe = _normalize_loaded_dataframe(pd.json_normalize(geojson_obj["features"]), source_name)
        return dataframe
    if lower_name.endswith(".json"):
        return _read_json_with_fallback(path_or_source, source_name)

    raise ValueError("Unsupported file format")


def load_datahub_dataset(dataset_id: str) -> Dict[str, Any]:
    if not dataset_id:
        raise ValueError("dataset_id is required to load a Data Hub dataset.")

    conn = get_db_connection()
    row = conn.execute(
        "SELECT id, name, path, semantic_model_json FROM datahub_datasets WHERE id = ?",
        (dataset_id,),
    ).fetchone()
    conn.close()

    if row is None:
        raise ValueError(f"Dataset '{dataset_id}' was not found in the Data Hub.")

    dataframe = read_dataset_file(row["path"])
    semantic_model = json.loads(row["semantic_model_json"]) if row["semantic_model_json"] else None

    return {
        "dataframe": dataframe,
        "semantic_model": semantic_model,
        "dataset_ref": {
            "source": "datahub",
            "dataset_id": row["id"],
            "dataset_name": row["name"],
            "path": row["path"],
        },
    }


def resolve_dataset_bundle(
    dataset: Any = None,
    dataset_ref: Optional[Dict[str, Any]] = None,
    semantic_model: Optional[Dict[str, Any]] = None,
    source: str = "metric_resolution",
    allow_active_fallback: bool = True,
) -> Dict[str, Any]:
    normalized_ref = dataset_ref if isinstance(dataset_ref, dict) else {}

    if dataset is not None:
        dataframe = build_dataframe_from_dataset(dataset)
        resolved_model = semantic_model if isinstance(semantic_model, dict) else infer_semantic_model_from_dataframe(
            dataframe,
            dataset_name=normalized_ref.get("dataset_name"),
            dataset_id=normalized_ref.get("dataset_id"),
            source=f"{source}_inline_dataset",
        )
        return {
            "dataframe": dataframe,
            "semantic_model": resolved_model,
            "dataset_ref": {
                "source": normalized_ref.get("source") or "inline",
                "dataset_id": normalized_ref.get("dataset_id"),
                "dataset_name": normalized_ref.get("dataset_name")
                or resolved_model.get("dataset", {}).get("name")
                or "Inline Dataset",
            },
        }

    if normalized_ref.get("source") == "datahub" or normalized_ref.get("dataset_id"):
        bundle = load_datahub_dataset(normalized_ref.get("dataset_id"))
        if isinstance(semantic_model, dict):
            bundle["semantic_model"] = semantic_model
        elif bundle["semantic_model"] is None:
            bundle["semantic_model"] = infer_semantic_model_from_dataframe(
                bundle["dataframe"],
                dataset_name=bundle["dataset_ref"].get("dataset_name"),
                dataset_id=bundle["dataset_ref"].get("dataset_id"),
                source=f"{source}_datahub_dataset",
            )
        return bundle

    if not allow_active_fallback:
        raise ValueError("No active dataset is available.")

    dataframe = resolve_active_dataframe()
    if dataframe is None or dataframe.empty:
        raise ValueError("No active dataset is available.")

    resolved_model = semantic_model if isinstance(semantic_model, dict) else get_semantic_model()
    if not isinstance(resolved_model, dict):
        resolved_model = infer_semantic_model_from_dataframe(
            dataframe,
            dataset_name=normalized_ref.get("dataset_name"),
            dataset_id=normalized_ref.get("dataset_id"),
            source=f"{source}_active_dataset",
        )

    dataset_meta = resolved_model.get("dataset", {}) if isinstance(resolved_model, dict) else {}
    return {
        "dataframe": dataframe,
        "semantic_model": resolved_model,
        "dataset_ref": {
            "source": normalized_ref.get("source") or "active",
            "dataset_id": normalized_ref.get("dataset_id") or dataset_meta.get("id"),
            "dataset_name": normalized_ref.get("dataset_name")
            or dataset_meta.get("name")
            or "Active Dataset",
        },
    }
