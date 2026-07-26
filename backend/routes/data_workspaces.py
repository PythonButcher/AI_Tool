"""Read-only routes for durable sources and one-source workspace context."""

from flask import Blueprint, jsonify, request

from backend.repositories.source_workspace_repository import get_source, get_workspace
from backend.services.workspace_context import WorkspaceContextError, resolve_analysis_context


data_workspaces_bp = Blueprint("data_workspaces_bp", __name__, url_prefix="/api")


def _workspace_error(error: WorkspaceContextError):
    """Translate stable domain errors without leaking filesystem details."""
    status_by_code = {
        "workspace_not_found": 404,
        "source_not_found": 404,
        "source_not_in_workspace": 409,
        "managed_source_unavailable": 409,
    }
    return jsonify({"error": {"code": error.code, "message": str(error)}}), status_by_code.get(error.code, 400)


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


@data_workspaces_bp.route("/data-workspaces/<workspace_id>/analysis-context", methods=["GET"])
def get_workspace_analysis_context(workspace_id):
    """Resolve selected workspace sources and verify managed file availability."""
    source_ids = request.args.getlist("source_id") or None
    try:
        return jsonify(resolve_analysis_context(workspace_id, source_ids)), 200
    except WorkspaceContextError as exc:
        return _workspace_error(exc)
