"""Real fitted pipelines, durable submission and process lifecycle evidence."""

from io import BytesIO
from time import sleep
import unittest
from unittest.mock import patch

import joblib
import numpy as np
import pandas as pd

from backend.ml_studio.artifacts import ManagedArtifactStore, ArtifactStoreError
from backend.ml_studio.repository import MLStudioRepository
from backend.ml_studio.training import run_with_limits, TrainingFailure, TrainingCancelled
from tests import test_ml_studio_configuration as configuration_tests


def stalled_worker(connection, data, config):
    sleep(20)


class WorkflowExecutionTests(unittest.TestCase):
    tearDown = configuration_tests.ConfigurationTests.tearDown
    assess = configuration_tests.ConfigurationTests.assess

    def setUp(self):
        configuration_tests.ConfigurationTests.setUp(self)
        rng = np.random.default_rng(52)
        feature = rng.normal(size=100)
        self.data = pd.DataFrame({"feature": feature, "target": 2 * feature + rng.normal(size=100), "row_id": [str(i) for i in range(100)]})
        self.store = ManagedArtifactStore(self.root / "artifacts")
        self.service._artifact_store = self.store
        self.service._run_data_resolver = lambda snapshot: (self.data.copy(), 3, {item["source_id"]: (item["content_fingerprint"], item["schema_version"]) for item in self.truth["source_fingerprints"]})
        self.ready = self.assess().get_json()
        self.config = self.ready["assessment"]["configuration"]
        self.runs_url = self.base + "/runs?workspace_id=workspace-1"

    def submit(self, key="training-1", etag=None):
        return self.client.post(self.runs_url, json={"configuration_id": self.config["configuration_id"]},
            headers={"If-Match": etag or self.ready["draft"]["etag"], "Idempotency-Key": key})

    def execute(self):
        response = self.submit()
        self.assertEqual(response.status_code, 201, response.get_json())
        run_id = response.get_json()["run"]["run_id"]
        self.service.execute_run(run_id)
        run = self.service.get_run(run_id)
        self.assertEqual(run["status"], "completed", run.get("failure"))
        return run

    def test_real_regression_development_and_verified_reload(self):
        run = self.execute()
        evidence = run["evaluation_result"]
        self.assertEqual(evidence["run_purpose"], "development_comparison")
        self.assertNotIn("final_holdout_metrics", evidence)
        self.assertEqual(len(evidence["candidates"]), 2)
        self.assertIn("rmse", evidence["baseline"]["metrics"])
        for metadata in run["artifacts"]:
            bundle = joblib.load(BytesIO(self.store.read_verified(metadata)))
            self.assertFalse(set(bundle["development_indices"]) & set(bundle["holdout_indices"]))
            self.assertEqual(len(bundle["holdout_indices"]), 20)
            self.assertTrue(np.isfinite(bundle["pipeline"].predict(self.data[["feature"]].iloc[:2])).all())
        reopened = MLStudioRepository(self.root / "ml.sqlite3").get_run(run["run_id"])
        self.assertEqual(reopened["evaluation_result"], evidence)
        stages = self.service.get_draft(self.draft["experiment_id"], "workspace-1")["workflow_state"]["stages"]
        self.assertEqual(next(stage["state"] for stage in stages if stage["stage"] == "Review Results"), "available")

    def test_real_classification_development_and_confusion_evidence(self):
        self.data["target"] = np.where(self.data["target"] > 0, "high", "low")
        changed = self.service.update_draft(self.draft["experiment_id"], "workspace-1", self.ready["draft"]["etag"], {"task_type": "classification"})
        self.ready = self.service.assess_draft(self.draft["experiment_id"], "workspace-1", changed["draft"]["etag"], {})
        self.config = self.ready["assessment"]["configuration"]
        run = self.execute()
        for candidate in run["evaluation_result"]["candidates"]:
            self.assertIn("balanced_accuracy", candidate["metrics"])
            self.assertEqual(candidate["evidence"]["kind"], "confusion_matrix")
            self.assertEqual(sum(map(sum, candidate["evidence"]["counts"])), 80)

    def test_retry_scoping_single_active_and_restart_recovery(self):
        first = self.submit().get_json()["run"]
        self.assertEqual(self.submit(etag="lost-response-old-etag").get_json()["run"]["run_id"], first["run_id"])
        self.assertGreaterEqual(self.submit("another").status_code, 400)
        self.assertEqual(self.client.get(self.base + f"/runs/{first['run_id']}?workspace_id=other").status_code, 404)
        self.assertEqual(self.repository.recover_incomplete_runs(), [first["run_id"]])
        self.assertEqual(self.service.get_run(first["run_id"])["status"], "interrupted")
        self.assertEqual(self.submit("after-restart").status_code, 201)

    def test_edit_during_submission_is_atomic(self):
        original = self.repository.submit_run
        def raced(*args, **kwargs):
            self.repository.update_draft(self.draft["experiment_id"], "workspace-1", self.ready["draft"]["etag"], {"metric": {"primary": "mae"}})
            return original(*args, **kwargs)
        with patch.object(self.repository, "submit_run", side_effect=raced):
            response = self.submit()
        self.assertEqual(response.status_code, 409, response.get_json())
        self.assertEqual(self.repository.list_runs(), [])

    def test_cancel_and_deadline_stop_child_and_errors_cross_process(self):
        kwargs = {"cancelled": lambda: False, "progress": lambda _: None}
        with self.assertRaises(TrainingCancelled):
            run_with_limits(self.data, self.config, cancelled=lambda: True, progress=lambda _: None, worker=stalled_worker)
        short = {**self.config, "resource": {**self.config["resource"], "timeout_seconds": .1}}
        with self.assertRaises(TrainingFailure) as timed:
            run_with_limits(self.data, short, worker=stalled_worker, **kwargs)
        self.assertEqual(timed.exception.error.code, "training_timeout")
        bad = self.data.copy()
        bad.loc[0, "feature"] = np.inf
        with self.assertRaises(TrainingFailure) as failed:
            run_with_limits(bad, self.config, **kwargs)
        self.assertEqual(failed.exception.error.code, "nonfinite_training_data")
        run = self.submit().get_json()["run"]
        response = self.client.post(self.base + f"/runs/{run['run_id']}?workspace_id=workspace-1", json={"action": "cancel"})
        self.assertEqual(response.get_json()["run"]["status"], "cancelled")
        self.service.execute_run(run["run_id"])
        self.assertEqual(self.service.get_run(run["run_id"])["status"], "cancelled")

    def test_registered_digest_guards_exact_loaded_bytes(self):
        metadata = self.store.write("run-trust", "model.joblib", b"trusted", media_type="application/octet-stream", server_created=True).to_dict()
        self.assertEqual(self.store.read_verified(metadata), b"trusted")
        with self.assertRaises(ArtifactStoreError):
            self.store.read_verified({**metadata, "sha256": "sha256:" + "0" * 64})


if __name__ == "__main__":
    unittest.main()
