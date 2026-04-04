from flask import Blueprint, jsonify, request

from backend.services.decision_brief_service import generate_decision_brief
from backend.services.decision_signal_service import generate_decision_signals
from backend.services.decision_support import DecisionServiceError
from backend.services.recommendation_service import generate_recommendations
from backend.services.scenario_service import evaluate_scenario


decision_bp = Blueprint("decision_bp", __name__, url_prefix="/api/decision")


def _error_payload(code: str, message: str):
    return {
        "status": "error",
        "error": {
            "code": code,
            "message": message,
        },
    }


@decision_bp.route("/signals/generate", methods=["POST"])
def generate_signals_route():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(generate_decision_signals(payload)), 200
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("DECISION_SIGNAL_GENERATION_FAILED", f"Failed to generate decision signals: {exc}")), 500


@decision_bp.route("/brief/generate", methods=["POST"])
def generate_brief_route():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(generate_decision_brief(payload)), 200
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("DECISION_BRIEF_GENERATION_FAILED", f"Failed to generate decision brief: {exc}")), 500


@decision_bp.route("/recommendations/generate", methods=["POST"])
def generate_recommendations_route():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(generate_recommendations(payload)), 200
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("RECOMMENDATION_GENERATION_FAILED", f"Failed to generate recommendations: {exc}")), 500


@decision_bp.route("/scenarios/evaluate", methods=["POST"])
def evaluate_scenario_route():
    payload = request.get_json(silent=True) or {}
    try:
        return jsonify(evaluate_scenario(payload)), 200
    except DecisionServiceError as exc:
        return jsonify(_error_payload("INVALID_DECISION_REQUEST", str(exc))), 400
    except Exception as exc:
        return jsonify(_error_payload("SCENARIO_EVALUATION_FAILED", f"Failed to evaluate scenario: {exc}")), 500
