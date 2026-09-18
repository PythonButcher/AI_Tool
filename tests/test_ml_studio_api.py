"""Endpoint and application-service tests for the identity-first ML Studio API."""

from __future__ import annotations

import tempfile
import unittest
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path

from flask import Flask

from backend.ml_studio.artifacts import ArtifactMetadata
from backend.ml_studio.repository import MLStudioRepository
from backend.ml_studio.service import MLStudioService, _snapshot_from_dict
from backend.routes.ml_studio import ml_studio_bp
from tests.test_ml_studio_persistence import SHA, evaluation, experiment


NOW = datetime(2026, 9, 17, 12, tzinfo=UTC)


def resolved_truth(*, workspace_version: int = 3, governance_status: str = "ready") -> dict:
    return {
        "workspace_id": "workspace-1",
        "workspace_version": workspace_version,
        "source_ids": ["source-1"],
        "relationship_ids": [],
        "source_fingerprints": [
            {
                "source_id": "source-1",
                "content_fingerprint": f"sha256:{SHA}",
                "schema_version": 2,
            }
        ],
        "schema_version": 2,
        "semantic_model_version": f"sha256:{'b' * 64}",
        "governance_result": {"status": governance_status, "reasons": []},
        "transformation_recipe_hash": f"sha256:{'c' * 64}",
        "row_count": 100,
        "column_profile": [
            {"name": "feature", "logical_type": "numeric", "null_count": 0, "distinct_count": 100},
            {"name": "target", "logical_type": "numeric", "null_count": 0, "distinct_count": 92},
        ],
    }


def snapshot_request(**overrides: object) -> dict:
    value = {
        "workspace_id": "workspace-1",
        "workspace_version": 3,
        "source_ids": ["source-1"],
        "relationship_ids": [],
    }
    value.update(overrides)
    return value


def run_request(snapshot_id: str, **overrides: object) -> dict:
    value = {
        "experiment_id": "experiment-1",
        "specification_version": 1,
        "snapshot_id": snapshot_id,
        "parameters": {"alpha": 0.5},
        "environment": {"python": "3.11"},
        "code_revision": "abcdef1",
    }
    value.update(overrides)
    return value


class MLStudioApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.truth = resolved_truth()
        self.repository = MLStudioRepository(self.root / "ml.sqlite3")
        self.artifact_verification_error = False

        def verify_artifact(metadata):
            if self.artifact_verification_error:
                raise ValueError("injected integrity failure")

        self.service = MLStudioService(
            self.repository,
            lambda workspace_id: dict(self.truth),
            verify_artifact,
            clock=lambda: NOW,
        )
        app = Flask(__name__)
        app.config.update(TESTING=True, ML_STUDIO_SERVICE=self.service)
        app.register_blueprint(ml_studio_bp)
        self.client = app.test_client()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _create_snapshot(self) -> dict:
        response = self.client.post("/api/ml-studio/v1/snapshots", json=snapshot_request())
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()["snapshot"]

    def _create_experiment(self) -> dict:
        response = self.client.post("/api/ml-studio/v1/experiments", json=experiment().to_dict())
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()["experiment"]

    def _submit_run(self, snapshot_id: str, *, key: str, **overrides: object) -> dict:
        response = self.client.post(
            "/api/ml-studio/v1/runs",
            json=run_request(snapshot_id, **overrides),
            headers={"Idempotency-Key": key},
        )
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()["run"]

    def _complete_run(self, run: dict, snapshot_payload: dict) -> None:
        snapshot = _snapshot_from_dict(snapshot_payload)
        result = replace(evaluation(run["run_id"]), dataset_snapshot=snapshot)
        self.repository.transition_run(run["run_id"], "running")
        self.repository.transition_run(run["run_id"], "completed", evaluation_result=result)

    def test_snapshot_is_resolved_and_persisted_without_client_rows_or_paths(self) -> None:
        snapshot = self._create_snapshot()
        self.assertEqual(snapshot["workspace_version"], 3)
        self.assertEqual(snapshot["source_ids"], ["source-1"])
        self.assertIsNotNone(self.repository.get_snapshot(snapshot["snapshot_id"]))
        serialized = str(snapshot).casefold()
        self.assertNotIn("rows", serialized)
        self.assertNotIn("path", serialized)

        rejected = self.client.post(
            "/api/ml-studio/v1/snapshots",
            json={**snapshot_request(), "rows": [{"private": "value"}]},
        )
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(rejected.get_json()["error"]["code"], "invalid_request_fields")

    def test_snapshot_rejects_stale_workspace_or_source_order(self) -> None:
        stale = self.client.post(
            "/api/ml-studio/v1/snapshots", json=snapshot_request(workspace_version=2)
        )
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.get_json()["error"]["code"], "snapshot_identity_stale")
        wrong_source = self.client.post(
            "/api/ml-studio/v1/snapshots", json=snapshot_request(source_ids=["source-other"])
        )
        self.assertEqual(wrong_source.status_code, 409)

    def test_snapshot_rejects_blocked_governance(self) -> None:
        self.truth = resolved_truth(governance_status="blocked")
        response = self.client.post("/api/ml-studio/v1/snapshots", json=snapshot_request())
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.get_json()["error"]["code"], "snapshot_governance_blocked")

    def test_experiment_versions_are_versioned_and_monotonic(self) -> None:
        self._create_experiment()
        second = replace(experiment(), specification_version=2).to_dict()
        self.assertEqual(self.client.post("/api/ml-studio/v1/experiments", json=second).status_code, 201)
        listed = self.client.get("/api/ml-studio/v1/experiments/experiment-1/versions")
        self.assertEqual([item["specification_version"] for item in listed.get_json()["experiments"]], [1, 2])
        conflict = self.client.post("/api/ml-studio/v1/experiments", json=second)
        self.assertEqual(conflict.status_code, 409)
        unsupported = {**experiment().to_dict(), "contract_version": "ml_studio_contract_v999"}
        self.assertEqual(self.client.post("/api/ml-studio/v1/experiments", json=unsupported).status_code, 400)

    def test_run_submission_requires_idempotency_and_reuses_identical_request(self) -> None:
        snapshot = self._create_snapshot()
        self._create_experiment()
        missing = self.client.post("/api/ml-studio/v1/runs", json=run_request(snapshot["snapshot_id"]))
        self.assertEqual(missing.status_code, 400)
        first = self.client.post(
            "/api/ml-studio/v1/runs",
            json=run_request(snapshot["snapshot_id"]),
            headers={"Idempotency-Key": "stable-key"},
        )
        repeated = self.client.post(
            "/api/ml-studio/v1/runs",
            json=run_request(snapshot["snapshot_id"]),
            headers={"Idempotency-Key": "stable-key"},
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(repeated.status_code, 200)
        self.assertFalse(repeated.get_json()["created"])
        self.assertEqual(first.get_json()["run"]["run_id"], repeated.get_json()["run"]["run_id"])
        self.assertNotIn("idempotency", str(first.get_json()).casefold())

    def test_run_submission_revalidates_snapshot_server_truth(self) -> None:
        snapshot = self._create_snapshot()
        self._create_experiment()
        self.truth = resolved_truth(workspace_version=4)
        response = self.client.post(
            "/api/ml-studio/v1/runs",
            json=run_request(snapshot["snapshot_id"]),
            headers={"Idempotency-Key": "stale-key"},
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["error"]["code"], "snapshot_identity_stale")

    def test_idempotency_key_cannot_be_reused_for_different_run_intent(self) -> None:
        snapshot = self._create_snapshot()
        self._create_experiment()
        self._submit_run(snapshot["snapshot_id"], key="one-intent")
        response = self.client.post(
            "/api/ml-studio/v1/runs",
            json=run_request(snapshot["snapshot_id"], parameters={"alpha": 0.9}),
            headers={"Idempotency-Key": "one-intent"},
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["error"]["code"], "idempotency_key_conflict")

    def test_run_submission_rejects_client_paths_rows_and_secret_fields(self) -> None:
        snapshot = self._create_snapshot()
        self._create_experiment()
        unsafe_parameters = (
            {"storage_path": "C:\\private\\model.bin"},
            {"rows": [{"value": 1}]},
            {"api_key": "secret-value"},
        )
        for index, parameters in enumerate(unsafe_parameters):
            with self.subTest(parameters=parameters):
                response = self.client.post(
                    "/api/ml-studio/v1/runs",
                    json=run_request(snapshot["snapshot_id"], parameters=parameters),
                    headers={"Idempotency-Key": f"unsafe-{index}"},
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.get_json()["error"]["code"], "run_submission_unsafe")

    def test_run_read_events_and_cancellation_use_durable_state(self) -> None:
        snapshot = self._create_snapshot()
        self._create_experiment()
        run = self._submit_run(snapshot["snapshot_id"], key="cancel-key")
        fetched = self.client.get(f"/api/ml-studio/v1/runs/{run['run_id']}")
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(fetched.get_json()["run"]["artifacts"], [])
        events = self.client.get(f"/api/ml-studio/v1/runs/{run['run_id']}/events")
        self.assertEqual(events.get_json()["events"][0]["event_type"], "submitted")
        cancelled = self.client.post(f"/api/ml-studio/v1/runs/{run['run_id']}/cancel")
        self.assertEqual(cancelled.get_json()["run"]["status"], "cancelled")
        unavailable = self.client.get(f"/api/ml-studio/v1/runs/{run['run_id']}/evaluation")
        self.assertEqual(unavailable.status_code, 409)

    def test_comparison_returns_only_compatible_completed_evidence(self) -> None:
        snapshot = self._create_snapshot()
        self._create_experiment()
        first = self._submit_run(snapshot["snapshot_id"], key="compare-1")
        second = self._submit_run(snapshot["snapshot_id"], key="compare-2")
        self._complete_run(first, snapshot)
        self._complete_run(second, snapshot)
        response = self.client.post(
            "/api/ml-studio/v1/runs/compare", json={"run_ids": [first["run_id"], second["run_id"]]}
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(len(response.get_json()["comparison"]["runs"]), 2)

    def test_comparison_rejects_incomplete_runs(self) -> None:
        snapshot = self._create_snapshot()
        self._create_experiment()
        first = self._submit_run(snapshot["snapshot_id"], key="compare-1")
        second = self._submit_run(snapshot["snapshot_id"], key="compare-2")
        response = self.client.post(
            "/api/ml-studio/v1/runs/compare", json={"run_ids": [first["run_id"], second["run_id"]]}
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["error"]["code"], "comparison_run_incomplete")

    def test_candidate_review_requires_registered_server_artifact(self) -> None:
        snapshot = self._create_snapshot()
        self._create_experiment()
        run = self._submit_run(snapshot["snapshot_id"], key="candidate-1")
        self._complete_run(run, snapshot)
        request_body = {
            "run_id": run["run_id"],
            "artifact_hash": f"sha256:{'d' * 64}",
            "review_status": "reviewed_candidate",
            "reviewed_by": "reviewer-1",
            "intended_use": "Offline analysis",
            "prohibited_use": ["Automated deployment"],
        }
        rejected = self.client.post("/api/ml-studio/v1/candidates", json=request_body)
        self.assertEqual(rejected.status_code, 409)
        self.repository.register_artifact(
            ArtifactMetadata(
                run_id=run["run_id"],
                name="model.bin",
                sha256=request_body["artifact_hash"],
                size_bytes=10,
                media_type="application/octet-stream",
                created_at=NOW.isoformat(),
            )
        )
        self.artifact_verification_error = True
        integrity_failure = self.client.post("/api/ml-studio/v1/candidates", json=request_body)
        self.assertEqual(integrity_failure.status_code, 409)
        self.artifact_verification_error = False
        accepted = self.client.post("/api/ml-studio/v1/candidates", json=request_body)
        self.assertEqual(accepted.status_code, 201, accepted.get_json())
        candidate = accepted.get_json()["candidate"]
        self.assertTrue(candidate["candidate_id"].startswith("candidate-"))
        fetched = self.client.get(f"/api/ml-studio/v1/candidates/{candidate['candidate_id']}")
        self.assertEqual(fetched.status_code, 200)

    def test_errors_are_stable_and_do_not_expose_paths_or_tracebacks(self) -> None:
        response = self.client.get("/api/ml-studio/v1/runs/missing-run")
        self.assertEqual(response.status_code, 404)
        error = response.get_json()["error"]
        self.assertEqual(set(error), {"code", "message", "remediation"})
        serialized = str(error).casefold()
        self.assertNotIn("traceback", serialized)
        self.assertNotIn(str(self.root).casefold(), serialized)

    def test_primary_app_registers_the_versioned_blueprint(self) -> None:
        from backend.app import create_app

        app = create_app({"TESTING": True, "ML_STUDIO_SERVICE": self.service})
        response = app.test_client().get("/api/ml-studio/v1/runs/missing-run")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["error"]["code"], "run_not_found")


if __name__ == "__main__":
    unittest.main()
