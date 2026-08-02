"""Read-only routes for durable sources and one-source workspace context."""

from flask import Blueprint, jsonify, request

from backend.repositories.source_workspace_repository import get_source, get_workspace, list_sources
from backend.services.workspace_context import (
    WorkspaceContextError,
    add_source_to_workspace,
    resolve_analysis_context,
)


data_workspaces_bp = Blueprint("data_workspaces_bp", __name__, url_prefix="/api")


def _workspace_error(error: WorkspaceContextError):
    """Translate stable domain errors without leaking filesystem details."""
    status_by_code = {
        "workspace_not_found": 404,
        "source_not_found": 404,
        "source_not_in_workspace": 409,
        "managed_source_unavailable": 409,
        "duplicate_workspace_membership": 409,
        "workspace_alias_conflict": 409,
        "workspace_membership_conflict": 409,
        "workspace_version_conflict": 409,
        "invalid_source_alias": 400,
        "invalid_workspace_role": 400,
        "invalid_workspace_version": 400,
    }
    return jsonify({"error": {"code": error.code, "message": str(error)}}), status_by_code.get(error.code, 400)


@data_workspaces_bp.route("/data-sources", methods=["GET"])
def get_data_sources():
    """List safe public catalog source identities."""
    return jsonify({"sources": list_sources()}), 200


@data_workspaces_bp.route("/data-sources/<source_id>", methods=["GET"])
def get_data_source(source_id):
    """Retrieve source-bound metadata without exposing its private path."""
    source = get_source(source_id)
    if source is None:
        return jsonify({"error": {"code": "source_not_found", "message": f"Source '{source_id}' was not found."}}), 404
    return jsonify({"source": source}), 200


@data_workspaces_bp.route("/data-workspaces/<workspace_id>", methods=["GET"])
def get_data_workspace(workspace_id):
    """Retrieve durable workspace metadata and isolated memberships."""
    workspace = get_workspace(workspace_id)
    if workspace is None:
        return jsonify({"error": {"code": "workspace_not_found", "message": f"Workspace '{workspace_id}' was not found."}}), 404
    return jsonify({"workspace": workspace}), 200


@data_workspaces_bp.route("/data-workspaces/<workspace_id>/sources", methods=["POST"])
def add_data_workspace_source(workspace_id):
    """Attach one existing catalog source to a versioned workspace."""
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return _workspace_error(
            WorkspaceContextError("invalid_request", "A JSON request body is required.")
        )
    try:
        return jsonify(
            add_source_to_workspace(
                workspace_id=workspace_id,
                source_id=payload.get("source_id"),
                version=payload.get("version"),
                alias=payload.get("alias"),
                role=payload.get("role"),
            )
        ), 200
    except WorkspaceContextError as exc:
        return _workspace_error(exc)


@data_workspaces_bp.route("/data-workspaces/<workspace_id>/analysis-context", methods=["GET"])
def get_workspace_analysis_context(workspace_id):
    """Resolve selected workspace sources and verify managed file availability."""
    source_ids = request.args.getlist("source_id") or None
    try:
        return jsonify(resolve_analysis_context(workspace_id, source_ids)), 200
    except WorkspaceContextError as exc:
        return _workspace_error(exc)
