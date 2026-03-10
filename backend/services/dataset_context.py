from __future__ import annotations

import json
from typing import Any, Dict, Optional

import pandas as pd

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


def read_dataset_file(path: str) -> pd.DataFrame:
    normalized_path = str(path).strip('"').strip("'")
    lower_path = normalized_path.lower()

    if lower_path.endswith(".csv"):
        return pd.read_csv(normalized_path)
    if lower_path.endswith((".xls", ".xlsx")):
        return pd.read_excel(normalized_path)
    if lower_path.endswith(".json"):
        return pd.read_json(normalized_path)
    if lower_path.endswith(".geojson"):
        with open(normalized_path, "r", encoding="utf-8") as handle:
            geojson_obj = json.load(handle)
        return pd.json_normalize(geojson_obj["features"])

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
