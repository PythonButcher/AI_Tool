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

@register_command("/clean")
def generate_cleaned_data(dataset):
    return f"Clean this dataset. Handle missing values, correct data types, and remove duplicates. Return the cleaned dataset as a JSON object:\n\n{json.dumps(dataset[:20], indent=2)}"

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
            model="gpt-5-nano",
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
    Supports special handling for '/charts' and '/clean' commands, and uses registered commands for others.
    """
    try:
        data = request.json
        command = data.get("command")
        dataset_obj = data.get("dataset") # Rename to avoid confusion

        # --- Data Extraction ---
        # The frontend sends a complex object. The actual data is in 'data_preview', which is a JSON string.
        if isinstance(dataset_obj, dict) and 'data_preview' in dataset_obj:
            try:
                # Parse the JSON string from data_preview to get the list of records
                dataset = json.loads(dataset_obj['data_preview'])
            except (json.JSONDecodeError, TypeError):
                current_app.logger.error(f"Failed to parse 'data_preview' from dataset object.")
                return jsonify({"error": "Invalid 'data_preview' format in the dataset."}), 400
        else:
            # Fallback for simpler dataset structures, though the primary path is above.
            dataset = dataset_obj

        # --- Dataset Validation ---
        if not isinstance(dataset, list) or not dataset:
            current_app.logger.error(f"Invalid dataset format after extraction. Expected a non-empty list, but got {type(dataset)}.")
            return jsonify({"error": "Dataset could not be processed into a valid list of records."}), 400

        # --- Command Handling ---

        # Special handling for the '/charts' command
        if command == "/charts":
            prompt = textwrap.dedent(f"""
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
            """)

            try:
                current_app.logger.debug("Sending request to OpenAI for chart recommendation...")
                completion = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "system", "content": prompt}],
                    response_format={"type": "json_object"},
                    max_tokens=1024 # Increased for safety
                )
                if not completion.choices or not hasattr(completion.choices[0], "message"):
                    return jsonify({"error": "Invalid response from AI service."}), 500

                ai_response_content = completion.choices[0].message.content
                current_app.logger.debug(f"✅ OpenAI Response for /charts: {ai_response_content}")

                chart_data = json.loads(ai_response_content)
                structured_response = {
                    "chartType": chart_data.get("chartType", "Unknown"),
                    "chartData": chart_data.get("chartData", [])
                }
                return jsonify(structured_response)

            except json.JSONDecodeError:
                current_app.logger.error(f"❌ AI response for /charts could not be parsed as valid JSON. Raw: {ai_response_content}")
                return jsonify({"error": "AI response for /charts could not be parsed properly."}), 500
            except Exception as e:
                current_app.logger.error(f"❌ OpenAI API Error for /charts: {str(e)}")
                return jsonify({"error": "AI request failed for /charts"}), 500

        elif command == "/clean":
            instructions = data.get("instructions")

            if not instructions:
                # Step 1: provide cleaning suggestions
                prompt = textwrap.dedent(
                    f"""
                    Analyze the dataset sample below and list potential cleaning operations.
                    Mention columns with missing values, possible type conversions, or outliers.
                    Provide the suggestions in a short bullet list.

                    Dataset sample:
                    {json.dumps(dataset[:20], indent=2)}
                    """
                )

                completion = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "system", "content": prompt}],
                    max_tokens=300
                )

                if not completion.choices or not hasattr(completion.choices[0], "message"):
                    return jsonify({"error": "Invalid response from AI service for /clean suggestions."}), 500

                suggestions = completion.choices[0].message.content
                return jsonify({"suggestions": suggestions})

            # Step 2: apply cleaning based on user instructions
            prompt = textwrap.dedent(
                f"""
                Clean the dataset according to these instructions: {instructions}
                Return ONLY the cleaned dataset as a JSON array of objects.

                Dataset sample:
                {json.dumps(dataset[:20], indent=2)}
                """
            )

            try:
                current_app.logger.debug("🧠 Sending request to OpenAI for data cleaning (JSON mode)...")
                completion = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "system", "content": prompt}],
                    response_format={"type": "json_object"},
                    max_tokens=4096
                )

                if not completion.choices or not hasattr(completion.choices[0], "message"):
                    return jsonify({"error": "Invalid response from AI service for /clean."}), 500

                ai_response_content = completion.choices[0].message.content
                current_app.logger.debug(f"✅ OpenAI Raw JSON Response for /clean: {ai_response_content}")

                parsed_json = json.loads(ai_response_content)
                cleaned_data = parsed_json.get("cleaned_data", parsed_json)

                if not isinstance(cleaned_data, list):
                    current_app.logger.error(f"❌ Cleaned data is not a list after parsing: {cleaned_data}")
                    raise TypeError("The cleaned data from the AI was not in the expected list format.")

                return jsonify({"cleaned_data": cleaned_data})

            except (json.JSONDecodeError, TypeError) as err:
                current_app.logger.error(
                    f"❌ OpenAI response for /clean could not be parsed as valid JSON. Error: {err}. Raw: '{ai_response_content}'"
                )
                return jsonify({
                    "error": "AI response for /clean could not be parsed into the expected format.",
                    "raw_response": ai_response_content
                }), 500
            except Exception as e:
                current_app.logger.error(f"❌ OpenAI API Error for /clean: {str(e)}", exc_info=True)
                return jsonify({"error": f"AI request failed for /clean: {str(e)}"}), 500

        # Use the COMMANDS dictionary for handling other commands
        elif command in COMMANDS:
            prompt = COMMANDS[command](dataset)
            
            if isinstance(prompt, dict): # For commands like /execute that return a full payload
                return jsonify(prompt)

            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "system", "content": prompt}],
                max_tokens=300
            )
            if not completion.choices or not hasattr(completion.choices[0], "message"):
                return jsonify({"error": "Invalid response from AI service."}), 500

            return jsonify({"reply": completion.choices[0].message.content})

        else:
            return jsonify({"error": f"Unknown command: {command}"}), 400

    except Exception as e:
        current_app.logger.error(f"Error in /ai_cmd: {str(e)}", exc_info=True)
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500
