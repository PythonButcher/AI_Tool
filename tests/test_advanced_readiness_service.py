import unittest

from backend.services.advanced_readiness_service import AdvancedReadinessService


class AdvancedReadinessServiceTests(unittest.TestCase):
    """Prove that readiness states follow evidence without enabling capabilities."""

    def _evaluate(
        self,
        *,
        row_count=100,
        semantic_ready=True,
        include_dataset=True,
        governance_status="ready",
        model_evaluation=None,
    ):
        dataset = (
            {
                "source": "active",
                "dataset_id": "sales_history",
                "dataset_name": "Sales history",
                "row_count": row_count,
                "column_count": 8,
            }
            if include_dataset
            else None
        )
        return AdvancedReadinessService.evaluate(
            frame={
                "goal": {
                    "statement": "Understand future revenue risk",
                    "metric_ref": {
                        "metric_id": "metric_revenue_sum",
                        "label": "Revenue",
                        "field": "Revenue",
                    },
                }
            },
            dataset_trust={
                "dataset": dataset,
                "source_label": "Active dataset" if include_dataset else "No dataset",
                "row_count": row_count if include_dataset else 0,
                "column_count": 8 if include_dataset else 0,
                "semantic_ready": semantic_ready,
                "transform_state": "cleaned" if include_dataset else "unknown",
                "stale_state": "current" if include_dataset else "not_applicable",
                "warnings": [],
            },
            decision_readiness={
                "truth_boundary": "observational_analysis_only",
                "capability_state": {
                    "optimization": {"status": "unsupported"},
                    "autonomous_decisioning": {"status": "unsupported"},
                },
            },
            evidence_board={
                "status": "analyzed",
                "observational_boundary": "observational_analysis_only",
                "items": [],
            },
            governance_readiness=(
                {"status": governance_status, "reasons": []}
                if governance_status is not None
                else None
            ),
            model_evaluation=model_evaluation,
        )

    @staticmethod
    def _capabilities(result):
        return {item["capability"]: item for item in result["capabilities"]}

    def test_prediction_is_limited_until_a_validated_model_run_is_evidenced(self):
        result = self._evaluate()
        capabilities = self._capabilities(result)

        self.assertEqual(result["overall_state"], "limited")
        self.assertEqual(capabilities["prediction"]["state"], "limited")
        self.assertEqual(
            capabilities["prediction"]["reasons"][0]["code"],
            "model_validation_not_available",
        )
        self.assertIn(
            "validated_model_run",
            [item["requirement_id"] for item in capabilities["prediction"]["missing_requirements"]],
        )
        self.assertIn(
            "train_and_validate_model",
            [item["action_id"] for item in capabilities["prediction"]["allowed_next_actions"]],
        )
        self.assertEqual(capabilities["optimization"]["state"], "blocked")
        self.assertEqual(capabilities["causal_analysis"]["state"], "blocked")
        self.assertEqual(capabilities["automated_decisioning"]["state"], "blocked")
        self.assertTrue(
            all(item["truth_boundary"] == "observational_analysis_only" for item in result["capabilities"])
        )

    def test_prediction_is_blocked_when_training_rows_are_below_runtime_minimum(self):
        result = self._evaluate(row_count=4)
        prediction = self._capabilities(result)["prediction"]

        self.assertEqual(prediction["state"], "blocked")
        self.assertEqual(prediction["reasons"][0]["code"], "insufficient_training_rows")
        self.assertIn("at least 10", prediction["missing_requirements"][0]["description"])
        row_evidence = next(item for item in prediction["evidence"] if item["code"] == "dataset_rows")
        self.assertEqual(row_evidence["value"], 4)
        self.assertEqual(row_evidence["source_path"], "decision_output.dataset_trust.row_count")

    def test_prediction_is_not_evaluated_without_a_dataset(self):
        result = self._evaluate(include_dataset=False)
        prediction = self._capabilities(result)["prediction"]

        self.assertEqual(prediction["state"], "not_evaluated")
        self.assertEqual(prediction["reasons"][0]["code"], "dataset_not_available")
        self.assertIn(
            "attach_dataset",
            [item["action_id"] for item in prediction["allowed_next_actions"]],
        )

    def test_prediction_is_supported_only_with_target_matched_validated_model_evidence(self):
        result = self._evaluate(
            model_evaluation={
                "status": "validated",
                "run_id": "automl_run_123",
                "problem_type": "regression",
                "target_column": "Revenue",
                "metrics": {"r2": 0.61, "mae": 8.2},
            }
        )
        prediction = self._capabilities(result)["prediction"]

        self.assertEqual(prediction["state"], "supported")
        self.assertEqual(prediction["missing_requirements"], [])
        self.assertIn(
            "validated_model_run",
            [item["code"] for item in prediction["evidence"]],
        )
        # Other advanced capabilities remain blocked; a predictive model does
        # not imply optimization, causality, or autonomous decision authority.
        self.assertEqual(result["overall_state"], "limited")

    def test_prediction_cannot_be_supported_without_verified_governance_evidence(self):
        result = self._evaluate(
            governance_status=None,
            model_evaluation={
                "status": "validated",
                "run_id": "automl_run_123",
                "problem_type": "regression",
                "target_column": "Revenue",
                "metrics": {"r2": 0.61},
            },
        )
        prediction = self._capabilities(result)["prediction"]

        self.assertEqual(prediction["state"], "limited")
        self.assertIn(
            "governance_evaluation",
            [item["requirement_id"] for item in prediction["missing_requirements"]],
        )


if __name__ == "__main__":
    unittest.main()
