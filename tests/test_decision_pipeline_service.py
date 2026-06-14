import unittest

from backend.services.decision_pipeline_service import run_decision_pipeline


DATASET = [
    {
        "Order Date": "2026-01-31",
        "Region": "East",
        "Channel": "Online",
        "Revenue": 100.0,
        "Gross Margin %": 0.35,
        "Discount Rate": 0.10,
    },
    {
        "Order Date": "2026-02-28",
        "Region": "East",
        "Channel": "Retail",
        "Revenue": 120.0,
        "Gross Margin %": 0.34,
        "Discount Rate": 0.09,
    },
    {
        "Order Date": "2026-03-31",
        "Region": "West",
        "Channel": "Online",
        "Revenue": 135.0,
        "Gross Margin %": 0.33,
        "Discount Rate": 0.08,
    },
    {
        "Order Date": "2026-04-30",
        "Region": "West",
        "Channel": "Retail",
        "Revenue": 150.0,
        "Gross Margin %": 0.32,
        "Discount Rate": 0.07,
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


def build_payload():
    return {
        "dataset": DATASET,
        "dataset_ref": {"source": "inline", "dataset_id": "sales_q1", "dataset_name": "Q1 Sales"},
        "semantic_model": SEMANTIC_MODEL,
    }


class DecisionPipelineServiceTests(unittest.TestCase):
    def test_missing_dataset_returns_non_ready_bundle(self):
        result = run_decision_pipeline({})

        # Expected when this passes:
        # - the API still returns a success-shaped response instead of crashing
        # - readiness clearly says dataset / semantic model / metrics are missing
        # - the decision bundle is scaffolded and empty
        self.assertEqual(result["status"], "success")
        self.assertFalse(result["readiness"]["dataset_loaded"])
        self.assertFalse(result["readiness"]["semantic_ready"])
        self.assertIn("dataset", result["readiness"]["missing_requirements"])
        self.assertIn("semantic_model", result["readiness"]["missing_requirements"])
        self.assertIn("metrics", result["readiness"]["missing_requirements"])
        self.assertEqual(result["decision_bundle"]["signals"], [])
        self.assertEqual(result["decision_bundle"]["recommendations"], [])
        self.assertEqual(result["decision_bundle"]["scenario_preview"]["status"], "not_applicable")
        self.assertEqual(result["decision_bundle"]["scenario_preview"]["source_scenario_ids"], [])

    def test_pipeline_can_skip_scenario_preview_but_still_return_decision_artifacts(self):
        payload = build_payload()
        payload["include_scenario_preview"] = False

        result = run_decision_pipeline(payload)

        # Expected when this passes:
        # - the decision pipeline is considered ready with dataset + semantic metrics
        # - signals and recommendations are still produced
        # - scenario preview explicitly says it was not requested, which is the stable contract
        self.assertEqual(result["status"], "success")
        self.assertTrue(result["readiness"]["dataset_loaded"])
        self.assertTrue(result["readiness"]["semantic_ready"])
        self.assertTrue(result["readiness"]["decision_ready"])
        self.assertGreaterEqual(len(result["decision_bundle"]["signals"]), 1)
        self.assertGreaterEqual(len(result["decision_bundle"]["recommendations"]), 1)
        self.assertEqual(result["decision_bundle"]["scenario_preview"]["status"], "not_requested")
        self.assertEqual(result["decision_bundle"]["scenario_preview"]["source_scenario_ids"], [])
        self.assertEqual(result["meta"]["scenario_preview_status"], "not_requested")

    def test_pipeline_scenario_preview_exposes_source_scenario_trace(self):
        result = run_decision_pipeline(build_payload())

        self.assertEqual(result["status"], "success")
        preview = result["decision_bundle"]["scenario_preview"]
        self.assertEqual(preview["status"], "ready")
        self.assertTrue(preview["projections"])
        self.assertTrue(preview["source_scenario_ids"])
        self.assertTrue(preview["source_scenario_ids"][0].startswith("scenario_"))


if __name__ == "__main__":
    unittest.main()
