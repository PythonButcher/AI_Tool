"""CRUD, profiling, and validation routes for workspace relationships."""

from flask import Blueprint, jsonify, request

from backend.services.source_relationships import (
    SourceRelationshipError,
    create_relationship,
    delete_relationship,
    get_relationship,
    list_relationships,
    profile_candidates,
    update_relationship,
    validate_relationship,
)


source_relationships_bp = Blueprint(
    "source_relationships_bp", __name__, url_prefix="/api/data-workspaces"
)


def _relationship_error(error: SourceRelationshipError):
    """Translate stable service failures to structured API errors."""
    status_by_code = {
        "workspace_not_found": 404,
        "source_not_found": 404,
        "relationship_not_found": 404,
        "source_not_in_workspace": 409,
        "relationship_version_conflict": 409,
        "relationship_confirmation_required": 409,
        "relationship_not_activatable": 422,
        "source_unavailable": 409,
    }
    error_body = {"code": error.code, "message": str(error)}
    if error.diagnostics:
        error_body["diagnostics"] = error.diagnostics
    return jsonify({"error": error_body}), status_by_code.get(error.code, 400)


@source_relationships_bp.route("/<workspace_id>/relationships", methods=["POST"])
def post_relationship(workspace_id):
    """Store an inactive relationship, with optional immediate validation."""
    payload = request.get_json(silent=True) or {}
    try:
        relationship = create_relationship(workspace_id, payload)
        if payload.get("validate"):
            relationship = validate_relationship(workspace_id, relationship["relationship_id"])
        if payload.get("is_active"):
            relationship = update_relationship(
                workspace_id,
                relationship["relationship_id"],
                {
                    "version": relationship["version"],
                    "is_confirmed": bool(payload.get("is_confirmed")),
                    "is_active": True,
                },
            )
        return jsonify({"relationship": relationship}), 201
    except SourceRelationshipError as exc:
        return _relationship_error(exc)


@source_relationships_bp.route("/<workspace_id>/relationships", methods=["GET"])
def get_relationships(workspace_id):
    """List workspace-isolated relationship contracts."""
    try:
        return jsonify({"relationships": list_relationships(workspace_id)}), 200
    except SourceRelationshipError as exc:
        return _relationship_error(exc)


@source_relationships_bp.route(
    "/<workspace_id>/relationships/<relationship_id>", methods=["GET"]
)
def get_relationship_record(workspace_id, relationship_id):
    """Retrieve one relationship without cross-workspace identity leakage."""
    try:
        return jsonify({"relationship": get_relationship(workspace_id, relationship_id)}), 200
    except SourceRelationshipError as exc:
        return _relationship_error(exc)


@source_relationships_bp.route(
    "/<workspace_id>/relationships/<relationship_id>", methods=["PATCH"]
)
def patch_relationship(workspace_id, relationship_id):
    """Edit, confirm, activate, or deactivate a relationship."""
    try:
        relationship = update_relationship(
            workspace_id, relationship_id, request.get_json(silent=True) or {}
        )
        return jsonify({"relationship": relationship}), 200
    except SourceRelationshipError as exc:
        return _relationship_error(exc)


@source_relationships_bp.route(
    "/<workspace_id>/relationships/<relationship_id>", methods=["DELETE"]
)
def remove_relationship(workspace_id, relationship_id):
    """Delete relationship metadata without deleting either governed source."""
    try:
        delete_relationship(workspace_id, relationship_id)
        return "", 204
    except SourceRelationshipError as exc:
        return _relationship_error(exc)


@source_relationships_bp.route(
    "/<workspace_id>/relationships/<relationship_id>/validate", methods=["POST"]
)
def post_relationship_validation(workspace_id, relationship_id):
    """Refresh trust evidence without executing the configured join."""
    try:
        relationship = validate_relationship(workspace_id, relationship_id)
        return jsonify({"relationship": relationship}), 200
    except SourceRelationshipError as exc:
        return _relationship_error(exc)


@source_relationships_bp.route(
    "/<workspace_id>/relationship-candidates", methods=["POST"]
)
def post_relationship_candidates(workspace_id):
    """Profile conservative proposals that always remain inactive."""
    try:
        return jsonify({"candidates": profile_candidates(workspace_id)}), 200
    except SourceRelationshipError as exc:
        return _relationship_error(exc)
