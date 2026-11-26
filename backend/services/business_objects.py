"""Validate and persist Business Object configuration against the current model."""

from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from sqlite3 import Connection
from typing import Any
from uuid import uuid4

from backend.db.backend_db import get_db_connection
from backend.repositories import business_object_repository as repository
from backend.repositories.source_relationship_repository import get_relationship
from backend.repositories.source_workspace_repository import (
    get_source,
    get_source_private_locator,
    get_workspace,
)


CONTRACT_VERSION = "business_object_definition_v1"
DEFINITION_FIELDS = {"display_name", "source_id", "record_key_field", "display_field", "relationship_ids"}


class BusinessObjectError(ValueError):
    """A safe, structured configuration error."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _normalize_definition(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict) or payload.keys() - DEFINITION_FIELDS:
        raise BusinessObjectError("invalid_request", "Supply a JSON object with definition fields only.")

    relationship_ids = payload.get("relationship_ids")
    if not isinstance(relationship_ids, list) or any(
        not isinstance(value, str) or not value.strip() for value in relationship_ids
    ):
        raise BusinessObjectError("invalid_definition", "relationship_ids must be a list of relationship IDs.")
    if len(relationship_ids) != len(set(relationship_ids)):
        raise BusinessObjectError("invalid_definition", "Select each relationship only once.")

    fields = {}
    for field in ("display_name", "source_id", "record_key_field", "display_field"):
        value = payload.get(field)
        if value is None and field == "display_field":
            fields[field] = None
            continue
        if not isinstance(value, str) or not value.strip():
            raise BusinessObjectError("invalid_definition", f"{field} must be a nonblank string.")
        fields[field] = value.strip() if field == "display_name" else value
    return {**fields, "relationship_ids": relationship_ids}


def _workspace_members(conn: Connection, workspace_id: str) -> set[str]:
    workspace = get_workspace(workspace_id, connection=conn)
    if workspace is None:
        raise BusinessObjectError("workspace_not_found", f"Workspace '{workspace_id}' was not found.")
    return {member["source_id"] for member in workspace["sources"]}


def _source_fields(conn: Connection, source_id: str, members: set[str]) -> set[str]:
    source = get_source(source_id, connection=conn)
    if source is None:
        raise BusinessObjectError("source_not_found", f"Source '{source_id}' was not found.")
    if source_id not in members:
        raise BusinessObjectError("source_not_in_workspace", f"Source '{source_id}' is not in this workspace.")

    if source["locator_kind"] == "managed_file":
        locator = get_source_private_locator(source_id, connection=conn)
        path = locator.get("path") if locator else None
        try:
            available = bool(path and Path(path).is_file())
        except OSError:
            available = False
        if not available:
            raise BusinessObjectError(
                "managed_source_unavailable", f"Managed storage for source '{source_id}' is unavailable."
            )

    schema = source["schema"] if isinstance(source["schema"], list) else []
    fields = {
        field["name"] for field in schema
        if isinstance(field, dict) and isinstance(field.get("name"), str)
    }
    if not fields:
        raise BusinessObjectError("source_schema_unavailable", f"Source '{source_id}' has no catalog schema.")
    return fields


def _validate_references(conn: Connection, definition: dict[str, Any], members: set[str]) -> None:
    workspace_id = definition["workspace_id"]
    source_id = definition["source_id"]
    fields_by_source = {source_id: _source_fields(conn, source_id, members)}
    for field in (definition["record_key_field"], definition["display_field"]):
        if field is not None and field not in fields_by_source[source_id]:
            raise BusinessObjectError("source_field_not_found", f"Field '{field}' is missing from the object source.")

    for relationship_id in definition["relationship_ids"]:
        relationship = get_relationship(workspace_id, relationship_id, connection=conn)
        if relationship is None:
            raise BusinessObjectError(
                "relationship_not_found", f"Relationship '{relationship_id}' was not found in this workspace."
            )
        left, right = relationship["left_source_id"], relationship["right_source_id"]
        if source_id not in (left, right):
            raise BusinessObjectError(
                "relationship_not_applicable", f"Relationship '{relationship_id}' must directly connect the object source."
            )
        related = right if source_id == left else left
        if related not in fields_by_source:
            fields_by_source[related] = _source_fields(conn, related, members)
        if any(
            pair["left_field"] not in fields_by_source[left] or pair["right_field"] not in fields_by_source[right]
            for pair in relationship["field_pairs"]
        ):
            raise BusinessObjectError(
                "relationship_field_not_found", f"Relationship '{relationship_id}' references a missing source field."
            )


def _public_definition(
    definition: dict[str, Any], configuration_error: BusinessObjectError | None = None
) -> dict[str, Any]:
    return {
        "contract_version": CONTRACT_VERSION,
        **definition,
        "configuration_error": (
            {"code": configuration_error.code, "message": str(configuration_error)}
            if configuration_error else None
        ),
    }


def _read_definition(conn: Connection, definition: dict[str, Any], members: set[str]) -> dict[str, Any]:
    try:
        _validate_references(conn, definition, members)
    except BusinessObjectError as exc:
        return _public_definition(definition, exc)
    return _public_definition(definition)


def create_business_object(workspace_id: str, payload: Any) -> dict[str, Any]:
    definition = {
        **_normalize_definition(payload),
        "object_id": f"obj_{uuid4().hex}",
        "workspace_id": workspace_id,
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    with closing(get_db_connection()) as conn, conn:
        # Serialize model edits with validation and insertion to avoid saving stale references.
        conn.execute("BEGIN IMMEDIATE")
        _validate_references(conn, definition, _workspace_members(conn, workspace_id))
        repository.insert_definition(conn, definition)
    return _public_definition(definition)


def list_business_objects(workspace_id: str) -> list[dict[str, Any]]:
    with closing(get_db_connection()) as conn, conn:
        conn.execute("BEGIN")
        members = _workspace_members(conn, workspace_id)
        return [_read_definition(conn, item, members) for item in repository.list_definitions(conn, workspace_id)]


def get_business_object(workspace_id: str, object_id: str) -> dict[str, Any]:
    with closing(get_db_connection()) as conn, conn:
        conn.execute("BEGIN")
        members = _workspace_members(conn, workspace_id)
        definition = repository.get_definition(conn, workspace_id, object_id)
        if definition is None:
            raise BusinessObjectError("business_object_not_found", "Business Object was not found in this workspace.")
        return _read_definition(conn, definition, members)
