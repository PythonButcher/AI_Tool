import json
import re
import difflib
from collections import Counter, defaultdict
from datetime import datetime
from dateutil import parser as date_parser
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
            model="gpt-4.1",
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
                    model="gpt-4.1",
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
                    model="gpt-4.1",
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
                    model="gpt-4.1",
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
                model="gpt-4.1",
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


def _extract_dataset(dataset_obj):
    """Normalize incoming dataset payloads into a list of records."""
    if isinstance(dataset_obj, dict) and "data_preview" in dataset_obj:
        preview = dataset_obj["data_preview"]
        if isinstance(preview, str):
            try:
                return json.loads(preview)
            except json.JSONDecodeError:
                return []
        if isinstance(preview, list):
            return preview
    if isinstance(dataset_obj, list):
        return dataset_obj
    return []


def _safe_float(value):
    """Attempt to convert a value to float, returning None on failure."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return None
        cleaned = cleaned.replace(",", "")
        match = re.search(r"-?\d+(?:\.\d+)?", cleaned)
        if not match:
            return None
        try:
            return float(match.group())
        except ValueError:
            return None
    return None


def _is_temporal_column(name, values):
    lowered = name.lower()
    temporal_keywords = [
        "date",
        "time",
        "year",
        "month",
        "day",
        "week",
        "quarter",
        "timestamp",
    ]
    if any(keyword in lowered for keyword in temporal_keywords):
        return True
    parsed = 0
    total = 0
    for value in values[:50]:
        if value in (None, ""):
            continue
        total += 1
        try:
            date_parser.parse(str(value))
            parsed += 1
        except (ValueError, TypeError, OverflowError):
            continue
    return total > 0 and parsed / total >= 0.5


def _is_numeric_column(values):
    numeric = 0
    total = 0
    for value in values[:200]:
        if value in (None, ""):
            continue
        total += 1
        if _safe_float(value) is not None:
            numeric += 1
    return total > 0 and numeric / total >= 0.6


def _analyse_columns(dataset):
    if not dataset:
        return []
    columns = []
    sample_record = dataset[0]
    for name in sample_record.keys():
        values = [row.get(name) for row in dataset]
        if _is_temporal_column(name, values):
            inferred_type = "temporal"
        elif _is_numeric_column(values):
            inferred_type = "numeric"
        else:
            inferred_type = "categorical"
        columns.append(
            {
                "name": name,
                "type": inferred_type,
                "values": values,
            }
        )
    return columns


def _detect_visual_intent(query):
    lowered = query.lower()
    visual_keywords = [
        "plot",
        "chart",
        "graph",
        "visualize",
        "visualise",
        "show",
        "display",
        "trend",
        "over time",
        "distribution",
        "breakdown",
        "compare",
    ]
    if any(keyword in lowered for keyword in visual_keywords):
        return "visualize"
    if "filter" in lowered or "subset" in lowered:
        return "filter"
    if "average" in lowered or "sum" in lowered or "total" in lowered:
        return "summarize"
    return "chat"


def _tokenize_query(query):
    return re.findall(r"\b\w+\b", query.lower())


def _match_columns(query, columns):
    tokens = _tokenize_query(query)
    matched_scores = {}
    for column in columns:
        name = column["name"]
        lowered_name = name.lower()
        score = 0.0
        if lowered_name in query.lower():
            score += 5.0
        for token in tokens:
            if token in lowered_name:
                score += 2.0
            else:
                similarity = difflib.SequenceMatcher(None, token, lowered_name).ratio()
                if similarity >= 0.75:
                    score += similarity
        matched_scores[name] = score
    return matched_scores


def _select_fields(query, columns):
    matches = _match_columns(query, columns)
    numeric_columns = [c for c in columns if c["type"] == "numeric"]
    categorical_columns = [c for c in columns if c["type"] == "categorical"]
    temporal_columns = [c for c in columns if c["type"] == "temporal"]

    def _sorted_subset(columns_subset):
        return sorted(
            columns_subset,
            key=lambda col: (matches.get(col["name"], 0), col["name"]),
            reverse=True,
        )

    sorted_numeric = _sorted_subset(numeric_columns)
    sorted_categorical = _sorted_subset(categorical_columns)
    sorted_temporal = _sorted_subset(temporal_columns)

    best_numeric = sorted_numeric[0]["name"] if sorted_numeric else None
    secondary_numeric = sorted_numeric[1]["name"] if len(sorted_numeric) > 1 else None
    best_categorical = sorted_categorical[0]["name"] if sorted_categorical else None
    best_temporal = sorted_temporal[0]["name"] if sorted_temporal else None

    tokens = _tokenize_query(query)
    if "by" in tokens:
        by_index = tokens.index("by")
        if by_index + 1 < len(tokens):
            target = tokens[by_index + 1]
            for column in categorical_columns:
                if target in column["name"].lower():
                    best_categorical = column["name"]
                    break

    if any(token in {"vs", "versus", "against"} for token in tokens) and secondary_numeric:
        # Encourage keeping two numeric fields for scatter-style questions
        pass

    return {
        "value": best_numeric,
        "secondary_value": secondary_numeric,
        "category": best_categorical,
        "time": best_temporal,
        "matches": matches,
    }


def _choose_chart_type(query, fields):
    lowered = query.lower()
    if "scatter" in lowered and fields.get("value") and fields.get("secondary_value"):
        return "Scatter"
    if "pie" in lowered or "share" in lowered or "percentage" in lowered:
        return "Pie"
    if "doughnut" in lowered:
        return "Doughnut"
    if "trend" in lowered or "over time" in lowered or "timeline" in lowered:
        return "Line"
    if fields.get("time"):
        return "Line"
    if "distribution" in lowered:
        return "Bar"
    if (
        "compare" in lowered
        or "comparison" in lowered
        or "versus" in lowered
        or "vs" in lowered
    ) and fields.get("secondary_value"):
        return "Scatter"
    if "compare" in lowered or "comparison" in lowered or "versus" in lowered or "vs" in lowered:
        return "Bar"
    return "Bar"


def _format_time_value(value):
    if value in (None, ""):
        return None, None
    if isinstance(value, (int, float)):
        return str(value), float(value)
    text = str(value).strip()
    if not text:
        return None, None
    try:
        parsed = date_parser.parse(text)
        return parsed.strftime("%Y-%m-%d"), parsed
    except (ValueError, TypeError, OverflowError):
        return text, text.lower()


def _limit_categories(category_totals, limit=10):
    if len(category_totals) <= limit:
        return list(category_totals.keys())
    most_common = Counter(category_totals).most_common(limit)
    return [item[0] for item in most_common]


def _build_chart_data(chart_type, dataset, fields):
    value_field = fields.get("value")
    secondary_value = fields.get("secondary_value")
    category_field = fields.get("category")
    time_field = fields.get("time")

    if not dataset:
        return None, "No data available to build a chart."

    explanation_parts = []

    if chart_type == "Scatter" and value_field and secondary_value:
        explanation_parts.append(
            f"{secondary_value} versus {value_field}"
        )
        points = []
        for row in dataset:
            x_val = _safe_float(row.get(value_field))
            y_val = _safe_float(row.get(secondary_value))
            if x_val is None or y_val is None:
                continue
            points.append({"x": x_val, "y": y_val})

        if not points:
            return None, "Not enough numeric values to build a scatter plot."

        chart_data = {
            "labels": [],
            "datasets": [
                {
                    "label": f"{secondary_value} vs {value_field}",
                    "data": points,
                    "backgroundColor": "rgba(75, 192, 192, 0.6)",
                    "pointRadius": 4,
                    "showLine": False,
                }
            ],
        }
        return chart_data, ", ".join(explanation_parts)

    if chart_type == "Line" and time_field:
        explanation_parts.append(f"trends in {value_field or 'records'} over {time_field}")
        time_buckets = {}
        category_totals = defaultdict(float)
        for row in dataset:
            label, sort_key = _format_time_value(row.get(time_field))
            if label is None:
                continue
            if label not in time_buckets:
                time_buckets[label] = {"sort": sort_key, "values": defaultdict(float)}
            if category_field:
                category_value = row.get(category_field, "Other")
                if value_field:
                    numeric = _safe_float(row.get(value_field))
                    if numeric is not None:
                        time_buckets[label]["values"][category_value] += numeric
                        category_totals[category_value] += numeric
                else:
                    time_buckets[label]["values"][category_value] += 1
                    category_totals[category_value] += 1
            else:
                if value_field:
                    numeric = _safe_float(row.get(value_field))
                    if numeric is not None:
                        time_buckets[label]["values"]["Value"] += numeric
                else:
                    time_buckets[label]["values"]["Count"] += 1

        sorted_labels = sorted(
            time_buckets.keys(),
            key=lambda lbl: (0 if isinstance(time_buckets[lbl]["sort"], datetime) else 1, time_buckets[lbl]["sort"]),
        )

        if not sorted_labels:
            return None, "Unable to interpret the requested time field."

        if category_field:
            limited_categories = _limit_categories(category_totals) if category_totals else []
            if not limited_categories:
                limited_categories = [
                    next(
                        iter(time_buckets[sorted_labels[0]]["values"].keys()),
                        "Value",
                    )
                ]
        else:
            limited_categories = [
                next(iter(time_buckets[sorted_labels[0]]["values"].keys()), "Value")
            ]

        datasets = []
        for category in limited_categories:
            datasets.append(
                {
                    "label": str(category),
                    "data": [time_buckets[label]["values"].get(category, 0) for label in sorted_labels],
                    "tension": 0.3,
                    "fill": False,
                }
            )

        chart_data = {"labels": sorted_labels, "datasets": datasets}
        return chart_data, ", ".join(explanation_parts)

    if chart_type in {"Pie", "Doughnut"} and category_field:
        explanation_parts.append(f"the share of {value_field or 'records'} by {category_field}")
        totals = defaultdict(float)
        for row in dataset:
            category_value = row.get(category_field, "Other")
            if value_field:
                numeric = _safe_float(row.get(value_field))
                if numeric is None:
                    continue
                totals[category_value] += numeric
            else:
                totals[category_value] += 1

        if not totals:
            return None, "No measurable values found for the requested fields."

        labels = _limit_categories(totals)
        chart_data = {
            "labels": [str(label) for label in labels],
            "datasets": [
                {
                    "label": value_field or "Count",
                    "data": [totals[label] for label in labels],
                }
            ],
        }
        return chart_data, ", ".join(explanation_parts)

    # Default to Bar chart logic
    explanation_parts.append(
        f"{value_field or 'record counts'} by {category_field or (time_field or 'observations')}"
    )

    if category_field:
        totals = defaultdict(float)
        for row in dataset:
            category_value = row.get(category_field, "Other")
            if value_field:
                numeric = _safe_float(row.get(value_field))
                if numeric is None:
                    continue
                totals[category_value] += numeric
            else:
                totals[category_value] += 1
        if not totals:
            return None, "No measurable values found for the requested fields."
        labels = _limit_categories(totals)
        data_values = [totals[label] for label in labels]
        chart_data = {
            "labels": [str(label) for label in labels],
            "datasets": [
                {
                    "label": value_field or "Count",
                    "data": data_values,
                }
            ],
        }
        return chart_data, ", ".join(explanation_parts)

    if time_field:
        buckets = defaultdict(float)
        for row in dataset:
            label, sort_key = _format_time_value(row.get(time_field))
            if label is None:
                continue
            value = 1 if value_field is None else _safe_float(row.get(value_field)) or 0
            buckets[label] += value
        if not buckets:
            return None, "Unable to build a chart with the requested fields."
        sorted_labels = sorted(
            buckets.keys(),
            key=lambda lbl: (0 if isinstance(_format_time_value(lbl)[1], datetime) else 1, _format_time_value(lbl)[1]),
        )
        chart_data = {
            "labels": sorted_labels,
            "datasets": [
                {
                    "label": value_field or "Count",
                    "data": [buckets[label] for label in sorted_labels],
                }
            ],
        }
        return chart_data, ", ".join(explanation_parts)

    # Histogram fallback for numeric-only queries
    if value_field:
        values = [
            _safe_float(row.get(value_field))
            for row in dataset
            if _safe_float(row.get(value_field)) is not None
        ]
        if not values:
            return None, "No numeric values available for the requested field."
        values.sort()
        bins = min(10, max(3, int(len(values) ** 0.5)))
        min_val, max_val = values[0], values[-1]
        if min_val == max_val:
            labels = [str(min_val)]
            frequencies = [len(values)]
        else:
            step = (max_val - min_val) / bins
            edges = [min_val + i * step for i in range(bins + 1)]
            frequencies = [0] * bins
            for value in values:
                index = min(int((value - min_val) / step), bins - 1)
                frequencies[index] += 1
            labels = [f"{round(edges[i], 2)}–{round(edges[i + 1], 2)}" for i in range(bins)]
        chart_data = {
            "labels": labels,
            "datasets": [
                {
                    "label": value_field,
                    "data": frequencies,
                }
            ],
        }
        explanation_parts = [f"distribution of {value_field}"]
        return chart_data, ", ".join(explanation_parts)

    return None, "Unable to determine appropriate fields for charting."


@ai_bp.route("/ai_nl_chart", methods=["POST"])
def ai_nl_chart():
    try:
        payload = request.json or {}
        query = payload.get("query", "").strip()
        dataset_obj = payload.get("dataset")

        if not query:
            return jsonify({"error": "A natural language query is required."}), 400

        dataset = _extract_dataset(dataset_obj)
        if not dataset or not isinstance(dataset, list):
            return jsonify({"error": "A valid dataset is required to build a chart."}), 400

        columns = _analyse_columns(dataset)
        if not columns:
            return jsonify({"error": "Unable to inspect dataset columns."}), 400

        intent = _detect_visual_intent(query)
        fields = _select_fields(query, columns)
        chart_type = _choose_chart_type(query, fields)
        chart_data, explanation = _build_chart_data(chart_type, dataset, fields)

        if chart_data is None:
            return jsonify({
                "intent": intent,
                "error": explanation or "Could not generate a chart for the given request.",
            }), 422

        readable_fields = {
            key: value for key, value in fields.items() if key != "matches"
        }

        if explanation:
            message = f"Here is a {chart_type.lower()} chart showing {explanation}."
        else:
            message = f"Here is a {chart_type.lower()} chart derived from the dataset."

        return jsonify(
            {
                "intent": intent,
                "chartType": chart_type,
                "chartData": chart_data,
                "explanation": message,
                "fieldsUsed": readable_fields,
            }
        )

    except Exception as exc:
        current_app.logger.error("Error in /ai_nl_chart: %s", exc, exc_info=True)
        return jsonify({"error": f"Failed to generate chart: {exc}"}), 500
