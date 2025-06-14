import json
from flask import Blueprint, request, jsonify, current_app
import os
import textwrap  # For dedenting multi-line strings
from openai import OpenAI

# Initialize OpenAI client with API key from environment variable
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY is not set in the environment variables.")
client = OpenAI(api_key=api_key)

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

        # Call OpenAI API with the conversation history as messages
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=conversation_history,
            max_tokens=500,
            temperature=0.7,
            top_p=1,
            frequency_penalty=0.5,
            presence_penalty=0.6
        )

        # Ensure that the response contains at least one choice
        if not completion.choices or not hasattr(completion.choices[0], "message"):
            return jsonify({"error": "Invalid response from AI service."}), 500

        # Extract the reply from the first choice and append it to the conversation history
        reply = completion.choices[0].message.content
        conversation_history.append({"role": "assistant", "content": reply})

        return jsonify({"reply": reply, "conversation_history": conversation_history})

    except Exception as e:
        # Log error details for debugging purposes (consider using current_app.logger)
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

        # Debug log: show received command and dataset type
        current_app.logger.debug(f"📥 Received request: {command}, dataset type: {type(dataset)}")

        # Convert dataset to list if provided as a JSON string or a dict
        if isinstance(dataset, str):
            try:
                dataset = json.loads(dataset)
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid JSON string provided for dataset."}), 400

        if isinstance(dataset, dict):
            dataset = list(dataset.values())

        # Validate that dataset is a non-empty list after conversion
        if not dataset or not isinstance(dataset, list):
            current_app.logger.debug("Invalid dataset format after conversion.")
            return jsonify({"error": "Invalid dataset provided. Expected a list."}), 400

        # Special handling for the '/charts' command
        if command == "/charts":
            # Refined prompt focusing on clarity for the combined task
            # Assume 'dataset' here is the sample (e.g., first 10 rows) passed in the request
            prompt = textwrap.dedent(f"""\
            You are an AI assistant specialized in creating chart data structures.
            Analyze the following data sample and determine the single best chart type to visualize it.
            Then, based on that chart type, aggregate the data and return a JSON object containing both the chart type and the aggregated data.

            Data Sample:
            {json.dumps(dataset[:10], indent=2)}

            Instructions:
            1.  Examine the data sample to understand its structure and potential relationships.
            2.  Determine the most suitable `chartType` (e.g., "Bar Chart", "Line Chart", "Pie Chart") for visualizing this data sample effectively.
            3.  Identify the appropriate column(s) for labels and values based on the chosen `chartType`.
            4.  Perform the necessary aggregation (e.g., count frequencies for categories, sum values if appropriate) directly from the provided data sample.
            5.  Format the result STRICTLY as a JSON object containing exactly two keys: "chartType" (string) and "chartData" (an array of objects).
            6.  Each object within the "chartData" array must have exactly two keys: "label" (string) and "value" (number).

            Required JSON Output Structure:
            {{
            "chartType": "string",
            "chartData": [
                {{
                "label": "string",
                "value": number
                }},
                // ... more data objects if needed
            ]
            }}

            Example of a valid JSON response:
            {{
            "chartType": "Pie Chart",
            "chartData": [
                {{ "label": "Electronics", "value": 5 }},
                {{ "label": "Clothing", "value": 3 }},
                {{ "label": "Groceries", "value": 2 }}
            ]
            }}

            Important: Your response MUST be ONLY the raw JSON object. Do not include any introductory text, explanations, apologies, comments, or markdown formatting like ```json.
            """) # Removed "CRITICAL:" prefix

            try:
                current_app.logger.debug(f"📥 Received /charts request: dataset type: {type(dataset)}")
                current_app.logger.debug("Sending request to OpenAI for chart recommendation...")
                completion = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "system", "content": prompt}],
                    response_format={"type": "json_object"},  # Ensures JSON output if supported
                    max_tokens=300
                )
                # Validate API response
                if not completion.choices or not hasattr(completion.choices[0], "message"):
                    return jsonify({"error": "Invalid response from AI service."}), 500

                ai_response_content = completion.choices[0].message.content
                current_app.logger.debug(f"✅ OpenAI Response: {ai_response_content}")

            except Exception as e:
                current_app.logger.error(f"❌ OpenAI API Error for /charts: {str(e)}")
                return jsonify({"error": "AI request failed"}), 500

            try:
                # Parse the AI response to a JSON object
                chart_data = json.loads(ai_response_content)
                structured_response = {
                    "chartType": chart_data.get("chartType", "Unknown"),  # Provide default value if missing
                    "chartData": chart_data.get("chartData", [])
                }
                current_app.logger.debug(f"✅ Returning Chart Data: {structured_response}")
                return jsonify(structured_response)
            except json.JSONDecodeError:
                current_app.logger.error("❌ AI response could not be parsed as valid JSON.")
                return jsonify({"error": "AI response could not be parsed properly."}), 500

        # Use the COMMANDS dictionary for handling other commands
        if command in COMMANDS:
            prompt = COMMANDS[command](dataset)
            print(f"📦 Payload from `{command}` command:", prompt)

            # ✅ If the handler returned a full response dict, return it now
            if isinstance(prompt, dict):
                return jsonify(prompt)
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "system", "content": prompt}],
                max_tokens=300
            )
            # Validate response before returning
            if not completion.choices or not hasattr(completion.choices[0], "message"):
                return jsonify({"error": "Invalid response from AI service."}), 500

            return jsonify({"reply": completion.choices[0].message.content})

        return jsonify({"error": f"Unknown command: {command}"}), 400

    except Exception as e:
        current_app.logger.error(f"Error in /ai_cmd: {str(e)}")
        return jsonify({"error": str(e)}), 500
