import unittest

from backend.services.decision_workspace_service import DecisionWorkspaceService


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
        "decision_prompt": "How should we grow Q3 revenue without hurting gross margin?",
        "objective": {
            "statement": "Increase revenue next quarter while protecting gross margin",
            "metric_id": "metric_revenue_sum",
            "direction": "maximize",
            "time_horizon": {
                "kind": "relative_period",
                "label": "Next quarter",
                "grain": "quarter",
            },
        },
        "levers": [
            {
                "lever_id": "discounting",
                "label": "Discounting",
                "lever_type": "policy_choice",
                "binding": {"field": "Discount Rate"},
                "desired_change": "decrease",
            },
            {
                "lever_id": "regional_mix",
                "label": "Regional mix",
                "lever_type": "mix",
                "binding": {"dimension_id": "dimension_region"},
                "desired_change": "shift",
            },
        ],
        "constraints": [
            {
                "constraint_id": "margin_floor",
                "label": "Gross margin floor",
                "constraint_type": "metric_guardrail",
                "binding": {"metric_id": "metric_margin_pct"},
                "condition": {"operator": "gte", "value": 0.32, "unit": "ratio"},
                "hardness": "hard",
            }
        ],
        "filters": [{"field": "Region", "operator": "neq", "value": "Unknown"}],
    }


class DecisionWorkspaceServiceTests(unittest.TestCase):
    def test_ready_workspace_uses_scoped_context_and_time_metadata(self):
        result = DecisionWorkspaceService.create_workspace(build_payload())

        workspace = result["decision_workspace"]
        readiness = workspace["readiness"]
        scoped_context = workspace["scoped_context"]
        relevant_metric_ids = {item["metric_id"] for item in scoped_context["relevant_metrics"]}
        relevant_dimension_ids = {item["dimension_id"] for item in scoped_context["relevant_dimensions"]}

        self.assertEqual(result["contract_version"], "di_2_0_v1")
        self.assertEqual(workspace["status"], "ready")
        self.assertTrue(readiness["scope_complete"])
        self.assertTrue(readiness["objective_ready"])
        self.assertTrue(readiness["lever_ready"])
        self.assertTrue(readiness["constraint_ready"])
        self.assertTrue(readiness["can_run_simulation"])
        self.assertEqual(readiness["missing_inputs"], [])
        self.assertEqual(relevant_metric_ids, {"metric_revenue_sum", "metric_discount_rate", "metric_margin_pct"})
        self.assertIn("dimension_region", relevant_dimension_ids)
        self.assertTrue(scoped_context["comparison_dimensions"])
        self.assertEqual(scoped_context["time_context"]["field"], "Order Date")
        self.assertIsNotNone(scoped_context["period_context"])
        self.assertTrue(any("Legacy decision-bundle diagnostics remain available" in note for note in scoped_context["notes"]))

    def test_missing_levers_stays_in_needs_input(self):
        payload = build_payload()
        payload["levers"] = []

        result = DecisionWorkspaceService.create_workspace(payload)
        workspace = result["decision_workspace"]

        self.assertEqual(workspace["status"], "needs_input")
        self.assertFalse(workspace["readiness"]["scope_complete"])
        self.assertIn("at_least_one_controllable_lever", workspace["readiness"]["missing_inputs"])
        self.assertTrue(any(item["blocks_simulation"] for item in workspace["unknowns"]))

    def test_unresolved_objective_keeps_workspace_limited(self):
        payload = build_payload()
        payload["objective"] = {
            **payload["objective"],
            "metric_id": "metric_not_found",
        }

        result = DecisionWorkspaceService.create_workspace(payload)
        workspace = result["decision_workspace"]

        self.assertEqual(workspace["status"], "limited")
        self.assertFalse(workspace["readiness"]["objective_ready"])
        self.assertIn("objective.metric_id_or_metric_name", workspace["readiness"]["missing_inputs"])
        self.assertTrue(any(item["category"] == "binding_gap" and item["blocks_simulation"] for item in workspace["unknowns"]))

    def test_unresolved_hard_constraint_stays_limited_and_honest(self):
        payload = build_payload()
        payload["constraints"] = [
            {
                "constraint_id": "margin_floor",
                "label": "Gross margin floor",
                "constraint_type": "metric_guardrail",
                "binding": {"metric_id": "metric_missing"},
                "condition": {"operator": "gte", "value": 0.32, "unit": "ratio"},
                "hardness": "hard",
            }
        ]

        result = DecisionWorkspaceService.create_workspace(payload)
        workspace = result["decision_workspace"]

        self.assertEqual(workspace["status"], "limited")
        self.assertFalse(workspace["readiness"]["constraint_ready"])
        self.assertIn("constraints.margin_floor.binding", workspace["readiness"]["missing_inputs"])
        self.assertTrue(
            any(item["category"] == "constraint_gap" and item["blocks_simulation"] for item in workspace["unknowns"])
        )


if __name__ == "__main__":
    unittest.main()
