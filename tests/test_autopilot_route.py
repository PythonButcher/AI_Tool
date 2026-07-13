"""Focused product-truth coverage for the Autopilot workflow endpoint."""

import unittest

from flask import Flask

from backend.routes.autopilot import autopilot_bp


class AutopilotRouteTests(unittest.TestCase):
    """Verify that Autopilot returns a review template rather than executed analysis."""

    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(autopilot_bp)
        self.client = app.test_client()

    def test_autopilot_returns_a_traceable_non_executing_review_template(self):
        response = self.client.post(
            "/api/autopilot",
            json={"uploadedData": [{"Revenue": 120, "Region": "East"}]},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["workflow_kind"], "review_template")
        self.assertEqual(payload["execution_state"], "not_executed")
        self.assertEqual(payload["truth_boundary"], "observational_analysis_only")
        self.assertEqual(payload["source_refs"]["source"], "autopilot_request_dataset_preview")
        self.assertEqual(payload["source_refs"]["row_count"], 1)
        self.assertIn("does not execute analysis", payload["description"])
        self.assertIn("final recommendations", " ".join(payload["limitations"]))
        for node in payload["nodes"]:
            self.assertEqual(node["execution_state"], "not_executed")
            self.assertEqual(node["truth_boundary"], "observational_analysis_only")


if __name__ == "__main__":
    unittest.main()
