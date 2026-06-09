import unittest

from flask import Flask

from backend.routes.decision import decision_bp
from backend.services.decision_graph_service import DecisionGraphService


DATASET = [
    {
        "Order Date": "2026-01-31",
        "Region": "East",
        "Channel": "Online",
        "Revenue": 100.0,
        "Gross Margin %": 0.35,
        "Marketing Spend": 24.0,
    },
    {
        "Order Date": "2026-02-28",
        "Region": "East",
        "Channel": "Retail",
        "Revenue": 120.0,
        "Gross Margin %": 0.34,
        "Marketing Spend": 28.0,
    },
    {
        "Order Date": "2026-03-31",
        "Region": "West",
        "Channel": "Online",
        "Revenue": 135.0,
        "Gross Margin %": 0.33,
        "Marketing Spend": 35.0,
    },
    {
        "Order Date": "2026-04-30",
        "Region": "West",
        "Channel": "Retail",
        "Revenue": 150.0,
        "Gross Margin %": 0.32,
        "Marketing Spend": 41.0,
    },
]

SMALL_DATASET = [
    {"Region": "East", "Revenue": 100.0, "Marketing Spend": 24.0},
    {"Region": "West", "Revenue": None, "Marketing Spend": 41.0},
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
            "decision_semantics": {"objective_candidate": True},
        },
        {
            "id": "metric_marketing_spend",
            "name": "Marketing Spend",
            "label": "Marketing Spend",
            "field": "Marketing Spend",
            "default_aggregation": "sum",
            "format_hint": "currency",
            "expression": {"type": "column_aggregation", "column": "Marketing Spend", "aggregation": "sum"},
            "decision_semantics": {"lever_candidate": True},
        },
        {
            "id": "metric_margin_pct",
            "name": "Gross Margin %",
            "label": "Gross Margin %",
            "field": "Gross Margin %",
            "default_aggregation": "mean",
            "format_hint": "percentage",
            "expression": {"type": "column_aggregation", "column": "Gross Margin %", "aggregation": "mean"},
            "decision_semantics": {"guardrail_candidate": True},
        },
    ],
}


def build_payload():
    return {
        "dataset": DATASET,
        "dataset_ref": {"source": "inline", "dataset_id": "sales_q1", "dataset_name": "Q1 Sales"},
        "semantic_model": SEMANTIC_MODEL,
    }


def build_graph_payload():
    payload = build_payload()
    payload.update(
        {
            "graph_mode": "mixed",
            "selected_variables": {
                "metric_ids": ["metric_revenue_sum", "metric_marketing_spend"],
                "dimension_ids": ["dimension_region", "dimension_order_date"],
            },
            "frame": {
                "goal": {"metric_ref": {"metric_id": "metric_revenue_sum", "label": "Revenue"}},
                "drivers": [
                    {
                        "label": "Marketing Spend",
                        "binding": {"metric_ref": {"metric_id": "metric_marketing_spend", "label": "Marketing Spend"}},
                    }
                ],
                "limits": [],
                "breakdowns": [
                    {
                        "label": "Region",
                        "binding": {"dimension_ref": {"dimension_id": "dimension_region", "label": "Region"}},
                    }
                ],
            },
            "evidence_board": {
                "status": "analyzed",
                "items": [
                    {
                        "rank": 1,
                        "title": "Revenue movement evidence",
                        "summary": "Revenue changed across the observed periods.",
                        "strength": "moderate",
                        "source_diagnostic_id": "diagnostic_revenue_change",
                        "covers": {
                            "goal": True,
                            "drivers": [{"label": "Marketing Spend"}],
                            "limits": [],
                            "breakdowns": [{"dimension_ref": {"dimension_id": "dimension_region"}, "label": "Region"}],
                            "temporal": True,
                        },
                        "data_sufficiency": {
                            "status": "sufficient",
                            "row_count": 4,
                            "summary": "Enough observed data is available.",
                        },
                        "limitations": ["Evidence is for review only."],
                    }
                ],
            },
            "selected_evidence_ids": ["diagnostic_revenue_change"],
        }
    )
    return payload


class DecisionGraphServiceTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.register_blueprint(decision_bp)
        self.client = app.test_client()

    def test_candidate_discovery_returns_metric_and_dimension_variables(self):
        result = DecisionGraphService.discover_candidates(build_payload())

        self.assertEqual(result["contract_version"], "di_phase7_3_decision_graph_v1")
        self.assertEqual(result["type"], "decision_graph_candidates")
        self.assertEqual(result["data_sufficiency"]["status"], "sufficient")
        candidates = {item["variable_id"]: item for item in result["variable_candidates"]}

        self.assertIn("metric_revenue_sum", candidates)
        self.assertIn("dimension_region", candidates)
        self.assertEqual(candidates["metric_revenue_sum"]["variable_type"], "metric")
        self.assertEqual(candidates["metric_revenue_sum"]["semantic_role"], "objective_candidate")
        self.assertTrue(candidates["metric_revenue_sum"]["eligible"])
        self.assertEqual(candidates["dimension_region"]["variable_type"], "dimension")
        self.assertEqual(candidates["dimension_order_date"]["data_type"], "temporal")

    def test_selected_variable_graph_generation_returns_nodes_and_reliability_labels(self):
        result = DecisionGraphService.build_graph(build_graph_payload())

        self.assertEqual(result["type"], "decision_graph")
        self.assertEqual(result["graph_mode"], "mixed")
        self.assertEqual(result["truth_boundary"], "observational_analysis_only")
        self.assertGreaterEqual(len(result["nodes"]), 5)
        self.assertTrue(result["edges"])

        for edge in result["edges"]:
            self.assertIn(edge["relationship_type"], {"evidence_coverage", "observed_association"})
            self.assertIn(edge["evidence_basis"], {"ranked_diagnostic_coverage", "dataset_observed_association"})
            self.assertEqual(edge["causal_status"], "not_causal_claim")
            self.assertIn(edge["reliability_label"], {"observed_supported", "observed_limited", "observed_insufficient"})
            self.assertIn("data_sufficiency", edge)
            self.assertIn("followup_actions", edge)

    def test_user_hypothesis_edges_are_directional_and_explicitly_not_validated(self):
        payload = build_graph_payload()
        payload["graph_mode"] = "observed_association"
        payload["user_hypotheses"] = [
            {
                "source_variable_id": "metric_marketing_spend",
                "target_variable_id": "metric_revenue_sum",
                "rationale": "Marketing spend may precede revenue movement.",
            }
        ]

        result = DecisionGraphService.build_graph(payload)
        hypothesis_edges = [edge for edge in result["edges"] if edge["relationship_type"] == "user_hypothesis"]

        self.assertEqual(len(hypothesis_edges), 1)
        edge = hypothesis_edges[0]
        self.assertEqual(edge["source_node_id"], "node_metric_metric_marketing_spend")
        self.assertEqual(edge["target_node_id"], "node_metric_metric_revenue_sum")
        self.assertEqual(edge["evidence_basis"], "user_stated_hypothesis")
        self.assertEqual(edge["causal_status"], "user_hypothesis_not_validated")
        self.assertEqual(edge["reliability_label"], "user_hypothesis_unvalidated")
        self.assertEqual(edge["metrics"]["validation_status"], "not_validated")
        self.assertTrue(
            any(action["action_id"] == "send_to_scenario_compare" and not action["enabled"] for action in edge["followup_actions"])
        )
        self.assertIn("user_hypothesis", result["reliability_labels"])
        self.assertEqual(result["graph_state"]["state_kind"], "decision_graph_build_state")
        self.assertEqual(
            result["graph_state"]["user_hypotheses"][0]["causal_status"],
            "user_hypothesis_not_validated",
        )
        self.assertIn("metric_marketing_spend", result["graph_state"]["selected_variables"]["metric_ids"])
        self.assertIn("dimension_region", result["graph_state"]["selected_variables"]["dimension_ids"])

    def test_invalid_user_hypothesis_edges_are_reported_without_fabricating_edges(self):
        payload = build_graph_payload()
        payload["graph_mode"] = "evidence_coverage"
        payload["user_hypotheses"] = [
            {
                "source_variable_id": "metric_marketing_spend",
                "target_variable_id": "metric_missing",
            }
        ]

        result = DecisionGraphService.build_graph(payload)
        hypothesis_edges = [edge for edge in result["edges"] if edge["relationship_type"] == "user_hypothesis"]

        self.assertEqual(hypothesis_edges, [])
        self.assertTrue(any("metric_marketing_spend -> metric_missing" in item for item in result["limitations"]))

    def test_evidence_coverage_edges_connect_evidence_to_selected_variables(self):
        payload = build_graph_payload()
        payload["graph_mode"] = "evidence_coverage"

        result = DecisionGraphService.build_graph(payload)
        coverage_edges = [edge for edge in result["edges"] if edge["relationship_type"] == "evidence_coverage"]
        covered_targets = {edge["target_node_id"] for edge in coverage_edges}

        self.assertGreaterEqual(len(coverage_edges), 3)
        self.assertIn("node_metric_metric_revenue_sum", covered_targets)
        self.assertIn("node_metric_metric_marketing_spend", covered_targets)
        self.assertIn("node_dimension_dimension_region", covered_targets)
        self.assertTrue(all(edge["evidence_basis"] == "ranked_diagnostic_coverage" for edge in coverage_edges))

    def test_observed_association_edges_include_descriptive_metrics(self):
        payload = build_graph_payload()
        payload["graph_mode"] = "observed_association"

        result = DecisionGraphService.build_graph(payload)
        association_edges = [edge for edge in result["edges"] if edge["relationship_type"] == "observed_association"]
        methods = {edge["metrics"]["method"] for edge in association_edges}
        metric_edge = next(edge for edge in association_edges if edge["metrics"]["method"] == "pearson_correlation")

        self.assertIn("pearson_correlation", methods)
        self.assertIn("group_mean_difference", methods)
        self.assertIn("observed_time_trend", methods)
        self.assertEqual(metric_edge["data_sufficiency"]["status"], "sufficient")
        self.assertEqual(metric_edge["metrics"]["sample_size"], 4)
        self.assertIsNotNone(metric_edge["metrics"]["correlation"])
        self.assertIn(metric_edge["metrics"]["direction"], {"positive", "negative", "no_clear_direction"})
        self.assertTrue(any(action["action_id"] == "monitor" and action["enabled"] for action in metric_edge["followup_actions"]))

    def test_insufficient_data_behavior_keeps_edge_but_labels_it(self):
        payload = {
            "dataset": SMALL_DATASET,
            "semantic_model": {
                "version": 2,
                "dataset": {"id": "small", "name": "Small"},
                "dimensions": [
                    {"id": "dimension_region", "name": "Region", "label": "Region", "field": "Region"},
                ],
                "metrics": [
                    {
                        "id": "metric_revenue_sum",
                        "name": "Revenue",
                        "label": "Revenue",
                        "field": "Revenue",
                        "expression": {"type": "column_aggregation", "column": "Revenue", "aggregation": "sum"},
                    },
                    {
                        "id": "metric_marketing_spend",
                        "name": "Marketing Spend",
                        "label": "Marketing Spend",
                        "field": "Marketing Spend",
                        "expression": {
                            "type": "column_aggregation",
                            "column": "Marketing Spend",
                            "aggregation": "sum",
                        },
                    },
                ],
            },
            "graph_mode": "observed_association",
            "selected_variables": {
                "metric_ids": ["metric_revenue_sum", "metric_marketing_spend"],
                "dimension_ids": ["dimension_region"],
            },
        }

        result = DecisionGraphService.build_graph(payload)
        self.assertEqual(result["data_sufficiency"]["status"], "insufficient")
        self.assertTrue(result["edges"])
        self.assertTrue(
            any(edge["data_sufficiency"]["status"] == "insufficient" for edge in result["edges"])
        )
        self.assertTrue(
            any(edge["reliability_label"] == "observed_insufficient" for edge in result["edges"])
        )

    def test_graph_display_text_avoids_unsupported_action_wording(self):
        result = DecisionGraphService.build_graph(build_graph_payload())
        display_parts = []
        for edge in result["edges"]:
            display_parts.extend([edge.get("label", ""), edge.get("summary", "")])
            display_parts.extend(edge.get("limitations") or [])
        display_text = " ".join(display_parts).lower()

        for forbidden in ("recommendation", "simulation", "prediction", "optimization"):
            self.assertNotIn(forbidden, display_text)

    def test_graph_action_explain_evidence_returns_safe_non_executing_response(self):
        graph = DecisionGraphService.build_graph(build_graph_payload())
        edge = next(edge for edge in graph["edges"] if edge["relationship_type"] == "observed_association")

        result = DecisionGraphService.plan_graph_action({
            "action_id": "explain_evidence",
            "decision_graph": graph,
            "edge_id": edge["edge_id"],
        })

        self.assertEqual(result["type"], "decision_graph_action_response")
        self.assertEqual(result["action_id"], "explain_evidence")
        self.assertEqual(result["action_status"], "ready")
        self.assertFalse(result["response_semantics"]["executes_analysis"])
        self.assertFalse(result["response_semantics"]["causal_claim"])
        self.assertEqual(result["target"]["edge_id"], edge["edge_id"])

    def test_graph_action_breakdown_prepares_metric_dimension_followup_payload(self):
        graph = DecisionGraphService.build_graph(build_graph_payload())
        edge = next(edge for edge in graph["edges"] if edge["metrics"].get("method") == "group_mean_difference")

        result = DecisionGraphService.plan_graph_action({
            "action_id": "breakdown",
            "decision_graph": graph,
            "target_edge": edge,
        })

        self.assertEqual(result["action_status"], "ready")
        self.assertEqual(result["request_payload"]["action"], "analyze_workspace")
        self.assertIn("metric_revenue_sum", result["request_payload"]["analysis_preferences"]["metric_ids"])
        self.assertIn("Region", result["request_payload"]["analysis_preferences"]["group_by"])
        self.assertFalse(result["response_semantics"]["causal_claim"])

    def test_graph_action_monitor_prepares_spec_without_creating_automation(self):
        graph = DecisionGraphService.build_graph(build_graph_payload())
        metric_node = next(node for node in graph["nodes"] if node.get("variable_id") == "metric_revenue_sum")

        result = DecisionGraphService.plan_graph_action({
            "action_id": "monitor",
            "decision_graph": graph,
            "target_node": metric_node,
        })

        self.assertEqual(result["action_status"], "ready")
        self.assertEqual(result["request_payload"]["action_type"], "monitor_relationship")
        self.assertEqual(result["request_payload"]["metric_ids"], ["metric_revenue_sum"])
        self.assertIsNone(result["request_payload"]["schedule"])
        self.assertFalse(result["response_semantics"]["executes_analysis"])
        self.assertFalse(result["response_semantics"]["causal_claim"])

    def test_graph_action_blocks_scenario_compare_for_unvalidated_user_hypothesis(self):
        payload = build_graph_payload()
        payload["user_hypotheses"] = [
            {
                "source_variable_id": "metric_marketing_spend",
                "target_variable_id": "metric_revenue_sum",
            }
        ]
        graph = DecisionGraphService.build_graph(payload)
        edge = next(edge for edge in graph["edges"] if edge["relationship_type"] == "user_hypothesis")

        result = DecisionGraphService.plan_graph_action({
            "action_id": "send_to_scenario_compare",
            "decision_graph": graph,
            "target_edge": edge,
        })

        self.assertEqual(result["action_status"], "needs_observed_metric_edge")
        self.assertEqual(result["response_semantics"]["scenario_semantics"], "direct_adjustment_only")
        self.assertFalse(result["response_semantics"]["causal_claim"])

    def test_routes_return_candidate_and_graph_contracts(self):
        candidates_response = self.client.post("/api/decision/graph/candidates", json=build_payload())
        graph_response = self.client.post("/api/decision/graph/build", json=build_graph_payload())

        self.assertEqual(candidates_response.status_code, 200)
        self.assertEqual(graph_response.status_code, 200)
        self.assertEqual(candidates_response.get_json()["type"], "decision_graph_candidates")
        self.assertEqual(graph_response.get_json()["type"], "decision_graph")

    def test_route_returns_graph_action_contract(self):
        graph = DecisionGraphService.build_graph(build_graph_payload())
        edge = graph["edges"][0]
        response = self.client.post(
            "/api/decision/graph/actions",
            json={
                "action_id": "explain_missing_data",
                "decision_graph": graph,
                "target_edge": edge,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["type"], "decision_graph_action_response")
        self.assertEqual(response.get_json()["action_id"], "explain_missing_data")


if __name__ == "__main__":
    unittest.main()
