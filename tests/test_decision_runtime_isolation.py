import sys
import unittest
from unittest.mock import patch


DATASET = [
    {"Region": "East", "Revenue": 100.0},
    {"Region": "West", "Revenue": 150.0},
]

SEMANTIC_MODEL = {
    "dataset": {"id": "runtime_isolation_sales", "name": "Runtime Isolation Sales"},
    "dimensions": [
        {
            "id": "dimension_region",
            "name": "Region",
            "label": "Region",
            "field": "Region",
            "semantic_kind": "categorical",
            "data_type": "string",
        },
    ],
    "metrics": [
        {
            "id": "metric_revenue_sum",
            "name": "Revenue",
            "label": "Revenue",
            "field": "Revenue",
            "default_aggregation": "sum",
            "expression": {
                "type": "column_aggregation",
                "column": "Revenue",
                "aggregation": "sum",
            },
        },
    ],
}


class DecisionRuntimeIsolationTests(unittest.TestCase):
    """Protect the explicit boundary between primary BI chat and compatibility APIs."""

    def test_primary_app_registers_chat_without_compatibility_routes(self):
        from backend.app import create_app

        app = create_app({"TESTING": True})
        rules = {rule.rule for rule in app.url_map.iter_rules()}

        self.assertIn("/api/decision/chat/turns", rules)
        self.assertIn("/api/decision/chat/actions", rules)
        self.assertNotIn("/api/decision/workspaces", rules)
        self.assertNotIn("/api/decision/assets", rules)
        self.assertNotIn("/api/decision/graph/build", rules)
        self.assertNotIn("/api/decision/scenarios/evaluate", rules)
        self.assertFalse(app.config["ENABLE_DECISION_INTELLIGENCE_COMPATIBILITY"])

    def test_compatibility_routes_require_explicit_registration(self):
        from backend.app import create_app

        app = create_app({
            "TESTING": True,
            "ENABLE_DECISION_INTELLIGENCE_COMPATIBILITY": True,
        })
        rules = {rule.rule for rule in app.url_map.iter_rules()}

        self.assertIn("/api/decision/chat/turns", rules)
        self.assertIn("/api/decision/workspaces", rules)
        self.assertIn("/api/decision/assets", rules)
        self.assertIn("/api/decision/graph/build", rules)
        self.assertIn("/api/decision/scenarios/evaluate", rules)
        self.assertTrue(app.config["ENABLE_DECISION_INTELLIGENCE_COMPATIBILITY"])

    def test_primary_chat_does_not_import_compatibility_services(self):
        """Fail immediately if normal startup or a BI turn crosses the lazy boundary."""
        from backend.app import create_app

        blocked_modules = {
            "backend.routes.decision": None,
            "backend.services.decision_asset_service": None,
            "backend.services.decision_graph_service": None,
            "backend.services.decision_output_service": None,
            "backend.services.decision_pipeline_service": None,
            "backend.services.decision_workspace_service": None,
            "backend.services.recommendation_service": None,
            "backend.services.scenario_service": None,
        }
        with patch.dict(sys.modules, blocked_modules):
            app = create_app({"TESTING": True})
            response = app.test_client().post(
                "/api/decision/chat/turns",
                json={
                    "dataset": DATASET,
                    "semantic_model": SEMANTIC_MODEL,
                    "user_message": "What is Revenue by Region?",
                    "requested_mode": "explore",
                    "conversation_history": [],
                    "session_state": {},
                },
            )

        self.assertEqual(response.status_code, 200, response.get_json())
        body = response.get_json()
        self.assertEqual(body["contract_version"], "ai_chat_bi_result_v1")
        self.assertEqual(body["bi_grounding"]["metric_definition"]["id"], "metric_revenue_sum")

    def test_primary_chat_refuses_decide_mode_without_importing_compatibility(self):
        """Keep explicit Decide requests behind the same registration switch."""
        from backend.app import create_app

        blocked_modules = {
            "backend.routes.decision": None,
            "backend.services.decision_output_service": None,
            "backend.services.decision_workspace_service": None,
        }
        with patch.dict(sys.modules, blocked_modules):
            app = create_app({"TESTING": True})
            response = app.test_client().post(
                "/api/decision/chat/turns",
                json={
                    "user_message": "How should we grow revenue?",
                    "requested_mode": "decide",
                    "session_state": {},
                },
            )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(
            response.get_json()["error"]["code"],
            "DECISION_INTELLIGENCE_COMPATIBILITY_DISABLED",
        )


if __name__ == "__main__":
    unittest.main()
