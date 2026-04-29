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
        self.assertEqual(body["mode_context"]["current_mode"], "explore")
        self.assertEqual(body["mode_context"]["reason_code"], "visualization_request")
        self.assertTrue(body["artifacts"][0]["artifact_id"])
        self.assertEqual(body["artifacts"][0]["render_hint"], "chart")
        self.assertTrue(body["artifacts"][0]["inspectable"])
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
        self.assertEqual(body["draft_workspace_preview"]["type"], "workspace_preview")
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
        self.assertEqual({item["label"] for item in understood["levers"]}, {"Marketing Spend", "Channel mix"})
        self.assertEqual({item["label"] for item in understood["segments"]}, {"Channel"})
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
            {"Discount Rate", "Marketing Spend", "Region mix"},
        )
        self.assertEqual({item["label"] for item in understood["segments"]}, {"Region"})
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
        self.assertEqual({item["label"] for item in understood["levers"]}, {"Inventory On Hand", "Product Category mix"})
        self.assertEqual({item["label"] for item in understood["segments"]}, {"Product Category"})
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
        lever_labels = {lever["label"] for lever in levers}
        constraint_labels = {constraint["label"] for constraint in constraints}

        self.assertEqual(objective["metric_ref"]["metric_id"], "metric_stockout_risk")
        self.assertEqual(objective["direction"], "minimize")
        self.assertIn("Inventory On Hand", lever_labels)
        self.assertIn("Product Category mix", lever_labels)
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
        lever_labels = {lever["label"] for lever in levers}
        constraint_labels = {constraint["label"] for constraint in constraints}
        hard_constraint_labels = {
            constraint["label"]
            for constraint in constraints
            if constraint.get("hardness") == "hard"
        }

        self.assertIn("Discount Rate", lever_labels)
        self.assertIn("Region mix", lever_labels)
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


if __name__ == "__main__":
    unittest.main()
