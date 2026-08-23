import unittest
from unittest.mock import patch

from flask import Flask

from backend.decision_engine import DecisionChatService
from backend.routes.decision_chat import decision_chat_bp


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
        app.register_blueprint(decision_chat_bp)
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

    def test_sustained_conversation_keeps_latest_question_authoritative(self):
        """Exercise the public route with the rolling history shape used by AI Chat."""
        conversation_history = []
        session_state = {}

        def send_turn(user_message):
            """Carry returned state and the frontend's bounded role/content history."""
            nonlocal session_state
            response = self._post_turn(
                user_message,
                session_state=session_state,
                conversation_history=conversation_history[-10:],
                requested_mode="explore",
            )
            self.assertEqual(response.status_code, 200, response.get_json())
            body = response.get_json()
            conversation_history.extend([
                {"role": "user", "content": user_message},
                {"role": "assistant", "content": body["assistant_message"]},
            ])
            session_state = body["session_state"]
            return body

        # Independent questions replace stale intent, while short referential
        # follow-ups deliberately retain the compatible analytical context.
        revenue_by_region = send_turn("What is Revenue by Region?")
        self.assertEqual(revenue_by_region["bi_grounding"]["metric_definition"]["id"], "metric_revenue_sum")
        self.assertEqual([item["field"] for item in revenue_by_region["bi_grounding"]["dimensions"]], ["Region"])

        revenue_chart = send_turn("Show it as a chart")
        self.assertEqual(revenue_chart["artifacts"][0]["type"], "chart")
        self.assertEqual(revenue_chart["bi_grounding"]["metric_definition"]["id"], "metric_revenue_sum")

        margin_by_channel = send_turn("What is Gross Margin % by Channel?")
        self.assertEqual(margin_by_channel["bi_grounding"]["metric_definition"]["id"], "metric_margin_pct")
        self.assertEqual([item["field"] for item in margin_by_channel["bi_grounding"]["dimensions"]], ["Channel"])

        online_margin = send_turn("Only Online")
        self.assertEqual(online_margin["bi_grounding"]["filters"][0]["field"], "Channel")
        self.assertEqual(online_margin["bi_grounding"]["filters"][0]["value"], "Online")

        # This unrelated question currently exposes the replay defect: stale
        # metric state must not substitute the prior margin answer.
        dataset_shape = send_turn("What columns are available in this dataset?")
        self.assertIn("4 rows across 6 columns", dataset_shape["assistant_message"])
        self.assertIsNone(dataset_shape["bi_grounding"]["metric_definition"])

        category_revenue = send_turn("What is Revenue by Product Category?")
        self.assertEqual(category_revenue["bi_grounding"]["metric_definition"]["id"], "metric_revenue_sum")
        self.assertEqual(
            [item["field"] for item in category_revenue["bi_grounding"]["dimensions"]],
            ["Product Category"],
        )
        self.assertEqual(category_revenue["bi_grounding"]["filters"], [])

        category_chart = send_turn("Show that as a chart")
        self.assertEqual(category_chart["artifacts"][0]["type"], "chart")
        self.assertEqual(category_chart["bi_grounding"]["metric_definition"]["id"], "metric_revenue_sum")

        electronics_only = send_turn("Only Electronics")
        self.assertEqual(electronics_only["bi_grounding"]["filters"][0]["field"], "Product Category")
        self.assertEqual(electronics_only["bi_grounding"]["filters"][0]["value"], "Electronics")

    def test_stale_decision_prompt_cannot_override_current_bi_question(self):
        """Keep compatibility state from becoming an alternate source of user intent."""
        response = self._post_turn(
            "What is Revenue by Region?",
            requested_mode="explore",
            session_state={
                "active_mode": "explore",
                "decision_prompt": "What is Gross Margin % by Channel?",
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["bi_grounding"]["metric_definition"]["id"], "metric_revenue_sum")
        self.assertEqual([item["field"] for item in body["bi_grounding"]["dimensions"]], ["Region"])
        self.assertNotIn("decision_prompt", body["session_state"])

    def test_twenty_four_turn_stress_keeps_independent_and_refinement_state_separate(self):
        """Protect continuity beyond the minimum eight-turn acceptance floor."""
        conversation_history = []
        session_state = {}
        independent_turns = (
            ("What is Revenue by Region?", "metric_revenue_sum", "Region"),
            ("What is Gross Margin % by Channel?", "metric_margin_pct", "Channel"),
            ("What is Revenue by Product Category?", "metric_revenue_sum", "Product Category"),
        )

        for cycle in range(8):
            question, expected_metric, expected_dimension = independent_turns[cycle % len(independent_turns)]
            response = self._post_turn(
                question,
                session_state=session_state,
                conversation_history=conversation_history[-10:],
                requested_mode="explore",
            )
            self.assertEqual(response.status_code, 200, response.get_json())
            independent = response.get_json()
            self.assertEqual(independent["bi_grounding"]["metric_definition"]["id"], expected_metric)
            self.assertEqual(
                [item["field"] for item in independent["bi_grounding"]["dimensions"]],
                [expected_dimension],
            )
            self.assertEqual(independent["bi_grounding"]["filters"], [])
            conversation_history.extend([
                {"role": "user", "content": question},
                {"role": "assistant", "content": independent["assistant_message"]},
            ])
            session_state = independent["session_state"]

            chart_message = "Show it as a chart"
            chart_response = self._post_turn(
                chart_message,
                session_state=session_state,
                conversation_history=conversation_history[-10:],
                requested_mode="explore",
            )
            self.assertEqual(chart_response.status_code, 200, chart_response.get_json())
            chart = chart_response.get_json()
            self.assertEqual(chart["artifacts"][0]["type"], "chart")
            self.assertEqual(chart["bi_grounding"]["metric_definition"]["id"], expected_metric)
            conversation_history.extend([
                {"role": "user", "content": chart_message},
                {"role": "assistant", "content": chart["assistant_message"]},
            ])
            session_state = chart["session_state"]

            shape_message = "What columns are available in this dataset?"
            shape_response = self._post_turn(
                shape_message,
                session_state=session_state,
                conversation_history=conversation_history[-10:],
                requested_mode="explore",
            )
            self.assertEqual(shape_response.status_code, 200, shape_response.get_json())
            shape = shape_response.get_json()
            self.assertIn("4 rows across 6 columns", shape["assistant_message"])
            self.assertIsNone(shape["bi_grounding"]["metric_definition"])
            conversation_history.extend([
                {"role": "user", "content": shape_message},
                {"role": "assistant", "content": shape["assistant_message"]},
            ])
            session_state = shape["session_state"]

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

    def test_workspace_identity_resolves_server_model_over_legacy_rows(self):
        class WorkspaceFrame:
            """Minimal joined-frame stand-in for automatic model resolution."""

            @staticmethod
            def to_dict(*, orient):
                if orient != "records":
                    raise AssertionError("The model resolver must request record-oriented rows.")
                return DATASET

        canonical_context = {
            "contract_version": "multi_source_workspace_v1",
            "workspace_id": "ws_current",
            "workspace_version": 7,
            "primary_source_id": "src_orders",
            "source_ids": ["src_orders", "src_customers"],
            "relationship_ids": ["rel_orders_customers"],
        }
        with (
            patch(
                "backend.decision_engine.chat_service.resolve_active_model_analysis_context"
            ) as model_resolver,
            patch(
                "backend.decision_engine.chat_service.resolve_analysis_dataset_bundle"
            ) as bundle_resolver,
        ):
            model_resolver.return_value = canonical_context
            bundle_resolver.return_value = {
                "dataframe": WorkspaceFrame(),
                "semantic_model": SEMANTIC_MODEL,
                "dataset_ref": {
                    "source": "workspace",
                    "dataset_id": "ws_current",
                    "dataset_name": "Current workspace",
                },
                "analysis_context": canonical_context,
                "analysis_lineage": {
                    "schema_version": "multi_source_analysis_lineage_v1",
                    "relationship_ids": ["rel_orders_customers"],
                },
                "governance_readiness": {"status": "ready"},
            }

            prepared = DecisionChatService.prepare_payload(
                {
                    "workspace_id": "ws_current",
                    "dataset": [{"Wrong": 1}],
                    "semantic_model": {"dataset": {"id": "wrong_active"}},
                }
            )

        model_resolver.assert_called_once_with("ws_current")
        bundle_resolver.assert_called_once_with(canonical_context)
        self.assertEqual(prepared["dataset"], DATASET)
        self.assertEqual(prepared["analysis_context"], canonical_context)
        self.assertEqual(
            prepared["_resolved_dataset_context"]["analysis_context"],
            canonical_context,
        )

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
