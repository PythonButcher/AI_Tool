"""Focused tests for asynchronous, durable ML Studio run execution."""

from __future__ import annotations

import tempfile
import threading
import unittest
from dataclasses import replace
from pathlib import Path

from backend.ml_studio.contracts import StructuredError
from backend.ml_studio.execution import AsyncRunExecutor
from backend.ml_studio.repository import MLStudioRepository
from backend.ml_studio.service import MLStudioService
from tests.test_ml_studio_persistence import SHA, evaluation, experiment, snapshot


def truth() -> dict:
    return {
        "workspace_id": "workspace-1",
        "workspace_version": 3,
        "source_ids": ["source-1"],
        "relationship_ids": [],
        "source_fingerprints": [
            {"source_id": "source-1", "content_fingerprint": f"sha256:{SHA}", "schema_version": 2}
        ],
        "schema_version": 2,
        "semantic_model_version": "semantic-v2",
        "governance_result": {"status": "ready", "reasons": []},
        "transformation_recipe_hash": f"sha256:{SHA}",
        "row_count": 100,
        "column_profile": [
            {"name": "feature", "logical_type": "numeric", "null_count": 0, "distinct_count": 100},
            {"name": "target", "logical_type": "numeric", "null_count": 0, "distinct_count": 92},
        ],
    }


def run_request() -> dict:
    return {
        "experiment_id": "experiment-1",
        "specification_version": 1,
        "snapshot_id": "snapshot-1",
        "parameters": {"alpha": 0.5},
        "environment": {"python": "3.11"},
        "code_revision": "abcdef1",
    }


class AsyncRunExecutionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.repository = MLStudioRepository(Path(self.temporary.name) / "ml.sqlite3")
        self.repository.create_snapshot(snapshot())
        self.repository.create_experiment(experiment())
        self.executors: list[AsyncRunExecutor] = []

    def tearDown(self) -> None:
        for executor in self.executors:
            executor.shutdown()
        self.temporary.cleanup()

    def make_service(self, evaluator) -> tuple[MLStudioService, AsyncRunExecutor]:
        service = MLStudioService(
            self.repository,
            lambda workspace_id: truth(),
            lambda metadata: None,
            run_data_resolver=lambda stored_snapshot: (
                object(),
                3,
                {"source-1": (f"sha256:{SHA}", 2)},
            ),
            run_evaluator=evaluator,
        )
        executor = AsyncRunExecutor(service.execute_run, max_workers=1)
        service.set_run_scheduler(executor.schedule)
        self.executors.append(executor)
        return service, executor

    @staticmethod
    def successful_evaluator(data, run, specification, **identity):
        return replace(evaluation(run.run_id), dataset_snapshot=run.dataset_snapshot)

    def test_submission_schedules_and_completes_with_durable_progress(self) -> None:
        service, executor = self.make_service(self.successful_evaluator)

        submitted, created = service.submit_run(run_request(), idempotency_key="execute-once")

        self.assertTrue(created)
        self.assertTrue(executor.wait_for_idle(timeout=5))
        completed = service.get_run(submitted["run_id"])
        self.assertEqual(completed["status"], "completed")
        self.assertEqual(completed["progress_stage"], "completed")
        self.assertEqual(completed["evaluation_result"]["run_id"], submitted["run_id"])
        events = service.get_events(submitted["run_id"])
        stages = {item["progress_stage"] for item in events}
        self.assertTrue({"resolving_dataset", "validating_snapshot", "evaluating_candidates", "completed"}.issubset(stages))

    def test_running_cancellation_is_honored_after_cooperative_evaluation_boundary(self) -> None:
        evaluating = threading.Event()
        release = threading.Event()

        def slow_evaluator(data, run, specification, **identity):
            evaluating.set()
            release.wait(timeout=5)
            return replace(evaluation(run.run_id), dataset_snapshot=run.dataset_snapshot)

        service, executor = self.make_service(slow_evaluator)
        submitted, _ = service.submit_run(run_request(), idempotency_key="cancel-running")
        self.assertTrue(evaluating.wait(timeout=5))

        requested = service.cancel_run(submitted["run_id"])
        self.assertEqual(requested["status"], "cancel_requested")
        release.set()

        self.assertTrue(executor.wait_for_idle(timeout=5))
        self.assertEqual(service.get_run(submitted["run_id"])["status"], "cancelled")

    def test_expected_evaluation_refusal_persists_only_structured_failure(self) -> None:
        class ExpectedEvaluationFailure(ValueError):
            def __init__(self, error: StructuredError) -> None:
                super().__init__(error.message)
                self.error = error

        def blocked_evaluator(data, run, specification, **identity):
            raise ExpectedEvaluationFailure(
                StructuredError(
                    code="insufficient_rows",
                    message="The governed dataset is too small for this evaluation.",
                    remediation="Provide more rows and submit a new run.",
                )
            )

        service, executor = self.make_service(blocked_evaluator)
        submitted, _ = service.submit_run(run_request(), idempotency_key="blocked-run")

        self.assertTrue(executor.wait_for_idle(timeout=5))
        failed = service.get_run(submitted["run_id"])
        self.assertEqual(failed["status"], "failed")
        self.assertEqual(failed["failure"]["code"], "insufficient_rows")
        self.assertNotIn("traceback", str(failed).casefold())

    def test_idempotent_retry_does_not_schedule_duplicate_execution(self) -> None:
        calls = 0
        calls_lock = threading.Lock()

        def counting_evaluator(data, run, specification, **identity):
            nonlocal calls
            with calls_lock:
                calls += 1
            return replace(evaluation(run.run_id), dataset_snapshot=run.dataset_snapshot)

        service, executor = self.make_service(counting_evaluator)
        first, created = service.submit_run(run_request(), idempotency_key="same-intent")
        repeated, repeated_created = service.submit_run(run_request(), idempotency_key="same-intent")

        self.assertTrue(created)
        self.assertFalse(repeated_created)
        self.assertEqual(first["run_id"], repeated["run_id"])
        self.assertTrue(executor.wait_for_idle(timeout=5))
        self.assertEqual(calls, 1)


if __name__ == "__main__":
    unittest.main()
