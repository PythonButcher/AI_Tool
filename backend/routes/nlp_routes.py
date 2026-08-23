"""Blueprint exposing deterministic NLP endpoints."""

from flask import Blueprint, current_app, jsonify, request
import pandas as pd

from backend.services.data_catalog_lineage import (
    GovernancePolicyError,
    evaluate_dataset_readiness,
    governance_error_payload,
    is_blocked,
)
from backend.services.aichat_nlp import (
    ChartBuildError,
    NLP_QUERY_FORMAT,
    analyse_columns,
    build_chart_response,
    extract_dataset,
    interpret_nl_query,
)
from backend.services.dataset_context import resolve_analysis_dataset_bundle
from backend.services.relationship_execution import RelationshipExecutionError

nlp_bp = Blueprint("nlp_bp", __name__, url_prefix="/api/nlp")


@nlp_bp.route("/chart", methods=["POST"])
def generate_chart_from_nlp():
    """Generate deterministic charts from natural-language queries."""
    try:
        payload = request.get_json(silent=True) or {}
        query = (payload.get("query") or "").strip()
        dataset_obj = payload.get("dataset")
        analysis_context = payload.get("analysis_context") or payload.get("analysisContext")
        analysis_lineage = None
        resolved_governance = None

        if not query:
            return jsonify({
                "error": "A natural language query is required.",
                "usageFormat": NLP_QUERY_FORMAT,
            }), 400

        if isinstance(analysis_context, dict):
            try:
                bundle = resolve_analysis_dataset_bundle(analysis_context)
            except RelationshipExecutionError as exc:
                status_code = 422 if exc.code in {
                    "many_to_many_execution_unsupported",
                    "row_expansion_limit_exceeded",
                    "multi_source_governance_blocked",
                } else 409
                return jsonify({
                    "error": {"code": exc.code, "message": str(exc)},
                    "diagnostics": exc.diagnostics,
                    "usageFormat": NLP_QUERY_FORMAT,
                }), status_code
            dataset = bundle["dataframe"].to_dict(orient="records")
            analysis_context = bundle.get("analysis_context")
            analysis_lineage = bundle.get("analysis_lineage")
            if isinstance(analysis_lineage, dict):
                resolved_governance = bundle.get("governance_readiness")
        else:
            dataset = extract_dataset(dataset_obj)
        if not dataset:
            return jsonify({
                "error": "A valid dataset is required to build a chart.",
                "usageFormat": NLP_QUERY_FORMAT,
            }), 400

        try:
            readiness = resolved_governance or evaluate_dataset_readiness(
                pd.DataFrame(dataset),
                payload.get('governance_policy') or payload.get('governancePolicy'),
                operation='chart',
            )
        except GovernancePolicyError as exc:
            return jsonify({'error': f'Invalid governance policy: {exc}'}), 400
        if is_blocked(readiness):
            return jsonify(governance_error_payload(readiness)), 422

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

        try:
            chart_response = build_chart_response(dataset, interpretation)
        except ChartBuildError as exc:
            return jsonify({
                "intent": interpretation.get("intent"),
                "error": {"code": exc.code, "message": str(exc)},
                "fieldsUsed": {k: v for k, v in fields.items() if v},
                "fieldMatches": interpretation.get("matchDetails", []),
                "filtersApplied": interpretation.get("filters", []),
                "usageFormat": NLP_QUERY_FORMAT,
            }), 422
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

        if isinstance(analysis_lineage, dict):
            meta = {**meta, "analysis_lineage": analysis_lineage}
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
            "governance_readiness": readiness,
            **({"analysis_context": analysis_context} if isinstance(analysis_lineage, dict) else {}),
            **({"analysis_lineage": analysis_lineage} if isinstance(analysis_lineage, dict) else {}),
        })

    except Exception as exc:
        current_app.logger.error("Error in /api/nlp/chart: %s", exc, exc_info=True)
        return jsonify({
            "error": f"Failed to generate chart: {exc}",
            "usageFormat": NLP_QUERY_FORMAT,
        }), 500
