import unittest

from flask import Flask

from backend.routes.decision import decision_bp
from backend.services.decision_output_service import DecisionOutputService
from backend.utils.global_state import set_trained_model


DATASET = [
    {
        "Order Date": "2026-01-31",
        "Region": "East",
        "Channel": "Online",
        "Revenue": 100.0,
        "Gross Margin %": 0.35,
        "Discount Rate": 0.10,
        "Marketing Spend": 24.0,
        "Inventory On Hand": 540,
        "Stockout Risk Score": 0.18,
        "On Time Delivery %": 0.97,
        "Return Rate": 0.03,
        "Product Category": "Electronics",
    },
    {
        "Order Date": "2026-02-28",
        "Region": "East",
        "Channel": "Retail",
        "Revenue": 120.0,
        "Gross Margin %": 0.34,
        "Discount Rate": 0.09,
        "Marketing Spend": 28.0,
        "Inventory On Hand": 690,
        "Stockout Risk Score": 0.22,
        "On Time Delivery %": 0.95,
        "Return Rate": 0.04,
        "Product Category": "Home Goods",
    },
    {
        "Order Date": "2026-03-31",
        "Region": "West",
        "Channel": "Online",
        "Revenue": 135.0,
        "Gross Margin %": 0.33,
        "Discount Rate": 0.08,
        "Marketing Spend": 35.0,
        "Inventory On Hand": 410,
        "Stockout Risk Score": 0.46,
        "On Time Delivery %": 0.93,
        "Return Rate": 0.03,
        "Product Category": "Electronics",
    },
    {
        "Order Date": "2026-04-30",
        "Region": "West",
        "Channel": "Retail",
        "Revenue": 150.0,
        "Gross Margin %": 0.32,
        "Discount Rate": 0.07,
        "Marketing Spend": 41.0,
        "Inventory On Hand": 760,
        "Stockout Risk Score": 0.19,
        "On Time Delivery %": 0.96,
        "Return Rate": 0.05,
        "Product Category": "Apparel",
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
        {
            "id": "metric_inventory_on_hand",
            "name": "Inventory On Hand",
            "label": "Inventory On Hand",
            "field": "Inventory On Hand",
            "default_aggregation": "sum",
            "format_hint": "number",
            "expression": {"type": "column_aggregation", "column": "Inventory On Hand", "aggregation": "sum"},
        },
        {
            "id": "metric_stockout_risk",
            "name": "Stockout Risk Score",
            "label": "Stockout Risk Score",
            "field": "Stockout Risk Score",
            "default_aggregation": "mean",
            "format_hint": "number",
            "expression": {"type": "column_aggregation", "column": "Stockout Risk Score", "aggregation": "mean"},
        },
        {
            "id": "metric_on_time_delivery",
            "name": "On Time Delivery %",
            "label": "On Time Delivery %",
            "field": "On Time Delivery %",
            "default_aggregation": "mean",
            "format_hint": "percentage",
            "expression": {"type": "column_aggregation", "column": "On Time Delivery %", "aggregation": "mean"},
        },
        {
            "id": "metric_return_rate",
            "name": "Return Rate",
            "label": "Return Rate",
            "field": "Return Rate",
            "default_aggregation": "mean",
            "format_hint": "percentage",
            "expression": {"type": "column_aggregation", "column": "Return Rate", "aggregation": "mean"},
        },
    ],
}


class DecisionChatApiTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(decision_bp)
        self.client = app.test_client()

    @staticmethod
    def _expanded_dataset():
        """Return enough distinct rows to clear the preparation row gate."""
        rows = []
        for cycle in range(3):
            for source_row in DATASET:
                row = dict(source_row)
                row["Revenue"] += cycle
                row["Marketing Spend"] += cycle
                rows.append(row)
        return rows

    @staticmethod
    def _prediction_from_response(response):
        advanced = response.get_json()["decision_output"]["advanced_readiness"]
        return advanced, next(
            item for item in advanced["capabilities"]
            if item["capability"] == "prediction"
        )

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
        # Phase 1 protects the existing AI Chat artifact contract before
        # any richer decision output artifact is introduced.
        self.assertEqual(body["mode_context"]["current_mode"], "explore")
        self.assertEqual(body["mode_context"]["reason_code"], "visualization_request")
        self.assertTrue(body["artifacts"][0]["artifact_id"])
        self.assertEqual(body["artifacts"][0]["render_hint"], "chart")
        self.assertTrue(body["artifacts"][0]["inspectable"])
        self.assertEqual(body["artifacts"][0]["default_view"], "inspector")
        self.assertEqual(body["artifacts"][0]["source"], "semantic_metric")
        self.assertEqual(body["artifacts"][0]["content"]["meta"]["source"], "semantic_metric")
        chart_spec = body["artifacts"][0]["content"]["chartSpec"]
        self.assertEqual(chart_spec["schemaVersion"], "chart_spec_v1")
        self.assertEqual(chart_spec["sourceMode"], "semantic")
        self.assertEqual(chart_spec["semanticConfig"]["metricId"], "metric_revenue_sum")
        self.assertIn(chart_spec["semanticConfig"]["groupByField"], {"region", "Region"})
        self.assertEqual(chart_spec["pin"]["sourceArtifact"], "ai_chat")
        self.assertIsNone(body["draft_workspace_preview"])
        self.assertEqual(body["action_state"]["available_action_ids"], [])

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
        self.assertEqual(body["artifacts"][0]["type"], "workspace_preview")
        self.assertEqual(body["artifacts"][0]["render_hint"], "workspace_preview")
        self.assertTrue(body["artifacts"][0]["inspectable"])
        self.assertEqual(body["artifacts"][0]["default_view"], "inline_and_inspector")
        self.assertEqual(body["artifacts"][0]["source"], "decision_workspace")
        self.assertEqual(body["draft_workspace_preview"]["type"], "workspace_preview")
        self.assertEqual(body["draft_workspace_preview"]["render_hint"], "workspace_preview")
        self.assertTrue(body["draft_workspace_preview"]["inspectable"])
        self.assertIn("draft_workspace", body["session_state"])
        self.assertTrue(body["suggested_actions"])
        self.assertEqual(body["mode_context"]["current_mode"], "decide")
        self.assertEqual(body["mode_context"]["reason_code"], "decision_request")
        self.assertEqual(body["session_state"]["schema_version"], "di_phase4_5_session_state_v1")
        self.assertTrue(body["session_state"]["decision_state"]["has_draft_workspace"])
        self.assertEqual(body["session_state"]["decision_state"]["objective_draft"]["metric"], "Revenue")
        self.assertIn("open_workspace", body["action_state"]["available_action_ids"])
        self.assertEqual(body["action_state"]["primary_action_id"], "show_blockers")
        self.assertTrue(body["suggested_actions"][0]["description"])

    def test_decision_turn_includes_dataset_trust_for_loaded_dataset(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "dataset_ref": {
                    "source": "active",
                    "dataset_id": "sales_q1",
                    "dataset_name": "Q1 Sales",
                    "transform_state": "cleaned",
                    "stale_state": "current",
                },
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we grow revenue next quarter without hurting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        trust = body["dataset_trust"]
        self.assertEqual(trust["source_label"], "Active dataset")
        self.assertEqual(trust["dataset"]["dataset_id"], "sales_q1")
        self.assertEqual(trust["dataset"]["dataset_name"], "Q1 Sales")
        self.assertEqual(trust["row_count"], len(DATASET))
        self.assertEqual(trust["column_count"], len(DATASET[0]))
        self.assertTrue(trust["semantic_ready"])
        self.assertEqual(trust["transform_state"], "cleaned")
        self.assertEqual(trust["stale_state"], "current")
        self.assertEqual(body["artifacts"][0]["dataset_trust"], trust)
        self.assertEqual(body["draft_workspace_preview"]["dataset_trust"], trust)

    def test_complete_decision_turn_returns_decision_output_artifact(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                # Internal governance evidence must come from the route, not
                # from a caller-controlled field with the same name.
                "_governance_readiness": {"status": "blocked"},
                "user_message": "How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual([artifact["type"] for artifact in body["artifacts"]], ["workspace_preview", "decision_output"])

        decision_output = body["decision_output"]
        self.assertEqual(decision_output["type"], "decision_output")
        self.assertEqual(decision_output["render_hint"], "decision_output")
        self.assertTrue(decision_output["inspectable"])
        self.assertEqual(decision_output["dataset_trust"], body["dataset_trust"])
        self.assertEqual(decision_output["readiness"]["readiness_state"], "analysis_ready")
        self.assertEqual(decision_output["readiness"]["truth_boundary"], "observational_analysis_only")
        self.assertEqual(decision_output["frame"]["goal"]["metric_ref"]["label"], "Revenue")
        self.assertEqual(decision_output["frame"]["drivers"][0]["label"], "Marketing Spend")
        self.assertEqual(decision_output["frame"]["breakdowns"][0]["label"], "Channel")
        self.assertEqual(decision_output["evidence_board"]["status"], "not_analyzed")
        self.assertTrue(decision_output["decision_map"]["nodes"])
        self.assertEqual(decision_output["scenario_compare"]["status"], "not_applicable")
        self.assertEqual(decision_output["scenario_compare"]["projections"], [])
        advanced_readiness = decision_output["advanced_readiness"]
        self.assertEqual(advanced_readiness["schema_version"], "di_advanced_readiness_v1")
        self.assertEqual(advanced_readiness["truth_boundary"], "observational_analysis_only")
        self.assertEqual(advanced_readiness["state_counts"]["supported"], 0)
        advanced_by_capability = {
            item["capability"]: item for item in advanced_readiness["capabilities"]
        }
        self.assertEqual(advanced_by_capability["prediction"]["state"], "blocked")
        self.assertEqual(
            advanced_by_capability["prediction"]["reasons"][0]["code"],
            "insufficient_training_rows",
        )
        self.assertEqual(advanced_by_capability["optimization"]["state"], "blocked")
        self.assertEqual(advanced_by_capability["causal_analysis"]["state"], "blocked")
        self.assertEqual(advanced_by_capability["automated_decisioning"]["state"], "blocked")
        governance_evidence = next(
            item
            for item in advanced_by_capability["prediction"]["evidence"]
            if item["code"] == "governance_status"
        )
        self.assertEqual(governance_evidence["value"], "ready")
        command_center = decision_output["command_center"]
        self.assertEqual(command_center["schema_version"], "di_command_center_v1")
        self.assertEqual(command_center["surface"], "ai_chat_decision_command_center")
        self.assertEqual(command_center["status"], "limited")
        self.assertEqual(command_center["stale_state"], "not_applicable")
        self.assertEqual(command_center["rerun_state"]["status"], "analysis_not_run")
        self.assertEqual(command_center["rerun_state"]["action_id"], "analyze_workspace")
        self.assertIn("executive_brief", command_center["section_order"])
        self.assertTrue(command_center["export_readiness"]["ready"])
        self.assertIn(
            "run_observational_analysis",
            [check["check_id"] for check in command_center["allowed_next_checks"]],
        )
        run_check = next(
            check for check in command_center["allowed_next_checks"]
            if check["check_id"] == "run_observational_analysis"
        )
        self.assertTrue(run_check["enabled"])
        self.assertEqual(run_check["action_id"], "analyze_workspace")
        self.assertEqual(run_check["source_refs"]["source_path"], "decision_output.readiness")
        self.assertEqual(run_check["truth_boundary"], "observational_analysis_only")
        self.assertIn(
            "export_decision_output",
            [check["check_id"] for check in command_center["allowed_next_checks"]],
        )
        disabled_check_ids = [check["check_id"] for check in command_center["disabled_next_checks"]]
        self.assertIn("review_evidence_board", disabled_check_ids)
        self.assertIn("unsupported_final_recommendation", disabled_check_ids)
        self.assertIn("live_saved_asset_refresh", disabled_check_ids)
        disabled_evidence = next(
            check for check in command_center["disabled_next_checks"]
            if check["check_id"] == "review_evidence_board"
        )
        self.assertFalse(disabled_evidence["enabled"])
        self.assertEqual(disabled_evidence["disabled_reason"], disabled_evidence["reason"])
        self.assertEqual(disabled_evidence["source_refs"]["source"], "evidence_board")

        self.assertEqual(disabled_evidence["truth_boundary"], "observational_analysis_only")
        self.assertEqual(command_center["truth_boundary"], "observational_analysis_only")
        self.assertTrue(decision_output["export_sections"])
        export_sections = decision_output["export_sections"]
        self.assertEqual(
            [section["section_id"] for section in export_sections],
            [
                "executive_brief",
                "dataset_trust",
                "goal",
                "drivers",
                "limits",
                "breakdowns",
                "evidence_board",
                "decision_map_summary",
                "scenario_compare",
                "advanced_readiness",
                "assumptions_unknowns",
                "truth_boundary",
            ],
        )
        for section in export_sections:
            self.assertTrue(section["title"])
            self.assertTrue(section["body"])
            self.assertEqual(section["summary"], section["body"])

        export_by_id = {section["section_id"]: section for section in export_sections}
        advanced_export = export_by_id["advanced_readiness"]
        self.assertEqual(advanced_export["body"], advanced_readiness["summary"])
        advanced_values = {row["label"]: row["value"] for row in advanced_export["keyValues"]}
        self.assertEqual(advanced_values["Overall State"], advanced_readiness["overall_state"])
        self.assertEqual(advanced_values["Blocked"], advanced_readiness["state_counts"]["blocked"])
        self.assertEqual(len(advanced_export["cards"]), len(advanced_readiness["capabilities"]))
        prediction_card = next(
            card for card in advanced_export["cards"]
            if card["title"] == "Prediction"
        )
        prediction_source = advanced_by_capability["prediction"]
        self.assertIn(prediction_source["reasons"][0]["message"], prediction_card["body"])
        self.assertIn("Dataset rows: 4", prediction_card["body"])
        self.assertIn(
            prediction_source["missing_requirements"][0]["description"].rstrip(" .;"),
            prediction_card["body"],
        )
        self.assertNotIn("..", prediction_card["body"])
        self.assertNotIn(".;", prediction_card["body"])
        self.assertEqual(
            prediction_card["meta"][1]["value"],
            prediction_source["truth_boundary"],
        )
        self.assertTrue(DecisionOutputService.export_sections_ready(export_sections))
        self.assertFalse(
            DecisionOutputService.export_sections_ready(
                [section for section in export_sections if section["section_id"] != "advanced_readiness"]
            )
        )
        dataset_key_values = {row["label"]: row["value"] for row in export_by_id["dataset_trust"]["keyValues"]}
        self.assertEqual(dataset_key_values["Dataset"], "Q1 Sales")
        self.assertEqual(dataset_key_values["Rows"], len(DATASET))
        self.assertEqual(dataset_key_values["Semantic Ready"], "Yes")
        goal_card_text = f"{export_by_id['goal']['cards'][0]['title']} {export_by_id['goal']['cards'][0]['body']}".lower()
        self.assertIn("revenue", goal_card_text)
        driver_card_text = f"{export_by_id['drivers']['cards'][0]['title']} {export_by_id['drivers']['cards'][0]['body']}".lower()
        limit_card_text = f"{export_by_id['limits']['cards'][0]['title']} {export_by_id['limits']['cards'][0]['body']}".lower()
        breakdown_card_text = f"{export_by_id['breakdowns']['cards'][0]['title']} {export_by_id['breakdowns']['cards'][0]['body']}".lower()
        self.assertIn("marketing spend", driver_card_text)
        self.assertIn("gross margin", limit_card_text)
        self.assertIn("channel", breakdown_card_text)
        self.assertEqual(export_by_id["decision_map_summary"]["keyValues"][3]["value"], "not_causal_claim")
        truth_export_text = " ".join(
            [
                export_by_id["truth_boundary"]["body"],
                *export_by_id["truth_boundary"]["items"],
                export_by_id["truth_boundary"]["keyValues"][1]["value"],
            ]
        ).lower()
        self.assertIn("observational decision support", truth_export_text)
        self.assertIn("no final recommendation", truth_export_text)
        self.assertIn("optimization", truth_export_text)
        self.assertIn("prediction certainty", truth_export_text)
        self.assertIn("autonomous decisioning", truth_export_text)
        self.assertIn("final_recommendation", [gate["capability"] for gate in decision_output["advanced_gates"]])
        self.assertNotIn("command_center", [section["section_id"] for section in export_sections])
        self.assertEqual(body["artifacts"][1]["source"], "decision_output")
        self.assertEqual(body["artifacts"][1]["dataset_trust"], body["dataset_trust"])

    def test_live_decision_turn_reports_prediction_limited_without_model_lineage(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": self._expanded_dataset(),
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        advanced_readiness, prediction = self._prediction_from_response(response)
        self.assertEqual(prediction["state"], "limited")
        self.assertEqual(prediction["reasons"][0]["code"], "model_validation_not_available")
        self.assertEqual(advanced_readiness["state_counts"]["supported"], 0)

    def test_live_decision_turn_reports_prediction_not_evaluated_without_dataset(self):
        initial_response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )
        self.assertEqual(initial_response.status_code, 200)

        # A later action can resume a valid draft after its dataset context is
        # no longer available. The backend must display not-evaluated rather
        # than treating stale workspace metadata as usable model evidence.
        workspace = dict(initial_response.get_json()["session_state"]["draft_workspace"])
        workspace.pop("dataset", None)
        response = self.client.post(
            "/api/decision/chat/actions",
            json={
                "action": "show_blockers",
                "semantic_model": SEMANTIC_MODEL,
                "session_state": {"draft_workspace": workspace},
            },
        )

        self.assertEqual(response.status_code, 200)
        advanced_readiness = response.get_json()["decision_output"]["advanced_readiness"]
        prediction = next(
            item for item in advanced_readiness["capabilities"]
            if item["capability"] == "prediction"
        )
        self.assertEqual(prediction["state"], "not_evaluated")
        self.assertEqual(prediction["reasons"][0]["code"], "dataset_not_available")
        self.assertEqual(advanced_readiness["state_counts"]["supported"], 0)

    def test_backend_model_for_different_dataset_does_not_support_prediction(self):
        set_trained_model(object(), {
            "run_id": "run_other_dataset",
            "dataset_id": "other_dataset",
            "target_column": "Revenue",
            "metrics": {"r2": 0.8},
        })
        try:
            response = self.client.post(
                "/api/decision/chat/turns",
                json={
                    "dataset": self._expanded_dataset(),
                    "dataset_ref": {"source": "active", "dataset_id": "sales_q1"},
                    "semantic_model": SEMANTIC_MODEL,
                    "user_message": "How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?",
                    "conversation_history": [],
                    "session_state": {},
                },
            )
        finally:
            set_trained_model(None, None)

        self.assertEqual(response.status_code, 200)
        advanced, prediction = self._prediction_from_response(response)
        self.assertEqual(prediction["state"], "limited")
        self.assertEqual(advanced["state_counts"]["supported"], 0)

    def test_backend_model_for_different_target_does_not_support_prediction(self):
        set_trained_model(object(), {
            "run_id": "run_other_target",
            "dataset_id": "sales_q1",
            "target_column": "Gross Margin %",
            "metrics": {"r2": 0.8},
        })
        try:
            response = self.client.post(
                "/api/decision/chat/turns",
                json={
                    "dataset": self._expanded_dataset(),
                    "dataset_ref": {"source": "active", "dataset_id": "sales_q1"},
                    "semantic_model": SEMANTIC_MODEL,
                    "user_message": "How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?",
                    "conversation_history": [],
                    "session_state": {},
                },
            )
        finally:
            set_trained_model(None, None)

        self.assertEqual(response.status_code, 200)
        advanced, prediction = self._prediction_from_response(response)
        self.assertEqual(prediction["state"], "limited")
        self.assertEqual(advanced["state_counts"]["supported"], 0)

    def test_caller_supplied_model_evidence_does_not_support_prediction(self):
        fake_evaluation = {
            "status": "validated",
            "run_id": "caller_fake_run",
            "target_column": "Revenue",
            "metrics": {"r2": 0.99},
        }
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": self._expanded_dataset(),
                "semantic_model": SEMANTIC_MODEL,
                "model_evaluation": fake_evaluation,
                "_model_evaluation": fake_evaluation,
                "user_message": "How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        advanced, prediction = self._prediction_from_response(response)
        self.assertEqual(prediction["state"], "limited")
        self.assertEqual(advanced["state_counts"]["supported"], 0)

    def test_decision_output_includes_supported_scenario_compare(self):
        scenario_preview = {
            "status": "ready",
            "summary": "Prepared one scenario preview target from the top chart-compatible follow-up checks.",
            "based_on_recommendation_ids": ["recommendation_review_revenue"],
            "based_on_signal_ids": ["signal_revenue_change"],
            "period_context": {
                "label": "Apr 2026",
                "comparison_label": "Mar 2026",
                "current_label": "Apr 2026",
                "previous_label": "Mar 2026",
            },
            "suggested_inputs": {
                "name": "Revenue sensitivity check",
                "filters": [],
                "group_by": ["Region"],
                "metric_targets": [
                    {
                        "metric_id": "metric_revenue_sum",
                        "adjustment_type": "percent",
                        "adjustment_value": 0.08,
                    }
                ],
            },
            "projections": [
                {
                    "metric_ref": {
                        "metric_id": "metric_revenue_sum",
                        "label": "Revenue",
                        "field": "Revenue",
                    },
                    "adjustment": {"type": "percent", "value": 0.08},
                    "baseline_value": 505.0,
                    "baseline_label": "Current Context (Apr 2026)",
                    "projected_value": 545.4,
                    "projected_label": "Adjusted Context (Apr 2026)",
                    "delta_value": 40.4,
                    "delta_pct": 0.08,
                    "comparison_summary": {"direction": "up", "delta_pct": 0.08},
                }
            ],
            "assumptions": ["Percent adjustments are applied directly to observed metric baselines."],
            "source_scenario_ids": ["scenario_revenue_sensitivity"],
        }

        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "scenario_preview": scenario_preview,
                "user_message": "How should we grow revenue next quarter using marketing spend by region while protecting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        scenario_compare = body["decision_output"]["scenario_compare"]
        command_center = body["decision_output"]["command_center"]

        self.assertEqual(scenario_compare["status"], "ready")
        self.assertEqual(scenario_compare["inputs"]["metric_targets"][0]["metric_id"], "metric_revenue_sum")
        self.assertEqual(scenario_compare["baseline"]["metrics"][0]["baseline_value"], 505.0)
        self.assertEqual(scenario_compare["comparison"]["method"], "direct_adjustment_sensitivity")
        self.assertEqual(scenario_compare["comparison"]["target_count"], 1)
        self.assertEqual(scenario_compare["projections"][0]["projected_value"], 545.4)
        self.assertEqual(scenario_compare["source_scenario_ids"], ["scenario_revenue_sensitivity"])
        self.assertEqual(scenario_compare["truth_boundary"], "observational_analysis_only")
        self.assertIn(
            "review_scenario_compare",
            [check["check_id"] for check in command_center["allowed_next_checks"]],
        )
        export_by_id = {
            section["section_id"]: section
            for section in body["decision_output"]["export_sections"]
        }
        scenario_export = export_by_id["scenario_compare"]
        self.assertEqual(scenario_export["keyValues"][1]["value"], "direct_adjustment_sensitivity")
        self.assertEqual(scenario_export["cards"][0]["title"], "Revenue")
        self.assertIn("Direct adjustment", scenario_export["cards"][0]["body"])
        self.assertIn("Direction: up", scenario_export["cards"][0]["body"])
        self.assertIn("direct adjustment", " ".join(scenario_export["items"]).lower())

        boundary_text = " ".join(
            [
                scenario_compare["summary"],
                *scenario_compare["assumptions"],
                *scenario_compare["limitations"],
            ]
        ).lower()
        self.assertIn("direct adjustment", boundary_text)
        self.assertIn("not a forecast", boundary_text)
        self.assertIn("not an optimizer", boundary_text)
        self.assertIn("not a simulation", boundary_text)
        self.assertIn("not a causal model", boundary_text)
        self.assertIn("not a final recommendation", boundary_text)

    def test_incomplete_decision_turn_returns_blocked_decision_output(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we adjust discount rate by region next quarter?",
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual([artifact["type"] for artifact in body["artifacts"]], ["workspace_preview", "decision_output"])

        decision_output = body["decision_output"]
        self.assertEqual(decision_output["readiness"]["readiness_state"], "blocked")
        advanced_prediction = next(
            item for item in decision_output["advanced_readiness"]["capabilities"]
            if item["capability"] == "prediction"
        )
        self.assertEqual(advanced_prediction["state"], "blocked")
        self.assertEqual(advanced_prediction["reasons"][0]["code"], "target_or_semantics_missing")
        self.assertIn("objective.metric_id_or_metric_name", decision_output["readiness"]["missing_inputs"])
        self.assertEqual(decision_output["command_center"]["status"], "blocked")
        self.assertEqual(decision_output["command_center"]["rerun_state"]["status"], "blocked")
        run_analysis_check = next(
            check
            for check in decision_output["command_center"]["disabled_next_checks"]
            if check["check_id"] == "run_observational_analysis"
        )
        self.assertIn("objective.metric_id_or_metric_name", run_analysis_check["reason"])
        self.assertEqual(decision_output["evidence_board"]["status"], "not_analyzed")
        unknown_nodes = [
            node for node in decision_output["decision_map"]["nodes"]
            if node["node_type"] == "unknown"
        ]
        self.assertTrue(unknown_nodes)
        self.assertIn("objective.metric_id_or_metric_name", decision_output["summary"])

    def test_decision_turn_includes_dataset_trust_for_inline_dataset(self):
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
        trust = body["dataset_trust"]
        self.assertEqual(trust["source_label"], "Inline payload")
        self.assertEqual(trust["dataset"]["source"], "inline")
        self.assertEqual(trust["dataset"]["dataset_name"], "Q1 Sales")
        self.assertEqual(trust["row_count"], len(DATASET))
        self.assertEqual(trust["column_count"], len(DATASET[0]))
        self.assertTrue(trust["semantic_ready"])
        self.assertEqual(trust["transform_state"], "raw")
        self.assertEqual(trust["stale_state"], "not_applicable")
        self.assertIn("Dataset source was inferred", " ".join(trust["warnings"]))

    def test_decision_turn_error_includes_dataset_trust_when_dataset_missing(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we grow revenue next quarter without hurting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 400)
        body = response.get_json()
        trust = body["dataset_trust"]
        self.assertEqual(body["status"], "error")
        self.assertIsNone(trust["dataset"])
        self.assertEqual(trust["source_label"], "No dataset")
        self.assertEqual(trust["row_count"], 0)
        self.assertEqual(trust["column_count"], 0)
        self.assertTrue(trust["semantic_ready"])
        self.assertEqual(trust["transform_state"], "unknown")
        self.assertEqual(trust["stale_state"], "unknown")
        self.assertIn("No active dataset", " ".join(trust["warnings"]))

    def test_turn_route_builds_decision_readable_workspace_kickoff_for_clean_prompt(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        preview = body["draft_workspace_preview"]
        kickoff = preview["decision_kickoff"]
        understood = kickoff["understood"]

        self.assertEqual(body["mode"], "decide")
        self.assertEqual(preview["status"], "ready")
        self.assertEqual(preview["status_label"], "Structurally ready for analysis")
        self.assertEqual(understood["objective"]["metric"], "Revenue")
        self.assertEqual(understood["objective"]["time_horizon"], "Next quarter")
        self.assertEqual({item["label"] for item in understood["levers"]}, {"Marketing Spend"})
        self.assertEqual({item["label"] for item in understood["segments"]}, {"Channel"})
        self.assertEqual({item["label"] for item in preview["segment_dimensions"]}, {"Channel"})
        self.assertEqual({item["metric"] for item in understood["guardrails"]}, {"Gross Margin %"})
        self.assertEqual(kickoff["recommended_next_action"]["action_id"], "analyze_workspace")
        self.assertEqual(body["action_state"]["primary_action_id"], "analyze_workspace")
        self.assertIn("Ready means", kickoff["readiness_meaning"])
        self.assertIn("not a recommendation", kickoff["truthfulness_note"])
        self.assertIn("Recommended next action: Analyze workspace", body["assistant_message"])
        self.assertNotIn("Inputs Needed: 0", body["assistant_message"])

    def test_turn_route_preview_keeps_discount_marketing_region_prompt_readable(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": (
                    "How should we grow revenue next quarter using discount rate and "
                    "marketing spend changes by region without hurting gross margin?"
                ),
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        preview = body["draft_workspace_preview"]
        understood = preview["decision_kickoff"]["understood"]

        # This regression protects the readable preview from collapsing the
        # objective, controllable levers, segment, and guardrail into one blob.
        self.assertEqual(understood["objective"]["metric"], "Revenue")
        self.assertEqual(understood["objective"]["time_horizon"], "Next quarter")
        self.assertEqual(
            {item["label"] for item in understood["levers"]},
            {"Discount Rate", "Marketing Spend"},
        )
        self.assertEqual({item["label"] for item in understood["segments"]}, {"Region"})
        self.assertEqual({item["label"] for item in preview["segment_dimensions"]}, {"Region"})
        self.assertEqual({item["metric"] for item in understood["guardrails"]}, {"Gross Margin %"})
        self.assertEqual(preview["recommended_next_action"]["action_id"], "analyze_workspace")
        self.assertIn("observational workspace analysis", preview["readiness_meaning"])
        self.assertNotIn("recommendation", preview["status_label"].lower())

    def test_turn_route_preview_keeps_stockout_prompt_readable(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": (
                    "How should we reduce stockout risk next quarter using inventory on hand "
                    "by product category while protecting on time delivery?"
                ),
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        preview = body["draft_workspace_preview"]
        understood = preview["decision_kickoff"]["understood"]

        self.assertEqual(understood["objective"]["metric"], "Stockout Risk Score")
        self.assertEqual(understood["objective"]["direction"], "minimize")
        self.assertEqual(understood["objective"]["time_horizon"], "Next quarter")
        self.assertEqual({item["label"] for item in understood["levers"]}, {"Inventory On Hand"})
        self.assertEqual({item["label"] for item in understood["segments"]}, {"Product Category"})
        self.assertEqual({item["label"] for item in preview["segment_dimensions"]}, {"Product Category"})
        self.assertEqual({item["metric"] for item in understood["guardrails"]}, {"On Time Delivery %"})
        self.assertEqual(preview["recommended_next_action"]["action_id"], "analyze_workspace")
        self.assertIn("not a recommendation", preview["truthfulness_note"])

    def test_turn_route_surfaces_targeted_clarification_for_incomplete_decision_prompt(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we adjust discount rate by region next quarter?",
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        preview = body["draft_workspace_preview"]

        self.assertEqual(body["mode"], "decide")
        self.assertIn("objective.metric_id_or_metric_name", preview["missing_inputs"])
        self.assertTrue(preview["clarification_hints"][0].startswith("Which metric should define success"))
        self.assertIn("Next question:", body["assistant_message"])
        self.assertIn("Which metric should define success", body["assistant_message"])
        self.assertEqual(body["session_state"]["decision_state"]["objective_draft"]["metric"], None)

    def test_new_decision_prompt_rebuilds_stale_workspace_from_session_state(self):
        first_response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )
        first_state = first_response.get_json()["session_state"]

        second_response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we reduce stockout risk next quarter using inventory on hand by product category while protecting on time delivery?",
                "conversation_history": [],
                "session_state": first_state,
            },
        )

        self.assertEqual(second_response.status_code, 200)
        body = second_response.get_json()
        workspace = body["session_state"]["draft_workspace"]
        objective = workspace["decision_scope"]["objective"]
        levers = workspace["decision_scope"]["levers"]
        constraints = workspace["decision_scope"]["constraints"]
        segment_dimensions = workspace["decision_scope"]["segment_dimensions"]
        lever_labels = {lever["label"] for lever in levers}
        constraint_labels = {constraint["label"] for constraint in constraints}
        segment_labels = {segment["label"] for segment in segment_dimensions}

        self.assertEqual(objective["metric_ref"]["metric_id"], "metric_stockout_risk")
        self.assertEqual(objective["direction"], "minimize")
        self.assertIn("Inventory On Hand", lever_labels)
        self.assertIn("Product Category", segment_labels)
        self.assertIn("Protect On Time Delivery %", constraint_labels)
        self.assertEqual(body["session_state"]["decision_state"]["objective_draft"]["metric"], "Stockout Risk Score")
        self.assertIn("stockout risk", body["session_state"]["decision_prompt"].lower())

    def test_decision_prompt_does_not_add_return_rate_as_discount_rate_lever(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we grow revenue next quarter using discount rate by region without hurting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        workspace = body["session_state"]["draft_workspace"]
        levers = workspace["decision_scope"]["levers"]
        constraints = workspace["decision_scope"]["constraints"]
        segment_dimensions = workspace["decision_scope"]["segment_dimensions"]
        lever_labels = {lever["label"] for lever in levers}
        constraint_labels = {constraint["label"] for constraint in constraints}
        segment_labels = {segment["label"] for segment in segment_dimensions}
        hard_constraint_labels = {
            constraint["label"]
            for constraint in constraints
            if constraint.get("hardness") == "hard"
        }

        self.assertIn("Discount Rate", lever_labels)
        self.assertIn("Region", segment_labels)
        self.assertNotIn("Return Rate", lever_labels)
        self.assertEqual(body["session_state"]["decision_state"]["objective_draft"]["metric"], "Revenue")
        self.assertIn("Protect Gross Margin %", constraint_labels)
        self.assertIn("Protect Gross Margin %", hard_constraint_labels)

    def test_textual_show_blockers_executes_action_instead_of_previewing_workspace(self):
        turn_response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we adjust discount rate by region next quarter?",
                "conversation_history": [],
                "session_state": {},
            },
        )
        draft_state = turn_response.get_json()["session_state"]

        follow_up = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "Show blockers",
                "conversation_history": [],
                "session_state": draft_state,
            },
        )

        self.assertEqual(follow_up.status_code, 200)
        body = follow_up.get_json()
        self.assertEqual(body["mode"], "decide")
        self.assertEqual(body["artifacts"][0]["type"], "workspace_analysis_summary")
        self.assertEqual(body["artifacts"][0]["title"], "Current blockers")
        self.assertIn("objective.metric_id_or_metric_name", body["artifacts"][0]["content"]["missing_inputs"])

    def test_decision_prompt_with_blocker_word_frames_decision_first(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": (
                    "Help me make a business decision: should we raise prices next quarter "
                    "or keep prices stable? Build the decision frame first using the active "
                    "dataset. Include the objective, decision options, key levers, constraints, "
                    "assumptions, unknowns, blockers, and what evidence is available."
                ),
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["mode"], "decide")
        self.assertNotEqual(
            body["assistant_message"],
            "Frame a decision first, then I can show blockers, assumptions, or workspace analysis.",
        )
        self.assertIn("draft_workspace", body["session_state"])
        self.assertEqual([artifact["type"] for artifact in body["artifacts"]], ["workspace_preview", "decision_output"])
        self.assertEqual(body["decision_output"]["type"], "decision_output")

    def test_textual_analyze_workspace_executes_observational_analysis(self):
        turn_response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )
        draft_state = turn_response.get_json()["session_state"]

        follow_up = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "Analyze workspace",
                "conversation_history": [],
                "session_state": draft_state,
            },
        )

        self.assertEqual(follow_up.status_code, 200)
        body = follow_up.get_json()
        self.assertEqual(body["mode"], "decide")
        self.assertEqual(body["artifacts"][0]["type"], "workspace_analysis_summary")
        self.assertEqual(body["artifacts"][0]["title"], "Workspace analysis")
        self.assertIn("scoped_diagnostics", body["artifacts"][0]["content"])
        self.assertIn("not a simulation", body["artifacts"][0]["content"]["truthfulness_note"])

    def test_analytic_question_after_decision_prompt_routes_back_to_explore(self):
        turn_response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )
        draft_state = turn_response.get_json()["session_state"]

        follow_up = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "What is Revenue by Region?",
                "conversation_history": [],
                "session_state": draft_state,
            },
        )

        self.assertEqual(follow_up.status_code, 200)
        body = follow_up.get_json()
        self.assertEqual(body["mode"], "explore")
        self.assertEqual(body["mode_context"]["reason_code"], "grounded_analytics_request")
        self.assertEqual(body["artifacts"][0]["type"], "answer")
        self.assertEqual(body["artifacts"][0]["render_hint"], "answer")
        self.assertFalse(body["artifacts"][0]["inspectable"])
        self.assertEqual(body["artifacts"][0]["default_view"], "inline")
        self.assertEqual(body["artifacts"][0]["source"], "semantic_metric")
        self.assertIsNone(body["draft_workspace_preview"])
        self.assertEqual(body["action_state"]["available_action_ids"], [])
        self.assertEqual(body["session_state"]["analytics_state"]["metric_name"], "Revenue")

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
        self.assertEqual(body["mode_context"]["reason_code"], "grounded_analytics_request")
        self.assertEqual(body["session_state"]["analytics_state"]["metric_name"], "Revenue")

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
        self.assertEqual(body["mode_context"]["reason_code"], "visualization_request")
        self.assertEqual(body["artifacts"][0]["default_view"], "inspector")
        self.assertEqual(body["artifacts"][0]["content"]["chartSpec"]["sourceMode"], "semantic")

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
        self.assertEqual(body["mode_context"]["reason_code"], "continue_active_mode")

    def test_full_analytic_question_after_chart_does_not_inherit_chart_preference(self):
        first_response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "Show revenue by region as a chart",
                "conversation_history": [],
                "session_state": {},
            },
        )
        chart_state = first_response.get_json()["session_state"]

        follow_up = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "What is Revenue by Region?",
                "conversation_history": [],
                "session_state": chart_state,
            },
        )

        self.assertEqual(follow_up.status_code, 200)
        body = follow_up.get_json()
        self.assertEqual(body["mode"], "explore")
        self.assertEqual(body["artifacts"][0]["type"], "answer")
        self.assertEqual(body["session_state"]["analytics_state"]["output_preference"], "answer")

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
        self.assertEqual(body["mode"], "decide")
        self.assertEqual(body["artifacts"][0]["type"], "workspace_analysis_summary")
        self.assertEqual(body["mode_context"]["reason_code"], "explicit_action")
        self.assertIn("open_workspace", body["action_state"]["available_action_ids"])

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
        self.assertTrue(body["artifacts"][0]["inspectable"])
        self.assertEqual(body["artifacts"][0]["render_hint"], "workspace_analysis_summary")
        self.assertEqual(body["artifacts"][0]["default_view"], "inspector")
        self.assertEqual(body["artifacts"][0]["source"], "workspace_analysis")
        self.assertEqual(body["artifacts"][1]["type"], "decision_output")
        self.assertEqual(body["artifacts"][1]["render_hint"], "decision_output")
        self.assertEqual(body["artifacts"][1]["source"], "decision_output")
        self.assertEqual(body["decision_output"]["evidence_board"]["status"], "analyzed")
        self.assertTrue(body["decision_output"]["evidence_board"]["items"])
        evidence_item = body["decision_output"]["evidence_board"]["items"][0]
        for field in (
            "rank",
            "title",
            "summary",
            "covers",
            "strength",
            "data_sufficiency",
            "limitations",
            "source_diagnostic_id",
            "source_refs",
            "next_checks",
        ):
            self.assertIn(field, evidence_item)
        self.assertEqual(evidence_item["rank"], 1)
        self.assertIn(evidence_item["strength"], {"strong", "moderate", "weak", "insufficient"})
        self.assertIn(evidence_item["data_sufficiency"]["status"], {"sufficient", "limited", "insufficient"})
        self.assertIsNotNone(evidence_item["source_diagnostic_id"])
        self.assertIn("goal", evidence_item["covers"])
        self.assertIn("drivers", evidence_item["covers"])
        self.assertIn("limits", evidence_item["covers"])
        self.assertIn("breakdowns", evidence_item["covers"])
        self.assertIn("context_roles", evidence_item["covers"])
        self.assertEqual(evidence_item["source_refs"]["source"], "evidence_board")
        self.assertEqual(evidence_item["source_refs"]["source_diagnostic_id"], evidence_item["source_diagnostic_id"])
        for check in evidence_item["next_checks"]:
            self.assertIn("enabled", check)
            self.assertIn("source_refs", check)
            self.assertIn("truth_boundary", check)
            self.assertEqual(check["truth_boundary"], "observational_analysis_only")
            if not check["enabled"]:
                self.assertIn("disabled_reason", check)
        reliability_text = " ".join(evidence_item["limitations"]).lower()
        self.assertIn("observational", reliability_text)
        self.assertIn("not advice", reliability_text)
        display_text = f"{evidence_item['title']} {evidence_item['summary']}".lower()
        self.assertNotIn("final recommendation", display_text)
        self.assertNotIn("optimization", display_text)
        self.assertEqual(
            body["decision_output"]["evidence_board"]["items"][0]["observational_boundary"],
            "observational_analysis_only",
        )
        self.assertEqual(body["decision_output"]["dataset_trust"], body["dataset_trust"])
        export_by_id = {
            section["section_id"]: section
            for section in body["decision_output"]["export_sections"]
        }
        evidence_export = export_by_id["evidence_board"]
        self.assertTrue(evidence_export["cards"])
        self.assertIn("observational", " ".join(evidence_export["items"]).lower())

    def test_decision_output_normalizes_sparse_ranked_diagnostics_for_evidence_board(self):
        workspace = {
            "workspace_id": "workspace_sparse_evidence",
            "status": "analysis_ready",
            "title": "Sparse Evidence Workspace",
            "decision_scope": {
                "objective": {
                    "statement": "Grow revenue",
                    "metric_ref": {"metric_id": "metric_revenue_sum", "label": "Revenue"},
                },
                "levers": [],
                "segment_dimensions": [],
                "constraints": [],
            },
            "readiness": {
                "readiness_state": "analysis_ready",
                "truth_boundary": "observational_analysis_only",
                "missing_inputs": [],
                "unsupported_capabilities": [
                    "simulation",
                    "optimization",
                    "autonomous_decisioning",
                    "final_recommendation",
                ],
            },
        }
        dataset_trust = {
            "dataset": {
                "source": "inline",
                "dataset_id": None,
                "dataset_name": "Inline payload",
                "row_count": 4,
                "column_count": 2,
            },
            "source_label": "Inline payload",
            "row_count": 4,
            "column_count": 2,
            "semantic_ready": True,
            "transform_state": "raw",
            "stale_state": "unknown",
            "warnings": [],
        }
        workspace_analysis = {
            "summary": {"headline": "Sparse evidence has been ranked for review."},
            "ranked_diagnostics": [
                {
                    "diagnostic_id": "diagnostic_limited_discount",
                    "evidence_rank": "1",
                    "summary": "Discount rate evidence is present but limited.",
                    "evidence_strength": "unexpected",
                    "semantic_coverage": {
                        "objective": False,
                        "levers": [{"lever_id": "lever_discount", "label": "Discount Rate"}],
                        "guardrails": [],
                        "segments": [],
                        "temporal": False,
                    },
                    "data_sufficiency": {"status": "limited"},
                    "limitations": [],
                    "role_tags": ["lever"],
                },
                {
                    "source_diagnostic": {
                        "diagnostic_id": "diagnostic_missing_history",
                        "summary": "Revenue lacks enough history for a comparison.",
                        "status": "insufficient_history",
                    },
                    "evidence_strength": "insufficient",
                },
            ],
            "observational_boundary": "observational_analysis_only",
        }

        output = DecisionOutputService.compose(
            workspace=workspace,
            dataset_trust=dataset_trust,
            workspace_analysis=workspace_analysis,
        )

        evidence_board = output["evidence_board"]
        command_center = output["command_center"]
        self.assertEqual(evidence_board["status"], "analyzed")
        self.assertEqual(len(evidence_board["items"]), 2)
        self.assertEqual(command_center["status"], "limited")
        self.assertEqual(command_center["rerun_state"]["status"], "possibly_stale_analysis_available")
        self.assertIn(
            "review_evidence_board",
            [check["check_id"] for check in command_center["allowed_next_checks"]],
        )

        limited_item = evidence_board["items"][0]
        self.assertEqual(limited_item["rank"], 1)
        self.assertEqual(limited_item["strength"], "weak")
        self.assertEqual(limited_item["data_sufficiency"]["status"], "limited")
        self.assertEqual(limited_item["source_diagnostic_id"], "diagnostic_limited_discount")
        self.assertEqual(limited_item["covers"]["drivers"][0]["label"], "Discount Rate")
        limited_checks = {check["check_id"]: check for check in limited_item["next_checks"]}
        self.assertTrue(limited_checks["explain_evidence"]["enabled"])
        self.assertFalse(limited_checks["breakdown"]["enabled"])
        self.assertIn("metric target", limited_checks["breakdown"]["disabled_reason"])
        self.assertFalse(limited_checks["send_to_scenario_compare"]["enabled"])
        self.assertEqual(
            limited_checks["send_to_scenario_compare"]["source_refs"]["source_diagnostic_id"],
            "diagnostic_limited_discount",
        )

        insufficient_item = evidence_board["items"][1]
        self.assertEqual(insufficient_item["rank"], 2)
        self.assertEqual(insufficient_item["strength"], "insufficient")
        self.assertEqual(insufficient_item["data_sufficiency"]["status"], "insufficient")
        self.assertEqual(insufficient_item["source_diagnostic_id"], "diagnostic_missing_history")
        self.assertIn("Revenue lacks enough history", insufficient_item["summary"])
        insufficient_checks = {check["check_id"]: check for check in insufficient_item["next_checks"]}
        self.assertFalse(insufficient_checks["monitor"]["enabled"])
        self.assertIn("metric target", insufficient_checks["monitor"]["disabled_reason"])

        for item in evidence_board["items"]:
            reliability_text = " ".join(item["limitations"]).lower()
            self.assertIn("observational", reliability_text)
            self.assertIn("not advice", reliability_text)
            self.assertNotIn("optimized advice", f"{item['title']} {item['summary']}".lower())

    def test_ready_workspace_actions_expose_stable_contract_and_priority(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        actions = {action["action_id"]: action for action in body["suggested_actions"]}

        self.assertEqual(
            set(actions),
            {"draft_workspace", "show_assumptions", "show_blockers", "analyze_workspace", "open_workspace"},
        )
        for action_id, action in actions.items():
            # Frontend rendering depends on every action carrying the same minimum contract.
            self.assertEqual(action["action_id"], action_id)
            self.assertTrue(action["label"])
            self.assertTrue(action["intent"])
            self.assertIn(action["priority"], {"primary", "secondary", "informational"})
            self.assertIn("enabled", action)
            self.assertTrue(action["availability_reason"])
            self.assertIsInstance(action["payload_expectations"], dict)

        self.assertEqual(actions["analyze_workspace"]["priority"], "primary")
        self.assertTrue(actions["analyze_workspace"]["enabled"])
        self.assertEqual(actions["show_blockers"]["priority"], "secondary")
        self.assertFalse(actions["show_blockers"]["enabled"])
        self.assertEqual(body["action_state"]["primary_action_id"], "analyze_workspace")
        self.assertIn("show_blockers", body["action_state"]["disabled_action_ids"])
        self.assertIn("open_workspace", body["action_state"]["secondary_action_ids"])

    def test_incomplete_workspace_disables_analysis_and_prioritizes_blockers(self):
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we adjust discount rate by region next quarter?",
                "conversation_history": [],
                "session_state": {},
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        actions = {action["action_id"]: action for action in body["suggested_actions"]}

        self.assertEqual(body["action_state"]["primary_action_id"], "show_blockers")
        self.assertEqual(actions["show_blockers"]["priority"], "primary")
        self.assertTrue(actions["show_blockers"]["enabled"])
        self.assertEqual(actions["analyze_workspace"]["priority"], "secondary")
        self.assertFalse(actions["analyze_workspace"]["enabled"])
        self.assertIn("analyze_workspace", body["action_state"]["disabled_action_ids"])
        self.assertIn("objective.metric_id_or_metric_name", body["draft_workspace_preview"]["missing_inputs"])

    def test_unsupported_action_returns_truthful_error_state(self):
        action_response = self.client.post(
            "/api/decision/chat/actions",
            json={
                "action": "run_optimizer",
                "session_state": {},
            },
        )

        self.assertEqual(action_response.status_code, 400)
        body = action_response.get_json()
        self.assertEqual(body["status"], "error")
        self.assertEqual(body["error"]["code"], "INVALID_DECISION_CHAT_ACTION_REQUEST")
        self.assertIn("Unsupported decision chat action", body["error"]["message"])

    def test_decision_action_artifacts_use_consistent_response_shape(self):
        turn_response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )
        draft_state = turn_response.get_json()["session_state"]

        for action_id in [
            "draft_workspace",
            "show_assumptions",
            "show_blockers",
            "analyze_workspace",
            "open_workspace",
        ]:
            response = self.client.post(
                "/api/decision/chat/actions",
                json={
                    "action": action_id,
                    "dataset": DATASET,
                    "semantic_model": SEMANTIC_MODEL,
                    "session_state": draft_state,
                },
            )

            self.assertEqual(response.status_code, 200, action_id)
            body = response.get_json()
            artifact = body["artifacts"][0]

            self.assertEqual(body["executed_action"]["action_id"], action_id)
            self.assertTrue(body["executed_action"]["payload_expectations"])
            self.assertEqual(body["suggested_actions"], body["session_state"]["available_actions"])
            self.assertIn("artifact_id", artifact)
            self.assertIn("schema_version", artifact)
            if artifact["type"] == "workspace_preview":
                self.assertEqual(artifact["action_id"], action_id)
                self.assertEqual(artifact["response_kind"], action_id)
                self.assertTrue(artifact["workspace_id"])
            else:
                self.assertEqual(artifact["content"]["action_id"], action_id)
                self.assertEqual(artifact["content"]["response_kind"], action_id)
                self.assertTrue(artifact["content"]["workspace_id"])
                self.assertIn("truthfulness_note", artifact["content"])

    def test_correction_action_preserves_workspace_preview_artifact_contract(self):
        turn_response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?",
                "conversation_history": [],
                "session_state": {},
            },
        )
        draft_state = turn_response.get_json()["session_state"]

        action_response = self.client.post(
            "/api/decision/chat/actions",
            json={
                "action": "draft_workspace",
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "session_state": draft_state,
                "correction": {
                    "correction_type": "remove_mapping",
                    "target_path": "decision_scope.objective.metric_ref",
                    "reason": "The objective mapping needs human review.",
                },
            },
        )

        self.assertEqual(action_response.status_code, 200)
        body = action_response.get_json()
        artifact = body["artifacts"][0]

        # Corrections keep the existing workspace_preview first while the
        # additive decision_output carries the updated frame for AI Chat.
        self.assertEqual(body["action"], "draft_workspace")
        self.assertEqual(body["mode"], "decide")
        self.assertEqual(artifact["type"], "workspace_preview")
        self.assertEqual(artifact["render_hint"], "workspace_preview")
        self.assertTrue(artifact["inspectable"])
        self.assertEqual(artifact["default_view"], "inline_and_inspector")
        self.assertEqual(artifact["source"], "decision_workspace")
        self.assertEqual(artifact["correction_result"]["correction_type"], "remove_mapping")
        self.assertEqual(body["correction_result"]["correction_type"], "remove_mapping")
        self.assertEqual(body["trace"]["observational_boundary"], "observational_analysis_only")
        self.assertIn("objective.metric_id_or_metric_name", artifact["missing_inputs"])
        self.assertEqual(body["session_state"]["draft_workspace"]["readiness"]["readiness_state"], "blocked")
        self.assertEqual(body["artifacts"][1]["type"], "decision_output")
        self.assertEqual(body["decision_output"]["correction_state"]["status"], "updated")
        self.assertEqual(
            body["decision_output"]["correction_state"]["latest"]["correction_type"],
            "remove_mapping",
        )
        self.assertIn(
            "objective.metric_id_or_metric_name",
            body["decision_output"]["readiness"]["missing_inputs"],
        )


if __name__ == "__main__":
    unittest.main()
