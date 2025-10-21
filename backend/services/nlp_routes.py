"""Blueprint exposing deterministic NLP endpoints."""

from flask import Blueprint, current_app, jsonify, request

from .aichat_nlp import (
    NLP_QUERY_FORMAT,
    analyse_columns,
    build_chart_response,
    extract_dataset,
    interpret_nl_query,
)

nlp_bp = Blueprint("nlp_bp", __name__, url_prefix="/api/nlp")


@nlp_bp.route("/chart", methods=["POST"])
def generate_chart_from_nlp():
    """Generate deterministic charts from natural-language queries."""
    try:
        payload = request.get_json(silent=True) or {}
        query = (payload.get("query") or "").strip()
        dataset_obj = payload.get("dataset")

        if not query:
            return jsonify({
                "error": "A natural language query is required.",
                "usageFormat": NLP_QUERY_FORMAT,
            }), 400

        dataset = extract_dataset(dataset_obj)
        if not dataset:
            return jsonify({
                "error": "A valid dataset is required to build a chart.",
                "usageFormat": NLP_QUERY_FORMAT,
            }), 400

        current_app.logger.debug("Received dataset with %d rows for NLP chart request.", len(dataset))

        columns = analyse_columns(dataset)
        if not columns:
            return jsonify({
                "error": "Unable to inspect dataset columns.",
                "usageFormat": NLP_QUERY_FORMAT,
            }), 400

        interpretation = interpret_nl_query(query, columns)
        fields = interpretation.get("fields") or {}
        current_app.logger.debug(
            "Interpreted fields for NLP chart - value: %s, category: %s, time: %s",
            fields.get("value"),
            fields.get("category"),
            fields.get("time"),
        )

        chart_response = build_chart_response(dataset, interpretation)
        chart_data = chart_response.get("chartData") or {}
        chart_type = chart_response.get("chartType") or interpretation.get("chart_type", "Bar")
        meta = chart_response.get("meta") or {}

        datasets = chart_data.get("datasets")
        if not datasets:
            return jsonify({
                "intent": interpretation.get("intent"),
                "error": "Could not generate a chart for the given request.",
                "fieldsUsed": {k: v for k, v in fields.items() if v},
                "fieldMatches": interpretation.get("matchDetails", []),
                "filtersApplied": interpretation.get("filters", []),
                "usageFormat": NLP_QUERY_FORMAT,
            }), 422

        explanation_bits = []
        if fields.get("value") and fields.get("category"):
            explanation_bits.append(f"{fields['value']} by {fields['category']}")
        if fields.get("value") and fields.get("time"):
            explanation_bits.append(f"{fields['value']} over {fields['time']}")
        explanation_text = explanation_bits[0] if explanation_bits else None

        message = (
            f"Here is a {chart_type.lower()} chart showing {explanation_text}."
            if explanation_text
            else f"Here is a {chart_type.lower()} chart derived from the dataset."
        )

        chart_payload = {
            **chart_data,
            "meta": meta,
        }

        return jsonify({
            "intent": interpretation.get("intent"),
            "chartType": chart_type,
            "chartData": chart_payload,
            "explanation": message,
            "fieldsUsed": {k: v for k, v in fields.items() if v},
            "fieldMatches": interpretation.get("matchDetails", []),
            "filtersApplied": interpretation.get("filters", []),
            "usageFormat": NLP_QUERY_FORMAT,
        })

    except Exception as exc:
        current_app.logger.error("Error in /api/nlp/chart: %s", exc, exc_info=True)
        return jsonify({
            "error": f"Failed to generate chart: {exc}",
            "usageFormat": NLP_QUERY_FORMAT,
        }), 500
