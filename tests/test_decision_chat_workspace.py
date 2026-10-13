"""Synthetic business journeys; all numeric assertions execute the real resolver."""

import copy
import unittest

from flask import Flask

from backend.routes.decision_chat import decision_chat_bp
from tests.test_decision_chat_service import DATASET, SEMANTIC_MODEL


class ChatWorkspaceTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(decision_chat_bp)
        self.client = app.test_client()

    def turn(self, message, state=None, **overrides):
        return self.client.post("/api/decision/chat/turns", json={
            "user_message": message, "requested_mode": "explore", "dataset": DATASET,
            "semantic_model": SEMANTIC_MODEL, "session_state": state or {}, **overrides,
        })

    def test_contextual_breakdown_preserves_metric_and_filter(self):
        first = self.turn("What is revenue for Online?").get_json()
        reply = self.turn("break that down by region", first["session_state"]).get_json()
        self.assertEqual(reply["bi_grounding"]["aggregation"], "sum")
        self.assertEqual(reply["bi_grounding"]["filters"][0]["value"], "Online")
        self.assertEqual(reply["artifacts"][0]["content"]["summary"]["value"], 235)
        self.assertEqual(reply["session_state"]["analytics_state"]["group_by"], ["Region"])

    def test_monthly_follow_up_buckets_and_sorts_without_top_n(self):
        rows = [{**DATASET[0], "Order Date": f"2025-{month:02d}-02", "Revenue": month}
                for month in range(12, 0, -1)]
        rows.append({**rows[0], "Order Date": "2025-01-28", "Revenue": 1})
        first = self.turn("What is revenue?", dataset=rows).get_json()
        reply = self.turn("show the monthly trend", first["session_state"], dataset=rows).get_json()
        chart = reply["artifacts"][0]["content"]["chartData"]
        self.assertEqual(chart["labels"], [f"2025-{month:02d}" for month in range(1, 13)])
        self.assertEqual(chart["datasets"][0]["data"], [2, *range(2, 13)])
        self.assertIn("2025-12", reply["assistant_message"])
        self.assertEqual(reply["bi_grounding"]["time_granularity"], "month")
        self.assertEqual(reply["bi_grounding"]["row_count"], 13)

    def test_aggregation_override_survives_later_grouping(self):
        first = self.turn("What is revenue?").get_json()
        average = self.turn("Use mean", first["session_state"], analytics_refinement={
            "operation": "set_aggregation", "arguments": {"aggregation": "mean"},
        }).get_json()
        reply = self.turn("break that down by region", average["session_state"]).get_json()
        self.assertEqual(reply["bi_grounding"]["aggregation"], "mean")
        self.assertEqual(reply["artifacts"][0]["content"]["summary"]["value"], 126.25)

    def test_ambiguous_metric_asks_then_resolves_exact_choice(self):
        model = copy.deepcopy(SEMANTIC_MODEL)
        duplicate = {**model["metrics"][0], "id": "metric_revenue_other", "label": "Other Revenue"}
        model["metrics"].append(duplicate)
        reply = self.turn("Show revenue by region", semantic_model=model).get_json()
        content = reply["artifacts"][0]["content"]
        self.assertEqual(content["reason_code"], "analytics_clarification_required")
        selected = self.turn(content["choices"][1]["user_message"], semantic_model=model).get_json()
        self.assertEqual(selected["bi_grounding"]["metric_definition"]["id"], "metric_revenue_other")

    def test_ambiguous_dates_ask_before_trend(self):
        model = copy.deepcopy(SEMANTIC_MODEL)
        model["dimensions"].append({**model["dimensions"][0], "id": "ship_date", "field": "Ship Date", "label": "Ship Date", "name": "Ship Date"})
        rows = [{**row, "Ship Date": row["Order Date"]} for row in DATASET]
        reply = self.turn("Show monthly revenue", semantic_model=model, dataset=rows).get_json()
        content = reply["artifacts"][0]["content"]
        self.assertEqual(len(content["choices"]), 2)
        selected = self.turn(content["choices"][1]["user_message"], semantic_model=model, dataset=rows).get_json()
        self.assertEqual(selected["bi_grounding"]["dimensions"][0]["field"], "Ship Date")

    def test_invalid_time_refinements_fail_instead_of_raw_fallback(self):
        first = self.turn("What is revenue?").get_json()
        for arguments in ({"field": "Region", "start": "2026-01-01", "end": "2026-02-01"},
                          {"field": "Order Date", "start": "2026-03-01", "end": "2026-02-01"}):
            with self.subTest(arguments=arguments):
                reply = self.turn("Change period", first["session_state"], analytics_refinement={
                    "operation": "set_time_period", "arguments": arguments,
                })
                self.assertEqual(reply.status_code, 400)

    def test_malformed_trend_dates_fail_without_dropping_rows(self):
        rows = [*DATASET, {**DATASET[0], "Order Date": "not a date"}]
        reply = self.turn("Show monthly revenue", dataset=rows)
        self.assertEqual(reply.status_code, 400)
        self.assertIn("invalid_trend_dates", reply.get_json()["error"]["message"])

    def test_dashboard_draft_executes_each_item_with_its_own_grounding(self):
        response = self.turn("Build a sales dashboard with monthly revenue and a regional breakdown for Online")
        self.assertEqual(response.status_code, 200)
        reply = response.get_json()
        items = reply["dashboard_draft"]["items"]
        self.assertEqual(len(items), 3)
        self.assertTrue(all(item["status"] == "ready" for item in items))
        total, trend, region = [item["artifact"] for item in items]
        self.assertEqual(total["content"]["summary"]["value"], 235)
        self.assertEqual(total["bi_grounding"]["dimensions"], [])
        self.assertEqual(trend["content"]["chartData"]["labels"], ["2026-01", "2026-03"])
        self.assertEqual(region["bi_grounding"]["dimensions"][0]["field"], "Region")
        for artifact in (total, trend, region):
            self.assertEqual(artifact["bi_grounding"]["filters"][0]["value"], "Online")
            self.assertEqual(artifact["bi_grounding"]["row_count"], 2)
            self.assertNotIn("_analytic_state", artifact)

    def test_dashboard_partial_failure_keeps_valid_results(self):
        rows = [*DATASET, {**DATASET[0], "Order Date": "invalid"}]
        reply = self.turn("Build a dashboard with monthly revenue and regional breakdown", dataset=rows).get_json()
        items = reply["dashboard_draft"]["items"]
        self.assertEqual([item["status"] for item in items], ["ready", "unavailable", "ready"])
        self.assertNotIn("artifact", items[1])

    def test_natural_average_and_inclusive_date_range(self):
        rows = [{**DATASET[0], "Order Date": "2026-01-31T17:00:00Z", "Revenue": 40},
                {**DATASET[1], "Order Date": "2026-02-01T01:00:00Z", "Revenue": 80}]
        reply = self.turn("Average revenue from 2026-01-01 to 2026-01-31", dataset=rows).get_json()
        self.assertEqual(reply["bi_grounding"]["aggregation"], "mean")
        self.assertEqual(reply["bi_grounding"]["row_count"], 1)
        self.assertEqual(reply["artifacts"][0]["content"]["summary"]["value"], 40)

    def test_changed_dataset_rejects_structured_refinement(self):
        first = self.turn("What is revenue?").get_json()
        reply = self.turn("Break down by Region", first["session_state"], dataset=DATASET[:2], analytics_refinement={
            "operation": "set_group_by", "arguments": {"field": "Region"},
        })
        self.assertEqual(reply.status_code, 400)
        self.assertIn("dataset changed", reply.get_json()["error"]["message"])

    def test_semantic_failure_does_not_fall_back_to_a_different_definition(self):
        model = copy.deepcopy(SEMANTIC_MODEL)
        model["metrics"][0]["expression"]["column"] = "Missing Measure"
        reply = self.turn("Show revenue by region", semantic_model=model)
        self.assertEqual(reply.status_code, 400)

    def test_dashboard_with_multiple_metrics_asks_for_focus(self):
        reply = self.turn("Build a dashboard with Revenue and Gross Margin %").get_json()
        self.assertEqual(reply["artifacts"][0]["content"]["reason_code"], "analytics_clarification_required")
        self.assertIsNone(reply["dashboard_draft"])

    def test_metric_filters_do_not_accumulate_across_follow_ups(self):
        model = copy.deepcopy(SEMANTIC_MODEL)
        model["metrics"][0]["filters"] = [{"field": "Channel", "operator": "eq", "value": "Online"}]
        reply = self.turn("What is revenue?", semantic_model=model).get_json()
        for _ in range(10):
            reply = self.turn("Break that down by region", reply["session_state"], semantic_model=model).get_json()
        self.assertEqual(len(reply["bi_grounding"]["filters"]), 1)
        self.assertEqual(reply["artifacts"][0]["content"]["summary"]["value"], 235)


if __name__ == "__main__":
    unittest.main()
