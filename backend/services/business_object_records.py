"""Read governed records from the sources of a saved Business Object."""

from contextlib import closing
from datetime import date
import math
from pathlib import Path
from typing import Any
from zipfile import BadZipFile, ZipFile

import pandas as pd

from backend.db.backend_db import get_db_connection
from backend.repositories.saved_dataset_repository import (
    DatasetDependencyError,
    activation_dependencies,
    verify_dependencies,
)
from backend.repositories.source_workspace_repository import get_source_private_locator, get_workspace
from backend.services.business_objects import BusinessObjectError, get_business_object
from backend.services.data_catalog_lineage import evaluate_dataset_readiness, is_blocked
from backend.services.dataset_context import load_datahub_dataset, safe_json_records
from backend.services.relationship_execution import MAX_EXECUTION_ROWS
from backend.services.source_relationships import SourceRelationshipError, get_relationship


RESULT_LIMIT = 50
RELATED_ROW_LIMIT = 50
MAX_RELATIONSHIPS = 8
MAX_SOURCE_BYTES = 32 * 1024 * 1024
MAX_EXPANDED_WORKBOOK_BYTES = 64 * 1024 * 1024
MAX_KEY_LENGTH = 512
KEY_TYPES = {"string", "integer", "number", "boolean", "datetime"}


class RecordAccessDenied(BusinessObjectError):
    def __init__(self, readiness: dict):
        super().__init__("record_access_denied", readiness["next_action"])
        self.readiness = readiness


def _typed_key(value: Any) -> tuple[str, str] | None:
    if isinstance(value, str) and value.strip() and len(value) <= MAX_KEY_LENGTH:
        return "string", value
    if value is None or value is pd.NA or value is pd.NaT:
        return None
    if isinstance(value, bool):
        return "boolean", "true" if value else "false"
    if isinstance(value, int):
        return "integer", str(value)
    if isinstance(value, float) and math.isfinite(value):
        return "number", repr(0.0 if value == 0 else value)
    if isinstance(value, date):
        return "datetime", value.isoformat()
    return None


def _load_frame(workspace_id: str, source_id: str) -> tuple[pd.DataFrame, dict]:
    locator = get_source_private_locator(source_id)
    try:
        path = Path(locator["path"])
        if path.stat().st_size > MAX_SOURCE_BYTES:
            raise BusinessObjectError("record_read_limit", "A selected source exceeds the record browsing size limit.")
        if path.suffix.lower() == ".xlsx":
            with ZipFile(path) as workbook:
                if sum(entry.file_size for entry in workbook.infolist()) > MAX_EXPANDED_WORKBOOK_BYTES:
                    raise BusinessObjectError("record_read_limit", "A selected workbook exceeds the expanded size limit.")
        with closing(get_db_connection()) as conn:
            dependencies = activation_dependencies(conn, workspace_id) or {}
            if source_id in dependencies:
                verify_dependencies(conn, {source_id: dependencies[source_id]})
        bundle = load_datahub_dataset(source_id)
    except BusinessObjectError:
        raise
    except DatasetDependencyError as exc:
        raise BusinessObjectError(
            "saved_dataset_dependency_changed", "A saved dataset source changed. Reopen or review the dataset."
        ) from exc
    except (BadZipFile, KeyError, OSError, TypeError, ValueError) as exc:
        raise BusinessObjectError("record_source_unavailable", "A selected source could not be read.") from exc
    frame = bundle["dataframe"]
    if len(frame) > MAX_EXECUTION_ROWS:
        raise BusinessObjectError("record_read_limit", "A selected source exceeds the record browsing row limit.")
    readiness = evaluate_dataset_readiness(frame, bundle["governance_policy"], operation="business_object_records")
    if is_blocked(readiness):
        raise RecordAccessDenied(readiness)
    return frame, readiness


def _read_object(workspace_id: str, object_id: str) -> tuple[dict, dict, pd.DataFrame, dict, dict]:
    workspace = get_workspace(workspace_id)
    definition = get_business_object(workspace_id, object_id)
    error = definition["configuration_error"]
    if error:
        raise BusinessObjectError("record_configuration_unavailable", error["message"])
    frame, readiness = _load_frame(workspace_id, definition["source_id"])
    field = definition["record_key_field"]
    if field not in frame or (definition["display_field"] and definition["display_field"] not in frame):
        raise BusinessObjectError("record_configuration_unavailable", "A configured record field is missing.")
    positions = {}
    for position, value in enumerate(frame[field]):
        key = _typed_key(value)
        if key is None:
            raise BusinessObjectError("record_key_missing", "The record key field contains blank or unsupported values.")
        if key in positions:
            raise BusinessObjectError("record_key_duplicate", "The record key field contains duplicate values.")
        positions[key] = position
    return workspace, definition, frame, positions, readiness


def _check_workspace(workspace: dict) -> None:
    if get_workspace(workspace["workspace_id"]) != workspace:
        raise BusinessObjectError("workspace_version_conflict", "The model changed while reading records. Try again.")


def _summary(key: tuple[str, str], label: Any) -> dict:
    return {"key": {"type": key[0], "value": key[1]}, "label": label}


def search_records(workspace_id: str, object_id: str, query: str) -> dict:
    if len(query) > 200:
        raise BusinessObjectError("invalid_record_request", "The search can contain up to 200 characters.")
    workspace, definition, frame, positions, readiness = _read_object(workspace_id, object_id)
    field = definition["display_field"]
    labels = frame[field].astype("string").fillna("") if field else None
    query = query.strip().casefold()
    matches = []
    exact = []
    match_count = 0
    for key, position in positions.items():
        label = labels.iat[position] if labels is not None else ""
        key_text = key[1].casefold()
        if not query or query in key_text or query in label.casefold():
            bucket = exact if query and key_text == query else matches
            match_count += 1
            if len(bucket) < RESULT_LIMIT:
                bucket.append((key, label))
    _check_workspace(workspace)
    return {
        "object_id": object_id,
        "records": [_summary(key, label or key[1]) for key, label in (exact + matches)[:RESULT_LIMIT]],
        "has_more": match_count > RESULT_LIMIT,
        "governance_readiness": readiness,
    }


def _related_rows(definition: dict, relationship_id: str, record: pd.DataFrame) -> dict:
    workspace_id = definition["workspace_id"]
    try:
        relationship = get_relationship(workspace_id, relationship_id)
    except SourceRelationshipError as exc:
        raise BusinessObjectError("record_configuration_unavailable", str(exc)) from exc
    object_side, other_side = (
        ("left", "right") if relationship["left_source_id"] == definition["source_id"] else ("right", "left")
    )
    if relationship[f"{object_side}_source_id"] != definition["source_id"]:
        raise BusinessObjectError("record_configuration_unavailable", "The relationship no longer connects this object.")
    source_id = relationship[f"{other_side}_source_id"]
    section = {"relationship_id": relationship_id, "source_id": source_id}
    if relationship["validation_state"] != "valid" or not relationship["is_active"] or not relationship["is_confirmed"]:
        return {**section, "status": "unavailable", "error": {
            "code": "record_relationship_unavailable",
            "message": "Validate, confirm, and activate this relationship to view its records.",
        }}
    if relationship["cardinality"] == "many_to_many":
        return {**section, "status": "unavailable", "error": {
            "code": "record_relationship_unsupported",
            "message": "This relationship cardinality is unavailable for record browsing.",
        }}
    frame, readiness = _load_frame(workspace_id, source_id)
    matches = pd.Series(True, index=frame.index)
    for pair in relationship["field_pairs"]:
        object_field, related_field = pair[f"{object_side}_field"], pair[f"{other_side}_field"]
        if object_field not in record or related_field not in frame:
            raise BusinessObjectError("record_configuration_unavailable", "A related record field is missing.")
        value = record[object_field].iat[0]
        matches &= False if pd.isna(value) else frame[related_field].eq(value).fillna(False)
    rows = frame.loc[matches]
    return {
        **section,
        "status": "ready",
        "rows": safe_json_records(rows.head(RELATED_ROW_LIMIT)),
        "total_count": len(rows),
        "has_more": len(rows) > RELATED_ROW_LIMIT,
        "governance_readiness": readiness,
    }


def get_record(workspace_id: str, object_id: str, payload: Any) -> dict:
    key = payload.get("key") if isinstance(payload, dict) and payload.keys() == {"key"} else None
    if (
        not isinstance(key, dict) or key.keys() != {"type", "value"}
        or not isinstance(key["type"], str) or key["type"] not in KEY_TYPES
        or not isinstance(key["value"], str) or not key["value"].strip() or len(key["value"]) > MAX_KEY_LENGTH
    ):
        raise BusinessObjectError("invalid_record_request", "Supply the typed record key from the search response.")
    # The relationship service can mark stale evidence and advance the version
    # during a read. Retry once so the response sees a consistent model.
    for _ in range(2):
        workspace, definition, frame, positions, readiness = _read_object(workspace_id, object_id)
        position = positions.get((key["type"], key["value"]))
        if position is None:
            raise BusinessObjectError("record_not_found", "The record was not found in this Business Object.")
        relationships = definition["relationship_ids"]
        if len(relationships) > MAX_RELATIONSHIPS:
            raise BusinessObjectError(
                "record_read_limit", "The definition selects too many relationships for record browsing."
            )
        row = frame.iloc[[position]]
        related = [_related_rows(definition, relationship_id, row) for relationship_id in relationships]
        if get_workspace(workspace_id) == workspace:
            field = definition["display_field"]
            label = row[field].astype("string").fillna("").iat[0] if field else ""
            record = _summary((key["type"], key["value"]), label or key["value"])
            record["fields"] = safe_json_records(row)[0]
            return {
                "object_id": object_id,
                "record": record,
                "relationships": related,
                "governance_readiness": readiness,
            }
    raise BusinessObjectError("workspace_version_conflict", "The model changed while reading records. Try again.")
