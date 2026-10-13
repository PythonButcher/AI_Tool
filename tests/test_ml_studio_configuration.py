"""Real Flask/repository evidence for saved draft configuration and readiness."""

from concurrent.futures import ThreadPoolExecutor
import unittest

from backend.ml_studio.repository import MLStudioRepository
from backend.ml_studio.service import MLStudioService
from tests import test_ml_studio_api as api_tests


class ConfigurationTests(unittest.TestCase):
    tearDown = api_tests.MLStudioApiTests.tearDown

    def setUp(self):
        api_tests.MLStudioApiTests.setUp(self)
        snapshot = self.service.create_snapshot(api_tests.snapshot_request())
        self.draft = self.service.create_draft({"workspace_id": "workspace-1", "snapshot_id": snapshot["snapshot_id"],
            "task_type": "regression", "active_stage": "Configure",
            "roles": {"target": "target", "numeric": ["feature"], "categorical": [], "ignored": ["row_id"], "time": [], "group": []}})["draft"]
        self.base = f"/api/ml-studio/v1/drafts/{self.draft['experiment_id']}"
        self.url = self.base + "/assessment?workspace_id=workspace-1"

    def assess(self, etag=None, payload=None):
        return self.client.post(self.url, json={} if payload is None else payload, headers={"If-Match": etag or self.draft["etag"]})

    def test_assessment_issues_immutable_configuration_and_recovers_lost_response(self):
        result = self.assess()
        self.assertEqual(result.status_code, 200, result.get_json())
        data = result.get_json()
        self.assertEqual(data["assessment"]["state"], "ready")
        configuration = data["assessment"]["configuration"]
        self.assertEqual(configuration["draft_revision"], 1)
        self.assertEqual(configuration["snapshot_id"], self.draft["snapshot_id"])
        self.assertTrue(configuration["recipe_hash"].startswith("sha256:"))
        self.assertEqual(configuration["resource"]["timeout_seconds"], 120)
        self.assertEqual(data["draft"]["draft_revision"], 2)
        self.assertEqual(self.assess().get_json(), data)
        restarted = MLStudioService(MLStudioRepository(self.root / "ml.sqlite3"), lambda _: self.truth, lambda _: None)
        reopened = restarted.get_draft(self.draft["experiment_id"], "workspace-1")
        self.assertEqual(reopened["assessment"], data["assessment"])
        self.assertEqual(self.repository.get_experiment(configuration["experiment_id"], 1), configuration)

    def test_dependency_edits_stale_assessment_but_presentation_edits_do_not(self):
        assessed = self.assess().get_json()
        saved = self.client.patch(self.base + "?workspace_id=workspace-1", json={"name": "Renamed", "guidance_enabled": False},
                                  headers={"If-Match": assessed["draft"]["etag"]}).get_json()
        self.assertFalse(any(stage["stale_reason_codes"] for stage in saved["workflow_state"]["stages"]))
        changed = self.client.patch(self.base + "?workspace_id=workspace-1", json={"metric": {"primary": "mae"}},
                                    headers={"If-Match": saved["draft"]["etag"]}).get_json()
        self.assertTrue(any(stage["state"] == "stale" for stage in changed["workflow_state"]["stages"]))
        self.assertEqual(self.assess().status_code, 409)
        fresh = self.assess(etag=changed["draft"]["etag"]).get_json()
        self.assertEqual(fresh["assessment"]["configuration"]["specification_version"], 2)
        self.assertNotEqual(fresh["assessment"]["input_fingerprint"], assessed["assessment"]["input_fingerprint"])

    def test_blocked_configuration_returns_field_issues_instead_of_false_readiness(self):
        saved = self.client.patch(self.base + "?workspace_id=workspace-1", json={
            "roles": {"numeric": ["missing"]}, "metric": {"primary": "accuracy"},
            "resource": {"timeout_seconds": 0}, "candidate": {"families": ["unknown"]}}, headers={"If-Match": self.draft["etag"]}).get_json()
        result = self.assess(etag=saved["draft"]["etag"]).get_json()
        self.assertEqual(result["assessment"]["state"], "blocked")
        codes = {item["code"] for item in result["assessment"]["issues"]}
        self.assertTrue({"target_required", "column_missing", "metric_invalid", "invalid_limit", "candidates_invalid"}.issubset(codes))

    def test_conflicts_scoping_and_untrusted_inputs_are_rejected(self):
        self.assertEqual(self.assess(etag="old").status_code, 409)
        self.assertEqual(self.client.post(self.url.replace("workspace-1", "workspace-2"), json={}, headers={"If-Match": self.draft["etag"]}).status_code, 404)
        for payload in ({"ready": True}, {"configuration": {}}, {"recipe_hash": "fake"}, {"rows": []}):
            self.assertEqual(self.assess(payload=payload).status_code, 400)
        self.truth["workspace_version"] = 4
        self.assertEqual(self.assess().status_code, 409)

    def test_concurrent_assessments_return_one_immutable_configuration(self):
        other = MLStudioService(MLStudioRepository(self.root / "ml.sqlite3"), lambda _: self.truth, lambda _: None)
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda service: service.assess_draft(self.draft["experiment_id"], "workspace-1", self.draft["etag"], {}), [self.service, other]))
        self.assertEqual(results[0], results[1])


if __name__ == "__main__":
    unittest.main()
