"""Durable persistence for governed workspace relationship contracts.

This module owns SQL, optimistic versions, and workspace isolation. Profiling
and trust judgments deliberately live in the relationship service.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Optional

from backend.db.backend_db import get_db_connection


CONTRACT_VERSION = "multi_source_relationships_v1"


class SourceRelationshipRepositoryError(ValueError):
    """Raised when relationship persistence invariants are not satisfied."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _deserialize(row) -> Dict[str, Any]:
    """Convert a SQLite row into the stable public relationship object."""
    return {
        "contract_version": CONTRACT_VERSION,
        "relationship_id": row["relationship_id"],
        "workspace_id": row["workspace_id"],
        "left_source_id": row["left_source_id"],
        "right_source_id": row["right_source_id"],
        "field_pairs": json.loads(row["field_pairs_json"]),
        "cardinality": row["cardinality"],
        "join_behavior": row["join_behavior"],
        "filter_direction": row["filter_direction"],
        "is_active": bool(row["is_active"]),
        "is_suggested": bool(row["is_suggested"]),
        "is_confirmed": bool(row["is_confirmed"]),
        "validation_state": row["validation_state"],
        "diagnostics": json.loads(row["diagnostics_json"]),
        "source_fingerprints": json.loads(row["source_fingerprints_json"]),
        "version": row["version"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "validated_at": row["validated_at"],
    }


def _require_workspace(conn, workspace_id: str):
    """Return a workspace row or raise a stable not-found error."""
    row = conn.execute(
        "SELECT * FROM data_workspaces WHERE workspace_id = ?", (workspace_id,)
    ).fetchone()
    if row is None:
        raise SourceRelationshipRepositoryError(
            "workspace_not_found", f"Workspace '{workspace_id}' was not found."
        )
    return row


def _require_member(conn, workspace_id: str, source_id: str) -> None:
    """Require an existing source and membership in the relationship workspace."""
    source = conn.execute(
        "SELECT id FROM datahub_datasets WHERE id = ?", (source_id,)
    ).fetchone()
    if source is None:
        raise SourceRelationshipRepositoryError(
            "source_not_found", f"Source '{source_id}' was not found."
        )
    membership = conn.execute(
        "SELECT 1 FROM workspace_sources WHERE workspace_id = ? AND source_id = ?",
        (workspace_id, source_id),
    ).fetchone()
    if membership is None:
        raise SourceRelationshipRepositoryError(
            "source_not_in_workspace",
            f"Source '{source_id}' is not a member of workspace '{workspace_id}'.",
        )


def create_relationship(record: Dict[str, Any]) -> Dict[str, Any]:
    """Create one isolated relationship and advance the workspace model version."""
    conn = get_db_connection()
    try:
        conn.execute("BEGIN")
        _require_workspace(conn, record["workspace_id"])
        _require_member(conn, record["workspace_id"], record["left_source_id"])
        _require_member(conn, record["workspace_id"], record["right_source_id"])
        conn.execute(
            """
            INSERT INTO workspace_relationships (
                relationship_id, workspace_id, left_source_id, right_source_id,
                field_pairs_json, cardinality, join_behavior, filter_direction,
                is_active, is_suggested, is_confirmed, validation_state,
                diagnostics_json, source_fingerprints_json, version, created_at,
                updated_at, validated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record["relationship_id"], record["workspace_id"],
                record["left_source_id"], record["right_source_id"],
                json.dumps(record["field_pairs"]), record["cardinality"],
                record["join_behavior"], record["filter_direction"],
                int(record["is_active"]), int(record["is_suggested"]),
                int(record["is_confirmed"]), record["validation_state"],
                json.dumps(record.get("diagnostics", [])),
                json.dumps(record.get("source_fingerprints", {})),
                record.get("version", 1), record["created_at"],
                record["updated_at"], record.get("validated_at"),
            ),
        )
        conn.execute(
            "UPDATE data_workspaces SET version = version + 1, updated_at = ? WHERE workspace_id = ?",
            (record["updated_at"], record["workspace_id"]),
        )
        conn.commit()
        return get_relationship(
            record["workspace_id"], record["relationship_id"], connection=conn
        )
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_relationship(
    workspace_id: str, relationship_id: str, *, connection=None
) -> Optional[Dict[str, Any]]:
    """Retrieve by both identities so cross-workspace records remain invisible."""
    owns_connection = connection is None
    conn = connection or get_db_connection()
    try:
        row = conn.execute(
            """
            SELECT * FROM workspace_relationships
            WHERE workspace_id = ? AND relationship_id = ?
            """,
            (workspace_id, relationship_id),
        ).fetchone()
        return _deserialize(row) if row is not None else None
    finally:
        if owns_connection:
            conn.close()


def list_relationships(workspace_id: str) -> list[Dict[str, Any]]:
    """List only relationships belonging to one verified workspace."""
    conn = get_db_connection()
    try:
        _require_workspace(conn, workspace_id)
        rows = conn.execute(
            """
            SELECT * FROM workspace_relationships
            WHERE workspace_id = ? ORDER BY created_at, relationship_id
            """,
            (workspace_id,),
        ).fetchall()
        return [_deserialize(row) for row in rows]
    finally:
        conn.close()


def update_relationship(
    workspace_id: str,
    relationship_id: str,
    changes: Dict[str, Any],
    *,
    expected_version: Optional[int] = None,
) -> Dict[str, Any]:
    """Apply a bounded update with optimistic concurrency and monotonic versioning."""
    allowed_columns = {
        "left_source_id", "right_source_id", "field_pairs", "cardinality",
        "join_behavior", "filter_direction", "is_active", "is_suggested",
        "is_confirmed", "validation_state", "diagnostics",
        "source_fingerprints", "updated_at", "validated_at",
    }
    unknown = set(changes) - allowed_columns
    if unknown:
        raise SourceRelationshipRepositoryError(
            "invalid_relationship", f"Unsupported relationship fields: {sorted(unknown)}."
        )

    conn = get_db_connection()
    try:
        conn.execute("BEGIN")
        _require_workspace(conn, workspace_id)
        existing_row = conn.execute(
            "SELECT * FROM workspace_relationships WHERE workspace_id = ? AND relationship_id = ?",
            (workspace_id, relationship_id),
        ).fetchone()
        if existing_row is None:
            raise SourceRelationshipRepositoryError(
                "relationship_not_found",
                f"Relationship '{relationship_id}' was not found in workspace '{workspace_id}'.",
            )
        if expected_version is not None and existing_row["version"] != expected_version:
            raise SourceRelationshipRepositoryError(
                "relationship_version_conflict",
                f"Relationship '{relationship_id}' changed after version {expected_version}.",
            )

        left_source_id = changes.get("left_source_id", existing_row["left_source_id"])
        right_source_id = changes.get("right_source_id", existing_row["right_source_id"])
        _require_member(conn, workspace_id, left_source_id)
        _require_member(conn, workspace_id, right_source_id)

        database_names = {
            "field_pairs": "field_pairs_json",
            "diagnostics": "diagnostics_json",
            "source_fingerprints": "source_fingerprints_json",
        }
        assignments = []
        values = []
        for key, value in changes.items():
            assignments.append(f"{database_names.get(key, key)} = ?")
            if key in database_names:
                value = json.dumps(value)
            elif key in {"is_active", "is_suggested", "is_confirmed"}:
                value = int(value)
            values.append(value)
        assignments.append("version = version + 1")
        values.extend([workspace_id, relationship_id])
        conn.execute(
            f"UPDATE workspace_relationships SET {', '.join(assignments)} WHERE workspace_id = ? AND relationship_id = ?",
            values,
        )
        timestamp = changes.get("updated_at") or existing_row["updated_at"]
        conn.execute(
            "UPDATE data_workspaces SET version = version + 1, updated_at = ? WHERE workspace_id = ?",
            (timestamp, workspace_id),
        )
        conn.commit()
        return get_relationship(workspace_id, relationship_id, connection=conn)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def delete_relationship(workspace_id: str, relationship_id: str, *, updated_at: str) -> None:
    """Delete a relationship within its workspace and advance model version."""
    conn = get_db_connection()
    try:
        conn.execute("BEGIN")
        _require_workspace(conn, workspace_id)
        cursor = conn.execute(
            "DELETE FROM workspace_relationships WHERE workspace_id = ? AND relationship_id = ?",
            (workspace_id, relationship_id),
        )
        if cursor.rowcount == 0:
            raise SourceRelationshipRepositoryError(
                "relationship_not_found",
                f"Relationship '{relationship_id}' was not found in workspace '{workspace_id}'.",
            )
        conn.execute(
            "UPDATE data_workspaces SET version = version + 1, updated_at = ? WHERE workspace_id = ?",
            (updated_at, workspace_id),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
