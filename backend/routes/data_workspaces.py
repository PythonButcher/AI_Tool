"""Durable source and workspace routes for governed analysis context."""

import sqlite3

from flask import Blueprint, current_app, jsonify, request

from backend.repositories.source_workspace_repository import get_source, get_workspace, list_sources
from backend.services.business_object_records import RecordAccessDenied, get_record, search_records
from backend.services.business_objects import (
    BusinessObjectError,
    create_business_object,
    get_business_object,
    list_business_objects,
)
from backend.services.workspace_context import (
    WorkspaceContextError,
    add_source_to_workspace,
    resolve_analysis_context,
    update_source_position,
)


data_workspaces_bp = Blueprint("data_workspaces_bp", __name__, url_prefix="/api")


def _workspace_error(error: WorkspaceContextError | BusinessObjectError):
    """Translate stable domain errors without leaking filesystem details."""
    status_by_code = {
        "workspace_not_found": 404,
        "source_not_found": 404,
        "relationship_not_found": 404,
        "business_object_not_found": 404,
        "record_not_found": 404,
        "record_read_limit": 413,
        "record_configuration_unavailable": 409,
        "record_source_unavailable": 409,
        "record_key_missing": 409,
        "record_key_duplicate": 409,
        "saved_dataset_dependency_changed": 409,
        "source_not_in_workspace": 409,
        "managed_source_unavailable": 409,
        "source_schema_unavailable": 409,
        "source_field_not_found": 409,
        "relationship_not_applicable": 409,
        "relationship_field_not_found": 409,
        "duplicate_workspace_membership": 409,
        "workspace_alias_conflict": 409,
        "workspace_membership_conflict": 409,
        "workspace_version_conflict": 409,
        "invalid_source_alias": 400,
        "invalid_workspace_role": 400,
        "invalid_workspace_version": 400,
        "invalid_workspace_position": 400,
    }
    return jsonify({"error": {"code": error.code, "message": str(error)}}), status_by_code.get(error.code, 400)


def _business_object_storage_error():
    current_app.logger.exception("Business Object storage operation failed")
    return jsonify({"error": {
        "code": "business_object_storage_error", "message": "Business Object storage is unavailable."
    }}), 500


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


@data_workspaces_bp.route("/data-workspaces/<workspace_id>/business-objects", methods=["GET", "POST"])
def business_object_collection(workspace_id):
    """Create or list configuration in the named workspace."""
    try:
        if request.method == "POST":
            definition = create_business_object(workspace_id, request.get_json(silent=True))
            return jsonify({"business_object": definition}), 201
        return jsonify({"business_objects": list_business_objects(workspace_id)}), 200
    except BusinessObjectError as exc:
        return _workspace_error(exc)
    except sqlite3.Error:
        return _business_object_storage_error()


@data_workspaces_bp.route("/data-workspaces/<workspace_id>/business-objects/<object_id>", methods=["GET"])
def business_object_detail(workspace_id, object_id):
    """Retrieve one saved definition in the named workspace."""
    try:
        return jsonify({"business_object": get_business_object(workspace_id, object_id)}), 200
    except BusinessObjectError as exc:
        return _workspace_error(exc)
    except sqlite3.Error:
        return _business_object_storage_error()


@data_workspaces_bp.route("/data-workspaces/<workspace_id>/business-objects/<object_id>/records", methods=["GET"])
@data_workspaces_bp.route(
    "/data-workspaces/<workspace_id>/business-objects/<object_id>/records/detail", methods=["POST"]
)
def business_object_records(workspace_id, object_id):
    """Search or retrieve rows exclusively through a saved object definition."""
    try:
        if request.method == "POST":
            if request.content_length is not None and request.content_length > 8192:
                raise BusinessObjectError("record_read_limit", "The record request is too large.")
            result = get_record(workspace_id, object_id, request.get_json(silent=True))
        else:
            if request.args.keys() - {"q"} or len(request.args.getlist("q")) > 1:
                raise BusinessObjectError("invalid_record_request", "Supply at most one q search parameter.")
            result = search_records(workspace_id, object_id, request.args.get("q", ""))
        response = jsonify(result)
        if response.calculate_content_length() > 2 * 1024 * 1024:
            raise BusinessObjectError("record_read_limit", "The matching record data exceeds the response limit.")
        response.headers["Cache-Control"] = "no-store"
        return response
    except RecordAccessDenied as exc:
        return jsonify({
            "error": {"code": exc.code, "message": str(exc)},
            "governance_readiness": exc.readiness,
        }), 422
    except BusinessObjectError as exc:
        return _workspace_error(exc)
    except sqlite3.Error:
        return _business_object_storage_error()


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


@data_workspaces_bp.route(
    "/data-workspaces/<workspace_id>/sources/<source_id>/position",
    methods=["PATCH"],
)
def update_data_workspace_source_position(workspace_id, source_id):
    """Persist one source node's presentation-only canvas position."""
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return _workspace_error(
            WorkspaceContextError("invalid_request", "A JSON request body is required.")
        )
    try:
        return jsonify(
            update_source_position(
                workspace_id=workspace_id,
                source_id=source_id,
                version=payload.get("version"),
                position=payload.get("position"),
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
