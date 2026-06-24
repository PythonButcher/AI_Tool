import os
import pandas as pd

from flask import Blueprint, current_app, jsonify, request

from backend.services.ai_command_executor import client, execute_ai_command
from backend.services.data_catalog_lineage import (
    GovernancePolicyError,
    evaluate_dataset_readiness,
    governance_error_payload,
    is_blocked,
)


ai_bp = Blueprint("ai_bp", __name__)


def _legacy_chat_readiness(dataset, policy, operation):
    if dataset is None:
        return {
            'status': 'warning',
            'operation': operation,
            'severity': 'warning',
            'reasons': [{
                'code': 'dataset_governance_unavailable',
                'severity': 'warning',
                'message': 'This legacy AI route did not receive a structured dataset for quality evaluation.',
                'next_action': 'Use /api/decision/chat/turns with a structured dataset for governed AI analysis.',
            }],
            'next_action': 'Use /api/decision/chat/turns with a structured dataset for governed AI analysis.',
        }
    return evaluate_dataset_readiness(pd.DataFrame(dataset), policy, operation=operation)


@ai_bp.route("/ai", methods=["POST"])
def ai_response():
    try:
        data = request.json or {}
        try:
            readiness = _legacy_chat_readiness(
                data.get('dataset'), data.get('governance_policy') or data.get('governancePolicy'), 'legacy_ai_chat'
            )
        except GovernancePolicyError as exc:
            return jsonify({'error': f'Invalid governance policy: {exc}'}), 400
        if is_blocked(readiness):
            return jsonify(governance_error_payload(readiness)), 422
        conversation_history = data.get("conversation_history")

        if not conversation_history or not isinstance(conversation_history, list):
            return jsonify({"error": "Invalid request: conversation_history must be a non-empty list."}), 400

        dataset_message = next((msg for msg in conversation_history if msg.get("role") == "system"), None)
        if not dataset_message:
            return jsonify({"error": "Missing dataset context. AI requires a dataset to function."}), 400

        completion = client.chat.completions.create(
            model="gpt-4.1",
            messages=conversation_history,
            max_tokens=500,
            temperature=0.7,
            top_p=1,
            frequency_penalty=0.5,
            presence_penalty=0.6,
        )

        if not completion.choices or not hasattr(completion.choices[0], "message"):
            return jsonify({"error": "Invalid response from AI service."}), 500

        reply = completion.choices[0].message.content
        conversation_history.append({"role": "assistant", "content": reply})

        return jsonify({"reply": reply, "conversation_history": conversation_history, "governance_readiness": readiness})

    except Exception as exc:
        current_app.logger.error(f"Error in /ai: {str(exc)}")
        return jsonify({"error": str(exc)}), 500


@ai_bp.route("/ai_cmd", methods=["POST"])
def ai_command():
    try:
        data = request.json or {}
        command = data.get("command")
        dataset_obj = data.get("dataset")
        instructions = data.get("instructions")
        node_params = data.get("params") or {}
        execution_context = data.get("execution_context") or {}

        if not command:
            return jsonify({"error": "Missing command."}), 400

        try:
            readiness = _legacy_chat_readiness(
                dataset_obj, data.get('governance_policy') or data.get('governancePolicy'), 'ai_command'
            )
        except GovernancePolicyError as exc:
            return jsonify({'error': f'Invalid governance policy: {exc}'}), 400
        if is_blocked(readiness):
            return jsonify(governance_error_payload(readiness)), 422

        result = execute_ai_command(
            command,
            dataset_obj,
            instructions=instructions,
            node_params=node_params,
            execution_context=execution_context,
        )
        if isinstance(result, dict):
            result['governance_readiness'] = readiness
        return jsonify(result)

    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        current_app.logger.error(f"Error in /ai_cmd: {str(exc)}", exc_info=True)
        return jsonify({"error": f"An unexpected error occurred: {str(exc)}"}), 500
