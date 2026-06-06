import unittest

from backend.decision_engine import DecisionChatService
from backend.services.decision_workspace_service import DecisionWorkspaceService
from tests.test_decision_workspace_service import DATASET, SEMANTIC_MODEL, build_payload


class DecisionPhase3CorrectionTests(unittest.TestCase):
    def test_objective_metric_correction_restores_analysis_readiness(self):
        payload = build_payload()
        payload["objective"] = {**payload["objective"], "metric_id": "metric_missing"}
        workspace = DecisionWorkspaceService.create_workspace(payload)["decision_workspace"]

        result = DecisionWorkspaceService.correct_workspace(
            {
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "decision_workspace": workspace,
                "correction": {
                    "correction_type": "objective_metric",
                    "target_path": "decision_scope.objective.metric_ref",
                    "replacement": {"metric_id": "metric_revenue_sum"},
                    "reason": "Revenue is the intended success metric.",
                },
            }
        )

        corrected = result["decision_workspace"]
        self.assertEqual(result["correction_result"]["status"], "applied")
        self.assertEqual(corrected["decision_scope"]["objective"]["metric_ref"]["metric_id"], "metric_revenue_sum")
        self.assertEqual(result["decision_readiness"]["readiness_state"], "analysis_ready")
        self.assertIn("analyze_workspace", result["allowed_next_actions"])
        self.assertEqual(result["trace"]["observational_boundary"], "observational_analysis_only")

    def test_lever_binding_and_controllability_corrections_recompute_scope(self):
        workspace = DecisionWorkspaceService.create_workspace(build_payload())["decision_workspace"]

        replacement = DecisionWorkspaceService.correct_workspace(
            {
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "decision_workspace": workspace,
                "correction": {
                    "correction_type": "lever_binding",
                    "target_path": "decision_scope.levers[0].binding",
                    "replacement": {"metric_id": "metric_marketing_spend"},
                },
            }
        )["decision_workspace"]

        metric_ids = {item["metric_id"] for item in replacement["scoped_context"]["relevant_metrics"]}
        self.assertIn("metric_marketing_spend", metric_ids)
        self.assertNotEqual(replacement["decision_scope"]["levers"][0]["binding"]["metric_ref"]["metric_id"], "metric_discount_rate")

        single_lever_payload = build_payload()
        single_lever_payload["levers"] = [single_lever_payload["levers"][0]]
        single_lever_workspace = DecisionWorkspaceService.create_workspace(single_lever_payload)["decision_workspace"]
        blocked = DecisionWorkspaceService.correct_workspace(
            {
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "decision_workspace": single_lever_workspace,
                "correction": {
                    "correction_type": "lever_controllability",
                    "target_path": "decision_scope.levers[0].controllable",
                    "replacement": {"controllable": False},
                },
            }
        )

        self.assertEqual(blocked["decision_readiness"]["readiness_state"], "blocked")
        self.assertIn("at_least_one_controllable_lever", blocked["decision_readiness"]["missing_inputs"])
        self.assertIn("show_blockers", blocked["allowed_next_actions"])

    def test_guardrail_segment_and_time_horizon_corrections_are_deterministic(self):
        payload = build_payload()
        payload["constraints"] = []
        workspace = DecisionWorkspaceService.create_workspace(payload)["decision_workspace"]

        with_guardrail = DecisionWorkspaceService.correct_workspace(
            {
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "decision_workspace": workspace,
                "correction": {
                    "correction_type": "guardrail_binding",
                    "target_path": "decision_scope.constraints",
                    "replacement": {
                        "label": "Gross margin floor",
                        "metric_id": "metric_margin_pct",
                        "operator": "gte",
                        "value": 0.30,
                        "unit": "ratio",
                    },
                },
            }
        )["decision_workspace"]
        self.assertEqual(with_guardrail["decision_scope"]["constraints"][0]["binding"]["metric_ref"]["metric_id"], "metric_margin_pct")
        self.assertEqual(with_guardrail["decision_scope"]["constraints"][0]["condition"]["value"], 0.30)

        blocked = DecisionWorkspaceService.correct_workspace(
            {
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "decision_workspace": with_guardrail,
                "correction": {
                    "correction_type": "guardrail_condition",
                    "target_path": "decision_scope.constraints[0].condition",
                    "replacement": {"operator": "gte", "value": None, "unit": "ratio", "value_status": "unparsed"},
                },
            }
        )
        self.assertEqual(blocked["decision_readiness"]["readiness_state"], "blocked")
        self.assertTrue(any(item.endswith(".condition.value") for item in blocked["decision_readiness"]["missing_inputs"]))

        with_segment = DecisionWorkspaceService.correct_workspace(
            {
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "decision_workspace": with_guardrail,
                "correction": {
                    "correction_type": "segment_dimension",
                    "target_path": "decision_scope.segment_dimensions",
                    "replacement": {"dimension_id": "dimension_channel", "label": "Channel"},
                },
            }
        )["decision_workspace"]
        self.assertTrue(
            any(
                ((segment.get("binding") or {}).get("dimension_ref") or {}).get("dimension_id") == "dimension_channel"
                for segment in with_segment["decision_scope"]["segment_dimensions"]
            )
        )

        with_horizon = DecisionWorkspaceService.correct_workspace(
            {
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "decision_workspace": with_segment,
                "correction": {
                    "correction_type": "time_horizon",
                    "target_path": "decision_scope.objective.time_horizon",
                    "replacement": {"kind": "named_period", "label": "Q4 2026", "grain": "quarter"},
                },
            }
        )["decision_workspace"]
        self.assertEqual(with_horizon["decision_scope"]["objective"]["time_horizon"]["label"], "Q4 2026")

    def test_remove_mapping_blocks_analysis_and_chat_action_preserves_corrected_state(self):
        workspace = DecisionWorkspaceService.create_workspace(build_payload())["decision_workspace"]

        action_response = DecisionChatService.handle_action(
            {
                "action": "draft_workspace",
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "session_state": {"draft_workspace": workspace},
                "correction": {
                    "correction_type": "remove_mapping",
                    "target_path": "decision_scope.objective.metric_ref",
                    "reason": "The objective mapping is unsafe.",
                },
            }
        )

        corrected = action_response["decision_workspace"]
        self.assertEqual(action_response["action"], "draft_workspace")
        self.assertIsNone(corrected["decision_scope"]["objective"]["metric_ref"])
        self.assertEqual(corrected["readiness"]["readiness_state"], "blocked")
        self.assertIn("objective.metric_id_or_metric_name", corrected["readiness"]["missing_inputs"])
        self.assertEqual(action_response["session_state"]["draft_workspace"]["readiness"]["readiness_state"], "blocked")
        self.assertEqual(action_response["correction_result"]["correction_type"], "remove_mapping")

    def test_chat_correction_updates_decision_output_and_follow_up_analysis_state(self):
        workspace = DecisionWorkspaceService.create_workspace(build_payload())["decision_workspace"]

        correction_response = DecisionChatService.handle_action(
            {
                "action": "draft_workspace",
                "dataset": DATASET,
                "dataset_ref": {"source": "inline", "dataset_id": "sales_q1", "dataset_name": "Q1 Sales"},
                "semantic_model": SEMANTIC_MODEL,
                "session_state": {"draft_workspace": workspace},
                "correction": {
                    "correction_type": "objective_metric",
                    "target_path": "decision_scope.objective.metric_ref",
                    "replacement": {"metric_id": "metric_margin_pct"},
                    "reason": "Gross margin is the active success measure.",
                },
            }
        )

        corrected_workspace = correction_response["decision_workspace"]
        correction_output = correction_response["decision_output"]

        self.assertEqual([artifact["type"] for artifact in correction_response["artifacts"]], ["workspace_preview", "decision_output"])
        self.assertEqual(correction_response["artifacts"][0]["source"], "decision_workspace")
        self.assertEqual(correction_response["artifacts"][1]["source"], "decision_output")
        self.assertEqual(correction_output["frame"]["goal"]["metric_ref"]["metric_id"], "metric_margin_pct")
        self.assertEqual(correction_output["dataset_trust"], correction_response["dataset_trust"])
        self.assertEqual(correction_output["correction_state"]["status"], "updated")
        self.assertEqual(correction_output["correction_state"]["latest"]["correction_type"], "objective_metric")
        self.assertEqual(correction_output["readiness"]["readiness_state"], "analysis_ready")
        self.assertIn("analyze_workspace", correction_output["readiness"]["allowed_next_actions"])
        self.assertEqual(
            correction_response["session_state"]["draft_workspace"]["decision_scope"]["objective"]["metric_ref"]["metric_id"],
            "metric_margin_pct",
        )
        self.assertEqual(
            corrected_workspace["decision_scope"]["objective"]["metric_ref"]["metric_id"],
            "metric_margin_pct",
        )

        analysis_response = DecisionChatService.handle_action(
            {
                "action": "analyze_workspace",
                "dataset": DATASET,
                "dataset_ref": {"source": "inline", "dataset_id": "sales_q1", "dataset_name": "Q1 Sales"},
                "semantic_model": SEMANTIC_MODEL,
                "session_state": correction_response["session_state"],
            }
        )
        analysis_output = analysis_response["decision_output"]

        self.assertEqual(
            [artifact["type"] for artifact in analysis_response["artifacts"]],
            ["workspace_analysis_summary", "decision_output"],
        )
        self.assertEqual(analysis_output["frame"]["goal"]["metric_ref"]["metric_id"], "metric_margin_pct")
        self.assertEqual(analysis_output["evidence_board"]["status"], "analyzed")
        self.assertTrue(analysis_output["evidence_board"]["items"])
        self.assertEqual(analysis_output["correction_state"]["status"], "updated")
        self.assertEqual(analysis_output["correction_state"]["history_count"], 1)
        self.assertEqual(analysis_output["correction_state"]["latest"]["correction_type"], "objective_metric")
        self.assertEqual(analysis_output["source_refs"]["correction_status"], "applied")
        self.assertEqual(analysis_output["dataset_trust"], analysis_response["dataset_trust"])

    def test_normal_answer_and_chart_routing_stay_unchanged_after_correction_support(self):
        answer_response = DecisionChatService.handle_turn(
            {
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "What is total revenue?",
                "conversation_history": [],
                "session_state": {},
            }
        )
        chart_response = DecisionChatService.handle_turn(
            {
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "user_message": "Show revenue by region as a chart",
                "conversation_history": [],
                "session_state": {},
            }
        )

        self.assertEqual(answer_response["artifacts"][0]["type"], "answer")
        self.assertEqual(answer_response["artifacts"][0]["render_hint"], "answer")
        self.assertIsNone(answer_response["decision_output"])
        self.assertIsNone(answer_response["draft_workspace_preview"])
        self.assertEqual(chart_response["artifacts"][0]["type"], "chart")
        self.assertEqual(chart_response["artifacts"][0]["render_hint"], "chart")
        self.assertIsNone(chart_response["decision_output"])
        self.assertIsNone(chart_response["draft_workspace_preview"])

    def test_analyze_workspace_returns_ranked_observational_diagnostics(self):
        workspace = DecisionWorkspaceService.create_workspace(build_payload())["decision_workspace"]

        analysis_result = DecisionWorkspaceService.analyze_workspace(
            {
                "dataset": DATASET,
                "semantic_model": SEMANTIC_MODEL,
                "decision_workspace": workspace,
            }
        )

        analysis = analysis_result["workspace_analysis"]
        ranked = analysis["ranked_diagnostics"]

        self.assertEqual(analysis["observational_boundary"], "observational_analysis_only")
        self.assertGreaterEqual(len(ranked), 1)
        self.assertEqual([item["evidence_rank"] for item in ranked], list(range(1, len(ranked) + 1)))
        self.assertGreaterEqual(ranked[0]["relevance_score"], ranked[-1]["relevance_score"])
        self.assertIn(ranked[0]["evidence_strength"], {"strong", "moderate", "weak", "insufficient"})
        self.assertIn("semantic_coverage", ranked[0])
        self.assertTrue(
            any("not a recommended action order" in limitation for limitation in ranked[0]["limitations"])
        )


if __name__ == "__main__":
    unittest.main()
