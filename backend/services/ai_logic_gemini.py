import json
from flask import Blueprint, request, jsonify, current_app
import os
import textwrap  # For dedenting multi-line strings
import google.generativeai as genai # Import Google Generative AI library

# Configure the Google Generative AI library with API key from environment variable
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if not api_key:
    # Make sure the error message also reflects the correct variable name
    raise ValueError("Neither GEMINI_API_KEY nor GOOGLE_API_KEY is set in the environment variables.")
genai.configure(api_key=api_key)

# Define Flask Blueprint for AI-related routes
ai_gemini_bp = Blueprint("ai_gemini_bp", __name__)

# --- Model Configuration ---
# Choose a Gemini model. 'gemini-pro' is a widely available general-purpose model.
GEMINI_MODEL_NAME = 'gemini-2.0-flash'
# Generation configuration for Gemini (maps roughly to OpenAI parameters)
# Note: Direct equivalents for frequency_penalty/presence_penalty aren't standard.
# Safety settings can be added if needed.
GENERATION_CONFIG_CHAT = genai.types.GenerationConfig(
    max_output_tokens=500,
    temperature=0.7,
    top_p=1.0 # Gemini often uses top_p=1.0 by default when temperature is set
    # No direct frequency/presence penalty equivalents in standard config
)
GENERATION_CONFIG_CMD = genai.types.GenerationConfig(
    max_output_tokens=300,
    temperature=0.7 # Adjust as needed
)
GENERATION_CONFIG_JSON = genai.types.GenerationConfig(
    max_output_tokens=300, # Adjust token limit for JSON output if needed
    response_mime_type="application/json", # Request JSON output
    temperature=0.2 # Lower temperature often better for structured output
)

# Initialize the Generative Model
gemini_model = genai.GenerativeModel(GEMINI_MODEL_NAME)


# --- Command Handling (Unchanged) ---
COMMANDS = {}

def register_command(command_name):
    """Decorator to register a command dynamically."""
    def decorator(func):
        COMMANDS[command_name] = func
        return func
    return decorator

@register_command("/summary")
def generate_summary(dataset):
    return f"Summarize this dataset. Give a concise, well-presented response:\n\n{json.dumps(dataset[:20], indent=2)}"

@register_command("/insights")
def generate_insights(dataset):
    return f"Provide key insights from this dataset:\n\n{json.dumps(dataset[:10], indent=2)}"

@register_command("/clean")
def generate_cleaned_data(dataset):
    return f"Clean this dataset. Handle missing values, correct data types, and remove duplicates. Return the cleaned dataset as a JSON object:\n\n{json.dumps(dataset[:20], indent=2)}"

@register_command("/execute")
def generate_execute(_dataset=None):
    print("🚀 Backend: Execute command triggered")
    return "Execute command acknowledged (placeholder)" # This command seems to be a placeholder still


# --- Route Definitions ---

def map_openai_to_gemini_history(openai_history):
    """Converts OpenAI message history format to Gemini's content format."""
    gemini_history = []
    system_prompt = None
    for msg in openai_history:
        role = msg.get("role")
        content = msg.get("content")
        if not content:
            continue

        if role == "system":
            # Gemini doesn't have a distinct 'system' role in the same way for chat history.
            # Prepend system instructions to the first user message or handle separately if needed.
            # Here, we'll store it and potentially prepend it later if logic requires.
            # For generate_content, system instructions often go in the initial call.
            system_prompt = content # Store system prompt
            continue # Don't add system prompt directly to history

        gemini_role = "user" if role == "user" else "model" # Map 'assistant' to 'model'
        gemini_history.append({"role": gemini_role, "parts": [content]})

    # Clean up history: Remove consecutive messages from the same role (Gemini requires alternation)
    cleaned_history = []
    if gemini_history:
        cleaned_history.append(gemini_history[0])
        for i in range(1, len(gemini_history)):
            if gemini_history[i]['role'] != cleaned_history[-1]['role']:
                cleaned_history.append(gemini_history[i])
            else:
                # If consecutive messages from the same role, merge or log warning
                # For simplicity, we are just keeping the latest one here.
                # A better approach might merge the 'parts'.
                current_app.logger.warning(f"Consecutive '{gemini_history[i]['role']}' messages detected. Keeping the last one.")
                cleaned_history[-1] = gemini_history[i] # Replace previous with current

    return cleaned_history, system_prompt

@ai_gemini_bp.route("/ai", methods=["POST"])
def ai_response():
    """
    Route to handle general AI conversation requests using Gemini.
    Expects a JSON payload with 'conversation_history' (OpenAI format).
    """
    try:
        data = request.json
        openai_conversation_history = data.get("conversation_history")

        if not openai_conversation_history or not isinstance(openai_conversation_history, list):
            return jsonify({"error": "Invalid request: conversation_history must be a non-empty list."}), 400

        # Convert history and extract system prompt
        gemini_history, system_prompt_content = map_openai_to_gemini_history(openai_conversation_history)

        # Ensure there's some user input after potential system message filtering
        if not any(msg['role'] == 'user' for msg in gemini_history):
             # If only system messages were present, try using the last one as the user prompt
             if system_prompt_content and not gemini_history:
                 current_app.logger.warning("No user messages found, using system prompt as initial user query.")
                 gemini_history.append({"role": "user", "parts": [system_prompt_content]})
                 system_prompt_content = None # Clear system prompt as it's now the user query
             else:
                return jsonify({"error": "Missing user input in conversation history."}), 400


        # Initialize chat session with history and potential system instructions
        # Note: System instructions can be passed to GenerativeModel() or start_chat()
        # For simplicity, let's pass the history directly. If a system prompt existed,
        # it needs to be integrated correctly, often as the first part of the contents sent.
        # If complex system instructions are needed, consider `GenerativeModel(model_name, system_instruction=...)`
        chat = gemini_model.start_chat(history=gemini_history)

        # The last message in the *original* history is the user's current query.
        # However, our converted history `gemini_history` is what we send to `start_chat`.
        # The *next* message to send is the one we want the AI to respond to.
        # Since `start_chat` takes the history *up to* the latest user message,
        # we need to send the *content* of that last user message.
        last_user_message_content = None
        if openai_conversation_history and openai_conversation_history[-1].get("role") == "user":
             last_user_message_content = openai_conversation_history[-1].get("content")
        elif system_prompt_content and not gemini_history: # Case where only system prompt existed initially
             last_user_message_content = system_prompt_content
        else:
             # This case might indicate an issue with history structure or conversion
             current_app.logger.error("Could not determine the final user message to send to Gemini.")
             return jsonify({"error": "Internal error processing conversation history."}), 500


        if not last_user_message_content:
             return jsonify({"error": "Could not extract final user message content."}), 400


        # Send the last user message content to the chat
        # Combine system prompt with the first user message if applicable and not handled by history
        # This logic might need refinement based on how system prompts are intended
        prompt_to_send = last_user_message_content
        # Example: Prepend system prompt if it exists and this is effectively the *first* turn
        # if system_prompt_content and len(gemini_history) <= 1: # Check if it's the start
        #    prompt_to_send = f"{system_prompt_content}\n\nUser query: {last_user_message_content}"


        current_app.logger.debug(f"🧠 Sending to Gemini Chat: History Length={len(chat.history)}, Prompt='{prompt_to_send[:100]}...'")
        response = chat.send_message(prompt_to_send, generation_config=GENERATION_CONFIG_CHAT)

        # Check for issues in the response (e.g., blocked content)
        if not response.candidates:
             current_app.logger.error(f"Gemini response blocked or empty. Feedback: {response.prompt_feedback}")
             error_message = f"AI response blocked or unavailable. Reason: {response.prompt_feedback or 'Unknown'}"
             return jsonify({"error": error_message}), 500
        if not hasattr(response, 'text') or not response.text:
             current_app.logger.error(f"Invalid response structure from Gemini service: {response}")
             return jsonify({"error": "Invalid or empty response from AI service."}), 500


        reply = response.text
        current_app.logger.debug(f"✅ Gemini Chat Reply: '{reply[:100]}...'")

        # Append the AI's reply to the *original* OpenAI format history for consistency with frontend
        openai_conversation_history.append({"role": "assistant", "content": reply})

        return jsonify({"reply": reply, "conversation_history": openai_conversation_history})

    except Exception as e:
        current_app.logger.error(f"Error in /ai: {str(e)}", exc_info=True) # Log traceback
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500


@ai_gemini_bp.route("/ai_cmd", methods=["POST"])
def ai_command():
    """
    Route to handle AI commands using Gemini.
    Expects JSON payload with 'command' and 'dataset'.
    Supports '/charts' with JSON output and other registered commands.
    """
    try:
        data = request.json
        command = data.get("command")
        dataset = data.get("dataset")

        current_app.logger.debug(f"📥 Received command: {command}, dataset type: {type(dataset)}")

        # --- Dataset Handling (largely unchanged) ---
        if isinstance(dataset, str):
            try:
                dataset = json.loads(dataset)
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid JSON string provided for dataset."}), 400
        if isinstance(dataset, dict):
             # Attempt to convert dict values to a list if it seems appropriate
             # This might need adjustment depending on the expected dict structure
             if all(isinstance(v, (dict, list)) for v in dataset.values()):
                 dataset = list(dataset.values())
             else:
                 # If it's not a dict of records, maybe it's a single record?
                 current_app.logger.warning("Dataset was a dictionary, attempting to wrap in a list.")
                 dataset = [dataset] # Wrap the single dictionary in a list


        if not dataset or not isinstance(dataset, list) or not dataset:
             current_app.logger.error(f"Invalid dataset format after conversion for command {command}. Type: {type(dataset)}")
             return jsonify({"error": "Invalid or empty dataset provided. Expected a non-empty list of records."}), 400
        # --- End Dataset Handling ---


        # Special handling for '/charts' command
        if command == "/charts":
            # Prompt remains largely the same, emphasizing JSON output.
            # Gemini's JSON mode relies heavily on prompt instructions and the response_mime_type.
            prompt = textwrap.dedent(f"""\
You are an AI assistant specialized in data visualization.

            Analyze the following data sample and select the single best chart type—either "Bar Chart" or "Pie Chart"—to clearly visualize it. Do NOT choose other chart types.

            Then, perform the necessary aggregation on the provided sample data. Return ONLY a JSON object exactly structured as follows:

            {{
            "chartType": "Bar Chart" or "Pie Chart",
            "xAxisLabel": "string",  // Descriptive label for the X-axis or categories (e.g., "Product Categories", "Months")
            "yAxisLabel": "string",  // Descriptive label for the Y-axis or values (e.g., "Sales Count", "Frequency")
            "chartData": [
                {{ "label": "string", "value": number }},
                ...
            ]
            }}

            Use ONLY the provided data—do not fabricate additional categories or values.

            Data Sample:
            {json.dumps(dataset[:20], indent=None)}

            Example Response:
            {{
            "chartType": "Bar Chart",
            "xAxisLabel": "Product Category",
            "yAxisLabel": "Number of Sales",
            "chartData": [
                {{ "label": "Electronics", "value": 120 }},
                {{ "label": "Books", "value": 80 }},
                {{ "label": "Clothing", "value": 40 }}
            ]
            }}

            IMPORTANT:
            - Choose only "Bar Chart" or "Pie Chart".
            - Provide clear, concise, and meaningful labels for xAxisLabel and yAxisLabel.
            - Output only raw JSON—no explanations, comments, or markdown formatting.
            """)


            try:
                current_app.logger.debug("🧠 Sending request to Gemini for chart recommendation (JSON mode)...")
                # Use generate_content directly for single-turn command
                response = gemini_model.generate_content(
                    prompt,
                    generation_config=GENERATION_CONFIG_JSON # Use JSON specific config
                )

                # Validate Gemini response
                if not response.candidates:
                     current_app.logger.error(f"Gemini response blocked or empty for /charts. Feedback: {response.prompt_feedback}")
                     error_message = f"AI response blocked or unavailable. Reason: {response.prompt_feedback or 'Unknown'}"
                     return jsonify({"error": error_message}), 500
                if not hasattr(response, 'text') or not response.text:
                     current_app.logger.error(f"Invalid response structure from Gemini service for /charts: {response}")
                     return jsonify({"error": "Invalid or empty response from AI service."}), 500

                ai_response_content = response.text
                current_app.logger.debug(f"✅ Gemini Raw JSON Response: {ai_response_content}")

                # Parse the AI response (which should be a JSON string)
                chart_data = json.loads(ai_response_content)

                # Basic validation of the parsed structure
                if not isinstance(chart_data, dict) or "chartType" not in chart_data or "chartData" not in chart_data:
                     current_app.logger.error(f"❌ Parsed JSON is missing required keys: {chart_data}")
                     raise json.JSONDecodeError("Parsed JSON missing required keys.", ai_response_content, 0)
                if not isinstance(chart_data["chartData"], list):
                     current_app.logger.error(f"❌ chartData is not a list: {chart_data['chartData']}")
                     raise json.JSONDecodeError("chartData is not a list.", ai_response_content, 0)

                structured_response = {
                    "chartType": chart_data.get("chartType", "Unknown"),
                    "chartData": chart_data.get("chartData", [])
                }
                current_app.logger.debug(f"✅ Returning Parsed Chart Data: {structured_response}")
                return jsonify(structured_response)

            except json.JSONDecodeError as json_err:
                current_app.logger.error(f"❌ Gemini response for /charts could not be parsed as valid JSON matching schema. Error: {json_err}. Raw response: '{ai_response_content}'")
                # Include the raw response in the error for debugging
                return jsonify({
                    "error": "AI response could not be parsed properly or did not match expected JSON structure.",
                    "raw_response": ai_response_content # Send raw response back if parsing fails
                    }), 500
            except Exception as e:
                current_app.logger.error(f"❌ Gemini API Error for /charts: {str(e)}", exc_info=True)
                return jsonify({"error": f"AI request failed for /charts: {str(e)}"}), 500
        elif command == "/clean":
            instructions = data.get("instructions")

            if not instructions:
                prompt = textwrap.dedent(
                    f"""
                    Analyze the dataset sample below and suggest possible cleaning operations such as removing nulls, converting types, or dropping duplicates. Provide suggestions as a short bullet list.

                    Dataset sample:
                    {json.dumps(dataset[:20], indent=2)}
                    """
                )

                response = gemini_model.generate_content(
                    prompt,
                    generation_config=GENERATION_CONFIG_CMD
                )

                if not response.candidates or not hasattr(response, 'text') or not response.text:
                    current_app.logger.error(f"Invalid or empty response for /clean suggestions: {response}")
                    return jsonify({"error": "Invalid response from AI service for /clean suggestions."}), 500

                suggestions = response.text
                return jsonify({"suggestions": suggestions})

            prompt = textwrap.dedent(
                f"""
                Clean the dataset according to these instructions: {instructions}
                Return ONLY the cleaned dataset as a JSON array of objects.

                Dataset sample:
                {json.dumps(dataset[:20], indent=2)}
                """
            )

            try:
                current_app.logger.debug("🧠 Sending request to Gemini for data cleaning (JSON mode)...")
                response = gemini_model.generate_content(
                    prompt,
                    generation_config=GENERATION_CONFIG_JSON
                )

                if not response.candidates or not hasattr(response, 'text') or not response.text:
                    current_app.logger.error(f"Invalid response structure from Gemini service for /clean: {response}")
                    return jsonify({"error": "Invalid or empty response from AI service."}), 500

                ai_response_content = response.text
                current_app.logger.debug(f"✅ Gemini Raw JSON Response: {ai_response_content}")

                cleaned_data = json.loads(ai_response_content)

                if not isinstance(cleaned_data, list):
                    current_app.logger.error(f"❌ Cleaned data is not a list: {cleaned_data}")
                    raise json.JSONDecodeError("Cleaned data is not a list.", ai_response_content, 0)

                return jsonify({"cleaned_data": cleaned_data})

            except json.JSONDecodeError as json_err:
                current_app.logger.error(
                    f"❌ Gemini response for /clean could not be parsed as valid JSON. Error: {json_err}. Raw response: '{ai_response_content}'"
                )
                return jsonify({
                    "error": "AI response could not be parsed properly or did not match expected JSON structure.",
                    "raw_response": ai_response_content
                }), 500
            except Exception as e:
                current_app.logger.error(f"❌ Gemini API Error for /clean: {str(e)}", exc_info=True)
                return jsonify({"error": f"AI request failed for /clean: {str(e)}"}), 500

        # Use the COMMANDS dictionary for handling other registered commands
        elif command in COMMANDS:
            # Handle placeholder command explicitly if needed
            if command == "/execute":
                 reply_content = COMMANDS[command](dataset) # Call the function
                 return jsonify({"reply": reply_content })

            # For other commands like /summary, /insights
            prompt = COMMANDS[command](dataset) # Get prompt from registered function

            try:
                 current_app.logger.debug(f"🧠 Sending command '{command}' prompt to Gemini...")
                 response = gemini_model.generate_content(
                     prompt,
                     generation_config=GENERATION_CONFIG_CMD # Use standard command config
                 )

                 # Validate Gemini response
                 if not response.candidates:
                     current_app.logger.error(f"Gemini response blocked or empty for {command}. Feedback: {response.prompt_feedback}")
                     error_message = f"AI response blocked or unavailable. Reason: {response.prompt_feedback or 'Unknown'}"
                     return jsonify({"error": error_message}), 500
                 if not hasattr(response, 'text') or not response.text:
                     current_app.logger.error(f"Invalid response structure from Gemini service for {command}: {response}")
                     return jsonify({"error": "Invalid or empty response from AI service."}), 500

                 reply = response.text
                 current_app.logger.debug(f"✅ Gemini Command Reply for {command}: '{reply[:100]}...'")
                 return jsonify({"reply": reply})

            except Exception as e:
                 current_app.logger.error(f"❌ Gemini API Error for command {command}: {str(e)}", exc_info=True)
                 return jsonify({"error": f"AI request failed for command {command}: {str(e)}"}), 500

        else:
            # Command not found in registered commands or special cases
            return jsonify({"error": f"Unknown command: {command}"}), 400

    except Exception as e:
        # Catch-all for unexpected errors during request processing
        current_app.logger.error(f"Error in /ai_cmd: {str(e)}", exc_info=True)
        return jsonify({"error": f"An unexpected error occurred processing the command: {str(e)}"}), 500