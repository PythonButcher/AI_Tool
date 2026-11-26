"""Synthetic business journeys; all numeric assertions execute the real resolver."""

import copy
from datetime import date
import unittest
from unittest.mock import patch

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

    def test_relative_month_paraphrases_and_inclusive_utc_boundaries(self):
        rows = [
            {**DATASET[0], "Order Date": "2026-01-31T23:59:59Z", "Revenue": 90.0},
            {**DATASET[1], "Order Date": "2026-02-01T00:00:00Z", "Revenue": 120.0},
            {**DATASET[1], "Order Date": "2026-02-28T22:15:00Z", "Revenue": 45.0},
            {**DATASET[2], "Order Date": "2026-03-01T00:05:00Z", "Revenue": 135.0},
        ]
        with patch("backend.decision_engine.bi_intent.utc_today", return_value=date(2026, 3, 18)):
            for prompt in (
                "How much revenue did we make last month?",
                "What was revenue in the previous month?",
            ):
                with self.subTest(prompt=prompt):
                    response = self.turn(prompt, dataset=rows)
                    self.assertEqual(response.status_code, 200)
                    reply = response.get_json()
                    self.assertEqual(reply["contract_version"], "ai_chat_bi_result_v1")
                    self.assertEqual(reply["artifacts"][0]["type"], "answer")
                    self.assertEqual(reply["artifacts"][0]["content"]["summary"]["value"], 165.0)
                    expected_period = {"field": "Order Date", "start": "2026-02-01", "end": "2026-02-28"}
                    self.assertEqual(reply["bi_grounding"]["time_period"], expected_period)
                    self.assertEqual(reply["bi_grounding"]["row_count"], 2)
                    self.assertEqual(
                        [(f["field"], f["operator"], f["value"]) for f in reply["bi_grounding"]["filters"]],
                        [("Order Date", "gte", "2026-02-01"), ("Order Date", "lte", "2026-02-28")],
                    )
                    state = reply["session_state"]["analytics_state"]
                    self.assertEqual(state["metric_id"], "metric_revenue_sum")
                    self.assertEqual(state["group_by"], [])
                    self.assertEqual(state["time_period"], expected_period)

    def test_relative_month_january_rolls_over_to_previous_december(self):
        rows = [
            {**DATASET[0], "Order Date": "2025-11-30T23:00:00Z", "Revenue": 50.0},
            {**DATASET[1], "Order Date": "2025-12-01T00:00:00Z", "Revenue": 110.0},
            {**DATASET[2], "Order Date": "2025-12-31T18:30:00Z", "Revenue": 95.0},
            {**DATASET[3], "Order Date": "2026-01-01T00:00:00Z", "Revenue": 150.0},
        ]
        with patch("backend.decision_engine.bi_intent.utc_today", return_value=date(2026, 1, 10)):
            reply = self.turn("How much revenue did we make last month?", dataset=rows).get_json()
        self.assertEqual(
            reply["bi_grounding"]["time_period"],
            {"field": "Order Date", "start": "2025-12-01", "end": "2025-12-31"},
        )
        self.assertEqual(reply["bi_grounding"]["row_count"], 2)
        self.assertEqual(reply["artifacts"][0]["content"]["summary"]["value"], 205.0)

    def test_relative_month_replaces_prior_period_and_retains_unrelated_filters(self):
        first = self.turn("What is revenue for Online in March 2026?").get_json()
        self.assertEqual(first["artifacts"][0]["content"]["summary"]["value"], 135.0)
        self.assertEqual(
            first["bi_grounding"]["time_period"],
            {"field": "Order Date", "start": "2026-03-01", "end": "2026-03-31"},
        )
        with patch("backend.decision_engine.bi_intent.utc_today", return_value=date(2026, 2, 14)):
            follow_up = self.turn("What about last month?", first["session_state"]).get_json()
        self.assertEqual(follow_up["artifacts"][0]["content"]["summary"]["value"], 100.0)
        self.assertEqual(follow_up["bi_grounding"]["row_count"], 1)
        self.assertEqual(
            follow_up["bi_grounding"]["time_period"],
            {"field": "Order Date", "start": "2026-01-01", "end": "2026-01-31"},
        )
        self.assertEqual(
            [(f["field"], f["operator"], f["value"]) for f in follow_up["bi_grounding"]["filters"]],
            [
                ("Channel", "eq", "Online"),
                ("Order Date", "gte", "2026-01-01"),
                ("Order Date", "lte", "2026-01-31"),
            ],
        )

    def test_relative_month_ambiguous_and_unavailable_date_fields(self):
        model = copy.deepcopy(SEMANTIC_MODEL)
        model["dimensions"].append({
            **model["dimensions"][0],
            "id": "ship_date",
            "field": "Ship Date",
            "label": "Ship Date",
            "name": "Ship Date",
        })
        rows = [
            {**DATASET[0], "Order Date": "2026-02-10", "Ship Date": "2026-03-02", "Revenue": 100.0},
            {**DATASET[1], "Order Date": "2026-01-15", "Ship Date": "2026-02-18", "Revenue": 240.0},
        ]
        with patch("backend.decision_engine.bi_intent.utc_today", return_value=date(2026, 3, 15)):
            clarify = self.turn(
                "How much revenue did we make last month?",
                semantic_model=model,
                dataset=rows,
            ).get_json()
            content = clarify["artifacts"][0]["content"]
            self.assertEqual(content["reason_code"], "analytics_clarification_required")
            self.assertNotIn("summary", content)
            self.assertEqual(len(content["choices"]), 2)

            resolved = self.turn(
                content["choices"][1]["user_message"],
                semantic_model=model,
                dataset=rows,
            ).get_json()
            self.assertEqual(resolved["bi_grounding"]["dimensions"], [])
            self.assertEqual(
                resolved["bi_grounding"]["time_period"],
                {"field": "Ship Date", "start": "2026-02-01", "end": "2026-02-28"},
            )
            self.assertEqual(resolved["artifacts"][0]["content"]["summary"]["value"], 240.0)

            no_date_model = copy.deepcopy(SEMANTIC_MODEL)
            no_date_model["dimensions"] = [
                dim for dim in no_date_model["dimensions"] if dim["id"] != "dimension_order_date"
            ]
            missing_date = self.turn(
                "How much revenue did we make last month?",
                semantic_model=no_date_model,
            )
            self.assertEqual(missing_date.status_code, 400)

    def test_category_comparison_paraphrases_and_ordinary_multi_value_filter(self):
        for prompt in (
            "Compare revenue for Online and Retail",
            "Compare Online and Retail revenue",
            "Online vs Retail revenue",
        ):
            with self.subTest(prompt=prompt):
                response = self.turn(prompt)
                self.assertEqual(response.status_code, 200)
                reply = response.get_json()
                artifact = reply["artifacts"][0]
                self.assertEqual(artifact["type"], "chart")
                chart = artifact["content"]["chartData"]
                self.assertEqual(chart["labels"], ["Retail", "Online"])
                self.assertEqual(chart["datasets"][0]["data"], [270.0, 235.0])
                self.assertEqual(
                    [dim["field"] for dim in reply["bi_grounding"]["dimensions"]],
                    ["Channel"],
                )
                self.assertEqual(
                    reply["bi_grounding"]["filters"],
                    [{
                        "dimension_id": "dimension_channel",
                        "field": "Channel",
                        "label": "Channel",
                        "operator": "in",
                        "value": None,
                        "values": ["Online", "Retail"],
                    }],
                )
                self.assertEqual(reply["bi_grounding"]["row_count"], 4)
                self.assertEqual(reply["session_state"]["analytics_state"]["group_by"], ["Channel"])

        ordinary = self.turn("What is revenue for Online and Retail?").get_json()
        self.assertEqual(ordinary["artifacts"][0]["type"], "answer")
        self.assertEqual(ordinary["artifacts"][0]["content"]["summary"]["value"], 505.0)
        self.assertEqual(ordinary["bi_grounding"]["dimensions"], [])
        self.assertEqual(ordinary["bi_grounding"]["filters"][0]["values"], ["Online", "Retail"])

    def test_category_comparison_preserves_date_and_unrelated_category_filters(self):
        first = self.turn("What is revenue for East in Q1 2026?").get_json()
        self.assertEqual(first["artifacts"][0]["content"]["summary"]["value"], 220.0)
        reply = self.turn("Compare Online and Retail", first["session_state"]).get_json()
        chart = reply["artifacts"][0]["content"]["chartData"]
        self.assertEqual(chart["labels"], ["Retail", "Online"])
        self.assertEqual(chart["datasets"][0]["data"], [120.0, 100.0])
        self.assertEqual([dim["field"] for dim in reply["bi_grounding"]["dimensions"]], ["Channel"])
        self.assertEqual(reply["bi_grounding"]["row_count"], 2)
        self.assertEqual(
            reply["bi_grounding"]["time_period"],
            {"field": "Order Date", "start": "2026-01-01", "end": "2026-03-31"},
        )
        filter_fields = [item["field"] for item in reply["bi_grounding"]["filters"]]
        self.assertIn("Region", filter_fields)
        self.assertIn("Channel", filter_fields)
        self.assertIn("Order Date", filter_fields)

    def test_category_comparison_ambiguous_and_unresolvable_cases(self):
        model = copy.deepcopy(SEMANTIC_MODEL)
        model["dimensions"].append({
            "id": "dimension_sales_channel",
            "name": "Sales Channel",
            "label": "Sales Channel",
            "field": "Sales Channel",
            "semantic_kind": "categorical",
            "data_type": "string",
        })
        rows = [
            {**DATASET[0], "Channel": "Online", "Sales Channel": "Retail", "Revenue": 80.0},
            {**DATASET[1], "Channel": "Retail", "Sales Channel": "Online", "Revenue": 190.0},
        ]
        clarify = self.turn(
            "Compare Online and Retail revenue",
            semantic_model=model,
            dataset=rows,
        ).get_json()
        content = clarify["artifacts"][0]["content"]
        self.assertEqual(content["reason_code"], "analytics_clarification_required")
        self.assertEqual(len(content["choices"]), 2)

        selected = self.turn(
            content["choices"][1]["user_message"],
            semantic_model=model,
            dataset=rows,
        ).get_json()
        self.assertEqual(
            [dim["field"] for dim in selected["bi_grounding"]["dimensions"]],
            ["Sales Channel"],
        )
        self.assertEqual(
            [item["field"] for item in selected["bi_grounding"]["filters"]],
            ["Sales Channel"],
        )
        chart = selected["artifacts"][0]["content"]["chartData"]
        self.assertEqual(chart["labels"], ["Online", "Retail"])
        self.assertEqual(chart["datasets"][0]["data"], [190.0, 80.0])

        for invalid_prompt in (
            "Compare revenue for Online and Wholesale",
            "Compare Direct and Partner revenue",
            "Online vs East revenue",
        ):
            with self.subTest(invalid_prompt=invalid_prompt):
                invalid = self.turn(invalid_prompt)
                self.assertEqual(invalid.status_code, 400)

    def test_combined_category_comparison_and_relative_month(self):
        rows = [
            {**DATASET[0], "Order Date": "2026-01-20", "Channel": "Online", "Revenue": 100.0},
            {**DATASET[0], "Order Date": "2026-02-05", "Channel": "Online", "Revenue": 125.0},
            {**DATASET[2], "Order Date": "2026-02-19", "Channel": "Online", "Revenue": 85.0},
            {**DATASET[1], "Order Date": "2026-02-14", "Channel": "Retail", "Revenue": 120.0},
            {**DATASET[1], "Order Date": "2026-02-22", "Channel": "Wholesale", "Revenue": 999.0},
            {**DATASET[3], "Order Date": "2026-03-10", "Channel": "Retail", "Revenue": 150.0},
        ]
        with patch("backend.decision_engine.bi_intent.utc_today", return_value=date(2026, 3, 15)):
            response = self.turn("Compare Online and Retail revenue last month", dataset=rows)
        self.assertEqual(response.status_code, 200)
        reply = response.get_json()
        artifact = reply["artifacts"][0]
        self.assertEqual(artifact["type"], "chart")
        chart = artifact["content"]["chartData"]
        self.assertEqual(chart["labels"], ["Online", "Retail"])
        self.assertEqual(chart["datasets"][0]["data"], [210.0, 120.0])
        self.assertEqual(
            [dim["field"] for dim in reply["bi_grounding"]["dimensions"]],
            ["Channel"],
        )
        self.assertEqual(
            reply["bi_grounding"]["time_period"],
            {"field": "Order Date", "start": "2026-02-01", "end": "2026-02-28"},
        )
        self.assertEqual(reply["bi_grounding"]["row_count"], 3)
        self.assertEqual(artifact["bi_grounding"], reply["bi_grounding"])
        state = reply["session_state"]["analytics_state"]
        self.assertEqual(state["metric_id"], "metric_revenue_sum")
        self.assertEqual(state["group_by"], ["Channel"])
        self.assertEqual(
            state["time_period"],
            {"field": "Order Date", "start": "2026-02-01", "end": "2026-02-28"},
        )


if __name__ == "__main__":
    unittest.main()
