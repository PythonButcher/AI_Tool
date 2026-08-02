"""Workflow API routes.

Exposes RESTful endpoints for workflow CRUD, execution, run status,
run listing, cancellation, and event inspection.

New endpoints added for reliability:
- GET  /api/workflows/runs          — paginated run listing
- POST /api/workflows/runs/<id>/cancel — cooperative cancellation
- GET  /api/workflows/runs/<id>/events — paginated event history

Existing endpoints are preserved for backward compatibility.
"""

from flask import Blueprint, current_app, jsonify, request

from backend.services.workflow_executor import get_workflow_run, start_workflow_run
from backend.services.workflow_run_repository import (
    get_run_events,
    list_runs,
    request_cancellation,
)
from backend.services.workflow_storage import (
    create_workflow,
    create_workflow_from_template,
    duplicate_workflow,
    get_workflow,
    list_workflows,
    update_workflow,
)
from backend.services.workflow_validator import WorkflowValidationError


workflow_bp = Blueprint("workflow_bp", __name__, url_prefix="/api/workflows")


# ── Workflow Definition CRUD ──────────────────────────────────────


@workflow_bp.route("", methods=["GET"])
def workflow_index():
    return jsonify(list_workflows())


@workflow_bp.route("", methods=["POST"])
def workflow_create():
    payload = request.get_json(silent=True) or {}
    workflow_definition = payload.get("workflow") or payload
    try:
        created = create_workflow(workflow_definition)
    except WorkflowValidationError as exc:
        return jsonify({"error": "Validation failed.", "details": exc.errors}), 400
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify(created), 201


@workflow_bp.route("/<workflow_id>", methods=["GET"])
def workflow_detail(workflow_id):
    workflow = get_workflow(workflow_id)
    if not workflow:
        return jsonify({"error": "Workflow not found."}), 404
    return jsonify(workflow)


@workflow_bp.route("/<workflow_id>", methods=["PATCH"])
def workflow_update(workflow_id):
    payload = request.get_json(silent=True) or {}
    workflow_definition = payload.get("workflow") or payload
    try:
        updated = update_workflow(workflow_id, workflow_definition)
    except WorkflowValidationError as exc:
        return jsonify({"error": "Validation failed.", "details": exc.errors}), 400
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    if not updated:
        return jsonify({"error": "Workflow not found."}), 404
    return jsonify(updated)


@workflow_bp.route("/<workflow_id>/duplicate", methods=["POST"])
def workflow_duplicate(workflow_id):
    payload = request.get_json(silent=True) or {}
    duplicated = duplicate_workflow(workflow_id, payload.get("name"))
    if not duplicated:
        return jsonify({"error": "Workflow not found."}), 404
    return jsonify(duplicated), 201


@workflow_bp.route("/from-template/<template_id>", methods=["POST"])
def workflow_from_template(template_id):
    payload = request.get_json(silent=True) or {}
    created = create_workflow_from_template(template_id, payload.get("name"))
    if not created:
        return jsonify({"error": "Template not found."}), 404
    return jsonify(created), 201


# ── Execution ─────────────────────────────────────────────────────


@workflow_bp.route("/execute", methods=["POST"])
def workflow_execute():
    """Start a new workflow run.

    Accepts an optional ``idempotency_key`` in the request body.
    If a run with that key already exists, returns the existing run
    instead of starting a new one.
    """
    payload = request.get_json(silent=True) or {}
    workflow_definition = payload.get("workflow") or payload
    dataset = payload.get("dataset")
    idempotency_key = payload.get("idempotency_key")

    try:
        run_state = start_workflow_run(
            workflow_definition,
            dataset,
            idempotency_key=idempotency_key,
        )
        return jsonify(run_state), 202
    except WorkflowValidationError as exc:
        return jsonify({"error": "Validation failed.", "details": exc.errors}), 400
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        current_app.logger.error(
            f"Failed to execute workflow: {str(exc)}", exc_info=True
        )
        return jsonify({"error": f"Failed to execute workflow: {str(exc)}"}), 500


# ── Run Queries ───────────────────────────────────────────────────


@workflow_bp.route("/runs", methods=["GET"])
def workflow_run_list():
    """List workflow runs with optional filtering and pagination.

    Query parameters:
    - workflow_id: filter by workflow ID
    - limit: max results per page (default 50, max 100)
    - offset: pagination offset (default 0)
    """
    workflow_id = request.args.get("workflow_id")
    try:
        limit = int(request.args.get("limit", 50))
    except (TypeError, ValueError):
        limit = 50
    try:
        offset = int(request.args.get("offset", 0))
    except (TypeError, ValueError):
        offset = 0

    result = list_runs(workflow_id=workflow_id, limit=limit, offset=offset)
    return jsonify(result)


@workflow_bp.route("/runs/<run_id>", methods=["GET"])
def workflow_run_status(run_id):
    run_state = get_workflow_run(run_id)
    if not run_state:
        return jsonify({"error": "Workflow run not found."}), 404
    return jsonify(run_state)


@workflow_bp.route("/runs/<run_id>/cancel", methods=["POST"])
def workflow_run_cancel(run_id):
    """Request cooperative cancellation of a running workflow.

    If the run is queued, cancels immediately.  If running, sets
    ``cancel_requested`` and the executor will stop before the next
    node.  If already in a terminal state, returns the current state.
    """
    result = request_cancellation(run_id)
    if not result:
        return jsonify({"error": "Workflow run not found."}), 404
    return jsonify(result)


@workflow_bp.route("/runs/<run_id>/events", methods=["GET"])
def workflow_run_events(run_id):
    """Return paginated events for a specific run.

    Query parameters:
    - limit: max events per page (default 100, max 200)
    - offset: pagination offset (default 0)
    """
    try:
        limit = int(request.args.get("limit", 100))
    except (TypeError, ValueError):
        limit = 100
    try:
        offset = int(request.args.get("offset", 0))
    except (TypeError, ValueError):
        offset = 0

    result = get_run_events(run_id, limit=limit, offset=offset)
    if not result:
        return jsonify({"error": "Workflow run not found."}), 404
    return jsonify(result)
