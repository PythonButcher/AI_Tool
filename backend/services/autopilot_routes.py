import uuid
from typing import Any, Dict, List

from flask import Blueprint, jsonify, request, current_app


autopilot_bp = Blueprint("autopilot_bp", __name__)


def _normalize_dataset(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return a list-based dataset sample from the payload."""

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
        "type": node_type,
        "label": label,
        "command": command,
        "description": description,
        "position": {"x": 120 + 240 * order, "y": 180},
    }


@autopilot_bp.route("/api/autopilot", methods=["POST"])
def generate_autopilot_workflow():
    payload = request.get_json(silent=True) or {}
    dataset_sample = _normalize_dataset(payload)

    if not dataset_sample:
        current_app.logger.warning("Autopilot requested without a valid dataset payload.")
        return jsonify({"error": "A dataset is required to run Autopilot."}), 400

    num_rows = len(dataset_sample)
    num_cols = len(dataset_sample[0]) if dataset_sample and isinstance(dataset_sample[0], dict) else 0

    run_id = uuid.uuid4().hex[:8]

    nodes = [
        _build_node(
            run_id,
            0,
            "SUMMARY",
            "Summary",
            "/summary",
            f"Generate an overview for {num_rows} rows across {num_cols} fields.",
        ),
        _build_node(
            run_id,
            1,
            "OUTLIERS",
            "Outliers",
            "/outliers",
            "Detect unusual values, rare categories, or missing data patterns.",
        ),
        _build_node(
            run_id,
            2,
            "CHARTS",
            "Charts",
            "/charts",
            "Recommend the most revealing visualization for the dataset sample.",
        ),
        _build_node(
            run_id,
            3,
            "INSIGHTS",
            "Insights",
            "/insights",
            "Summarize key findings and business-ready takeaways.",
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

    return jsonify({"nodes": nodes, "edges": edges})

