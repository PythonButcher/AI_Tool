"""Store Business Object definitions on the caller's workspace transaction."""

import json
import sqlite3
from typing import Any


def _deserialize(row: sqlite3.Row) -> dict[str, Any]:
    definition = dict(row)
    definition["relationship_ids"] = json.loads(definition.pop("relationship_ids_json"))
    return definition


def insert_definition(conn: sqlite3.Connection, definition: dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO workspace_business_objects (
            object_id, workspace_id, display_name, source_id, record_key_field,
            display_field, relationship_ids_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            definition["object_id"], definition["workspace_id"],
            definition["display_name"], definition["source_id"],
            definition["record_key_field"], definition["display_field"],
            json.dumps(definition["relationship_ids"]), definition["created_at"],
        ),
    )


def get_definition(
    conn: sqlite3.Connection, workspace_id: str, object_id: str
) -> dict[str, Any] | None:
    row = conn.execute(
        """
        SELECT * FROM workspace_business_objects WHERE workspace_id = ? AND object_id = ?
        """,
        (workspace_id, object_id),
    ).fetchone()
    return _deserialize(row) if row is not None else None


def list_definitions(conn: sqlite3.Connection, workspace_id: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT * FROM workspace_business_objects
        WHERE workspace_id = ? ORDER BY created_at, object_id
        """,
        (workspace_id,),
    )
    return [_deserialize(row) for row in rows]
