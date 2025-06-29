import json
from flask import Blueprint, request, jsonify, current_app
import os
import textwrap  # For dedenting multi-line 
from flask import current_app
from openai import OpenAI
from flask import current_app


# Define Flask Blueprint for AI-related routes
ai_bp = Blueprint("ai_bp", __name__)

# Dictionary to store all command handlers dynamically
COMMANDS = {}

def register_command(command_name):
    """Decorator to register a command dynamically."""
    def decorator(func):
        COMMANDS[command_name] = func
        return func
    return decorator

# Registered command: generate summary of the dataset
@register_command("/summary")
def generate_summary(dataset):
    # Provide a concise summary prompt using the first 20 entries of the dataset
    return f"Summarize this dataset. Give a concise, well-presented response:\n\n{json.dumps(dataset[:20], indent=2)}"

# Registered command: generate insights from the dataset
@register_command("/insights")
def generate_insights(dataset):
    # Provide key insights prompt using the first 10 entries of the dataset
    return f"Provide key insights from this dataset:\n\n{json.dumps(dataset[:10], indent=2)}"

@register_command("/execute")
def generate_execute(dataset):
    print("🚀 Backend: Execute command triggered")

    if isinstance(dataset, dict):
        dataset = [dataset]

    summary = generate_summary(dataset)
    insights = generate_insights(dataset)

    result_payload = {
        "reply": f"{summary}\n\n{insights}",
        "chartType": None,
        "chartData": None
    }

    print("✅ /execute returning result:", result_payload)
    return result_payload


@ai_bp.route("/ai", methods=["POST"])
def ai_response():
    """
    Route to handle general AI conversation requests.
    Expects a JSON payload with a 'conversation_history' list containing at least one system message (dataset context).
    """
    try:
        data = request.json
        conversation_history = data.get("conversation_history")

        # Validate that conversation_history is provided and is a list
        if not conversation_history or not isinstance(conversation_history, list):
            return jsonify({"error": "Invalid request: conversation_history must be a non-empty list."}), 400

        # Validate that the conversation history contains a system message for dataset context
        dataset_message = next((msg for msg in conversation_history if msg.get("role") == "system"), None)
        if not dataset_message:
            return jsonify({"error": "Missing dataset context. AI requires a dataset to function."}), 400

        # ✅ Instantiate OpenAI client inside the request context
        client = OpenAI(api_key=current_app.config["OPENAI_API_KEY"])

        # ✅ Call OpenAI API using model/config from config.py
        completion = client.chat.completions.create(
            model=current_app.config["OPENAI_MODEL_NAME"],
            messages=conversation_history,
            **current_app.config["OPENAI_COMPLETION_CONFIG"]
        )

        # Ensure that the response contains at least one choice
        if not completion.choices or not hasattr(completion.choices[0], "message"):
            return jsonify({"error": "Invalid response from AI service."}), 500

        # Extract the reply from the first choice and append it to the conversation history
        reply = completion.choices[0].message.content
        conversation_history.append({"role": "assistant", "content": reply})

        return jsonify({"reply": reply, "conversation_history": conversation_history})

    except Exception as e:
        current_app.logger.error(f"Error in /ai: {str(e)}")
        return jsonify({"error": str(e)}), 500


@ai_bp.route("/ai_cmd", methods=["POST"])
def ai_command():
    """
    Route to handle AI commands.
    Expects a JSON payload with 'command' and 'dataset'.
    Supports special handling for the '/charts' command and uses registered commands for others.
    """
    try:
        data = request.json
        command = data.get("command")
        dataset = data.get("dataset")

        current_app.logger.debug(f"📥 Received request: {command}, dataset type: {type(dataset)}")

        # --- Dataset Parsing ---
        if isinstance(dataset, str):
            try:
                dataset = json.loads(dataset)
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid JSON string provided for dataset."}), 400

        if isinstance(dataset, dict):
            dataset = list(dataset.values())

        if not dataset or not isinstance(dataset, list):
            current_app.logger.debug("Invalid dataset format after conversion.")
            return jsonify({"error": "Invalid dataset provided. Expected a list."}), 400

        # ✅ Create OpenAI client inside request scope
        client = OpenAI(api_key=current_app.config["OPENAI_API_KEY"])

        # --- Handle /charts command ---
        if command == "/charts":
            prompt = textwrap.dedent(f"""\
            You are an AI assistant specializing in generating chart-ready data structures from raw datasets.

            Your task:
            - Analyze the sample dataset below.
            - Choose the best chart type: **"Bar Chart"**, **"Pie Chart"**, or **"Line Chart"**.
            - Aggregate or summarize the data to fit the chart type.
            - Output a valid JSON object (only JSON!) using the following exact schema:

            {{
            "chartType": "Bar Chart" | "Pie Chart" | "Line Chart",
            "xAxisLabel": "string",    // e.g. "Product Category"
            "yAxisLabel": "string",    // e.g. "Sales Total"
            "chartData": [
                {{ "label": "string", "value": number }},
                ...
            ]
            }}

            Rules:
            - Pull in the most relevant data specifically for the when the aireporter.jsx frontend ask for data in the ai report.
            - ✅ If the data is categorical → choose **Bar** or **Pie**.
            - ✅ If the data is time-series or continuous numeric → choose **Line**.
            - ❌ Do not fabricate values, labels, or categories.
            - ❌ Do not return markdown, comments, headings, or explanations — only pure JSON.

            Context:
            This chart will be used in a frontend charting tool and must be directly parseable.

            Dataset Sample:
            {json.dumps(dataset[:10], indent=2)}
            """)

            try:
                current_app.logger.debug("Sending request to OpenAI for chart recommendation...")
                completion = client.chat.completions.create(
                    model=current_app.config["OPENAI_MODEL_NAME"],
                    messages=[{"role": "system", "content": prompt}],
                    response_format={"type": "json_object"},
                    max_tokens=300
                )

                if not completion.choices or not hasattr(completion.choices[0], "message"):
                    return jsonify({"error": "Invalid response from AI service."}), 500

                ai_response_content = completion.choices[0].message.content
                current_app.logger.debug(f"✅ OpenAI Response: {ai_response_content}")

            except Exception as e:
                current_app.logger.error(f"❌ OpenAI API Error for /charts: {str(e)}")
                return jsonify({"error": "AI request failed"}), 500

            try:
                chart_data = json.loads(ai_response_content)
                structured_response = {
                    "chartType": chart_data.get("chartType", "Unknown"),
                    "chartData": chart_data.get("chartData", [])
                }
                return jsonify(structured_response)

            except json.JSONDecodeError:
                current_app.logger.error("❌ AI response could not be parsed as valid JSON.")
                return jsonify({"error": "AI response could not be parsed properly."}), 500

        # --- Handle custom registered commands ---
        if command in COMMANDS:
            prompt = COMMANDS[command](dataset)

            # Some commands may return full JSON response directly
            if isinstance(prompt, dict):
                return jsonify(prompt)

            completion = client.chat.completions.create(
                model=current_app.config["OPENAI_MODEL_NAME"],
                messages=[{"role": "system", "content": prompt}],
                max_tokens=300
            )

            if not completion.choices or not hasattr(completion.choices[0], "message"):
                return jsonify({"error": "Invalid response from AI service."}), 500

            return jsonify({"reply": completion.choices[0].message.content})

        return jsonify({"error": f"Unknown command: {command}"}), 400

    except Exception as e:
        current_app.logger.error(f"Error in /ai_cmd: {str(e)}")
        return jsonify({"error": str(e)}), 500
