"""Identity-scoped preparation using the existing Power Query engine."""

import json
from io import StringIO
from uuid import uuid4

import pandas as pd

from backend.db.backend_db import get_db_connection
from backend.repositories.source_workspace_repository import get_source, get_workspace
from backend.services.data_catalog_lineage import evaluate_dataset_readiness, is_blocked
from backend.services.dataset_context import load_datahub_dataset
from backend.services.manual_cleaning_engine import ManualCleaningEngine
from backend.services.semantic_model import infer_semantic_model_from_dataframe
from backend.services.workspace_context import (
    WorkspaceContextError, _workspace_version, dataframe_schema, register_managed_upload,
)


def clean_workspace(workspace_id: str, payload: object, *, preparation_id: str | None = None) -> dict:
    """Preview without writes, or atomically publish an isolated derived source."""
    required = {"workspace_version", "source_id", "steps", "preview_only"}
    if not isinstance(payload, dict) or set(payload) != required:
        raise WorkspaceContextError("invalid_request", "Supply exactly workspace_version, source_id, steps, preview_only.")
    version = _workspace_version(payload["workspace_version"])
    if not isinstance(payload["preview_only"], bool):
        raise WorkspaceContextError("invalid_request", "preview_only must be boolean.")
    workspace = get_workspace(workspace_id)
    if workspace is None:
        raise WorkspaceContextError("workspace_not_found", "Workspace not found.")
    if workspace["version"] != version:
        raise WorkspaceContextError("workspace_version_conflict", "Reload the workspace version.")
    if payload["source_id"] != workspace["primary_source_id"]:
        raise WorkspaceContextError("source_not_in_workspace", "Preparation requires the workspace primary source.")
    conn = get_db_connection()
    try:
        has_relationships = conn.execute("SELECT 1 FROM workspace_relationships WHERE workspace_id = ? LIMIT 1", (workspace_id,)).fetchone()
    finally:
        conn.close()
    if has_relationships:
        raise WorkspaceContextError("preparation_relationships_unsupported", "Relationship workspaces require a separate preparation contract.")
    source = get_source(payload["source_id"])
    engine = ManualCleaningEngine()
    steps = payload["steps"]
    if not isinstance(steps, list) or len(steps) > 100 or any(
        not isinstance(step, dict) or set(step) - {"type", "params"}
        or not isinstance(step.get("type"), str) or step.get("type") not in engine.registry
        or not isinstance(step.get("params", {}), dict)
        for step in steps
    ):
        raise WorkspaceContextError("invalid_cleaning_steps", "Supply at most 100 supported cleaning steps.")
    try:
        original = load_datahub_dataset(source["source_id"])["dataframe"]
        cleaned = engine.apply_steps(steps, original)
        # The receipt must describe the actual durable representation, including
        # timestamp precision and dtype reconstruction, rather than a transient frame.
        encoded = cleaned.reset_index(drop=True).to_json(orient="table", date_format="iso", date_unit="ns", index=False)
        cleaned = pd.read_json(StringIO(encoded), orient="table")
    except Exception as exc:
        raise WorkspaceContextError("cleaning_failed", "Unable to apply these steps to the governed source.") from exc
    if not payload["preview_only"] and (cleaned.empty or len(cleaned.columns) == 0):
        raise WorkspaceContextError("empty_cleaning_result", "Apply requires nonempty data and columns.")
    readiness = evaluate_dataset_readiness(cleaned, source["governance_policy"], operation="manual_cleaning")
    if is_blocked(readiness):
        raise WorkspaceContextError("governance_blocked", "Cleaning violates the source governance policy.")
    preview = json.loads(cleaned.head(100).to_json(orient="records", date_format="iso"))
    result = {"committed": False, "workspace_id": workspace_id, "workspace_version": version,
              "preview": preview, "row_count": len(cleaned), "schema": dataframe_schema(cleaned),
              "governance_readiness": readiness, "receipt": None}
    if payload["preview_only"]:
        return result
    model = infer_semantic_model_from_dataframe(cleaned, source="manual_cleaning", existing_model=source["semantic_model"], preserve_user_metrics=True)
    committed = register_managed_upload(
        file_bytes=encoded.encode("utf-8"), filename="prepared.table.json", dataframe=cleaned,
        semantic_model=model, governance_policy=readiness["policy"], governance_readiness=readiness,
        preview=preview, workspace_id=workspace_id, workspace_version=version, replace_source=source,
        preparation_id=preparation_id,
    )
    new_source = committed["source"]
    result.update(committed=True, workspace_version=committed["workspace"]["version"], receipt={
        "receipt_id": preparation_id or f"prep_{uuid4().hex}", "workspace_id": workspace_id,
        "workspace_version": committed["workspace"]["version"], "base_workspace_version": version,
        "base_source_id": source["source_id"], "source_id": new_source["source_id"],
        "content_fingerprint": new_source["content_fingerprint"], "schema_version": new_source["schema_version"],
        "schema": new_source["schema"], "row_count": new_source["row_count"], "committed_at": new_source["updated_at"],
    })
    return result
