import unittest

import pandas as pd

from backend.services.decision_workspace_service import DecisionWorkspaceService
from backend.services.semantic_model import finalize_semantic_model, infer_semantic_model_from_dataframe


DATASET = [
    {
        "Order Date": "2026-01-31",
        "Region": "East",
        "Revenue": 100.0,
        "Gross Margin %": 0.35,
        "Discount Rate": 0.10,
        "Marketing Spend": 24.0,
    },
    {
        "Order Date": "2026-02-28",
        "Region": "West",
        "Revenue": 150.0,
        "Gross Margin %": 0.32,
        "Discount Rate": 0.07,
        "Marketing Spend": 41.0,
    },
]


def _metric_by_field(model, field):
    return next(metric for metric in model["metrics"] if metric.get("field") == field)


def _dimension_by_field(model, field):
    return next(dimension for dimension in model["dimensions"] if dimension.get("field") == field)


class SemanticRoleStrengtheningTests(unittest.TestCase):
    def test_inferred_semantic_model_adds_decision_role_metadata(self):
        model = infer_semantic_model_from_dataframe(pd.DataFrame(DATASET), dataset_name="Sales")

        revenue_semantics = _metric_by_field(model, "Revenue")["decision_semantics"]
        margin_semantics = _metric_by_field(model, "Gross Margin %")["decision_semantics"]
        discount_semantics = _metric_by_field(model, "Discount Rate")["decision_semantics"]
        date_semantics = _dimension_by_field(model, "Order Date")["decision_semantics"]
        region_semantics = _dimension_by_field(model, "Region")["decision_semantics"]

        # These assertions protect the additive contract rather than a single UI rendering path.
        self.assertTrue(revenue_semantics["objective_candidate"])
        self.assertEqual(revenue_semantics["polarity"], "increase_is_good")
        self.assertGreaterEqual(revenue_semantics["confidence"], 0.7)
        self.assertTrue(discount_semantics["lever_candidate"])
        self.assertEqual(discount_semantics["controllability"], "controllable")
        self.assertTrue(margin_semantics["guardrail_candidate"])
        self.assertIn("Gross Margin %", margin_semantics["aliases"])
        self.assertTrue(date_semantics["temporal_candidate"])
        self.assertEqual(date_semantics["grain"], "observed_value")
        self.assertTrue(region_semantics["segment_candidate"])
        self.assertTrue(region_semantics["comparison_candidate"])

    def test_prompt_first_workspace_carries_binding_confidence_and_role_source(self):
        semantic_model = infer_semantic_model_from_dataframe(pd.DataFrame(DATASET), dataset_name="Sales")
        result = DecisionWorkspaceService.create_workspace(
            {
                "dataset": DATASET,
                "semantic_model": semantic_model,
                "decision_prompt": "How should we grow revenue next quarter using marketing spend by region while protecting gross margin?",
            }
        )

        workspace = result["decision_workspace"]
        objective = workspace["decision_scope"]["objective"]
        lever_bindings = [lever["binding"] for lever in workspace["decision_scope"]["levers"]]
        guardrail_binding = workspace["decision_scope"]["constraints"][0]["binding"]
        drafting_matches = workspace["drafting"]["prompt_matches"]

        self.assertEqual(objective["metric_ref"]["field"], "Revenue")
        self.assertGreaterEqual(objective["semantic_binding_confidence"], 0.7)
        self.assertEqual(objective["semantic_role_source"], "decision_semantics")
        self.assertTrue(any(binding.get("semantic_binding_confidence") for binding in lever_bindings))
        self.assertEqual(guardrail_binding["metric_ref"]["field"], "Gross Margin %")
        self.assertGreaterEqual(guardrail_binding["semantic_binding_confidence"], 0.7)
        self.assertIn("unresolved_mappings", drafting_matches)

    def test_weak_or_ambiguous_objective_mapping_stays_unresolved(self):
        ambiguous_model = finalize_semantic_model(
            {
                "version": 2,
                "dataset": {"id": "ambiguous_sales", "name": "Ambiguous Sales"},
                "dimensions": [
                    {
                        "id": "dimension_region",
                        "name": "Region",
                        "label": "Region",
                        "field": "Region",
                        "semantic_kind": "categorical",
                        "data_type": "string",
                    }
                ],
                "metrics": [
                    {
                        "id": "metric_total_sales",
                        "name": "Total Sales",
                        "label": "Total Sales",
                        "field": "Total Sales",
                        "default_aggregation": "sum",
                        "format_hint": "currency",
                    },
                    {
                        "id": "metric_net_sales",
                        "name": "Net Sales",
                        "label": "Net Sales",
                        "field": "Net Sales",
                        "default_aggregation": "sum",
                        "format_hint": "currency",
                    },
                    {
                        "id": "metric_discount_rate",
                        "name": "Discount Rate",
                        "label": "Discount Rate",
                        "field": "Discount Rate",
                        "default_aggregation": "mean",
                        "format_hint": "percentage",
                    },
                ],
            }
        )
        dataset = [
            {"Region": "East", "Total Sales": 100.0, "Net Sales": 90.0, "Discount Rate": 0.1},
            {"Region": "West", "Total Sales": 120.0, "Net Sales": 110.0, "Discount Rate": 0.08},
        ]

        result = DecisionWorkspaceService.create_workspace(
            {
                "dataset": dataset,
                "semantic_model": ambiguous_model,
                "decision_prompt": "How should we grow sales next quarter using discount rate by region?",
            }
        )

        workspace = result["decision_workspace"]
        unresolved_mappings = workspace["drafting"]["prompt_matches"]["unresolved_mappings"]

        self.assertIsNone(workspace["decision_scope"]["objective"]["metric_ref"])
        self.assertIn("objective.metric_id_or_metric_name", workspace["readiness"]["missing_inputs"])
        self.assertTrue(any(item["status"] == "ambiguous" for item in unresolved_mappings))
        self.assertTrue(
            any(
                (lever.get("binding") or {}).get("metric_ref", {}).get("metric_id") == "metric_discount_rate"
                for lever in workspace["decision_scope"]["levers"]
            )
        )


if __name__ == "__main__":
    unittest.main()
