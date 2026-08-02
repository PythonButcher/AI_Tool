"""Workflow executor with durable persistence and cooperative cancellation.

Replaces the original in-memory-only executor with one backed by
``workflow_run_repository`` for durable run state.  Supports explicit
run states (queued, running, cancel_requested, cancelled, completed,
failed, interrupted), cooperative cancellation between nodes, and
optional idempotency keys.

Concurrency model
-----------------
Each ``start_workflow_run`` call validates the workflow, persists the
initial queued state, then spawns a daemon thread for execution.  The
thread checks for cancellation before each node.  State is persisted
to disk after every transition so it survives a backend restart.

A restart calls ``recover_incomplete_runs()`` to mark any in-progress
runs as ``interrupted`` with an explanation.
"""

import copy
import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.services.ai_command_executor import execute_ai_command, normalize_dataset
from backend.services.workflow_storage import normalize_workflow_definition
from backend.services.workflow_validator import (
    WorkflowValidationError,
    assert_valid_workflow,
)
from backend.services.workflow_run_repository import (
    TERMINAL_STATES,
    check_idempotency_key,
    create_run_if_absent,
    get_run,
    mark_interrupted,
    store_live_result,
    update_run,
)


logger = logging.getLogger(__name__)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_predecessors(edges: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    predecessors: Dict[str, List[str]] = {}
    for edge in edges or []:
        target = edge.get('target')
        source = edge.get('source')
        if not target or not source:
            continue
        predecessors.setdefault(target, []).append(source)
    return predecessors


def _build_initial_run_state(
    workflow: Dict[str, Any],
    dataset: List[Dict[str, Any]],
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Build the initial run state dict for a new workflow execution."""
    graph = workflow.get('graph') or {}
    nodes = graph.get('nodes') or []
    node_states = {}
    results = {}

    for node in nodes:
        node_id = node.get('id')
        if not node_id:
            continue
        node_states[node_id] = {
            'status': 'idle',
            'label': node.get('label') or node.get('type') or node_id,
            'command': node.get('command'),
            'error': None,
            'started_at': None,
            'completed_at': None,
        }
        results[node_id] = {
            'status': 'idle',
            'result': None,
            'error': None,
            'command': node.get('command'),
            'label': node.get('label') or node_id,
        }

    now = _utc_now()
    run_state = {
        'run_id': uuid.uuid4().hex,
        'workflow_id': workflow.get('id'),
        'workflow_name': workflow.get('name'),
        'status': 'queued',
        'started_at': None,
        'finished_at': None,
        'created_at': now,
        'progress': {
            'total': len(node_states),
            'completed': 0,
            'failed': 0,
            'running': 0,
        },
        'dataset_rows': len(dataset),
        'execution_order': graph.get('execution_order') or [],
        'node_states': node_states,
        'results': results,
        'events': [
            {
                'timestamp': now,
                'type': 'queued',
                'node_id': None,
                'message': f"Workflow '{workflow.get('name')}' queued for execution.",
            }
        ],
    }

    return run_state


def _update_progress(run_state: Dict[str, Any]) -> None:
    """Recompute progress counters from node_states."""
    statuses = [entry.get('status') for entry in run_state['node_states'].values()]
    run_state['progress'] = {
        'total': len(statuses),
        'completed': sum(1 for s in statuses if s == 'completed'),
        'failed': sum(1 for s in statuses if s == 'failed'),
        'running': sum(1 for s in statuses if s == 'running'),
    }


def _append_event(
    run_state: Dict[str, Any],
    event_type: str,
    message: str,
    node_id: Optional[str] = None,
) -> None:
    """Append a timestamped event to the run's event log."""
    run_state['events'].append({
        'timestamp': _utc_now(),
        'type': event_type,
        'node_id': node_id,
        'message': message,
    })


def _mark_remaining_nodes_skipped(
    run_state: Dict[str, Any],
    remaining_node_ids: List[str],
) -> None:
    """Mark remaining idle nodes as skipped after a failure or cancellation."""
    for node_id in remaining_node_ids:
        current_state = run_state['node_states'].get(node_id)
        current_result = run_state['results'].get(node_id)
        if not current_state or current_state.get('status') != 'idle':
            continue
        current_state['status'] = 'skipped'
        current_state['completed_at'] = _utc_now()
        if current_result is not None:
            current_result['status'] = 'skipped'
            current_result['result'] = None
            current_result['error'] = 'Skipped because workflow was stopped early.'
        _append_event(
            run_state,
            'node_skipped',
            f'Skipped {current_state.get("label") or node_id}.',
            node_id=node_id,
        )


def _assemble_ai_report(results: Dict[str, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Consolidate individual AI step outputs into an ai_report."""
    ai_report = {}
    for node_result in results.values():
        if not isinstance(node_result, dict):
            continue
        if node_result.get('status') != 'completed':
            continue
        command = node_result.get('command') or ''
        if command == '/summary':
            ai_report['summary'] = node_result.get('result')
        if command == '/outliers':
            ai_report['outliers'] = node_result.get('result')
        if command == '/insights':
            ai_report['insights'] = node_result.get('result')
        if command == '/execute':
            ai_report['execution'] = node_result.get('result')
        if command == '/charts':
            result_payload = node_result.get('result') or {}
            if isinstance(result_payload, dict):
                ai_report['chartType'] = result_payload.get('chartType')
                ai_report['chartData'] = result_payload.get('chartData')

    return ai_report or None


def _is_cancellation_requested(run_id: str) -> bool:
    """Check whether cancellation has been requested for this run.

    Reads from the durable store to pick up cancellation requests
    made via the API while execution is in progress.
    """
    run = get_run(run_id, include_live_results=False)
    if not run:
        return False
    return run.get('status') in ('cancel_requested', 'cancelled')


def _cancel_before_next_node(
    run_id: str,
    remaining_node_ids: List[str],
) -> Optional[Dict[str, Any]]:
    """Finalize a cooperative cancellation without losing completed work."""
    def apply_cancellation(run_state: Dict[str, Any]) -> Dict[str, Any]:
        if run_state.get('status') != 'cancel_requested':
            return run_state
        _mark_remaining_nodes_skipped(run_state, remaining_node_ids)
        run_state['status'] = 'cancelled'
        run_state['finished_at'] = _utc_now()
        _append_event(
            run_state,
            'cancelled',
            'Workflow cancelled. Results from completed nodes are preserved.',
        )
        _update_progress(run_state)
        return run_state

    return update_run(run_id, apply_cancellation)


def _execute_run(
    run_id: str,
    workflow: Dict[str, Any],
    dataset: List[Dict[str, Any]],
) -> None:
    """Execute a workflow run in a background thread.

    Checks for cancellation before each node.  Persists state after
    every transition.  Produces an ai_report on completion.
    """
    run_state = get_run(run_id, include_live_results=False)
    if not run_state:
        return

    # Check if already cancelled before we start
    if run_state.get('status') in TERMINAL_STATES:
        return

    def mark_started(current: Dict[str, Any]) -> Dict[str, Any]:
        if current.get('status') != 'queued':
            return current
        current['status'] = 'running'
        current['started_at'] = _utc_now()
        _append_event(
            current,
            'started',
            f"Workflow '{workflow.get('name')}' started.",
        )
        return current

    run_state = update_run(run_id, mark_started)
    if not run_state or run_state.get('status') in TERMINAL_STATES:
        return

    graph = workflow.get('graph') or {}
    nodes = graph.get('nodes') or []
    edges = graph.get('edges') or []
    execution_order = graph.get('execution_order') or []
    node_map = {node.get('id'): node for node in nodes if node.get('id')}
    predecessors = _build_predecessors(edges)
    current_dataset = list(dataset)
    continue_on_error = workflow.get('continue_on_error', False)

    for index, node_id in enumerate(execution_order):
        node = node_map.get(node_id)
        if not node:
            continue

        # --- Cooperative cancellation check before each node ---
        if _is_cancellation_requested(run_id):
            _cancel_before_next_node(run_id, execution_order[index:])
            return

        def mark_node_started(current: Dict[str, Any]) -> Dict[str, Any]:
            # Cancellation wins if it reached the repository before this
            # atomic node-start transition.
            if current.get('status') != 'running':
                return current
            current['node_states'][node_id]['status'] = 'running'
            current['node_states'][node_id]['started_at'] = _utc_now()
            current['results'][node_id]['status'] = 'running'
            _append_event(
                current,
                'node_started',
                f"Started {node.get('label') or node_id}.",
                node_id=node_id,
            )
            _update_progress(current)
            return current

        run_state = update_run(run_id, mark_node_started)
        if not run_state:
            return
        if run_state.get('status') == 'cancel_requested':
            _cancel_before_next_node(run_id, execution_order[index:])
            return
        if run_state.get('status') in TERMINAL_STATES:
            return

        # Downstream nodes may consume transient full results from completed
        # predecessors even though durable history stores only summaries.
        run_state = get_run(run_id)
        if not run_state:
            return

        upstream_results = {
            upstream_id: run_state['results'].get(upstream_id)
            for upstream_id in predecessors.get(node_id, [])
            if run_state['results'].get(upstream_id)
        }

        try:
            command = node.get('command')
            result = execute_ai_command(
                command,
                current_dataset,
                instructions=(node.get('params') or {}).get('instructions'),
                node_params=node.get('params') or {},
                execution_context={
                    'mode': 'pipeline',
                    'workflow_id': workflow.get('id'),
                    'node_id': node_id,
                    'upstream_results': upstream_results,
                },
            )

            if command == '/clean' and isinstance(result.get('cleaned_data'), list):
                current_dataset = result['cleaned_data']

            def mark_node_completed(current: Dict[str, Any]) -> Dict[str, Any]:
                current['node_states'][node_id]['status'] = 'completed'
                current['node_states'][node_id]['completed_at'] = _utc_now()
                current['results'][node_id] = {
                    'status': 'completed',
                    'result': result,
                    'error': None,
                    'command': command,
                    'label': node.get('label') or node_id,
                }
                _append_event(
                    current,
                    'node_completed',
                    f"Completed {node.get('label') or node_id}.",
                    node_id=node_id,
                )
                _update_progress(current)
                return current

            run_state = update_run(run_id, mark_node_completed)
            if not run_state or run_state.get('status') in TERMINAL_STATES:
                return
            store_live_result(run_id, node_id, result)

        except Exception as exc:
            logger.exception('Workflow node failed', exc_info=exc)

            def mark_node_failed(current: Dict[str, Any]) -> Dict[str, Any]:
                current['node_states'][node_id]['status'] = 'failed'
                current['node_states'][node_id]['completed_at'] = _utc_now()
                current['node_states'][node_id]['error'] = str(exc)
                current['results'][node_id] = {
                    'status': 'failed',
                    'result': None,
                    'error': str(exc),
                    'command': node.get('command'),
                    'label': node.get('label') or node_id,
                }
                _append_event(
                    current,
                    'node_failed',
                    f"Failed {node.get('label') or node_id}: {str(exc)}",
                    node_id=node_id,
                )
                if not continue_on_error:
                    _mark_remaining_nodes_skipped(
                        current,
                        execution_order[index + 1:],
                    )
                _update_progress(current)
                return current

            run_state = update_run(run_id, mark_node_failed)
            if not run_state or run_state.get('status') in TERMINAL_STATES:
                return
            if not continue_on_error:
                break

    # --- Final state ---
    run_state = get_run(run_id)
    if not run_state:
        return

    # Don't overwrite an outcome established by another request.
    if run_state.get('status') in TERMINAL_STATES:
        return

    if run_state.get('status') == 'cancel_requested':
        _cancel_before_next_node(run_id, [])
        return

    live_run_state = get_run(run_id)
    report = _assemble_ai_report((live_run_state or run_state)['results'])

    def finalize_run(current: Dict[str, Any]) -> Dict[str, Any]:
        # A cancellation request that arrives after the read above still wins.
        if current.get('status') == 'cancel_requested':
            _mark_remaining_nodes_skipped(current, [])
            current['status'] = 'cancelled'
            current['finished_at'] = _utc_now()
            _append_event(
                current,
                'cancelled',
                'Workflow cancelled. Results from completed nodes are preserved.',
            )
            _update_progress(current)
            return current

        if report:
            current['results']['ai_report'] = {
                'status': 'completed',
                'result': report,
                'error': None,
                'command': 'ai_report',
                'label': 'AI Report',
            }

        if current['progress']['failed'] > 0:
            current['status'] = 'failed'
            _append_event(
                current,
                'finished',
                'Workflow finished with one or more failed nodes.',
            )
        else:
            current['status'] = 'completed'
            _append_event(
                current,
                'finished',
                'Workflow completed successfully.',
            )

        current['finished_at'] = _utc_now()
        _update_progress(current)
        return current

    finalized = update_run(run_id, finalize_run)
    if finalized and report:
        store_live_result(run_id, 'ai_report', report)


def _execute_run_safely(
    run_id: str,
    workflow: Dict[str, Any],
    dataset: List[Dict[str, Any]],
) -> None:
    """Keep unexpected executor defects from leaving a run stuck forever."""
    try:
        _execute_run(run_id, workflow, dataset)
    except Exception as exc:  # pragma: no cover - defensive process boundary
        logger.exception("Workflow run crashed unexpectedly", exc_info=exc)
        mark_interrupted(
            run_id,
            f"Executor stopped unexpectedly: {type(exc).__name__}.",
        )


def start_workflow_run(
    workflow_definition: Dict[str, Any],
    dataset_obj: Any,
    *,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Validate, persist, and start a workflow run.

    Parameters
    ----------
    workflow_definition : dict
        The workflow to execute.
    dataset_obj : any
        The input dataset in any supported format.
    idempotency_key : str, optional
        If provided, duplicate submissions with the same key return the
        existing run instead of starting a new one.

    Returns
    -------
    dict
        The initial (or existing) run state.

    Raises
    ------
    WorkflowValidationError
        If the workflow definition is invalid.
    ValueError
        If the dataset is empty.
    """
    # --- Idempotency check ---
    if idempotency_key:
        existing = check_idempotency_key(idempotency_key)
        if existing:
            return existing

    workflow = normalize_workflow_definition(workflow_definition)

    # --- Validate before executing ---
    assert_valid_workflow(workflow)

    dataset = normalize_dataset(dataset_obj)
    if not dataset:
        raise ValueError('A dataset is required to execute a workflow.')

    run_state = _build_initial_run_state(workflow, dataset, idempotency_key)
    run_state, created = create_run_if_absent(
        run_state,
        idempotency_key=idempotency_key,
    )
    if not created:
        return run_state

    thread = threading.Thread(
        target=_execute_run_safely,
        args=(run_state['run_id'], workflow, dataset),
        daemon=True,
    )
    thread.start()

    return get_run(run_state['run_id'])


# Keep backward compatibility — get_workflow_run is the function
# imported by the routes module.
def get_workflow_run(run_id: str) -> Optional[Dict[str, Any]]:
    """Get a workflow run by ID (backward compatible wrapper)."""
    return get_run(run_id)
