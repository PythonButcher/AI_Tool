# backend/routes/natural_language_chart.py
from flask import Blueprint, request, jsonify
from backend.services.ai_logic_gemini import generate_chart_from_natural_language

natural_language_chart_bp = Blueprint('natural_language_chart_bp', __name__, url_prefix='/api')

@natural_language_chart_bp.route('/natural-language-chart', methods=['POST'])
def natural_language_chart():
    """
    Generates a chart configuration from a natural language query.
    """
    try:
        data = request.json
        query = data.get("query")

        if not query:
            return jsonify({"error": "Missing 'query' in request body."}), 400

        chart_config = generate_chart_from_natural_language(query)

        if "error" in chart_config:
            return jsonify(chart_config), 500

        return jsonify(chart_config), 200

    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500
