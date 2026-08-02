"""Focused executable tests for the durable workflow reliability contract."""

import copy
import json
import sys
import tempfile
import threading
import types
import unittest
import uuid
from pathlib import Path
from unittest.mock import MagicMock, patch

# Workflow reliability tests never call an external model. Keep the executor
# import deterministic when the optional OpenAI SDK is not installed in the
# system Python used by the repository's unittest command.
try:
    import openai  # noqa: F401
except ModuleNotFoundError:
    openai_stub = types.ModuleType("openai")
    openai_stub.OpenAI = MagicMock
    sys.modules["openai"] = openai_stub

from backend.services import workflow_run_repository as run_repository
from backend.services import workflow_storage
from backend.services import workflow_executor
from backend.services.workflow_executor import (
    _build_initial_run_state,
    _execute_run,
    start_workflow_run,
)
from backend.services.workflow_run_repository import (
    MAX_RESULT_SUMMARY_CHARS,
    RunStateConflictError,
    _truncate_result,
    _truncate_value,
    check_idempotency_key,
    create_run_if_absent,
    get_run,
    get_run_events,
    list_runs,
    mark_interrupted,
    recover_incomplete_runs,
    request_cancellation,
    store_run,
    update_run,
)
from backend.services.workflow_storage import (
    _compute_execution_order,
    create_workflow,
    get_workflow,
    normalize_workflow_definition,
    update_workflow,
)
from backend.services.workflow_validator import (
    WorkflowValidationError,
    assert_valid_workflow,
    validate_workflow_definition,
)


def _make_workflow(
    node_count=3,
    *,
    continue_on_error=False,
    workflow_id=None,
):
    """Create a small linear workflow using supported commands."""
    commands = ["/summary", "/outliers", "/insights"]
    nodes = [
        {
            "id": f"node-{index}",
            "type": commands[index % len(commands)].lstrip("/"),
            "label": f"Step {index}",
            "command": commands[index % len(commands)],
            "params": {},
            "position": {"x": index * 200, "y": 100},
        }
        for index in range(node_count)
    ]
    edges = [
        {
            "id": f"edge-{index}",
            "source": f"node-{index}",
            "target": f"node-{index + 1}",
        }
        for index in range(node_count - 1)
    ]
    return normalize_workflow_definition({
        "id": workflow_id or uuid.uuid4().hex,
        "name": "Reliability Test",
        "nodes": nodes,
        "edges": edges,
        "continue_on_error": continue_on_error,
    })


def _make_run(status="queued", *, workflow=None):
    """Create a repository-ready run without starting a background thread."""
    workflow = workflow or _make_workflow(2)
    return _build_initial_run_state(workflow, [{"value": 1}], None) | {
        "status": status,
    }


class WorkflowReliabilityTests(unittest.TestCase):
    """Exercise validation, persistence, execution, and route compatibility."""

    def setUp(self):
        self._temp_dir = tempfile.TemporaryDirectory()
        self.temp_path = Path(self._temp_dir.name)
        self.run_dir = self.temp_path / "workflow_runs"
        self.workflow_dir = self.temp_path / "workflows"
        self.run_dir.mkdir()
        self.workflow_dir.mkdir()

        self._patchers = [
            patch.object(run_repository, "RUN_STORAGE_DIR", self.run_dir),
            patch.object(run_repository, "_CACHE", {}),
            patch.object(run_repository, "_LIVE_RESULTS", run_repository.OrderedDict()),
            patch.object(
                workflow_storage,
                "WORKFLOW_STORAGE_DIR",
                self.workflow_dir,
            ),
        ]
        for patcher in self._patchers:
            patcher.start()

    def tearDown(self):
        for patcher in reversed(self._patchers):
            patcher.stop()
        self._temp_dir.cleanup()

    def _persist_for_execution(self, workflow):
        run = _build_initial_run_state(workflow, [{"value": 1}], None)
        stored, created = create_run_if_absent(run)
        self.assertTrue(created)
        return stored

    def test_valid_dag_has_canonical_topological_order(self):
        workflow = _make_workflow(3)
        self.assertEqual(
            workflow["graph"]["execution_order"],
            ["node-0", "node-1", "node-2"],
        )
        self.assertEqual(validate_workflow_definition(workflow), [])

    def test_cycle_is_rejected_without_position_fallback(self):
        nodes = [
            {"id": "a", "command": "/summary", "params": {}},
            {"id": "b", "command": "/insights", "params": {}},
        ]
        edges = [
            {"source": "a", "target": "b"},
            {"source": "b", "target": "a"},
        ]
        with self.assertRaisesRegex(ValueError, "cycle"):
            _compute_execution_order(nodes, edges)

        cyclic = {"graph": {"nodes": nodes, "edges": edges}}
        with self.assertRaises(WorkflowValidationError):
            assert_valid_workflow(cyclic)

    def test_malformed_graph_shapes_are_structured_errors(self):
        malformed = {
            "graph": {
                "nodes": [
                    {"id": "missing-command", "params": {}},
                    {"id": "bad-params", "command": "/summary", "params": "x"},
                ],
                "edges": [{"source": "missing-command", "target": "ghost"}],
            }
        }
        errors = validate_workflow_definition(malformed)
        codes = {error["code"] for error in errors}
        self.assertIn("MISSING_COMMAND", codes)
        self.assertIn("MALFORMED_PARAMS", codes)
        self.assertIn("DANGLING_EDGE", codes)

    def test_duplicate_nodes_and_unsupported_commands_are_rejected(self):
        malformed = {
            "graph": {
                "nodes": [
                    {"id": "same", "command": "/summary", "params": {}},
                    {"id": "same", "command": "/unknown", "params": {}},
                ],
                "edges": [],
            }
        }
        codes = {
            error["code"]
            for error in validate_workflow_definition(malformed)
        }
        self.assertIn("DUPLICATE_NODE_ID", codes)
        self.assertIn("UNSUPPORTED_COMMAND", codes)

    def test_invalid_execution_orders_are_rejected(self):
        workflow = _make_workflow(2)
        graph = workflow["graph"]

        reverse = copy.deepcopy(workflow)
        reverse["graph"]["execution_order"] = ["node-1", "node-0"]
        self.assertIn(
            "INVALID_EXECUTION_ORDER",
            {
                error["code"]
                for error in validate_workflow_definition(reverse)
            },
        )

        omitted = copy.deepcopy(workflow)
        omitted["graph"]["execution_order"] = ["node-0"]
        self.assertIn(
            "INVALID_EXECUTION_ORDER",
            {
                error["code"]
                for error in validate_workflow_definition(omitted)
            },
        )

        duplicate = copy.deepcopy(workflow)
        duplicate["graph"]["execution_order"] = ["node-0", "node-0"]
        self.assertIn(
            "INVALID_EXECUTION_ORDER",
            {
                error["code"]
                for error in validate_workflow_definition(duplicate)
            },
        )

        self.assertEqual(graph["execution_order"], ["node-0", "node-1"])

    def test_metadata_only_update_preserves_saved_graph(self):
        created = create_workflow(_make_workflow(2))
        updated = update_workflow(created["id"], {"name": "Renamed"})
        self.assertEqual(updated["name"], "Renamed")
        self.assertEqual(len(updated["nodes"]), 2)
        self.assertEqual(len(updated["edges"]), 1)

        disconnected = update_workflow(created["id"], {"edges": []})
        self.assertEqual(disconnected["edges"], [])
        self.assertEqual(
            set(disconnected["execution_order"]),
            {"node-0", "node-1"},
        )

        with self.assertRaises(WorkflowValidationError):
            update_workflow(created["id"], {"nodes": []})

    def test_idempotent_creation_is_atomic_and_does_not_store_raw_key(self):
        results = []
        result_lock = threading.Lock()
        barrier = threading.Barrier(8)

        def submit():
            candidate = _make_run()
            barrier.wait()
            result = create_run_if_absent(
                candidate,
                idempotency_key="shared-client-key",
            )
            with result_lock:
                results.append(result)

        threads = [threading.Thread(target=submit) for _ in range(8)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=5)

        self.assertTrue(all(not thread.is_alive() for thread in threads))
        self.assertEqual(sum(1 for _, created in results if created), 1)
        self.assertEqual(len({run["run_id"] for run, _ in results}), 1)
        stored = results[0][0]
        self.assertNotIn("idempotency_key", stored)
        self.assertIn("idempotency_key_hash", stored)
        self.assertEqual(
            check_idempotency_key("shared-client-key")["run_id"],
            stored["run_id"],
        )

    def test_start_run_preserves_execute_contract_and_idempotency(self):
        workflow = _make_workflow(1)
        fake_thread = MagicMock()
        fake_thread.start.return_value = None
        with patch(
            "backend.services.workflow_executor.threading.Thread",
            return_value=fake_thread,
        ) as thread_factory:
            first = start_workflow_run(
                workflow,
                [{"value": 1}],
                idempotency_key="request-key",
            )
            second = start_workflow_run(
                workflow,
                [{"value": 1}],
                idempotency_key="request-key",
            )

        self.assertEqual(first["run_id"], second["run_id"])
        self.assertEqual(thread_factory.call_count, 1)
        fake_thread.start.assert_called_once()

    def test_run_is_durable_after_cache_is_cleared(self):
        stored = store_run(_make_run())
        self.assertTrue((self.run_dir / f"{stored['run_id']}.json").exists())
        run_repository._CACHE.clear()
        retrieved = get_run(stored["run_id"])
        self.assertEqual(retrieved["run_id"], stored["run_id"])
        self.assertEqual(retrieved["revision"], 1)

    def test_restart_marks_non_terminal_runs_interrupted(self):
        queued = store_run(_make_run("queued"))
        running = store_run(_make_run("queued"))
        update_run(
            running["run_id"],
            lambda run: run.update({"status": "running"}) or run,
        )
        completed = store_run(_make_run("queued"))
        update_run(
            completed["run_id"],
            lambda run: run.update({"status": "running"}) or run,
        )
        update_run(
            completed["run_id"],
            lambda run: run.update({"status": "completed"}) or run,
        )

        interrupted = recover_incomplete_runs()
        self.assertIn(queued["run_id"], interrupted)
        self.assertIn(running["run_id"], interrupted)
        self.assertNotIn(completed["run_id"], interrupted)
        self.assertEqual(get_run(queued["run_id"])["status"], "interrupted")

    def test_queued_cancellation_is_immediate(self):
        run = store_run(_make_run())
        cancelled = request_cancellation(run["run_id"])
        self.assertEqual(cancelled["status"], "cancelled")
        self.assertIsNotNone(cancelled["finished_at"])

    def test_cancellation_between_nodes_preserves_completed_result(self):
        workflow = _make_workflow(2)
        run = self._persist_for_execution(workflow)
        call_count = 0

        def execute_then_cancel(*_args, **_kwargs):
            nonlocal call_count
            call_count += 1
            request_cancellation(run["run_id"])
            return {"reply": "first node completed"}

        with patch(
            "backend.services.workflow_executor.execute_ai_command",
            side_effect=execute_then_cancel,
        ):
            _execute_run(run["run_id"], workflow, [{"value": 1}])

        finished = get_run(run["run_id"])
        self.assertEqual(call_count, 1)
        self.assertEqual(finished["status"], "cancelled")
        self.assertEqual(
            finished["node_states"]["node-0"]["status"],
            "completed",
        )
        self.assertEqual(
            finished["node_states"]["node-1"]["status"],
            "skipped",
        )

    def test_cancellation_during_final_node_is_not_overwritten(self):
        workflow = _make_workflow(1)
        run = self._persist_for_execution(workflow)
        command_started = threading.Event()
        command_release = threading.Event()

        def blocking_command(*_args, **_kwargs):
            command_started.set()
            self.assertTrue(command_release.wait(timeout=5))
            return {"reply": "completed active command"}

        with patch(
            "backend.services.workflow_executor.execute_ai_command",
            side_effect=blocking_command,
        ):
            executor = threading.Thread(
                target=_execute_run,
                args=(run["run_id"], workflow, [{"value": 1}]),
            )
            executor.start()
            self.assertTrue(command_started.wait(timeout=5))
            requested = request_cancellation(run["run_id"])
            self.assertEqual(requested["status"], "cancel_requested")
            command_release.set()
            executor.join(timeout=5)

        self.assertFalse(executor.is_alive())
        finished = get_run(run["run_id"])
        self.assertEqual(finished["status"], "cancelled")
        self.assertEqual(
            finished["node_states"]["node-0"]["status"],
            "completed",
        )

    def test_terminal_state_cannot_be_overwritten_by_stale_update(self):
        run = store_run(_make_run())
        update_run(
            run["run_id"],
            lambda state: state.update({"status": "running"}) or state,
        )
        stale = get_run(run["run_id"])
        update_run(
            run["run_id"],
            lambda state: state.update({"status": "completed"}) or state,
        )

        stale["status"] = "cancel_requested"
        preserved = store_run(stale)
        self.assertEqual(preserved["status"], "completed")

        newer_terminal = copy.deepcopy(stale)
        newer_terminal["status"] = "cancelled"
        preserved_again = store_run(newer_terminal)
        self.assertEqual(preserved_again["status"], "completed")

    def test_non_terminal_stale_write_is_rejected(self):
        run = store_run(_make_run())
        stale = get_run(run["run_id"])
        update_run(
            run["run_id"],
            lambda state: state.update({"status": "running"}) or state,
        )
        stale["status"] = "running"
        with self.assertRaises(RunStateConflictError):
            store_run(stale)

    def test_failed_node_stops_remaining_nodes_by_default(self):
        workflow = _make_workflow(2, continue_on_error=False)
        run = self._persist_for_execution(workflow)
        with patch(
            "backend.services.workflow_executor.execute_ai_command",
            side_effect=RuntimeError("expected failure"),
        ) as command, patch.object(workflow_executor.logger, "exception"):
            _execute_run(run["run_id"], workflow, [{"value": 1}])

        finished = get_run(run["run_id"])
        self.assertEqual(finished["status"], "failed")
        self.assertEqual(command.call_count, 1)
        self.assertEqual(
            finished["node_states"]["node-1"]["status"],
            "skipped",
        )

    def test_continue_on_error_executes_later_nodes(self):
        workflow = _make_workflow(2, continue_on_error=True)
        run = self._persist_for_execution(workflow)
        with patch(
            "backend.services.workflow_executor.execute_ai_command",
            side_effect=[
                RuntimeError("expected failure"),
                {"reply": "second node completed"},
            ],
        ) as command, patch.object(workflow_executor.logger, "exception"):
            _execute_run(run["run_id"], workflow, [{"value": 1}])

        finished = get_run(run["run_id"])
        self.assertEqual(finished["status"], "failed")
        self.assertEqual(command.call_count, 2)
        self.assertEqual(
            finished["node_states"]["node-1"]["status"],
            "completed",
        )

    def test_event_order_follows_real_execution(self):
        workflow = _make_workflow(1)
        run = self._persist_for_execution(workflow)
        with patch(
            "backend.services.workflow_executor.execute_ai_command",
            return_value={"reply": "ok"},
        ):
            _execute_run(run["run_id"], workflow, [{"value": 1}])

        finished = get_run(run["run_id"])
        event_types = [event["type"] for event in finished["events"]]
        self.assertEqual(
            event_types,
            ["queued", "started", "node_started", "node_completed", "finished"],
        )
        timestamps = [event["timestamp"] for event in finished["events"]]
        self.assertEqual(timestamps, sorted(timestamps))

    def test_run_and_event_pagination_are_bounded(self):
        for index in range(5):
            run = _make_run()
            run["workflow_id"] = "paged-workflow"
            run["events"].append({
                "timestamp": f"2026-07-01T00:00:0{index}+00:00",
                "type": "test",
                "node_id": None,
                "message": f"event {index}",
            })
            store_run(run)

        page = list_runs(
            workflow_id="paged-workflow",
            limit=2,
            offset=1,
        )
        self.assertEqual(page["total"], 5)
        self.assertEqual(len(page["runs"]), 2)

        events = get_run_events(page["runs"][0]["run_id"], limit=1)
        self.assertEqual(len(events["events"]), 1)
        self.assertEqual(events["limit"], 1)

    def test_results_are_truncated_and_sensitive_fields_redacted(self):
        long_text = "x" * (MAX_RESULT_SUMMARY_CHARS + 100)
        self.assertTrue(_truncate_value(long_text).endswith("… [truncated]"))

        safe = _truncate_result({
            "reply": long_text,
            "cleaned_data": [{"secret": "row"}],
            "api_key": "do-not-store",
            "nested": {"access_token": "also-secret"},
        })
        self.assertIn("truncated", safe["reply"])
        self.assertEqual(safe["cleaned_data"], "[1 items]")
        self.assertEqual(safe["api_key"], "[redacted]")
        self.assertEqual(safe["nested"]["access_token"], "[redacted]")

        run = _make_run()
        run["results"]["node-0"]["result"] = {
            "password": "sensitive",
            "rows": [{"value": 1}],
        }
        stored = store_run(run)
        payload = json.loads(
            (self.run_dir / f"{stored['run_id']}.json").read_text()
        )
        persisted = payload["results"]["node-0"]["result"]
        self.assertEqual(persisted["password"], "[redacted]")
        self.assertEqual(persisted["rows"], "[1 items]")

    def test_live_result_overlay_is_available_but_never_persisted(self):
        workflow = normalize_workflow_definition({
            "name": "Cleaning",
            "nodes": [{
                "id": "clean",
                "command": "/clean",
                "params": {"instructions": "Normalize values."},
            }],
            "edges": [],
        })
        run = self._persist_for_execution(workflow)
        cleaned_rows = [{"value": index} for index in range(30)]

        with patch(
            "backend.services.workflow_executor.execute_ai_command",
            return_value={"cleaned_data": cleaned_rows},
        ):
            _execute_run(run["run_id"], workflow, [{"value": 1}])

        live = get_run(run["run_id"])
        self.assertEqual(
            live["results"]["clean"]["result"]["cleaned_data"],
            cleaned_rows,
        )

        payload = json.loads(
            (self.run_dir / f"{run['run_id']}.json").read_text()
        )
        self.assertEqual(
            payload["results"]["clean"]["result"]["cleaned_data"],
            "[30 items]",
        )

    def test_downstream_node_receives_full_transient_predecessor_result(self):
        cleaned_rows = [{"value": index} for index in range(25)]
        workflow = normalize_workflow_definition({
            "name": "Cleaning then insights",
            "nodes": [
                {
                    "id": "clean",
                    "command": "/clean",
                    "params": {"instructions": "Normalize values."},
                },
                {
                    "id": "insights",
                    "command": "/insights",
                    "params": {},
                },
            ],
            "edges": [{"source": "clean", "target": "insights"}],
        })
        run = self._persist_for_execution(workflow)

        def execute(command, dataset, **kwargs):
            if command == "/clean":
                return {"cleaned_data": cleaned_rows}
            self.assertEqual(dataset, cleaned_rows)
            upstream = kwargs["execution_context"]["upstream_results"]
            self.assertEqual(
                upstream["clean"]["result"]["cleaned_data"],
                cleaned_rows,
            )
            return {"reply": "used full predecessor result"}

        with patch(
            "backend.services.workflow_executor.execute_ai_command",
            side_effect=execute,
        ):
            _execute_run(run["run_id"], workflow, [{"value": 1}])

        self.assertEqual(get_run(run["run_id"])["status"], "completed")

    def test_mark_interrupted_explains_reason(self):
        run = store_run(_make_run())
        interrupted = mark_interrupted(run["run_id"], "test restart")
        self.assertEqual(interrupted["status"], "interrupted")
        self.assertIn(
            "test restart",
            interrupted["events"][-1]["message"],
        )

    def test_existing_and_new_routes_are_registered(self):
        from backend.app import create_app

        app = create_app()
        rules = {rule.rule for rule in app.url_map.iter_rules()}
        expected = {
            "/api/workflows",
            "/api/workflows/<workflow_id>",
            "/api/workflows/<workflow_id>/duplicate",
            "/api/workflows/from-template/<template_id>",
            "/api/workflows/execute",
            "/api/workflows/runs",
            "/api/workflows/runs/<run_id>",
            "/api/workflows/runs/<run_id>/cancel",
            "/api/workflows/runs/<run_id>/events",
        }
        self.assertTrue(expected.issubset(rules))

    def test_route_returns_structured_validation_errors(self):
        from backend.app import create_app

        app = create_app()
        client = app.test_client()
        response = client.post(
            "/api/workflows",
            json={
                "name": "Invalid",
                "nodes": [{"id": "node-without-command", "params": {}}],
                "edges": [],
            },
        )
        self.assertEqual(response.status_code, 400)
        body = response.get_json()
        self.assertEqual(body["error"], "Validation failed.")
        self.assertEqual(body["details"][0]["code"], "MISSING_COMMAND")

    def test_get_workflow_reads_saved_definition(self):
        created = create_workflow(_make_workflow(1))
        retrieved = get_workflow(created["id"])
        self.assertEqual(retrieved["id"], created["id"])
        self.assertEqual(len(retrieved["nodes"]), 1)


if __name__ == "__main__":
    unittest.main()
