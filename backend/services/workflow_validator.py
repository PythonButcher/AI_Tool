"""Workflow definition validator.

Validates workflow graphs before saving or executing. Rejects:
- Duplicate node identifiers
- Missing or empty node lists
- Dangling edges (referencing non-existent nodes)
- Unsupported commands
- Cycles in the directed graph
- Malformed node parameters (missing required fields)

All validation errors are returned as structured dicts with an error code
and a human-readable message so callers can present them directly.
"""

from typing import Any, Dict, List, Set


# Commands that the AI command executor supports.  Keep in sync with
# backend/services/ai_command_executor.py COMMANDS registry and
# frontend AiCommandBlock definitions.
SUPPORTED_COMMANDS: Set[str] = {
    "/summary",
    "/outliers",
    "/charts",
    "/insights",
    "/clean",
    "/execute",
}


class WorkflowValidationError(Exception):
    """Raised when a workflow definition fails validation.

    Carries a list of structured error dicts so the route layer can
    return them as a JSON array.
    """

    def __init__(self, errors: List[Dict[str, str]]) -> None:
        self.errors = errors
        messages = "; ".join(e.get("message", "") for e in errors)
        super().__init__(f"Workflow validation failed: {messages}")


def _make_error(code: str, message: str, **extra: Any) -> Dict[str, Any]:
    """Build a structured validation error dict."""
    error: Dict[str, Any] = {"code": code, "message": message}
    error.update(extra)
    return error


def validate_workflow_definition(
    workflow: Dict[str, Any],
    *,
    reject_cycles: bool = True,
) -> List[Dict[str, Any]]:
    """Validate a workflow definition and return a list of errors.

    Returns an empty list when the definition is valid.  The caller
    decides whether to raise or return the errors.

    Parameters
    ----------
    workflow : dict
        A normalised workflow definition (may come from the frontend
        or from ``normalize_workflow_definition``).
    reject_cycles : bool
        When True (default) the validator rejects graphs that contain
        directed cycles.  The assignment explicitly forbids executing
        cyclic graphs by falling back to visual position.
    """
    errors: List[Dict[str, Any]] = []

    # --- Extract graph components ---
    if not isinstance(workflow, dict):
        return [
            _make_error(
                "MALFORMED_WORKFLOW",
                "Workflow definition must be a JSON object.",
            )
        ]

    graph = workflow.get("graph") or {}
    if not isinstance(graph, dict):
        return [
            _make_error(
                "MALFORMED_GRAPH",
                "Workflow graph must be a JSON object.",
            )
        ]

    nodes: List[Dict[str, Any]] = (
        graph.get("nodes")
        or workflow.get("nodes")
        or []
    )
    edges: List[Dict[str, Any]] = (
        graph.get("edges")
        or workflow.get("edges")
        or []
    )

    # --- Empty workflow ---
    if not isinstance(nodes, list) or not nodes:
        errors.append(
            _make_error("EMPTY_WORKFLOW", "Workflow must contain at least one node.")
        )
        return errors  # nothing else to validate

    if not isinstance(edges, list):
        errors.append(
            _make_error("MALFORMED_EDGES", "Workflow edges must be a JSON array.")
        )
        edges = []

    # --- Duplicate node IDs ---
    seen_ids: Dict[str, int] = {}
    nodes_without_id: int = 0
    malformed_nodes: int = 0
    for node in nodes:
        if not isinstance(node, dict):
            malformed_nodes += 1
            continue
        node_id = node.get("id")
        if not isinstance(node_id, str) or not node_id.strip():
            nodes_without_id += 1
            continue
        seen_ids[node_id] = seen_ids.get(node_id, 0) + 1

    if malformed_nodes > 0:
        errors.append(
            _make_error(
                "MALFORMED_NODE",
                f"{malformed_nodes} node(s) are not JSON objects.",
            )
        )

    if nodes_without_id > 0:
        errors.append(
            _make_error(
                "MISSING_NODE_ID",
                f"{nodes_without_id} node(s) are missing an 'id' field.",
            )
        )

    duplicates = [nid for nid, count in seen_ids.items() if count > 1]
    if duplicates:
        errors.append(
            _make_error(
                "DUPLICATE_NODE_ID",
                f"Duplicate node identifiers: {', '.join(duplicates)}.",
                node_ids=duplicates,
            )
        )

    valid_node_ids: Set[str] = set(seen_ids.keys())

    # --- Dangling edges ---
    for edge in edges:
        if not isinstance(edge, dict):
            errors.append(
                _make_error(
                    "MALFORMED_EDGE",
                    "Every workflow edge must be a JSON object.",
                )
            )
            continue
        source = edge.get("source")
        target = edge.get("target")
        if source and source not in valid_node_ids:
            errors.append(
                _make_error(
                    "DANGLING_EDGE",
                    f"Edge source '{source}' does not match any node.",
                    edge_id=edge.get("id"),
                    field="source",
                )
            )
        if target and target not in valid_node_ids:
            errors.append(
                _make_error(
                    "DANGLING_EDGE",
                    f"Edge target '{target}' does not match any node.",
                    edge_id=edge.get("id"),
                    field="target",
                )
            )
        if not source or not target:
            errors.append(
                _make_error(
                    "MALFORMED_EDGE",
                    f"Edge '{edge.get('id', '?')}' is missing source or target.",
                    edge_id=edge.get("id"),
                )
            )

    # --- Unsupported commands ---
    for node in nodes:
        if not isinstance(node, dict):
            continue
        command = node.get("command")
        if not isinstance(command, str) or not command.strip():
            errors.append(
                _make_error(
                    "MISSING_COMMAND",
                    f"Node '{node.get('id', '?')}' must define a command.",
                    node_id=node.get("id"),
                )
            )
        elif command not in SUPPORTED_COMMANDS:
            errors.append(
                _make_error(
                    "UNSUPPORTED_COMMAND",
                    f"Node '{node.get('id', '?')}' uses unsupported command '{command}'.",
                    node_id=node.get("id"),
                    command=command,
                )
            )

    # --- Malformed node parameters ---
    for node in nodes:
        if not isinstance(node, dict):
            continue
        node_id = node.get("id", "?")
        params = node.get("params")

        # params must be a dict if present
        if params is not None and not isinstance(params, dict):
            errors.append(
                _make_error(
                    "MALFORMED_PARAMS",
                    f"Node '{node_id}' has non-dict params.",
                    node_id=node_id,
                )
            )

    # --- Cycle detection (Kahn's algorithm) ---
    if reject_cycles and valid_node_ids:
        indegree: Dict[str, int] = {nid: 0 for nid in valid_node_ids}
        outgoing: Dict[str, List[str]] = {nid: [] for nid in valid_node_ids}

        for edge in edges:
            source = edge.get("source")
            target = edge.get("target")
            if source in valid_node_ids and target in valid_node_ids:
                outgoing[source].append(target)
                indegree[target] = indegree.get(target, 0) + 1

        queue = [nid for nid, deg in indegree.items() if deg == 0]
        visited_count = 0

        while queue:
            current = queue.pop(0)
            visited_count += 1
            for successor in outgoing.get(current, []):
                indegree[successor] -= 1
                if indegree[successor] == 0:
                    queue.append(successor)

        if visited_count != len(valid_node_ids):
            # Identify nodes remaining in cycle
            cycle_nodes = [nid for nid, deg in indegree.items() if deg > 0]
            errors.append(
                _make_error(
                    "CYCLE_DETECTED",
                    f"Workflow graph contains a cycle involving node(s): "
                    f"{', '.join(cycle_nodes)}. Cyclic workflows cannot be executed.",
                    node_ids=cycle_nodes,
                )
            )

    # --- Execution order validity ---
    execution_order = graph.get("execution_order")
    if execution_order is None:
        execution_order = workflow.get("execution_order")

    if execution_order is not None:
        if not isinstance(execution_order, list):
            errors.append(
                _make_error(
                    "INVALID_EXECUTION_ORDER",
                    "Execution order must be a JSON array of node identifiers.",
                )
            )
        else:
            order_ids = [
                node_id
                for node_id in execution_order
                if isinstance(node_id, str)
            ]
            order_set = set(order_ids)

            if len(order_ids) != len(execution_order):
                errors.append(
                    _make_error(
                        "INVALID_EXECUTION_ORDER",
                        "Execution order must contain only string node identifiers.",
                    )
                )

            duplicates_in_order = sorted(
                {
                    node_id
                    for node_id in order_ids
                    if order_ids.count(node_id) > 1
                }
            )
            if duplicates_in_order:
                errors.append(
                    _make_error(
                        "INVALID_EXECUTION_ORDER",
                        "Execution order contains duplicate node identifiers: "
                        f"{', '.join(duplicates_in_order)}.",
                        node_ids=duplicates_in_order,
                    )
                )

            unknown_ids = sorted(order_set - valid_node_ids)
            if unknown_ids:
                errors.append(
                    _make_error(
                        "INVALID_EXECUTION_ORDER",
                        "Execution order references non-existent node(s): "
                        f"{', '.join(unknown_ids)}.",
                        node_ids=unknown_ids,
                    )
                )

            missing_ids = sorted(valid_node_ids - order_set)
            if missing_ids:
                errors.append(
                    _make_error(
                        "INVALID_EXECUTION_ORDER",
                        "Execution order omits node(s): "
                        f"{', '.join(missing_ids)}.",
                        node_ids=missing_ids,
                    )
                )

            if not unknown_ids and not missing_ids and not duplicates_in_order:
                positions = {
                    node_id: index
                    for index, node_id in enumerate(order_ids)
                }
                for edge in edges:
                    if not isinstance(edge, dict):
                        continue
                    source = edge.get("source")
                    target = edge.get("target")
                    if source not in positions or target not in positions:
                        continue
                    if positions[source] >= positions[target]:
                        errors.append(
                            _make_error(
                                "INVALID_EXECUTION_ORDER",
                                f"Execution order places '{target}' before its "
                                f"dependency '{source}'.",
                                edge_id=edge.get("id"),
                                source=source,
                                target=target,
                            )
                        )

    return errors


def assert_valid_workflow(
    workflow: Dict[str, Any],
    *,
    reject_cycles: bool = True,
) -> None:
    """Validate and raise ``WorkflowValidationError`` if invalid."""
    errors = validate_workflow_definition(workflow, reject_cycles=reject_cycles)
    if errors:
        raise WorkflowValidationError(errors)
