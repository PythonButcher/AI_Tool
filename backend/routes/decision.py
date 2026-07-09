from flask import Blueprint, jsonify, request

from backend.decision_engine import DecisionChatService
from backend.services.data_catalog_lineage import (
    GovernancePolicyError,
    evaluate_dataset_readiness,
    governance_error_payload,
    is_blocked,
)
from backend.services.dataset_context import resolve_dataset_bundle
from backend.services.decision_brief_service import generate_decision_brief
from backend.services.decision_asset_service import DecisionAssetService
from backend.services.decision_graph_service import DecisionGraphService
from backend.services.decision_pipeline_service import run_decision_pipeline
from backend.services.decision_signal_service import generate_decision_signals
from backend.services.decision_support import DecisionServiceError
from backend.services.recommendation_service import generate_recommendations
from backend.services.scenario_service import evaluate_scenario
from backend.services.decision_workspace_service import DecisionWorkspaceService

decision_bp = Blueprint("decision_bp", __name__, url_prefix="/api/decision")

def _error_payload(code: str, message: str):
    return {
        "status": "error",
        "error": {
            "code": code,
            "message": message,
        },
    }


def _governance_for_payload(payload, operation):
    """Evaluate only when this decision request actually carries a dataset."""
    if not isinstance(payload, dict) or (payload.get('dataset') is None and not (payload.get('dataset_ref') or payload.get('datasetRef'))):
        return None, None
    try:
        bundle = resolve_dataset_bundle(
            dataset=payload.get('dataset'),
            dataset_ref=payload.get('dataset_ref') or payload.get('datasetRef'),
            semantic_model=payload.get('semantic_model') or payload.get('semanticModel'),
            source=f'decision_{operation}',
            allow_active_fallback=False,
        )
        readiness = evaluate_dataset_readiness(
            bundle['dataframe'],
            payload.get('governance_policy') or payload.get('governancePolicy') or bundle.get('governance_policy'),
            operation=f'decision_{operation}',
        )
    except (ValueError, GovernancePolicyError) as exc:
        return None, (jsonify(_error_payload('INVALID_DATASET_GOVERNANCE_REQUEST', str(exc))), 400)
    if is_blocked(readiness):
        return readiness, (jsonify(governance_error_payload(readiness)), 422)
    return readiness, None


def _governed_response(result, readiness):
    if readiness is not None:
        result['governance_readiness'] = readiness
    return jsonify(result), 200

@decision_bp.route("/workspaces", methods=["POST"])
def create_workspace_route():
    payload = request.get_json(silent=True) or {}
    readiness, blocked = _governance_for_payload(payload, 'workspace')
    if blocked:
        return blocked
    try:
        return _governed_response(DecisionWorkspaceService.create_workspace(payload), readiness)
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_WORKSPACE_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("DECISION_WORKSPACE_CREATION_FAILED", f"Failed to create decision workspace: {exc}")), 500

@decision_bp.route("/chat/turns", methods=["POST"])
def decision_chat_turn_route():
    payload = request.get_json(silent=True) or {}
    readiness, blocked = _governance_for_payload(payload, 'chat')
    if blocked:
        return blocked
    try:
        return _governed_response(DecisionChatService.handle_turn(payload), readiness)
    except DecisionServiceError as exc:
        error_response = _error_payload("INVALID_DECISION_CHAT_TURN_REQUEST", str(exc))
        error_response["dataset_trust"] = DecisionChatService.build_dataset_trust_for_payload(payload)
        return jsonify(error_response), 400
    except Exception as exc:
        return jsonify(_error_payload("DECISION_CHAT_TURN_FAILED", f"Failed to process decision chat turn: {exc}")), 500

@decision_bp.route("/chat/actions", methods=["POST"])
def decision_chat_action_route():
    payload = request.get_json(silent=True) or {}
    readiness, blocked = _governance_for_payload(payload, 'chat_action')
    if blocked:
        return blocked
    try:
        return _governed_response(DecisionChatService.handle_action(payload), readiness)
    except DecisionServiceError as exc:
        error_response = _error_payload("INVALID_DECISION_CHAT_ACTION_REQUEST", str(exc))
        error_response["dataset_trust"] = DecisionChatService.build_dataset_trust_for_payload(payload)
        return jsonify(error_response), 400
    except Exception as exc:
        return jsonify(_error_payload("DECISION_CHAT_ACTION_FAILED", f"Failed to process decision chat action: {exc}")), 500

@decision_bp.route("/workspaces/analyze", methods=["POST"])
def analyze_workspace_route():
    payload = request.get_json(silent=True) or {}
    readiness, blocked = _governance_for_payload(payload, 'workspace_analysis')
    if blocked:
        return blocked
    try:
        return _governed_response(DecisionWorkspaceService.analyze_workspace(payload), readiness)
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_WORKSPACE_ANALYSIS_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("DECISION_WORKSPACE_ANALYSIS_FAILED", f"Failed to analyze decision workspace: {exc}")), 500


@decision_bp.route("/assets", methods=["POST"])
def create_decision_asset_route():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(DecisionAssetService.create_asset(payload)), 201
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_ASSET_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("DECISION_ASSET_CREATION_FAILED", f"Failed to save decision asset: {exc}")), 500


@decision_bp.route("/assets", methods=["GET"])
def list_decision_assets_route():
    try:
        filters = {
            "readiness_state": request.args.get("readiness_state"),
            "truth_boundary": request.args.get("truth_boundary"),
            "dataset_label": request.args.get("dataset_label"),
            "query": request.args.get("query"),
            "has_graph_state": request.args.get("has_graph_state"),
            "created_from": request.args.get("created_from"),
            "created_to": request.args.get("created_to"),
            "archived_state": request.args.get("archived_state"),
            "include_archived": request.args.get("include_archived"),
        }
        return jsonify(DecisionAssetService.list_assets(request.args.get("limit"), filters)), 200
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_ASSET_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("DECISION_ASSET_LIST_FAILED", f"Failed to list decision assets: {exc}")), 500


@decision_bp.route("/assets/compare", methods=["POST"])
def compare_decision_assets_route():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(DecisionAssetService.compare_assets(payload)), 200
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_ASSET_COMPARISON_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("DECISION_ASSET_COMPARISON_FAILED", f"Failed to compare decision assets: {exc}")), 500


@decision_bp.route("/assets/<asset_id>", methods=["GET"])
def get_decision_asset_route(asset_id):
    try:
        asset = DecisionAssetService.get_asset(asset_id)
    except Exception as exc:
        return jsonify(_error_payload("DECISION_ASSET_FETCH_FAILED", f"Failed to fetch decision asset: {exc}")), 500
    if asset is None:
        return jsonify(_error_payload("DECISION_ASSET_NOT_FOUND", "Decision asset was not found.")), 404
    return jsonify(asset), 200


@decision_bp.route("/assets/<asset_id>/archive", methods=["POST"])
def archive_decision_asset_route(asset_id):
    try:
        asset = DecisionAssetService.archive_asset(asset_id)
    except Exception as exc:
        return jsonify(_error_payload("DECISION_ASSET_ARCHIVE_FAILED", f"Failed to archive decision asset: {exc}")), 500
    if asset is None:
        return jsonify(_error_payload("DECISION_ASSET_NOT_FOUND", "Decision asset was not found.")), 404
    return jsonify(asset), 200


@decision_bp.route("/assets/<asset_id>/restore", methods=["POST"])
def restore_decision_asset_route(asset_id):
    try:
        asset = DecisionAssetService.restore_asset(asset_id)
    except Exception as exc:
        return jsonify(_error_payload("DECISION_ASSET_RESTORE_FAILED", f"Failed to restore decision asset: {exc}")), 500
    if asset is None:
        return jsonify(_error_payload("DECISION_ASSET_NOT_FOUND", "Decision asset was not found.")), 404
    return jsonify(asset), 200


@decision_bp.route("/assets/<asset_id>", methods=["DELETE"])
def delete_decision_asset_route(asset_id):
    try:
        deleted = DecisionAssetService.delete_asset(asset_id)
    except Exception as exc:
        return jsonify(_error_payload("DECISION_ASSET_DELETE_FAILED", f"Failed to delete decision asset: {exc}")), 500
    if not deleted:
        return jsonify(_error_payload("DECISION_ASSET_NOT_FOUND", "Decision asset was not found.")), 404
    return jsonify({"status": "deleted", "asset_id": asset_id}), 200


@decision_bp.route("/assets/<asset_id>/export", methods=["GET"])
def export_decision_asset_route(asset_id):
    try:
        export_payload = DecisionAssetService.export_asset(asset_id)
    except Exception as exc:
        return jsonify(_error_payload("DECISION_ASSET_EXPORT_FAILED", f"Failed to export decision asset: {exc}")), 500
    if export_payload is None:
        return jsonify(_error_payload("DECISION_ASSET_NOT_FOUND", "Decision asset was not found.")), 404
    return jsonify(export_payload), 200


@decision_bp.route("/graph/candidates", methods=["POST"])
def decision_graph_candidates_route():
    payload = request.get_json(silent=True) or {}
    readiness, blocked = _governance_for_payload(payload, 'graph_candidates')
    if blocked:
        return blocked
    try:
        return _governed_response(DecisionGraphService.discover_candidates(payload), readiness)
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_GRAPH_CANDIDATE_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("DECISION_GRAPH_CANDIDATE_DISCOVERY_FAILED", f"Failed to discover graph candidates: {exc}")), 500


@decision_bp.route("/graph/build", methods=["POST"])
def decision_graph_build_route():
    payload = request.get_json(silent=True) or {}
    readiness, blocked = _governance_for_payload(payload, 'graph')
    if blocked:
        return blocked
    try:
        return _governed_response(DecisionGraphService.build_graph(payload), readiness)
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_GRAPH_BUILD_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("DECISION_GRAPH_BUILD_FAILED", f"Failed to build decision graph: {exc}")), 500


@decision_bp.route("/graph/actions", methods=["POST"])
def decision_graph_action_route():
    payload = request.get_json(silent=True) or {}
    readiness, blocked = _governance_for_payload(payload, 'graph_action')
    if blocked:
        return blocked
    try:
        return _governed_response(DecisionGraphService.plan_graph_action(payload), readiness)
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_GRAPH_ACTION_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("DECISION_GRAPH_ACTION_FAILED", f"Failed to plan graph action: {exc}")), 500

@decision_bp.route("/signals/generate", methods=["POST"])
def generate_signals_route():
    payload = request.get_json(silent=True) or {}
    readiness, blocked = _governance_for_payload(payload, 'signals')
    if blocked:
        return blocked
    try:
        return _governed_response(generate_decision_signals(payload), readiness)
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("DECISION_SIGNAL_GENERATION_FAILED", f"Failed to generate decision signals: {exc}")), 500


@decision_bp.route("/brief/generate", methods=["POST"])
def generate_brief_route():
    payload = request.get_json(silent=True) or {}
    readiness, blocked = _governance_for_payload(payload, 'brief')
    if blocked:
        return blocked
    try:
        return _governed_response(generate_decision_brief(payload), readiness)
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("DECISION_BRIEF_GENERATION_FAILED", f"Failed to generate decision brief: {exc}")), 500


@decision_bp.route("/run", methods=["POST"])
def run_decision_pipeline_route():
    payload = request.get_json(silent=True) or {}
    readiness, blocked = _governance_for_payload(payload, 'pipeline')
    if blocked:
        return blocked
    try:
        return _governed_response(run_decision_pipeline(payload), readiness)
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("DECISION_PIPELINE_RUN_FAILED", f"Failed to run decision pipeline: {exc}")), 500


@decision_bp.route("/recommendations/generate", methods=["POST"])
def generate_recommendations_route():
    payload = request.get_json(silent=True) or {}
    readiness, blocked = _governance_for_payload(payload, 'recommendations')
    if blocked:
        return blocked
    try:
        return _governed_response(generate_recommendations(payload), readiness)
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("RECOMMENDATION_GENERATION_FAILED", f"Failed to generate recommendations: {exc}")), 500


@decision_bp.route("/scenarios/evaluate", methods=["POST"])
def evaluate_scenario_route():
    payload = request.get_json(silent=True) or {}
    readiness, blocked = _governance_for_payload(payload, 'scenario')
    if blocked:
        return blocked
    try:
        return _governed_response(evaluate_scenario(payload), readiness)
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("SCENARIO_EVALUATION_FAILED", f"Failed to evaluate scenario: {exc}")), 500
