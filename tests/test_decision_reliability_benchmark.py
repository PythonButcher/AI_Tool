import json
import unittest

from backend.decision_engine import DecisionChatService
from tests.decision_reliability_benchmark_cases import (
    BENCHMARK_CASES,
    DATASET,
    FORBIDDEN_CLAIM_SNIPPETS,
    SEMANTIC_MODEL,
)


class DecisionReliabilityBenchmarkTests(unittest.TestCase):
    def test_prompt_suite_has_minimum_phase_1_coverage(self):
        self.assertGreaterEqual(len(BENCHMARK_CASES), 20)
        self.assertTrue(any(case["case_id"].startswith("unsupported_") for case in BENCHMARK_CASES))
        self.assertTrue(any(case["expected_mode"] == "explore" for case in BENCHMARK_CASES))
        self.assertTrue(any(case.get("missing_inputs") for case in BENCHMARK_CASES))

    def test_benchmark_prompts_grade_extraction_readiness_actions_and_truthfulness(self):
        failures = []
        for case in BENCHMARK_CASES:
            with self.subTest(case_id=case["case_id"]):
                response = DecisionChatService.handle_turn(
                    {
                        "dataset": DATASET,
                        "semantic_model": SEMANTIC_MODEL,
                        "user_message": case["prompt"],
                        "conversation_history": [],
                        "session_state": {},
                    }
                )
                failures.extend(self._grade_case(case, response))

        if failures:
            self.fail("\n".join(failures))

    def _grade_case(self, case, response):
        errors = []
        case_id = case["case_id"]
        self._expect(errors, response["status"] == "success", case_id, "response status was not success")
        self._expect(errors, response["mode"] == case["expected_mode"], case_id, f"mode was {response['mode']}")
        self._grade_global_truth_boundary(case, response, errors)

        if case["expected_mode"] == "explore":
            self._grade_explore_case(case, response, errors)
            return errors

        self._grade_decision_case(case, response, errors)
        return errors

    def _grade_global_truth_boundary(self, case, response, errors):
        case_id = case["case_id"]
        serialized = json.dumps(response, default=str, sort_keys=True).lower()
        for forbidden in FORBIDDEN_CLAIM_SNIPPETS:
            self._expect(
                errors,
                forbidden not in serialized,
                case_id,
                f"forbidden claim snippet appeared: {forbidden}",
            )

        capability_state = response.get("capability_state") or {}
        self._expect(errors, capability_state.get("truth_boundary") == "observational_analysis_only", case_id, "truth boundary missing")
        expected_unsupported = set(case.get("unsupported_requested_capabilities") or set())
        observed_unsupported = set(capability_state.get("unsupported_requested_capabilities") or [])
        self._expect(
            errors,
            expected_unsupported.issubset(observed_unsupported),
            case_id,
            f"unsupported requests {observed_unsupported} did not include {expected_unsupported}",
        )

    def _grade_explore_case(self, case, response, errors):
        case_id = case["case_id"]
        artifact = (response.get("artifacts") or [{}])[0]
        self._expect(errors, artifact.get("type") == case.get("artifact_type"), case_id, f"artifact was {artifact.get('type')}")
        self._expect(errors, response.get("draft_workspace_preview") is None, case_id, "explore case created a workspace preview")
        self._expect(errors, response["action_state"]["available_action_ids"] == [], case_id, "explore case exposed decision actions")
        self._expect(errors, response["decision_readiness"]["readiness_state"] == "not_applicable", case_id, "explore readiness should be not_applicable")

    def _grade_decision_case(self, case, response, errors):
        case_id = case["case_id"]
        preview = response.get("draft_workspace_preview") or {}
        readiness = response.get("decision_readiness") or {}
        action_state = response.get("action_state") or {}
        understood = (preview.get("decision_kickoff") or {}).get("understood") or {}

        self._expect(errors, preview.get("status") == case.get("expected_status"), case_id, f"status was {preview.get('status')}")
        self._expect(
            errors,
            readiness.get("readiness_state") == case.get("expected_readiness_state"),
            case_id,
            f"readiness was {readiness.get('readiness_state')}",
        )
        self._expect(errors, preview.get("truth_boundary") == "observational_analysis_only", case_id, "preview truth boundary missing")
        self._expect(errors, preview.get("not_ready_for_recommendation") is True, case_id, "recommendation readiness was not false")
        self._expect(errors, (preview.get("capability_state") or {}).get("simulation", {}).get("status") == "unsupported", case_id, "simulation capability was not unsupported")
        self._expect(errors, (preview.get("capability_state") or {}).get("optimization", {}).get("status") == "unsupported", case_id, "optimization capability was not unsupported")
        self._expect(errors, (preview.get("capability_state") or {}).get("final_recommendation", {}).get("status") == "unsupported", case_id, "final recommendation capability was not unsupported")

        objective = understood.get("objective") or {}
        self._expect(errors, objective.get("metric") == case.get("objective_metric"), case_id, f"objective metric was {objective.get('metric')}")
        self._expect(errors, objective.get("time_horizon") == case.get("time_horizon"), case_id, f"horizon was {objective.get('time_horizon')}")
        self._expect_set_contains(errors, {item.get("label") for item in understood.get("levers") or []}, case.get("levers") or set(), case_id, "levers")
        self._expect_set_contains(errors, {item.get("label") for item in understood.get("segments") or []}, case.get("segments") or set(), case_id, "segments")
        self._expect_set_contains(errors, {item.get("metric") for item in understood.get("guardrails") or []}, case.get("guardrails") or set(), case_id, "guardrails")
        self._expect_set_contains(errors, set(action_state.get("available_action_ids") or []), case.get("allowed_actions") or set(), case_id, "allowed actions")
        self._expect_set_contains(errors, set(action_state.get("disabled_action_ids") or []), case.get("disabled_actions") or set(), case_id, "disabled actions")
        self._expect_set_contains(errors, set(preview.get("missing_inputs") or []), case.get("missing_inputs") or set(), case_id, "missing inputs")

    def _expect_set_contains(self, errors, observed, expected, case_id, label):
        self._expect(errors, expected.issubset(observed), case_id, f"{label} {observed} did not include {expected}")

    def _expect(self, errors, condition, case_id, message):
        if not condition:
            errors.append(f"{case_id}: {message}")


if __name__ == "__main__":
    unittest.main()
