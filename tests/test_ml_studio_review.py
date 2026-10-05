"""One-time holdout and explicit decision integration with real fitted models."""

from concurrent.futures import ThreadPoolExecutor
import unittest
from unittest.mock import patch
from io import BytesIO
import joblib
from backend.ml_studio.training import measure

from backend.ml_studio.review import nominate
from tests import test_ml_studio_workflow_execution as training_tests


class ReviewTests(unittest.TestCase):
    setUp = training_tests.WorkflowExecutionTests.setUp
    tearDown = training_tests.WorkflowExecutionTests.tearDown
    assess = training_tests.WorkflowExecutionTests.assess
    submit = training_tests.WorkflowExecutionTests.submit
    execute = training_tests.WorkflowExecutionTests.execute

    def nominate(self, run, **extra):
        return self.client.post(self.base + '/nominations?workspace_id=workspace-1',
            json={"run_id": run["run_id"], "family": "regularized_linear", "nominator": "Local analyst", "intended_use": "Estimate the next measured value", **extra},
            headers={"If-Match": self.ready["draft"]["etag"]})

    def final(self, nomination):
        return self.client.post(self.base + f'/nominations/{nomination["nomination_id"]}/final-evaluation?workspace_id=workspace-1', json={})

    def selection(self, nomination, **extra):
        return self.client.post(self.base + '/selections?workspace_id=workspace-1', json={"nomination_id": nomination["nomination_id"],
            "reviewed_by": "Local analyst", "intended_use": "Local estimates", "prohibited_use": "Automated consequential decisions", **extra},
            headers={"If-Match": self.ready["draft"]["etag"]})

    def test_real_journey_nomination_final_once_selection_and_reload(self):
        development = self.execute()
        response = self.nominate(development)
        self.assertEqual(response.status_code, 200, response.get_json())
        nomination = response.get_json()["nomination"]
        self.assertEqual(self.nominate(development).get_json()["nomination"], nomination)
        self.assertEqual(self.nominate(development, family="random_forest").status_code, 409)
        self.assertEqual(self.selection(nomination).status_code, 409)
        final = self.final(nomination).get_json()["run"]
        self.service.execute_run(final["run_id"])
        final = self.service.get_run(final["run_id"])
        self.assertEqual(final["status"], "completed", final.get("failure"))
        self.assertEqual(final["evaluation_result"]["holdout_rows"], 20)
        self.assertTrue(final["evaluation_result"]["evaluated_once"])
        self.assertNotIn("candidates", final["evaluation_result"])
        bundle = joblib.load(BytesIO(self.store.read_verified(nomination["artifact"])))
        holdout = self.data.iloc[bundle["holdout_indices"]]
        expected_metrics = measure('regression', holdout['target'], bundle['pipeline'].predict(holdout))
        self.assertEqual(final['evaluation_result']['metrics'], expected_metrics)
        with patch('backend.ml_studio.review.run_with_limits', side_effect=AssertionError('must never evaluate twice')):
            self.assertEqual(self.final(nomination).get_json()["run"]["evaluation_result"], final["evaluation_result"])
            self.service.execute_run(final["run_id"])
        selected = self.selection(nomination)
        self.assertEqual(selected.status_code, 200, selected.get_json())
        receipt = selected.get_json()["selection"]
        self.assertEqual(self.selection(nomination).get_json()["selection"], receipt)
        review = self.client.get(self.base + '/review?workspace_id=workspace-1').get_json()
        self.assertEqual(review["selections"], [receipt])
        self.assertEqual(len(review["runs"]), 1)
        self.assertEqual(review["workflow_state"]["selection_id"], receipt["selection_id"])
        self.assertEqual(next(stage["state"] for stage in review["workflow_state"]["stages"] if stage["stage"] == "Use & Share"), "available")
        changed = self.service.update_draft(self.draft["experiment_id"], 'workspace-1', self.ready['draft']['etag'], {'metric': {'primary': 'mae'}})
        self.assertIsNone(changed['workflow_state']['selection_id'])
        self.assertEqual(next(stage['state'] for stage in changed['workflow_state']['stages'] if stage['stage'] == 'Use & Share'), 'stale')

    def test_concurrent_nominations_lock_one_candidate_and_interrupted_final_resumes_same_identity(self):
        development = self.execute()
        args = (self.service, self.draft["experiment_id"], 'workspace-1', self.ready["draft"]["etag"])
        payload = {"run_id": development["run_id"], "family": "regularized_linear", "nominator": "Analyst", "intended_use": "Local estimates"}
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: nominate(*args, payload), range(2)))
        self.assertEqual(results[0], results[1])
        first = self.final(results[0]).get_json()["run"]
        self.repository.recover_incomplete_runs()
        second = self.final(results[0]).get_json()["run"]
        self.assertEqual(first["run_id"], second["run_id"])
        self.assertEqual(second["status"], "queued")
        self.service.execute_run(second["run_id"])
        self.assertEqual(self.service.get_run(second["run_id"])["status"], "completed")

    def test_stale_evidence_and_wrong_workspace_cannot_be_selected(self):
        run = self.execute()
        nomination = self.nominate(run).get_json()["nomination"]
        self.service.update_draft(self.draft["experiment_id"], 'workspace-1', self.ready["draft"]["etag"], {"metric": {"primary": "mae"}})
        self.assertEqual(self.final(nomination).status_code, 409)
        self.assertEqual(self.selection(nomination).status_code, 409)
        self.assertEqual(self.client.get(self.base + '/review?workspace_id=workspace-2').status_code, 404)
        self.assertEqual(self.nominate(run, family='fabricated').status_code, 409)

    def test_integrity_failure_blocks_nomination(self):
        run = self.execute()
        with patch.object(self.store, 'read_verified', side_effect=ValueError('injected corruption')):
            self.assertGreaterEqual(self.nominate(run).status_code, 400)
        self.assertEqual(self.repository.list_nominations(self.draft["experiment_id"], 'workspace-1'), [])


if __name__ == '__main__':
    unittest.main()
