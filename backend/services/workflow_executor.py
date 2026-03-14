import copy
import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from backend.services.ai_command_executor import execute_ai_command, normalize_dataset
from backend.services.workflow_storage import normalize_workflow_definition


logger = logging.getLogger(__name__)
_RUNS: Dict[str, Dict[str, Any]] = {}
_RUNS_LOCK = threading.Lock()


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _snapshot_run_state(run_state: Dict[str, Any]) -> Dict[str, Any]:
    return copy.deepcopy(run_state)


def _store_run_state(run_state: Dict[str, Any]) -> Dict[str, Any]:
    with _RUNS_LOCK:
        _RUNS[run_state['run_id']] = copy.deepcopy(run_state)
        return _snapshot_run_state(_RUNS[run_state['run_id']])


def get_workflow_run(run_id: str) -> Optional[Dict[str, Any]]:
    with _RUNS_LOCK:
        run_state = _RUNS.get(run_id)
        if not run_state:
            return None
        return _snapshot_run_state(run_state)


def _build_predecessors(edges: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    predecessors: Dict[str, List[str]] = {}
    for edge in edges or []:
        target = edge.get('target')
        source = edge.get('source')
        if not target or not source:
            continue
        predecessors.setdefault(target, []).append(source)
    return predecessors


def _build_initial_run_state(workflow: Dict[str, Any], dataset: List[Dict[str, Any]]) -> Dict[str, Any]:
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

    return {
        'run_id': uuid.uuid4().hex,
        'workflow_id': workflow.get('id'),
        'workflow_name': workflow.get('name'),
        'status': 'queued',
        'started_at': None,
        'finished_at': None,
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
                'timestamp': _utc_now(),
                'type': 'queued',
                'message': f"Workflow '{workflow.get('name')}' queued for execution.",
            }
        ],
    }


def _update_progress(run_state: Dict[str, Any]) -> None:
    statuses = [entry.get('status') for entry in run_state['node_states'].values()]
    run_state['progress'] = {
        'total': len(statuses),
        'completed': sum(1 for status in statuses if status == 'completed'),
        'failed': sum(1 for status in statuses if status == 'failed'),
        'running': sum(1 for status in statuses if status == 'running'),
    }


def _append_event(run_state: Dict[str, Any], event_type: str, message: str, node_id: Optional[str] = None) -> None:
    run_state['events'].append(
        {
            'timestamp': _utc_now(),
            'type': event_type,
            'node_id': node_id,
            'message': message,
        }
    )


def _mark_remaining_nodes_skipped(run_state: Dict[str, Any], remaining_node_ids: List[str]) -> None:
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
            current_result['error'] = 'Skipped because an earlier workflow step failed.'
        _append_event(run_state, 'node_skipped', f'Skipped {current_state.get("label") or node_id}.', node_id=node_id)


def _assemble_ai_report(results: Dict[str, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    ai_report = {}
    for node_result in results.values():
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
            ai_report['chartType'] = result_payload.get('chartType')
            ai_report['chartData'] = result_payload.get('chartData')

    return ai_report or None


def _execute_run(run_id: str, workflow: Dict[str, Any], dataset: List[Dict[str, Any]]) -> None:
    run_state = get_workflow_run(run_id)
    if not run_state:
        return

    run_state['status'] = 'running'
    run_state['started_at'] = _utc_now()
    _append_event(run_state, 'started', f"Workflow '{workflow.get('name')}' started.")
    _store_run_state(run_state)

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

        run_state = get_workflow_run(run_id)
        if not run_state:
            return

        run_state['node_states'][node_id]['status'] = 'running'
        run_state['node_states'][node_id]['started_at'] = _utc_now()
        run_state['results'][node_id]['status'] = 'running'
        _append_event(run_state, 'node_started', f"Started {node.get('label') or node_id}.", node_id=node_id)
        _update_progress(run_state)
        _store_run_state(run_state)

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

            run_state = get_workflow_run(run_id)
            if not run_state:
                return

            run_state['node_states'][node_id]['status'] = 'completed'
            run_state['node_states'][node_id]['completed_at'] = _utc_now()
            run_state['results'][node_id] = {
                'status': 'completed',
                'result': result,
                'error': None,
                'command': command,
                'label': node.get('label') or node_id,
            }
            _append_event(run_state, 'node_completed', f"Completed {node.get('label') or node_id}.", node_id=node_id)
            _update_progress(run_state)
            _store_run_state(run_state)

        except Exception as exc:
            logger.exception('Workflow node failed', exc_info=exc)
            run_state = get_workflow_run(run_id)
            if not run_state:
                return

            run_state['node_states'][node_id]['status'] = 'failed'
            run_state['node_states'][node_id]['completed_at'] = _utc_now()
            run_state['node_states'][node_id]['error'] = str(exc)
            run_state['results'][node_id] = {
                'status': 'failed',
                'result': None,
                'error': str(exc),
                'command': node.get('command'),
                'label': node.get('label') or node_id,
            }
            _append_event(run_state, 'node_failed', f"Failed {node.get('label') or node_id}: {str(exc)}", node_id=node_id)
            if not continue_on_error:
                _mark_remaining_nodes_skipped(run_state, execution_order[index + 1:])
            _update_progress(run_state)
            _store_run_state(run_state)
            if not continue_on_error:
                break

    run_state = get_workflow_run(run_id)
    if not run_state:
        return

    report = _assemble_ai_report(run_state['results'])
    if report:
        run_state['results']['ai_report'] = {
            'status': 'completed',
            'result': report,
            'error': None,
            'command': 'ai_report',
            'label': 'AI Report',
        }

    if run_state['progress']['failed'] > 0:
        run_state['status'] = 'failed'
        _append_event(run_state, 'finished', 'Workflow finished with one or more failed nodes.')
    else:
        run_state['status'] = 'completed'
        _append_event(run_state, 'finished', 'Workflow completed successfully.')

    run_state['finished_at'] = _utc_now()
    _update_progress(run_state)
    _store_run_state(run_state)


def start_workflow_run(workflow_definition: Dict[str, Any], dataset_obj: Any) -> Dict[str, Any]:
    workflow = normalize_workflow_definition(workflow_definition)
    dataset = normalize_dataset(dataset_obj)
    if not dataset:
        raise ValueError('A dataset is required to execute a workflow.')

    run_state = _build_initial_run_state(workflow, dataset)
    _store_run_state(run_state)

    thread = threading.Thread(
        target=_execute_run,
        args=(run_state['run_id'], workflow, dataset),
        daemon=True,
    )
    thread.start()

    return get_workflow_run(run_state['run_id'])
