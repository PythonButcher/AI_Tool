from flask import Blueprint, current_app, jsonify, request

from backend.services.workflow_executor import get_workflow_run, start_workflow_run
from backend.services.workflow_storage import (
    create_workflow,
    create_workflow_from_template,
    duplicate_workflow,
    get_workflow,
    list_workflows,
    update_workflow,
)


workflow_bp = Blueprint("workflow_bp", __name__, url_prefix="/api/workflows")


@workflow_bp.route("", methods=["GET"])
def workflow_index():
    return jsonify(list_workflows())


@workflow_bp.route("", methods=["POST"])
def workflow_create():
    payload = request.get_json(silent=True) or {}
    workflow_definition = payload.get("workflow") or payload
    created = create_workflow(workflow_definition)
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
    updated = update_workflow(workflow_id, workflow_definition)
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


@workflow_bp.route("/execute", methods=["POST"])
def workflow_execute():
    payload = request.get_json(silent=True) or {}
    workflow_definition = payload.get("workflow") or payload
    dataset = payload.get("dataset")

    try:
        run_state = start_workflow_run(workflow_definition, dataset)
        return jsonify(run_state), 202
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        current_app.logger.error(f"Failed to execute workflow: {str(exc)}", exc_info=True)
        return jsonify({"error": f"Failed to execute workflow: {str(exc)}"}), 500


@workflow_bp.route("/runs/<run_id>", methods=["GET"])
def workflow_run_status(run_id):
    run_state = get_workflow_run(run_id)
    if not run_state:
        return jsonify({"error": "Workflow run not found."}), 404
    return jsonify(run_state)
