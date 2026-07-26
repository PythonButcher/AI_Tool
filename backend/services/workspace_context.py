"""One-source workspace registration and analysis-context resolution."""

from __future__ import annotations

from datetime import datetime, timezone
from copy import deepcopy
from hashlib import sha256
from pathlib import Path
import re
from typing import Any, Dict, Iterable, Optional
from uuid import uuid4

import pandas as pd
from werkzeug.utils import secure_filename

from backend.repositories.source_workspace_repository import (
    CONTRACT_VERSION,
    SourceWorkspaceRepositoryError,
    get_source,
    get_source_private_locator,
    get_workspace,
    register_source_with_workspace,
    require_workspace_sources,
)


# This root is controlled by the server and can be patched to a temporary
# directory in tests. No request field can override it.
MANAGED_UPLOAD_ROOT = Path(__file__).resolve().parents[1] / "storage" / "managed_uploads"


class WorkspaceContextError(ValueError):
    """Stable service error suitable for API translation."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _utc_now() -> str:
    """Return a portable, timezone-aware ISO-8601 timestamp."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _source_alias(filename: str) -> str:
    """Create a stable field namespace from a user-visible filename."""
    stem = Path(filename).stem.lower()
    alias = re.sub(r"[^a-z0-9]+", "_", stem).strip("_")
    return alias or "source"


def dataframe_schema(dataframe: pd.DataFrame) -> list[Dict[str, Any]]:
    """Describe ordered fields without including any row values."""
    return [
        {
            "name": str(column),
            "position": position,
            "data_type": str(dataframe[column].dtype),
            "nullable": bool(dataframe[column].isna().any()),
        }
        for position, column in enumerate(dataframe.columns)
    ]


def _analysis_context(workspace: Dict[str, Any], source_ids: Iterable[str]) -> Dict[str, Any]:
    """Build the current relationship-free analysis boundary."""
    return {
        "contract_version": CONTRACT_VERSION,
        "workspace_id": workspace["workspace_id"],
        "workspace_version": workspace["version"],
        "primary_source_id": workspace["primary_source_id"],
        "source_ids": list(source_ids),
        "relationship_ids": [],
    }


def register_managed_upload(
    *,
    file_bytes: bytes,
    filename: str,
    dataframe: pd.DataFrame,
    semantic_model: Dict[str, Any],
    governance_policy: Dict[str, Any],
    governance_readiness: Dict[str, Any],
    preview: list[Dict[str, Any]],
) -> Dict[str, Any]:
    """Persist accepted bytes and atomically create source/workspace records."""
    source_id = f"src_{uuid4().hex}"
    workspace_id = f"ws_{uuid4().hex}"
    safe_name = secure_filename(filename) or "dataset"
    suffix = Path(safe_name).suffix.lower()
    storage_key = f"{source_id}{suffix}"
    managed_root = MANAGED_UPLOAD_ROOT.resolve()
    managed_root.mkdir(parents=True, exist_ok=True)
    managed_path = (managed_root / storage_key).resolve()

    # Defense in depth: the generated key must remain beneath the configured
    # managed root even if this function is changed later.
    if managed_root not in managed_path.parents:
        raise WorkspaceContextError(
            "managed_source_unavailable", "Unable to allocate managed source storage."
        )

    timestamp = _utc_now()
    source_semantic_model = deepcopy(semantic_model)
    source_semantic_model.setdefault("dataset", {})["id"] = source_id
    source_semantic_model["dataset"]["name"] = filename
    source_record = {
        "source_id": source_id,
        "name": filename,
        "private_path": str(managed_path),
        "source_kind": "upload",
        "locator_kind": "managed_file",
        "private_locator": {
            "storage_key": storage_key,
            "file_name": safe_name,
            "format": suffix.lstrip(".") or None,
        },
        "content_fingerprint": f"sha256:{sha256(file_bytes).hexdigest()}",
        "schema_version": 1,
        "schema": dataframe_schema(dataframe),
        "row_count": int(dataframe.shape[0]),
        "column_count": int(dataframe.shape[1]),
        "preview": preview,
        "semantic_model": source_semantic_model,
        "governance_policy": governance_policy,
        "governance_readiness": governance_readiness,
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    workspace_record = {
        "workspace_id": workspace_id,
        "name": f"{Path(filename).stem or 'Dataset'} workspace",
        "version": 1,
        "primary_source_id": source_id,
        "created_at": timestamp,
        "updated_at": timestamp,
    }
    membership_record = {
        "workspace_id": workspace_id,
        "source_id": source_id,
        "alias": _source_alias(filename),
        "role": "primary",
        "position": None,
        "added_at": timestamp,
    }

    try:
        # Exclusive creation prevents an accidental overwrite even though the
        # storage key contains a random server-generated source identity.
        with managed_path.open("xb") as managed_file:
            managed_file.write(file_bytes)
        source, workspace = register_source_with_workspace(
            source=source_record,
            workspace=workspace_record,
            membership=membership_record,
        )
    except Exception:
        managed_path.unlink(missing_ok=True)
        raise

    return {
        "source": source,
        "workspace": workspace,
        "analysis_context": _analysis_context(workspace, [source_id]),
    }


def resolve_analysis_context(
    workspace_id: str,
    source_ids: Optional[Iterable[str]] = None,
    *,
    require_managed_files: bool = True,
) -> Dict[str, Any]:
    """Resolve a durable workspace while enforcing membership and availability."""
    workspace = get_workspace(workspace_id)
    if workspace is None:
        raise WorkspaceContextError(
            "workspace_not_found", f"Workspace '{workspace_id}' was not found."
        )

    selected_ids = list(source_ids) if source_ids is not None else [workspace["primary_source_id"]]
    if not selected_ids or any(not source_id for source_id in selected_ids):
        raise WorkspaceContextError(
            "source_not_in_workspace", "At least one workspace source must be selected."
        )

    try:
        workspace = require_workspace_sources(workspace_id, selected_ids)
    except SourceWorkspaceRepositoryError as exc:
        raise WorkspaceContextError(exc.code, str(exc)) from exc

    sources = []
    for source_id in selected_ids:
        source = get_source(source_id)
        if source is None:
            raise WorkspaceContextError(
                "source_not_found", f"Source '{source_id}' was not found."
            )
        if require_managed_files and source["locator_kind"] == "managed_file":
            locator = get_source_private_locator(source_id)
            path = Path(locator["path"]) if locator and locator.get("path") else None
            if path is None or not path.is_file():
                raise WorkspaceContextError(
                    "managed_source_unavailable",
                    f"Managed storage for source '{source_id}' is unavailable.",
                )
        sources.append(source)

    return {
        "workspace": workspace,
        "sources": sources,
        "analysis_context": _analysis_context(workspace, selected_ids),
    }
