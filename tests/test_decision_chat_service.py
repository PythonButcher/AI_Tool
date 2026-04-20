import unittest

from flask import Flask

from backend.routes.decision import decision_bp


DATASET = [
    {
        "Order Date": "2026-01-31",
        "Region": "East",
        "Channel": "Online",
        "Revenue": 100.0,
        "Gross Margin %": 0.35,
        "Discount Rate": 0.10,
        "Marketing Spend": 24.0,
    },
    {
        "Order Date": "2026-02-28",
        "Region": "East",
        "Channel": "Retail",
        "Revenue": 120.0,
        "Gross Margin %": 0.34,
        "Discount Rate": 0.09,
        "Marketing Spend": 28.0,
    },
    {
        "Order Date": "2026-03-31",
        "Region": "West",
        "Channel": "Online",
        "Revenue": 135.0,
        "Gross Margin %": 0.33,
        "Discount Rate": 0.08,
        "Marketing Spend": 35.0,
    },
    {
        "Order Date": "2026-04-30",
        "Region": "West",
        "Channel": "Retail",
        "Revenue": 150.0,
        "Gross Margin %": 0.32,
        "Discount Rate": 0.07,
        "Marketing Spend": 41.0,
    },
]

SEMANTIC_MODEL = {
    "version": 2,
    "dataset": {"id": "sales_q1", "name": "Q1 Sales"},
    "dimensions": [
        {
            "id": "dimension_order_date",
            "name": "Order Date",
            "label": "Order Date",
            "field": "Order Date",
            "semantic_kind": "temporal",
            "data_type": "datetime",
        },
        {
            "id": "dimension_region",
            "name": "Region",
            "label": "Region",
            "field": "Region",
            "semantic_kind": "categorical",
            "data_type": "string",
        },
        {
            "id": "dimension_channel",
            "name": "Channel",
            "label": "Channel",
            "field": "Channel",
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
            "format_hint": "currency",
            "expression": {"type": "column_aggregation", "column": "Revenue", "aggregation": "sum"},
        },
        {
            "id": "metric_margin_pct",
            "name": "Gross Margin %",
            "label": "Gross Margin %",
            "field": "Gross Margin %",
            "default_aggregation": "mean",
            "format_hint": "percentage",
            "expression": {"type": "column_aggregation", "column": "Gross Margin %", "aggregation": "mean"},
        },
        {
            "id": "metric_discount_rate",
            "name": "Discount Rate",
            "label": "Discount Rate",
            "field": "Discount Rate",
            "default_aggregation": "mean",
            "format_hint": "percentage",
            "expression": {"type": "column_aggregation", "column": "Discount Rate", "aggregation": "mean"},
        },
    ],
}


class DecisionChatApiTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(decision_bp)
        self.client = app.test_client()

    def test_turn_route_builds_chart_artifact_for_visual_query(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "Show revenue by region as a chart",
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["mode"], "explore")
        self.assertEqual(body["artifacts"][0]["type"], "chart")
        self.assertTrue(body["artifacts"][0]["content"]["chartData"])

    def test_turn_route_builds_workspace_preview_for_decision_prompt(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we grow revenue next quarter without hurting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["mode"], "decide")
        self.assertEqual(body["draft_workspace_preview"]["type"], "workspace_preview")
        self.assertIn("draft_workspace", body["session_state"])
        self.assertTrue(body["suggested_actions"])

    def test_turn_route_answers_semantic_metric_question_without_chart_keyword(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "What is Revenue by Region?",
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["mode"], "explore")
        self.assertEqual(body["artifacts"][0]["type"], "answer")
        self.assertEqual(body["session_state"]["last_analytic_context"]["source"], "semantic_metric")
        self.assertEqual(body["session_state"]["last_analytic_context"]["metric_name"], "Revenue")

    def test_follow_up_turn_reuses_last_metric_and_returns_chart(self):
        first_response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "What is Revenue by Region?",
                "conversation_history": [],
                "session_state": {},
            },
        )
        first_state = first_response.get_json()["session_state"]

        follow_up = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "Show it as a chart",
                "conversation_history": [],
                "session_state": first_state,
            },
        )

        self.assertEqual(follow_up.status_code, 200)
        body = follow_up.get_json()
        self.assertEqual(body["mode"], "explore")
        self.assertEqual(body["artifacts"][0]["type"], "chart")
        self.assertEqual(body["session_state"]["last_analytic_context"]["output_preference"], "chart")

    def test_follow_up_turn_can_change_grouping_from_prior_semantic_context(self):
        first_response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "What is Revenue by Region?",
                "conversation_history": [],
                "session_state": {},
            },
        )
        first_state = first_response.get_json()["session_state"]

        follow_up = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "by Channel instead",
                "conversation_history": [],
                "session_state": first_state,
            },
        )

        self.assertEqual(follow_up.status_code, 200)
        body = follow_up.get_json()
        self.assertEqual(body["mode"], "explore")
        self.assertEqual(body["artifacts"][0]["type"], "answer")
        self.assertEqual(body["session_state"]["last_analytic_context"]["group_by"], ["Channel"])

    def test_action_route_returns_blockers_from_existing_workspace(self):
        turn_response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we grow revenue next quarter without hurting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )
        draft_state = turn_response.get_json()["session_state"]

        action_response = self.client.post(
            "/api/decision/chat/actions",
            json={
                "action": "show_blockers",
                "session_state": draft_state,
            },
        )

        self.assertEqual(action_response.status_code, 200)
        body = action_response.get_json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["action"], "show_blockers")
        self.assertEqual(body["artifacts"][0]["type"], "workspace_analysis_summary")

    def test_action_route_runs_workspace_analysis(self):
        turn_response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we grow revenue next quarter without hurting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )
        draft_state = turn_response.get_json()["session_state"]

        action_response = self.client.post(
            "/api/decision/chat/actions",
            json={
                "action": "analyze_workspace",
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "session_state": draft_state,
            },
        )

        self.assertEqual(action_response.status_code, 200)
        body = action_response.get_json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["action"], "analyze_workspace")
        self.assertEqual(body["artifacts"][0]["type"], "workspace_analysis_summary")


if __name__ == "__main__":
    unittest.main()
