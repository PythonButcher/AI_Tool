"""Durable source-catalog and analytical-workspace persistence.

This repository keeps SQL and private locator details out of route handlers.
`datahub_datasets` remains the canonical source table so existing Data Hub and
Decision Chat consumers continue resolving the same dataset identity.
"""

from __future__ import annotations

import json
from typing import Any, Dict, Iterable, Optional

from backend.db.backend_db import get_db_connection


CONTRACT_VERSION = "multi_source_workspace_v1"


class SourceWorkspaceRepositoryError(ValueError):
    """Raised when a source/workspace persistence invariant is violated."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _load_json(value: Optional[str], fallback: Any) -> Any:
    """Deserialize a nullable JSON database value with a stable fallback."""
    if not value:
        return fallback
    return json.loads(value)


def _public_locator(locator_json: Optional[str], locator_kind: str) -> Dict[str, Any]:
    """Return only non-sensitive, server-managed locator metadata."""
    private_locator = _load_json(locator_json, {})
    return {
        "kind": locator_kind,
        "storage_key": private_locator.get("storage_key"),
        "file_name": private_locator.get("file_name"),
        "format": private_locator.get("format"),
    }


def serialize_source(row) -> Dict[str, Any]:
    """Convert one canonical catalog row to the public source contract."""
    return {
        "contract_version": CONTRACT_VERSION,
        "source_id": row["id"],
        "name": row["name"],
        "source_kind": row["source_kind"],
        "locator_kind": row["locator_kind"],
        "managed_locator": _public_locator(row["locator_json"], row["locator_kind"]),
        "content_fingerprint": row["content_fingerprint"],
        "schema_version": row["schema_version"],
        "schema": _load_json(row["schema_json"], []),
        "row_count": row["numRows"],
        "column_count": row["numCols"],
        "semantic_model": _load_json(row["semantic_model_json"], None),
        "governance_policy": _load_json(row["governance_policy_json"], None),
        "governance_readiness": _load_json(row["governance_readiness_json"], None),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _serialize_membership(row) -> Dict[str, Any]:
    """Convert a membership row without exposing private source storage."""
    return {
        "contract_version": CONTRACT_VERSION,
        "workspace_id": row["workspace_id"],
        "source_id": row["source_id"],
        "alias": row["alias"],
        "role": row["role"],
        "position": _load_json(row["position_json"], None),
        "added_at": row["added_at"],
    }


def _serialize_workspace(row, memberships: Iterable[Any]) -> Dict[str, Any]:
    """Build the durable workspace object and its ordered memberships."""
    serialized_memberships = [_serialize_membership(item) for item in memberships]
    return {
        "contract_version": CONTRACT_VERSION,
        "workspace_id": row["workspace_id"],
        "name": row["name"],
        "version": row["version"],
        "primary_source_id": row["primary_source_id"],
        "source_count": len(serialized_memberships),
        "sources": serialized_memberships,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def register_source_with_workspace(
    *,
    source: Dict[str, Any],
    workspace: Dict[str, Any],
    membership: Dict[str, Any],
) -> tuple[Dict[str, Any], Dict[str, Any]]:
    """Atomically register one source and its initial one-source workspace."""
    conn = get_db_connection()
    try:
        conn.execute("BEGIN")
        conn.execute(
            """
            INSERT INTO datahub_datasets (
                id, name, path, uploadedAt, numRows, numCols, schema_json,
                preview_json, semantic_model_json, governance_policy_json,
                governance_readiness_json, source_kind, locator_kind,
                locator_json, content_fingerprint, schema_version,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source["source_id"],
                source["name"],
                source["private_path"],
                source["created_at"],
                source["row_count"],
                source["column_count"],
                json.dumps(source["schema"]),
                json.dumps(source["preview"]),
                json.dumps(source["semantic_model"]),
                json.dumps(source["governance_policy"]),
                json.dumps(source["governance_readiness"]),
                source["source_kind"],
                source["locator_kind"],
                json.dumps(source["private_locator"]),
                source["content_fingerprint"],
                source["schema_version"],
                source["created_at"],
                source["updated_at"],
            ),
        )
        conn.execute(
            """
            INSERT INTO data_workspaces (
                workspace_id, name, version, primary_source_id, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                workspace["workspace_id"],
                workspace["name"],
                workspace["version"],
                workspace["primary_source_id"],
                workspace["created_at"],
                workspace["updated_at"],
            ),
        )
        conn.execute(
            """
            INSERT INTO workspace_sources (
                workspace_id, source_id, alias, role, position_json, added_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                membership["workspace_id"],
                membership["source_id"],
                membership["alias"],
                membership["role"],
                json.dumps(membership.get("position")) if membership.get("position") is not None else None,
                membership["added_at"],
            ),
        )
        conn.commit()
        return get_source(source["source_id"], connection=conn), get_workspace(
            workspace["workspace_id"], connection=conn
        )
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_source(source_id: str, *, connection=None) -> Optional[Dict[str, Any]]:
    """Retrieve a source by stable identity using a fresh connection by default."""
    owns_connection = connection is None
    conn = connection or get_db_connection()
    try:
        row = conn.execute(
            "SELECT * FROM datahub_datasets WHERE id = ?",
            (source_id,),
        ).fetchone()
        return serialize_source(row) if row is not None else None
    finally:
        if owns_connection:
            conn.close()


def get_source_private_locator(source_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve storage details for trusted backend services only."""
    conn = get_db_connection()
    try:
        row = conn.execute(
            "SELECT path, locator_kind, locator_json FROM datahub_datasets WHERE id = ?",
            (source_id,),
        ).fetchone()
        if row is None:
            return None
        return {
            "path": row["path"],
            "locator_kind": row["locator_kind"],
            **_load_json(row["locator_json"], {}),
        }
    finally:
        conn.close()


def get_workspace(workspace_id: str, *, connection=None) -> Optional[Dict[str, Any]]:
    """Retrieve one workspace with membership isolated by workspace ID."""
    owns_connection = connection is None
    conn = connection or get_db_connection()
    try:
        row = conn.execute(
            "SELECT * FROM data_workspaces WHERE workspace_id = ?",
            (workspace_id,),
        ).fetchone()
        if row is None:
            return None
        memberships = conn.execute(
            """
            SELECT * FROM workspace_sources
            WHERE workspace_id = ?
            ORDER BY CASE role WHEN 'primary' THEN 0 ELSE 1 END, added_at, source_id
            """,
            (workspace_id,),
        ).fetchall()
        return _serialize_workspace(row, memberships)
    finally:
        if owns_connection:
            conn.close()


def require_workspace_sources(workspace_id: str, source_ids: Iterable[str]) -> Dict[str, Any]:
    """Validate that every selected source belongs to the requested workspace."""
    workspace = get_workspace(workspace_id)
    if workspace is None:
        raise SourceWorkspaceRepositoryError(
            "workspace_not_found", f"Workspace '{workspace_id}' was not found."
        )

    member_ids = {item["source_id"] for item in workspace["sources"]}
    for source_id in source_ids:
        if get_source(source_id) is None:
            raise SourceWorkspaceRepositoryError(
                "source_not_found", f"Source '{source_id}' was not found."
            )
        if source_id not in member_ids:
            raise SourceWorkspaceRepositoryError(
                "source_not_in_workspace",
                f"Source '{source_id}' is not a member of workspace '{workspace_id}'.",
            )
    return workspace
