"""Primary BI-first AI Chat routes under the compatibility-stable URL prefix."""

from flask import Blueprint, current_app, jsonify, request

from backend.decision_engine import DecisionChatService
from backend.decision_engine.mode_detection import (
    is_decision_request,
    normalize_requested_mode,
)
from backend.routes.decision_common import (
    error_payload,
    governance_for_payload,
    governed_response,
    payload_with_governance_readiness,
)
from backend.services.decision_support import DecisionServiceError


decision_chat_bp = Blueprint(
    "decision_chat_bp",
    __name__,
    url_prefix="/api/decision",
)


def _compatibility_enabled():
    """Read the application-owned compatibility switch at request time."""
    return bool(current_app.config.get("ENABLE_DECISION_INTELLIGENCE_COMPATIBILITY", False))


def _turn_requests_compatibility(payload):
    """Detect turn shapes that would enter Decision Intelligence execution."""
    requested_mode = normalize_requested_mode(
        payload.get("requested_mode")
        or payload.get("requestedMode")
        or payload.get("mode")
    )
    session_state = payload.get("session_state") if isinstance(payload.get("session_state"), dict) else {}
    if requested_mode == "decide":
        return True
    if session_state.get("draft_workspace") or session_state.get("active_mode") == "decide":
        return True
    return requested_mode in {None, "auto"} and is_decision_request(payload.get("user_message"))


def _compatibility_disabled_response():
    """Return one stable refusal without importing compatibility services."""
    return jsonify(error_payload(
        "DECISION_INTELLIGENCE_COMPATIBILITY_DISABLED",
        "Decision Intelligence compatibility APIs are disabled in the primary BI runtime.",
    )), 409


@decision_chat_bp.route("/chat/turns", methods=["POST"])
def decision_chat_turn_route():
    """Execute the stable public BI chat turn contract."""
    payload = request.get_json(silent=True) or {}
    if _turn_requests_compatibility(payload) and not _compatibility_enabled():
        return _compatibility_disabled_response()
    try:
        prepared_payload = DecisionChatService.prepare_payload(payload)
    except DecisionServiceError as exc:
        response = error_payload("INVALID_DECISION_CHAT_TURN_REQUEST", str(exc))
        response["dataset_trust"] = DecisionChatService.build_dataset_trust_for_payload(payload)
        return jsonify(response), 400
    readiness, blocked = governance_for_payload(prepared_payload, "chat")
    if blocked:
        return blocked
    try:
        service_payload = payload_with_governance_readiness(prepared_payload, readiness)
        return governed_response(DecisionChatService.handle_turn(service_payload), readiness)
    except DecisionServiceError as exc:
        response = error_payload("INVALID_DECISION_CHAT_TURN_REQUEST", str(exc))
        response["dataset_trust"] = DecisionChatService.build_dataset_trust_for_payload(payload)
        return jsonify(response), 400
    except Exception as exc:
        return jsonify(error_payload(
            "DECISION_CHAT_TURN_FAILED",
            f"Failed to process decision chat turn: {exc}",
        )), 500


@decision_chat_bp.route("/chat/actions", methods=["POST"])
def decision_chat_action_route():
    """Retain the stable action path while compatibility services stay lazy."""
    payload = request.get_json(silent=True) or {}
    if not _compatibility_enabled():
        return _compatibility_disabled_response()
    try:
        prepared_payload = DecisionChatService.prepare_payload(payload)
    except DecisionServiceError as exc:
        response = error_payload("INVALID_DECISION_CHAT_ACTION_REQUEST", str(exc))
        response["dataset_trust"] = DecisionChatService.build_dataset_trust_for_payload(payload)
        return jsonify(response), 400
    readiness, blocked = governance_for_payload(prepared_payload, "chat_action")
    if blocked:
        return blocked
    try:
        service_payload = payload_with_governance_readiness(prepared_payload, readiness)
        return governed_response(DecisionChatService.handle_action(service_payload), readiness)
    except DecisionServiceError as exc:
        response = error_payload("INVALID_DECISION_CHAT_ACTION_REQUEST", str(exc))
        response["dataset_trust"] = DecisionChatService.build_dataset_trust_for_payload(payload)
        return jsonify(response), 400
    except Exception as exc:
        return jsonify(error_payload(
            "DECISION_CHAT_ACTION_FAILED",
            f"Failed to process decision chat action: {exc}",
        )), 500
