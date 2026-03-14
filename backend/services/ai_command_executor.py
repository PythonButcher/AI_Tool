import json
import logging
import os
import textwrap
from typing import Any, Dict, List, Optional

from openai import OpenAI


api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY is not set in the environment variables.")

client = OpenAI(api_key=api_key)
logger = logging.getLogger(__name__)

COMMANDS = {}


def register_command(command_name):
    def decorator(func):
        COMMANDS[command_name] = func
        return func

    return decorator


def normalize_dataset(dataset_obj: Any) -> List[Dict[str, Any]]:
    if isinstance(dataset_obj, dict) and "data_preview" in dataset_obj:
        preview = dataset_obj.get("data_preview")
        if isinstance(preview, list):
            return preview
        if isinstance(preview, str):
            try:
                parsed_preview = json.loads(preview)
                return parsed_preview if isinstance(parsed_preview, list) else []
            except (json.JSONDecodeError, TypeError):
                logger.error("Failed to parse dataset data_preview value.")
                return []

    if isinstance(dataset_obj, list):
        return dataset_obj

    if isinstance(dataset_obj, dict):
        for key in ("data", "rows", "records", "cleaned_data", "full_data"):
            candidate = dataset_obj.get(key)
            if isinstance(candidate, list):
                return candidate

    return []


def _append_node_guidance(prompt: str, node_params: Optional[Dict[str, Any]], execution_context: Optional[Dict[str, Any]]) -> str:
    guidance_parts = []

    if isinstance(node_params, dict):
        focus = node_params.get("focus")
        instructions = node_params.get("instructions")
        goal = node_params.get("goal")
        if focus:
            guidance_parts.append(f"Workflow guidance: {focus}")
        if goal:
            guidance_parts.append(f"Business goal: {goal}")
        if instructions:
            guidance_parts.append(f"Execution note: {instructions}")

    if execution_context:
        upstream_results = execution_context.get("upstream_results") or {}
        upstream_summaries = []
        for upstream_id, upstream_entry in upstream_results.items():
            result = upstream_entry.get("result") if isinstance(upstream_entry, dict) else None
            if not result:
                continue
            if isinstance(result, dict) and result.get("reply"):
                upstream_summaries.append(f"{upstream_id}: {result['reply']}")
        if upstream_summaries:
            guidance_parts.append(
                "Upstream workflow outputs:\n" + "\n".join(upstream_summaries[:3])
            )

    if not guidance_parts:
        return prompt

    return f"{prompt}\n\n" + "\n\n".join(guidance_parts)


@register_command("/summary")
def generate_summary(dataset, node_params=None, execution_context=None):
    prompt = (
        "Summarize this dataset. Give a concise, well-presented response:\n\n"
        f"{json.dumps(dataset[:20], indent=2)}"
    )
    return _append_node_guidance(prompt, node_params, execution_context)


@register_command("/insights")
def generate_insights(dataset, node_params=None, execution_context=None):
    prompt = (
        "Provide key insights from this dataset. Focus on business-readable findings:\n\n"
        f"{json.dumps(dataset[:10], indent=2)}"
    )
    return _append_node_guidance(prompt, node_params, execution_context)


@register_command("/outliers")
def generate_outliers(dataset, node_params=None, execution_context=None):
    sample = dataset[:25] if dataset else []
    prompt = textwrap.dedent(
        f"""
        You are an elite data analyst focused on anomaly detection.
        Review the dataset sample below and describe the most notable outliers or irregular patterns.

        Requirements:
        - Identify extreme numeric values, sudden spikes, or unusual trends.
        - Highlight rare categorical values or combinations that appear anomalous.
        - Call out any suspicious missing-data patterns or schema inconsistencies.
        - Explain why each item is unusual and what action a business analyst should consider next.

        Present the findings as a short, well-structured narrative with bullet points when useful.

        Dataset sample:
        {json.dumps(sample, indent=2)}
        """
    ).strip()
    return _append_node_guidance(prompt, node_params, execution_context)


@register_command("/clean")
def generate_cleaned_data(dataset, node_params=None, execution_context=None):
    prompt = (
        "Clean this dataset. Handle missing values, correct data types, and remove duplicates. "
        "Return the cleaned dataset as a JSON object:\n\n"
        f"{json.dumps(dataset[:20], indent=2)}"
    )
    return _append_node_guidance(prompt, node_params, execution_context)


@register_command("/execute")
def generate_execute(dataset, node_params=None, execution_context=None):
    summary = generate_summary(dataset, node_params=node_params, execution_context=execution_context)
    insights = generate_insights(dataset, node_params=node_params, execution_context=execution_context)
    return {
        "reply": f"{summary}\n\n{insights}",
        "chartType": None,
        "chartData": None,
    }


def _build_chart_prompt(dataset: List[Dict[str, Any]], node_params=None, execution_context=None) -> str:
    prompt = textwrap.dedent(
        f"""
        You are an AI assistant specialized in creating chart data structures.
        Analyze the following data sample and determine the single best chart type to visualize it.
        Then, based on that chart type, aggregate the data and return a JSON object containing both the chart type and the aggregated data.

        Data Sample:
        {json.dumps(dataset[:10], indent=2)}

        Instructions:
        1. Examine the data sample to understand its structure and potential relationships.
        2. Determine the most suitable chartType (for example \"Bar Chart\", \"Line Chart\", or \"Pie Chart\").
        3. Identify the appropriate column or columns for labels and values based on the chosen chartType.
        4. Perform the necessary aggregation directly from the provided data sample.
        5. Format the result strictly as a JSON object containing exactly two keys: \"chartType\" and \"chartData\".
        6. Each object within \"chartData\" must have exactly two keys: \"label\" and \"value\".

        Important: Your response must be only the raw JSON object.
        """
    ).strip()
    return _append_node_guidance(prompt, node_params, execution_context)


def _build_clean_suggestions_prompt(dataset: List[Dict[str, Any]], node_params=None, execution_context=None) -> str:
    prompt = textwrap.dedent(
        f"""
        Analyze the dataset sample below and list potential cleaning operations.
        Mention columns with missing values, possible type conversions, or outliers.
        Provide the suggestions in a short bullet list.

        Dataset sample:
        {json.dumps(dataset[:20], indent=2)}
        """
    ).strip()
    return _append_node_guidance(prompt, node_params, execution_context)


def _build_clean_apply_prompt(dataset: List[Dict[str, Any]], instructions: str, node_params=None, execution_context=None) -> str:
    prompt = textwrap.dedent(
        f"""
        Clean the dataset according to these instructions: {instructions}
        Return ONLY the cleaned dataset as a JSON object with a \"cleaned_data\" array.

        Dataset sample:
        {json.dumps(dataset[:20], indent=2)}
        """
    ).strip()
    return _append_node_guidance(prompt, node_params, execution_context)


def execute_ai_command(
    command: str,
    dataset_obj: Any,
    *,
    instructions: Optional[str] = None,
    node_params: Optional[Dict[str, Any]] = None,
    execution_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    dataset = normalize_dataset(dataset_obj)

    if not isinstance(dataset, list) or not dataset:
        raise ValueError("Dataset could not be processed into a valid list of records.")

    if command == "/charts":
        prompt = _build_chart_prompt(dataset, node_params=node_params, execution_context=execution_context)
        completion = client.chat.completions.create(
            model="gpt-4.1",
            messages=[{"role": "system", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=1024,
        )
        if not completion.choices or not hasattr(completion.choices[0], "message"):
            raise RuntimeError("Invalid response from AI service.")

        ai_response_content = completion.choices[0].message.content
        chart_data = json.loads(ai_response_content)
        return {
            "chartType": chart_data.get("chartType", "Unknown"),
            "chartData": chart_data.get("chartData", []),
        }

    if command == "/clean":
        clean_instructions = instructions or (node_params or {}).get("instructions")
        if not clean_instructions and execution_context and execution_context.get("mode") == "pipeline":
            clean_instructions = (
                "Handle missing values, normalize data types, and remove duplicates while preserving the dataset schema."
            )

        if not clean_instructions:
            prompt = _build_clean_suggestions_prompt(
                dataset,
                node_params=node_params,
                execution_context=execution_context,
            )
            completion = client.chat.completions.create(
                model="gpt-4.1",
                messages=[{"role": "system", "content": prompt}],
                max_tokens=300,
            )
            if not completion.choices or not hasattr(completion.choices[0], "message"):
                raise RuntimeError("Invalid response from AI service for /clean suggestions.")
            return {"suggestions": completion.choices[0].message.content}

        prompt = _build_clean_apply_prompt(
            dataset,
            clean_instructions,
            node_params=node_params,
            execution_context=execution_context,
        )
        completion = client.chat.completions.create(
            model="gpt-4.1",
            messages=[{"role": "system", "content": prompt}],
            response_format={"type": "json_object"},
            max_tokens=4096,
        )
        if not completion.choices or not hasattr(completion.choices[0], "message"):
            raise RuntimeError("Invalid response from AI service for /clean.")

        ai_response_content = completion.choices[0].message.content
        parsed_json = json.loads(ai_response_content)
        cleaned_data = parsed_json.get("cleaned_data", parsed_json)
        if not isinstance(cleaned_data, list):
            raise TypeError("The cleaned data from the AI was not in the expected list format.")
        return {"cleaned_data": cleaned_data}

    if command in COMMANDS:
        prompt_or_payload = COMMANDS[command](
            dataset,
            node_params=node_params,
            execution_context=execution_context,
        )

        if isinstance(prompt_or_payload, dict):
            return prompt_or_payload

        completion = client.chat.completions.create(
            model="gpt-4.1",
            messages=[{"role": "system", "content": prompt_or_payload}],
            max_tokens=300,
        )
        if not completion.choices or not hasattr(completion.choices[0], "message"):
            raise RuntimeError("Invalid response from AI service.")
        return {"reply": completion.choices[0].message.content}

    raise ValueError(f"Unknown command: {command}")
