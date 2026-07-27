import copy
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.services.workflow_validator import validate_workflow_definition


WORKFLOW_STORAGE_DIR = Path(__file__).resolve().parent.parent / "storage" / "workflows"


DEFAULT_TEMPLATE_DEFINITIONS = [
    {
        "id": "template-dataset-cleaning",
        "name": "Dataset Cleaning Pipeline",
        "description": "Prepare a dataset, summarize quality issues, and deliver cleaned output for downstream analysis.",
        "is_template": True,
        "category": "Data Preparation",
        "nodes": [
            {
                "id": "clean-step",
                "type": "clean",
                "label": "Clean Dataset",
                "command": "/clean",
                "description": "Apply AI-guided cleaning instructions.",
                "params": {
                    "instructions": "Handle missing values, normalize data types, and remove duplicates while preserving the dataset schema."
                },
                "position": {"x": 180, "y": 180},
            },
            {
                "id": "summary-step",
                "type": "summary",
                "label": "Quality Summary",
                "command": "/summary",
                "description": "Describe the cleaned dataset for business review.",
                "params": {"focus": "Highlight completeness, duplicates removed, and any major schema changes."},
                "position": {"x": 460, "y": 180},
            },
            {
                "id": "insights-step",
                "type": "insights",
                "label": "Business Insights",
                "command": "/insights",
                "description": "Translate the prepared data into plain-language takeaways.",
                "params": {"focus": "Call out issues that may affect reporting confidence or operations."},
                "position": {"x": 740, "y": 180},
            },
        ],
        "edges": [
            {"id": "edge-clean-summary", "source": "clean-step", "target": "summary-step"},
            {"id": "edge-summary-insights", "source": "summary-step", "target": "insights-step"},
        ],
    },
    {
        "id": "template-automated-insights",
        "name": "Automated Insight Generation",
        "description": "Create a reusable insight workflow for executive summaries and anomaly review.",
        "is_template": True,
        "category": "Insights",
        "nodes": [
            {
                "id": "summary-step",
                "type": "summary",
                "label": "Executive Summary",
                "command": "/summary",
                "description": "Summarize what matters most for business stakeholders.",
                "params": {"focus": "Keep the language concise and executive-friendly."},
                "position": {"x": 180, "y": 180},
            },
            {
                "id": "outlier-step",
                "type": "outliers",
                "label": "Risk Signals",
                "command": "/outliers",
                "description": "Detect anomalies or unusual patterns.",
                "params": {"focus": "Prioritize business-impacting anomalies and exceptions."},
                "position": {"x": 460, "y": 180},
            },
            {
                "id": "insights-step",
                "type": "insights",
                "label": "Decision Insights",
                "command": "/insights",
                "description": "Turn signals into bounded follow-up checks.",
                "params": {"goal": "Surface observational checks a business user can review."},
                "position": {"x": 740, "y": 180},
            },
        ],
        "edges": [
            {"id": "edge-summary-outlier", "source": "summary-step", "target": "outlier-step"},
            {"id": "edge-outlier-insights", "source": "outlier-step", "target": "insights-step"},
        ],
    },
    {
        "id": "template-visualization-pipeline",
        "name": "Visualization Pipeline",
        "description": "Prepare visuals and commentary for business reporting.",
        "is_template": True,
        "category": "Reporting",
        "nodes": [
            {
                "id": "summary-step",
                "type": "summary",
                "label": "Dataset Summary",
                "command": "/summary",
                "description": "Understand the dataset shape before charting.",
                "params": {},
                "position": {"x": 180, "y": 180},
            },
            {
                "id": "charts-step",
                "type": "charts",
                "label": "Recommended Visual",
                "command": "/charts",
                "description": "Generate a chart structure suitable for the dataset.",
                "params": {"goal": "Choose visuals that support business reporting rather than technical analysis."},
                "position": {"x": 460, "y": 180},
            },
            {
                "id": "insights-step",
                "type": "insights",
                "label": "Narrative",
                "command": "/insights",
                "description": "Explain what the chart means in plain language.",
                "params": {"focus": "Explain the likely business meaning of the chart recommendation."},
                "position": {"x": 740, "y": 180},
            },
        ],
        "edges": [
            {"id": "edge-summary-charts", "source": "summary-step", "target": "charts-step"},
            {"id": "edge-charts-insights", "source": "charts-step", "target": "insights-step"},
        ],
    },
    {
        "id": "template-ai-analysis",
        "name": "AI Analysis Workflow",
        "description": "Full analysis path for summary, anomaly review, visualization, and bounded follow-up checks.",
        "is_template": True,
        "category": "Analysis",
        "nodes": [
            {
                "id": "summary-step",
                "type": "summary",
                "label": "Summary",
                "command": "/summary",
                "description": "Create a concise overview of the data.",
                "params": {},
                "position": {"x": 160, "y": 180},
            },
            {
                "id": "outlier-step",
                "type": "outliers",
                "label": "Outlier Review",
                "command": "/outliers",
                "description": "Spot issues that need investigation.",
                "params": {},
                "position": {"x": 420, "y": 180},
            },
            {
                "id": "charts-step",
                "type": "charts",
                "label": "Visualization",
                "command": "/charts",
                "description": "Build a presentation-ready visual suggestion.",
                "params": {},
                "position": {"x": 680, "y": 180},
            },
            {
                "id": "insights-step",
                "type": "insights",
                "label": "Follow-up Checks",
                "command": "/insights",
                "description": "Translate analysis into reviewable next checks.",
                "params": {"goal": "Suggest observational checks for business users to review."},
                "position": {"x": 940, "y": 180},
            },
        ],
        "edges": [
            {"id": "edge-summary-outlier", "source": "summary-step", "target": "outlier-step"},
            {"id": "edge-outlier-charts", "source": "outlier-step", "target": "charts-step"},
            {"id": "edge-charts-insights", "source": "charts-step", "target": "insights-step"},
        ],
    },
]


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ensure_storage_dir() -> None:
    WORKFLOW_STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def _compute_execution_order(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[str]:
    if not nodes:
        return []

    node_map = {node["id"]: node for node in nodes if node.get("id")}
    indegree = {node_id: 0 for node_id in node_map}
    outgoing = {node_id: [] for node_id in node_map}

    for edge in edges or []:
        source = edge.get("source")
        target = edge.get("target")
        if source in node_map and target in node_map:
            outgoing[source].append(target)
            indegree[target] += 1

    queue = sorted(
        [node_id for node_id, degree in indegree.items() if degree == 0],
        key=lambda node_id: (
            (node_map[node_id].get("position") or {}).get("y", 0),
            (node_map[node_id].get("position") or {}).get("x", 0),
        ),
    )

    ordered = []
    while queue:
        node_id = queue.pop(0)
        ordered.append(node_id)
        for target in outgoing[node_id]:
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)
                queue.sort(
                    key=lambda current_id: (
                        (node_map[current_id].get("position") or {}).get("y", 0),
                        (node_map[current_id].get("position") or {}).get("x", 0),
                    )
                )

    if len(ordered) != len(node_map):
        # The assignment forbids executing a cyclic graph by falling
        # back to visual position.  Raise so the caller gets a clear
        # error instead of silent incorrect behaviour.
        cycle_nodes = [nid for nid, deg in indegree.items() if deg > 0]
        raise ValueError(
            f"Workflow graph contains a cycle involving node(s): "
            f"{', '.join(cycle_nodes)}.  Cyclic workflows cannot be executed."
        )

    return ordered


def normalize_workflow_definition(workflow: Dict[str, Any], existing: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    existing = existing or {}
    workflow_graph = workflow.get("graph") or {}
    existing_graph = existing.get("graph") or {}

    if "nodes" in workflow:
        node_source = workflow["nodes"]
    elif "nodes" in workflow_graph:
        node_source = workflow_graph["nodes"]
    elif "nodes" in existing:
        node_source = existing["nodes"]
    else:
        node_source = existing_graph.get("nodes") or []

    if "edges" in workflow:
        edge_source = workflow["edges"]
    elif "edges" in workflow_graph:
        edge_source = workflow_graph["edges"]
    elif "edges" in existing:
        edge_source = existing["edges"]
    else:
        edge_source = existing_graph.get("edges") or []

    nodes = copy.deepcopy(node_source)
    edges = copy.deepcopy(edge_source)
    graph_changed = (
        "nodes" in workflow
        or "nodes" in workflow_graph
        or "edges" in workflow
        or "edges" in workflow_graph
    )

    if "execution_order" in workflow:
        execution_order = workflow["execution_order"]
    elif "execution_order" in workflow_graph:
        execution_order = workflow_graph["execution_order"]
    else:
        execution_order = None

    if execution_order is None and not graph_changed:
        execution_order = (
            existing.get("execution_order")
            or existing_graph.get("execution_order")
        )
    if execution_order is None:
        execution_order = _compute_execution_order(nodes, edges)

    now = _utc_now()
    return {
        "id": workflow.get("id") or existing.get("id") or uuid.uuid4().hex,
        "name": workflow.get("name") or existing.get("name") or "Untitled Workflow",
        "description": workflow.get("description") or existing.get("description") or "",
        "category": workflow.get("category") or existing.get("category") or "Custom",
        "is_template": bool(workflow.get("is_template", existing.get("is_template", False))),
        "source_workflow_id": workflow.get("source_workflow_id") or existing.get("source_workflow_id"),
        "created_at": existing.get("created_at") or workflow.get("created_at") or now,
        "updated_at": now,
        "continue_on_error": bool(workflow.get("continue_on_error", existing.get("continue_on_error", False))),
        "graph": {
            "version": "phase-6",
            "nodes": nodes,
            "edges": edges,
            "execution_order": execution_order,
        },
    }


def _workflow_path(workflow_id: str) -> Path:
    return WORKFLOW_STORAGE_DIR / f"{workflow_id}.json"


def _write_workflow(workflow: Dict[str, Any]) -> Dict[str, Any]:
    _ensure_storage_dir()
    _workflow_path(workflow["id"]).write_text(json.dumps(workflow, indent=2), encoding="utf-8")
    return workflow


def _read_workflow(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def ensure_default_templates() -> None:
    _ensure_storage_dir()
    for template in DEFAULT_TEMPLATE_DEFINITIONS:
        template_path = _workflow_path(template["id"])
        if template_path.exists():
            continue
        normalized = normalize_workflow_definition(template)
        normalized["id"] = template["id"]
        normalized["name"] = template["name"]
        normalized["description"] = template["description"]
        normalized["category"] = template["category"]
        normalized["is_template"] = True
        normalized["graph"]["nodes"] = copy.deepcopy(template["nodes"])
        normalized["graph"]["edges"] = copy.deepcopy(template["edges"])
        normalized["graph"]["execution_order"] = _compute_execution_order(template["nodes"], template["edges"])
        _write_workflow(normalized)


def serialize_workflow_summary(workflow: Dict[str, Any]) -> Dict[str, Any]:
    graph = workflow.get("graph") or {}
    return {
        "id": workflow.get("id"),
        "name": workflow.get("name"),
        "description": workflow.get("description"),
        "category": workflow.get("category"),
        "is_template": workflow.get("is_template", False),
        "source_workflow_id": workflow.get("source_workflow_id"),
        "created_at": workflow.get("created_at"),
        "updated_at": workflow.get("updated_at"),
        "continue_on_error": workflow.get("continue_on_error", False),
        "node_count": len(graph.get("nodes") or []),
        "edge_count": len(graph.get("edges") or []),
        "execution_order": graph.get("execution_order") or [],
    }


def list_workflows() -> Dict[str, List[Dict[str, Any]]]:
    ensure_default_templates()
    workflows = []
    templates = []
    for path in sorted(WORKFLOW_STORAGE_DIR.glob("*.json")):
        workflow = _read_workflow(path)
        summary = serialize_workflow_summary(workflow)
        if workflow.get("is_template"):
            templates.append(summary)
        else:
            workflows.append(summary)
    workflows.sort(key=lambda item: item.get("updated_at") or "", reverse=True)
    templates.sort(key=lambda item: item.get("name") or "")
    return {"workflows": workflows, "templates": templates}


def get_workflow(workflow_id: str) -> Optional[Dict[str, Any]]:
    ensure_default_templates()
    path = _workflow_path(workflow_id)
    if not path.exists():
        return None
    workflow = _read_workflow(path)
    graph = workflow.get("graph") or {}
    return {
        **serialize_workflow_summary(workflow),
        "nodes": graph.get("nodes") or [],
        "edges": graph.get("edges") or [],
    }


def create_workflow(workflow_definition: Dict[str, Any]) -> Dict[str, Any]:
    workflow = normalize_workflow_definition(workflow_definition)
    # Validate before persisting; raises WorkflowValidationError on failure
    errors = validate_workflow_definition(workflow)
    if errors:
        from backend.services.workflow_validator import WorkflowValidationError
        raise WorkflowValidationError(errors)
    return get_workflow(_write_workflow(workflow)["id"])


def update_workflow(workflow_id: str, workflow_definition: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    existing = get_workflow(workflow_id)
    if not existing:
        return None
    normalized = normalize_workflow_definition({**workflow_definition, "id": workflow_id}, existing=existing)
    # Validate before persisting
    errors = validate_workflow_definition(normalized)
    if errors:
        from backend.services.workflow_validator import WorkflowValidationError
        raise WorkflowValidationError(errors)
    return get_workflow(_write_workflow(normalized)["id"])


def duplicate_workflow(workflow_id: str, name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    existing = get_workflow(workflow_id)
    if not existing:
        return None
    duplicate = copy.deepcopy(existing)
    duplicate.pop("created_at", None)
    duplicate.pop("updated_at", None)
    duplicate["id"] = uuid.uuid4().hex
    duplicate["name"] = name or f"Copy of {existing['name']}"
    duplicate["is_template"] = False
    duplicate["source_workflow_id"] = existing.get("id")
    return create_workflow(duplicate)


def create_workflow_from_template(template_id: str, name: Optional[str] = None) -> Optional[Dict[str, Any]]:
    template = get_workflow(template_id)
    if not template:
        return None
    draft_name = name or f"{template['name']} Copy"
    workflow = copy.deepcopy(template)
    workflow.pop("created_at", None)
    workflow.pop("updated_at", None)
    workflow["id"] = uuid.uuid4().hex
    workflow["name"] = draft_name
    workflow["is_template"] = False
    workflow["source_workflow_id"] = template_id
    return create_workflow(workflow)
