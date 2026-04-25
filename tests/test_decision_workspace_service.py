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
        {
            "id": "metric_marketing_spend",
            "name": "Marketing Spend",
            "label": "Marketing Spend",
            "field": "Marketing Spend",
            "default_aggregation": "sum",
            "format_hint": "currency",
            "expression": {"type": "column_aggregation", "column": "Marketing Spend", "aggregation": "sum"},
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


def build_prompt_first_payload():
    return {
        "dataset": DATASET,
        "dataset_ref": {"source": "inline", "dataset_id": "sales_q1", "dataset_name": "Q1 Sales"},
        "semantic_model": SEMANTIC_MODEL,
        "decision_prompt": "How should we grow revenue next quarter without hurting gross margin?",
        "decision_intake": {
            "what_matters": "Grow revenue next quarter",
            "what_to_avoid": "Protect gross margin",
            "additional_context": "We can change discounting and regional mix.",
        },
    }


def build_compound_prompt_first_payload():
    return {
        "dataset": DATASET,
        "dataset_ref": {"source": "inline", "dataset_id": "sales_q1", "dataset_name": "Q1 Sales"},
        "semantic_model": SEMANTIC_MODEL,
        "decision_prompt": (
            "How should we grow revenue next quarter using discount rate and "
            "marketing spend changes by region without hurting gross margin?"
        ),
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

    def test_workspace_analysis_returns_scoped_diagnostics_with_secondary_legacy_signals(self):
        result = DecisionWorkspaceService.analyze_workspace(build_payload())

        workspace = result["decision_workspace"]
        analysis = result["workspace_analysis"]
        scoped_diagnostics = analysis["scoped_diagnostics"]
        legacy_diagnostics = analysis["legacy_diagnostics"]
        workspace_metric_ids = {
            item["metric_id"]
            for item in workspace["scoped_context"]["relevant_metrics"]
        }
        workspace_dimension_ids = {
            item["dimension_id"]
            for item in workspace["scoped_context"]["relevant_dimensions"]
        } | {
            item["dimension_id"]
            for item in workspace["scoped_context"]["comparison_dimensions"]
        }

        self.assertEqual(result["status"], "success")
        self.assertEqual(analysis["analysis_mode"], "scoped_observational")
        self.assertEqual(analysis["status"], "ready")
        self.assertTrue(any(item["status"] == "observed_change" for item in scoped_diagnostics))
        self.assertIn("not a simulation or trade-off result", analysis["truthfulness_note"])
        self.assertEqual(legacy_diagnostics["status"], "secondary")
        self.assertGreaterEqual(len(legacy_diagnostics["signals"]), 1)

        for signal in legacy_diagnostics["signals"]:
            metric_ref = signal.get("metric_ref") or {}
            dimension_ref = signal.get("dimension_ref") or {}
            self.assertTrue(
                metric_ref.get("metric_id") in workspace_metric_ids
                or dimension_ref.get("dimension_id") in workspace_dimension_ids
            )

    def test_workspace_analysis_accepts_existing_workspace_and_keeps_limited_truthful(self):
        payload = build_payload()
        payload["objective"] = {
            **payload["objective"],
            "metric_id": "metric_not_found",
        }
        workspace_result = DecisionWorkspaceService.create_workspace(payload)

        analysis_result = DecisionWorkspaceService.analyze_workspace(
            {
                "dataset": DATASET,
                "dataset_ref": {"source": "inline", "dataset_id": "sales_q1", "dataset_name": "Q1 Sales"},
                "semantic_model": SEMANTIC_MODEL,
                "decision_workspace": workspace_result["decision_workspace"],
            }
        )

        analysis = analysis_result["workspace_analysis"]

        self.assertEqual(analysis["status"], "limited")
        self.assertIn("Returned diagnostics are descriptive only.", analysis["summary"])
        self.assertIn("objective.metric_id_or_metric_name", analysis_result["decision_workspace"]["readiness"]["missing_inputs"])
        self.assertIn("not a simulation or trade-off result", analysis["truthfulness_note"])
        self.assertNotIn("Ready for simulation", analysis["summary"])

    def test_prompt_first_intake_drafts_workspace_from_plain_english(self):
        result = DecisionWorkspaceService.create_workspace(build_prompt_first_payload())

        workspace = result["decision_workspace"]
        drafting = workspace["drafting"]
        levers = workspace["decision_scope"]["levers"]
        constraints = workspace["decision_scope"]["constraints"]

        self.assertEqual(result["meta"]["intake_mode"], "prompt_first")
        self.assertEqual(drafting["intake_mode"], "prompt_first")
        self.assertEqual(drafting["source_summary"]["objective"], "system_draft")
        self.assertEqual(workspace["decision_scope"]["objective"]["metric_ref"]["metric_id"], "metric_revenue_sum")
        self.assertTrue(any(item["metric_id"] == "metric_revenue_sum" for item in drafting["prompt_matches"]["metrics"]))
        self.assertTrue(
            any(
                (((lever.get("binding") or {}).get("metric_ref")) or {}).get("metric_id") == "metric_discount_rate"
                or (((lever.get("binding") or {}).get("dimension_ref")) or {}).get("dimension_id") == "dimension_region"
                for lever in levers
            )
        )
        self.assertTrue(
            any(
                (constraint.get("binding") or {}).get("metric_ref", {}).get("metric_id") == "metric_margin_pct"
                for constraint in constraints
            )
        )

    def test_prompt_first_intake_respects_explicit_objective(self):
        payload = build_prompt_first_payload()
        payload["objective"] = {
            "statement": "Maintain gross margin while we grow revenue",
            "metric_id": "metric_margin_pct",
            "direction": "maintain",
        }

        result = DecisionWorkspaceService.create_workspace(payload)

        workspace = result["decision_workspace"]
        self.assertEqual(workspace["drafting"]["source_summary"]["objective"], "user_input")
        self.assertEqual(workspace["decision_scope"]["objective"]["statement"], payload["objective"]["statement"])
        self.assertEqual(workspace["decision_scope"]["objective"]["metric_ref"]["metric_id"], "metric_margin_pct")

    def test_prompt_first_intake_separates_objective_from_levers_and_guardrails(self):
        result = DecisionWorkspaceService.create_workspace(build_compound_prompt_first_payload())

        workspace = result["decision_workspace"]
        objective = workspace["decision_scope"]["objective"]
        levers = workspace["decision_scope"]["levers"]
        constraints = workspace["decision_scope"]["constraints"]

        lever_metric_ids = {
            (((lever.get("binding") or {}).get("metric_ref")) or {}).get("metric_id")
            for lever in levers
            if isinstance(lever.get("binding"), dict)
        }
        lever_dimension_ids = {
            (((lever.get("binding") or {}).get("dimension_ref")) or {}).get("dimension_id")
            for lever in levers
            if isinstance(lever.get("binding"), dict)
        }
        constraint_metric_ids = {
            (((constraint.get("binding") or {}).get("metric_ref")) or {}).get("metric_id")
            for constraint in constraints
            if isinstance(constraint.get("binding"), dict)
        }

        self.assertEqual(objective["metric_ref"]["metric_id"], "metric_revenue_sum")
        self.assertEqual(objective["direction"], "maximize")
        self.assertIn("revenue", objective["statement"].lower())
        self.assertIn("metric_discount_rate", lever_metric_ids)
        self.assertIn("metric_marketing_spend", lever_metric_ids)
        self.assertNotIn("metric_revenue_sum", lever_metric_ids)
        self.assertIn("dimension_region", lever_dimension_ids)
        self.assertEqual(constraint_metric_ids, {"metric_margin_pct"})

    def test_prompt_first_intake_preserves_prompt_frame_for_multi_clause_business_prompt(self):
        payload = build_compound_prompt_first_payload()
        payload["decision_prompt"] = (
            "How should we grow revenue in Q3 using marketing spend by channel "
            "while keeping gross margin above target?"
        )

        result = DecisionWorkspaceService.create_workspace(payload)

        workspace = result["decision_workspace"]
        objective = workspace["decision_scope"]["objective"]
        levers = workspace["decision_scope"]["levers"]
        constraints = workspace["decision_scope"]["constraints"]
        prompt_frame = workspace["drafting"]["prompt_frame"]

        lever_metric_ids = {
            (((lever.get("binding") or {}).get("metric_ref")) or {}).get("metric_id")
            for lever in levers
            if isinstance(lever.get("binding"), dict)
        }
        lever_dimension_ids = {
            (((lever.get("binding") or {}).get("dimension_ref")) or {}).get("dimension_id")
            for lever in levers
            if isinstance(lever.get("binding"), dict)
        }
        constraint_metric_ids = {
            (((constraint.get("binding") or {}).get("metric_ref")) or {}).get("metric_id")
            for constraint in constraints
            if isinstance(constraint.get("binding"), dict)
        }

        self.assertEqual(objective["metric_ref"]["metric_id"], "metric_revenue_sum")
        self.assertEqual(objective["time_horizon"]["label"], "Q3")
        self.assertEqual(prompt_frame["objective_clause"], "grow revenue in Q3")
        self.assertIn("marketing spend", prompt_frame["lever_clause"].lower())
        self.assertIn("channel", prompt_frame["segment_clause"].lower())
        self.assertIn("metric_marketing_spend", lever_metric_ids)
        self.assertIn("dimension_channel", lever_dimension_ids)
        self.assertEqual(constraint_metric_ids, {"metric_margin_pct"})

    def test_prompt_first_intake_asks_targeted_question_when_prompt_only_names_levers(self):
        payload = build_compound_prompt_first_payload()
        payload["decision_prompt"] = "How should we adjust discount rate by region next quarter?"

        result = DecisionWorkspaceService.create_workspace(payload)

        workspace = result["decision_workspace"]
        objective = workspace["decision_scope"]["objective"]
        levers = workspace["decision_scope"]["levers"]
        clarification_hints = workspace["drafting"]["clarification_hints"]

        lever_metric_ids = {
            (((lever.get("binding") or {}).get("metric_ref")) or {}).get("metric_id")
            for lever in levers
            if isinstance(lever.get("binding"), dict)
        }
        lever_dimension_ids = {
            (((lever.get("binding") or {}).get("dimension_ref")) or {}).get("dimension_id")
            for lever in levers
            if isinstance(lever.get("binding"), dict)
        }

        self.assertEqual(workspace["status"], "limited")
        self.assertIsNone(objective["metric_ref"])
        self.assertIn("objective.metric_id_or_metric_name", workspace["readiness"]["missing_inputs"])
        self.assertIn("metric_discount_rate", lever_metric_ids)
        self.assertIn("dimension_region", lever_dimension_ids)
        self.assertTrue(clarification_hints[0].startswith("Which metric should define success"))
        self.assertNotIn("What controllable lever", " ".join(clarification_hints))

    def test_workspace_analysis_preserves_prompt_first_drafting_metadata(self):
        workspace_result = DecisionWorkspaceService.create_workspace(build_prompt_first_payload())

        analysis_result = DecisionWorkspaceService.analyze_workspace(
            {
                "dataset": DATASET,
                "dataset_ref": {"source": "inline", "dataset_id": "sales_q1", "dataset_name": "Q1 Sales"},
                "semantic_model": SEMANTIC_MODEL,
                "decision_workspace": workspace_result["decision_workspace"],
            }
        )

        self.assertEqual(analysis_result["decision_workspace"]["drafting"]["intake_mode"], "prompt_first")
        self.assertEqual(analysis_result["meta"]["intake_mode"], "prompt_first")


if __name__ == "__main__":
    unittest.main()
