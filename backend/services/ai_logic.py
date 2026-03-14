import os

from flask import Blueprint, current_app, jsonify, request

from backend.services.ai_command_executor import client, execute_ai_command


ai_bp = Blueprint("ai_bp", __name__)


@ai_bp.route("/ai", methods=["POST"])
def ai_response():
    try:
        data = request.json or {}
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

        return jsonify({"reply": reply, "conversation_history": conversation_history})

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

        result = execute_ai_command(
            command,
            dataset_obj,
            instructions=instructions,
            node_params=node_params,
            execution_context=execution_context,
        )
        return jsonify(result)

    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        current_app.logger.error(f"Error in /ai_cmd: {str(exc)}", exc_info=True)
        return jsonify({"error": f"An unexpected error occurred: {str(exc)}"}), 500
