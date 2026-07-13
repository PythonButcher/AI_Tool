import uuid
from typing import Any, Dict, List

from flask import Blueprint, jsonify, request, current_app


autopilot_bp = Blueprint("autopilot_bp", __name__)
TRUTH_BOUNDARY = "observational_analysis_only"


def _normalize_dataset(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    def ensure_list(value: Any) -> List[Dict[str, Any]]:
        if isinstance(value, list):
            return value
        if isinstance(value, dict):
            for key in ("data", "data_preview", "rows", "records"):
                nested = value.get(key)
                if isinstance(nested, list):
                    return nested
        return []

    for key in ("cleanedData", "fullData", "uploadedData"):
        if key in payload and payload[key]:
            candidate = ensure_list(payload[key])
            if candidate:
                return candidate
    return []


def _build_node(run_id: str, order: int, node_type: str, label: str, command: str, description: str) -> Dict[str, Any]:
    return {
        "id": f"{run_id}-{node_type.lower()}",
        "type": node_type.lower(),
        "label": label,
        "command": command,
        "description": description,
        "params": {},
        "position": {"x": 140 + 260 * order, "y": 210},
        "execution_state": "not_executed",
        "truth_boundary": TRUTH_BOUNDARY,
    }


@autopilot_bp.route("/api/autopilot", methods=["POST"])
def generate_autopilot_workflow():
    payload = request.get_json(silent=True) or {}
    dataset_sample = _normalize_dataset(payload)

    if not dataset_sample:
        current_app.logger.warning("Autopilot requested without a valid dataset payload.")
        return jsonify({"error": "A dataset is required to generate an Autopilot workflow template."}), 400

    num_rows = len(dataset_sample)
    num_cols = len(dataset_sample[0]) if dataset_sample and isinstance(dataset_sample[0], dict) else 0

    run_id = uuid.uuid4().hex[:8]

    nodes = [
        _build_node(
            run_id,
            0,
            "SUMMARY",
            "Dataset Overview Step",
            "/summary",
            f"Template step for reviewing an overview of the submitted {num_rows}-row, {num_cols}-field dataset preview.",
        ),
        _build_node(
            run_id,
            1,
            "OUTLIERS",
            "Data Quality Review Step",
            "/outliers",
            "Template step for reviewing unusual values, rare categories, or missing-data patterns; no scan has run yet.",
        ),
        _build_node(
            run_id,
            2,
            "CHARTS",
            "Visualization Review Step",
            "/charts",
            "Template step for selecting an appropriate visualization after reviewing the dataset and analysis question.",
        ),
        _build_node(
            run_id,
            3,
            "INSIGHTS",
            "Evidence Review Step",
            "/insights",
            "Template step for reviewing produced findings, limitations, and bounded follow-up checks.",
        ),
    ]

    edges = [
        {
            "id": f"edge-{run_id}-{index}",
            "source": nodes[index]["id"],
            "target": nodes[index + 1]["id"],
        }
        for index in range(len(nodes) - 1)
    ]

    current_app.logger.info(
        "Autopilot workflow generated with %s nodes and dataset preview of %s rows.",
        len(nodes),
        num_rows,
    )

    return jsonify(
        {
            "id": f"autopilot-{run_id}",
            "name": "Autopilot Review Workflow Template",
            "description": (
                "Generated review-workflow template for summary, data-quality, visualization, and "
                "evidence-review steps. It does not execute analysis, detect risks, select a chart, "
                "or make a recommendation."
            ),
            "category": "Autopilot",
            "nodes": nodes,
            "edges": edges,
            "workflow_kind": "review_template",
            "execution_state": "not_executed",
            "source_refs": {
                "source": "autopilot_request_dataset_preview",
                "row_count": num_rows,
                "column_count": num_cols,
            },
            "limitations": [
                "This endpoint returns a workflow template only; no node has run against the dataset.",
                "The template does not produce predictions, optimization, causal proof, autonomous decisions, or final recommendations.",
            ],
            "truth_boundary": TRUTH_BOUNDARY,
        }
    )
