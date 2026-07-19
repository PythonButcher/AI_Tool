import unittest
from unittest.mock import patch

from flask import Flask

from backend.decision_engine import DecisionChatService
from backend.routes.decision import decision_bp


# This fixture intentionally contains only fields used by the active BI-first
# AI Chat flow. Retired Decision Intelligence capability fields do not belong
# in this regression suite.
DATASET = [
    {
        "Order Date": "2026-01-31",
        "Region": "East",
        "Channel": "Online",
        "Product Category": "Electronics",
        "Revenue": 100.0,
        "Gross Margin %": 0.35,
    },
    {
        "Order Date": "2026-02-28",
        "Region": "East",
        "Channel": "Retail",
        "Product Category": "Home Goods",
        "Revenue": 120.0,
        "Gross Margin %": 0.34,
    },
    {
        "Order Date": "2026-03-31",
        "Region": "West",
        "Channel": "Online",
        "Product Category": "Electronics",
        "Revenue": 135.0,
        "Gross Margin %": 0.33,
    },
    {
        "Order Date": "2026-04-30",
        "Region": "West",
        "Channel": "Retail",
        "Product Category": "Apparel",
        "Revenue": 150.0,
        "Gross Margin %": 0.32,
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
        {
            "id": "dimension_product_category",
            "name": "Product Category",
            "label": "Product Category",
            "field": "Product Category",
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
            "expression": {
                "type": "column_aggregation",
                "column": "Revenue",
                "aggregation": "sum",
            },
        },
        {
            "id": "metric_margin_pct",
            "name": "Gross Margin %",
            "label": "Gross Margin %",
            "field": "Gross Margin %",
            "default_aggregation": "mean",
            "format_hint": "percentage",
            "expression": {
                "type": "column_aggregation",
                "column": "Gross Margin %",
                "aggregation": "mean",
            },
        },
    ],
}


class DecisionChatApiTests(unittest.TestCase):
    """Protect only the active BI-first AI Chat contract and state flow."""

    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(decision_bp)
        self.client = app.test_client()

    def _post_turn(self, user_message, *, session_state=None, **overrides):
        """Send one deterministic BI turn while allowing focused overrides."""
        payload = {
            "dataset": DATASET,
            "semantic_model": SEMANTIC_MODEL,
            "user_message": user_message,
            "conversation_history": [],
            "session_state": session_state or {},
        }
        payload.update(overrides)
        return self.client.post("/api/decision/chat/turns", json=payload)

    def test_visual_query_returns_grounded_chart_and_typed_actions(self):
        response = self._post_turn("Show revenue by region as a chart")

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["mode"], "explore")
        self.assertEqual(body["contract_version"], "ai_chat_bi_result_v1")
        artifact = body["artifacts"][0]
        self.assertEqual(artifact["type"], "chart")
        self.assertEqual(artifact["source"], "semantic_metric")
        self.assertTrue(artifact["content"]["chartData"])
        self.assertEqual(artifact["content"]["chartSpec"]["sourceMode"], "semantic")
        self.assertTrue(body["suggested_actions"])
        self.assertTrue(
            all(action["kind"] == "analytics_refinement" for action in body["suggested_actions"])
        )
        self.assertIsNone(body["draft_workspace_preview"])
        self.assertIsNone(body["decision_output"])

    def test_semantic_answer_returns_bi_grounding_and_compact_state(self):
        response = self._post_turn(
            "What is Revenue by Region?",
            dataset_ref={
                "source": "active",
                "dataset_id": "sales_q1",
                "dataset_name": "Q1 Sales",
                "transform_state": "cleaned",
                "stale_state": "current",
                "freshness_as_of": "2026-04-30T00:00:00Z",
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        grounding = body["bi_grounding"]
        self.assertEqual(grounding["dataset"]["dataset_id"], "sales_q1")
        self.assertEqual(grounding["metric_definition"]["id"], "metric_revenue_sum")
        self.assertEqual(grounding["aggregation"], "sum")
        self.assertEqual([item["field"] for item in grounding["dimensions"]], ["Region"])
        self.assertEqual(grounding["freshness"]["state"], "current")

        analytics_state = body["session_state"]["analytics_state"]
        self.assertEqual(body["session_state"]["schema_version"], "ai_chat_bi_session_state_v1")
        self.assertEqual(analytics_state["metric_name"], "Revenue")
        self.assertNotIn("rows", analytics_state)
        self.assertNotIn("chartData", analytics_state)
        self.assertNotIn("dataset", analytics_state)

    def test_structured_refinements_update_filter_aggregation_and_period(self):
        initial = self._post_turn("What is Revenue by Region?").get_json()
        filtered = self._post_turn(
            "Only West",
            session_state=initial["session_state"],
        ).get_json()

        removed = self._post_turn(
            "Remove the Region filter",
            session_state=filtered["session_state"],
            analytics_refinement={
                "operation": "remove_filter",
                "arguments": {"field": "Region"},
            },
        ).get_json()
        self.assertEqual(removed["analytics_refinement"]["applied"]["operation"], "remove_filter")
        self.assertEqual(removed["session_state"]["analytics_state"]["filters"], [])

        aggregated = self._post_turn(
            "Use mean aggregation",
            session_state=removed["session_state"],
            analytics_refinement={
                "operation": "set_aggregation",
                "arguments": {"aggregation": "mean"},
            },
        ).get_json()
        self.assertEqual(aggregated["bi_grounding"]["aggregation"], "mean")

        period_response = self._post_turn(
            "Use the first quarter",
            session_state=aggregated["session_state"],
            analytics_refinement={
                "operation": "set_time_period",
                "arguments": {
                    "field": "Order Date",
                    "start": "2026-01-01",
                    "end": "2026-03-31",
                },
            },
        )
        self.assertEqual(period_response.status_code, 200)
        period = period_response.get_json()
        self.assertEqual(period["bi_grounding"]["row_count"], 3)
        self.assertEqual(
            period["analytics_refinement"]["current_state"]["time_period"],
            period["bi_grounding"]["time_period"],
        )

    def test_follow_up_uses_structured_state_not_conflicting_history(self):
        initial = self._post_turn("What is Revenue by Region?").get_json()
        follow_up = self._post_turn(
            "Show it as a chart",
            session_state=initial["session_state"],
            conversation_history=[
                {"role": "user", "content": "Use Gross Margin % instead"},
                {"role": "assistant", "content": "The metric is now Gross Margin %."},
            ],
        )

        self.assertEqual(follow_up.status_code, 200)
        body = follow_up.get_json()
        self.assertEqual(body["artifacts"][0]["type"], "chart")
        self.assertEqual(body["session_state"]["analytics_state"]["metric_name"], "Revenue")
        self.assertFalse(body["conversation_context"]["history_alignment"])
        self.assertEqual(
            body["conversation_context"]["authoritative_source"],
            "structured_session_state",
        )

    def test_named_dataset_requires_matching_dataset_reference(self):
        missing_reference = self._post_turn(
            "Show revenue for @Mentioned_Sales",
            resolved_datasets=["Mentioned Sales"],
            _dataset_identity_prepared=True,
        )
        self.assertEqual(missing_reference.status_code, 400)
        self.assertIn("dataset_ref", missing_reference.get_json()["error"]["message"])

        matched = self._post_turn(
            "Show revenue for the selected dataset",
            resolved_datasets=["Mentioned Sales"],
            dataset_ref={
                "source": "inline",
                "dataset_id": "mentioned_sales",
                "dataset_name": "Mentioned Sales",
            },
        )
        self.assertEqual(matched.status_code, 200)
        self.assertEqual(
            matched.get_json()["resolved_datasets"][0]["dataset_id"],
            "mentioned_sales",
        )

    def test_datahub_selection_uses_selected_semantic_model(self):
        class DatasetFrame:
            """Minimal DataFrame stand-in for deterministic dataset resolution."""

            @staticmethod
            def to_dict(*, orient):
                if orient != "records":
                    raise AssertionError("The dataset resolver must request record-oriented rows.")
                return DATASET

        selected_semantic_model = {
            **SEMANTIC_MODEL,
            "dataset": {"id": "selected_sales", "name": "Selected Sales"},
        }
        with patch("backend.decision_engine.chat_service.resolve_dataset_bundle") as resolver:
            resolver.return_value = {
                "dataframe": DatasetFrame(),
                "semantic_model": selected_semantic_model,
                "dataset_ref": {
                    "source": "datahub",
                    "dataset_id": "selected_sales",
                    "dataset_name": "Selected Sales",
                },
            }
            prepared = DecisionChatService.prepare_payload(
                {
                    "dataset": [{"Wrong": 1}],
                    "dataset_ref": {
                        "source": "datahub",
                        "dataset_id": "selected_sales",
                        "dataset_name": "Selected Sales",
                    },
                    "semantic_model": {"dataset": {"id": "wrong_active"}},
                    "resolved_datasets": ["Selected Sales"],
                }
            )

        self.assertIsNone(resolver.call_args.kwargs["semantic_model"])
        self.assertEqual(prepared["dataset"], DATASET)
        self.assertEqual(prepared["semantic_model"], selected_semantic_model)

    def test_explicit_explore_mode_prevents_decision_output(self):
        # Decision-like wording must stay on the active BI path when the AI Chat
        # integration explicitly requests Explore mode.
        response = self._post_turn(
            "How should we grow revenue without hurting gross margin?",
            requested_mode="explore",
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["mode"], "explore")
        self.assertTrue(all(item["type"] in {"answer", "chart"} for item in body["artifacts"]))
        self.assertIsNone(body["draft_workspace_preview"])
        self.assertIsNone(body["decision_output"])
        self.assertNotIn("draft_workspace", body["session_state"])

    def test_dataset_change_clears_stale_analytic_context(self):
        initial = self._post_turn(
            "What is Revenue by Region?",
            dataset_ref={
                "source": "inline",
                "dataset_id": "sales_a",
                "dataset_name": "Sales A",
            },
        ).get_json()
        changed_dataset = [dict(row, Revenue=row["Revenue"] + 500) for row in DATASET]

        changed = self._post_turn(
            "Show it as a chart",
            dataset=changed_dataset,
            dataset_ref={
                "source": "inline",
                "dataset_id": "sales_b",
                "dataset_name": "Sales B",
            },
            session_state=initial["session_state"],
            conversation_history=[
                {"role": "user", "content": "What is Revenue by Region?"},
                {"role": "assistant", "content": initial["assistant_message"]},
            ],
        )

        self.assertEqual(changed.status_code, 200)
        body = changed.get_json()
        self.assertNotIn("last_analytic_context", body["session_state"])
        self.assertNotIn("analytics_state", body["session_state"])
        self.assertFalse(body["conversation_context"]["used_for_continuity"])
        self.assertTrue(
            any("prior structured analysis state was cleared" in warning for warning in body["warnings"])
        )


if __name__ == "__main__":
    unittest.main()
