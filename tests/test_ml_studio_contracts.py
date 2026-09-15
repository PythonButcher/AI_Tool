"""Focused contract tests for the ML Studio v1 boundary."""

from __future__ import annotations

import math
import unittest
from dataclasses import replace
from datetime import UTC, datetime

from backend.ml_studio.contracts import (
    CandidateSelectionEvidence,
    ColumnProfile,
    DatasetSnapshotIdentity,
    EvaluationResult,
    ExperimentSpecification,
    FeatureInfluence,
    FeatureRoles,
    FinalHoldoutEvidence,
    FoldEvidence,
    LeakageFinding,
    MetricPolicy,
    RandomSeedPolicy,
    ResourceLimits,
    ReviewedCandidateReference,
    RunSpecification,
    SelectionEvidence,
    SourceFingerprint,
    SplitPolicy,
    SplitEvidence,
    StructuredError,
    TruthBoundary,
)


SHA = "a" * 64
NOW = datetime(2026, 9, 14, tzinfo=UTC)


def snapshot() -> DatasetSnapshotIdentity:
    return DatasetSnapshotIdentity(
        snapshot_id="snapshot-1",
        workspace_id="workspace-1",
        workspace_version=3,
        source_ids=("source-1",),
        relationship_ids=(),
        source_fingerprints=(
            SourceFingerprint(source_id="source-1", content_fingerprint=f"sha256:{SHA}", schema_version=2),
        ),
        schema_version=2,
        semantic_model_version="semantic-v2",
        governance_result={"status": "ready", "reasons": []},
        transformation_recipe_hash=f"sha256:{SHA}",
        row_count=100,
        column_profile=(
            ColumnProfile(name="feature", logical_type="numeric", null_count=0, distinct_count=100),
            ColumnProfile(name="target", logical_type="numeric", null_count=0, distinct_count=92),
        ),
        created_at=NOW,
    )


def seeds() -> RandomSeedPolicy:
    return RandomSeedPolicy(final_holdout_seed=11, cross_validation_seed=12, estimator_seed=13)


def experiment(**overrides: object) -> ExperimentSpecification:
    values: dict[str, object] = {
        "experiment_id": "experiment-1",
        "specification_version": 1,
        "task_type": "regression",
        "target": "target",
        "feature_roles": FeatureRoles(numeric=("feature",)),
        "excluded_columns": ("row_id",),
        "split_policy": SplitPolicy(
            strategy="random", final_holdout_fraction=0.2, cross_validation_folds=5
        ),
        "candidate_families": ("regularized_linear", "random_forest"),
        "metric_policy": MetricPolicy(
            primary_metric="rmse", optimization="minimize", reported_metrics=("rmse", "mae", "r2")
        ),
        "resource_limits": ResourceLimits(
            max_rows=10000, max_features=100, max_candidates=3, timeout_seconds=300
        ),
        "random_seed_policy": seeds(),
    }
    values.update(overrides)
    return ExperimentSpecification(**values)


class DatasetSnapshotContractTests(unittest.TestCase):
    def test_snapshot_is_versioned_json_safe_and_preserves_source_order(self) -> None:
        value = snapshot()
        payload = value.to_dict()
        self.assertEqual(payload["contract_version"], "ml_studio_contract_v1")
        self.assertEqual(payload["source_ids"], ["source-1"])
        self.assertNotIn("path", payload)
        with self.assertRaises(TypeError):
            value.governance_result["status"] = "blocked"

    def test_snapshot_rejects_missing_and_contradictory_identity(self) -> None:
        payload = snapshot().to_dict()
        payload.pop("workspace_id")
        payload.pop("contract_version")
        with self.assertRaises(TypeError):
            DatasetSnapshotIdentity(**payload)

        with self.assertRaises(ValueError):
            replace(snapshot(), source_ids=("different-source",))

    def test_snapshot_rejects_blocked_governance_and_non_json_values(self) -> None:
        with self.assertRaises(ValueError):
            replace(snapshot(), governance_result={"status": "blocked"})
        with self.assertRaises(ValueError):
            replace(snapshot(), governance_result={"status": "ready", "bad": {1, 2}})

    def test_snapshot_rejects_stale_workspace_or_source_truth(self) -> None:
        value = snapshot()
        with self.assertRaisesRegex(ValueError, "workspace_version is stale"):
            value.assert_current(
                workspace_version=4,
                source_fingerprints={"source-1": (f"sha256:{SHA}", 2)},
            )
        with self.assertRaisesRegex(ValueError, "source fingerprints are stale"):
            value.assert_current(
                workspace_version=3,
                source_fingerprints={"source-1": (f"sha256:{'b' * 64}", 2)},
            )


class ExperimentContractTests(unittest.TestCase):
    def test_regression_specification_is_valid(self) -> None:
        value = experiment()
        self.assertEqual(value.task_type, "regression")
        self.assertEqual(value.feature_roles.all_features, ("feature",))

    def test_task_type_remains_authoritative(self) -> None:
        with self.assertRaisesRegex(ValueError, "contradict task_type"):
            experiment(candidate_families=("logistic",))
        with self.assertRaisesRegex(ValueError, "classification-only"):
            experiment(
                split_policy=SplitPolicy(
                    strategy="stratified", final_holdout_fraction=0.2, cross_validation_folds=5
                )
            )

    def test_split_specific_columns_are_required_and_exclusive(self) -> None:
        with self.assertRaises(ValueError):
            SplitPolicy(strategy="time_ordered", final_holdout_fraction=0.2, cross_validation_folds=3)
        with self.assertRaises(ValueError):
            SplitPolicy(
                strategy="random",
                final_holdout_fraction=0.2,
                cross_validation_folds=3,
                group_column="account_id",
            )
        with self.assertRaisesRegex(ValueError, "cannot be model features"):
            experiment(
                feature_roles=FeatureRoles(numeric=("feature", "event_time")),
                split_policy=SplitPolicy(
                    strategy="time_ordered",
                    final_holdout_fraction=0.2,
                    cross_validation_folds=3,
                    time_column="event_time",
                ),
            )

    def test_target_and_exclusions_cannot_leak_into_features(self) -> None:
        with self.assertRaisesRegex(ValueError, "target cannot"):
            experiment(feature_roles=FeatureRoles(numeric=("feature", "target")))
        with self.assertRaisesRegex(ValueError, "excluded columns"):
            experiment(feature_roles=FeatureRoles(numeric=("feature", "row_id")))

    def test_selection_metric_cannot_use_accuracy_or_fit_alone(self) -> None:
        with self.assertRaisesRegex(ValueError, "fit alone"):
            experiment(
                metric_policy=MetricPolicy(
                    primary_metric="r2", optimization="maximize", reported_metrics=("rmse", "mae", "r2")
                )
            )
        with self.assertRaisesRegex(ValueError, "raw accuracy"):
            experiment(
                task_type="classification",
                candidate_families=("logistic",),
                metric_policy=MetricPolicy(
                    primary_metric="accuracy",
                    optimization="maximize",
                    reported_metrics=("balanced_accuracy", "f1_weighted", "accuracy"),
                ),
            )


class EvidenceContractTests(unittest.TestCase):
    def test_evaluation_separates_selection_and_final_holdout(self) -> None:
        selection = SelectionEvidence(
            baseline_name="mean",
            baseline_fold_metrics=({"rmse": 5.0}, {"rmse": 4.8}),
            candidates=(
                CandidateSelectionEvidence(
                    candidate_family="regularized_linear",
                    fold_metrics=({"rmse": 3.0}, {"rmse": 3.2}),
                    mean_metrics={"rmse": 3.1},
                ),
            ),
            selected_candidate="regularized_linear",
            development_row_count=80,
        )
        final = FinalHoldoutEvidence(
            selected_candidate="regularized_linear",
            candidate_metrics={"rmse": 3.4},
            baseline_metrics={"rmse": 5.2},
            holdout_row_count=20,
        )
        result = EvaluationResult(
            run_id="run-1",
            task_type="regression",
            dataset_snapshot=snapshot(),
            experiment_id="experiment-1",
            specification_version=1,
            selection_evidence=selection,
            final_holdout_evidence=final,
            split_evidence=SplitEvidence(
                strategy="random",
                development_index_hash=f"sha256:{SHA}",
                final_holdout_index_hash=f"sha256:{'b' * 64}",
                development_row_count=80,
                final_holdout_row_count=20,
                final_row_overlap_count=0,
                final_temporal_order_valid=None,
                final_group_overlap_count=None,
                folds=(
                    FoldEvidence(
                        train_row_count=40,
                        evaluation_row_count=40,
                        train_index_hash=f"sha256:{'c' * 64}",
                        evaluation_index_hash=f"sha256:{'d' * 64}",
                        row_overlap_count=0,
                        temporal_order_valid=None,
                        group_overlap_count=None,
                    ),
                ),
            ),
            warnings=(),
            limitations=("Small local sample.",),
            leakage_findings=(
                LeakageFinding(code="identifier_like", severity="warning", message="Review row identifiers."),
            ),
            feature_influence=FeatureInfluence(
                method="permutation",
                values={"feature": 0.5},
                limitations=("Association only.",),
            ),
            runtime_versions={"python": "3.11", "scikit_learn": "1.5.2"},
            random_seeds=seeds(),
            truth_boundary=TruthBoundary(
                claims=("The candidate was evaluated on this snapshot.",),
                prohibited_claims=("Production readiness.", "Causal effect."),
            ),
        )
        self.assertEqual(result.truth_boundary.status, "evaluated_experiment")
        self.assertFalse(result.feature_influence.causal)

        with self.assertRaisesRegex(ValueError, "selected development candidate"):
            replace(result, final_holdout_evidence=replace(final, selected_candidate="other"))

    def test_metrics_reject_nan_and_infinity(self) -> None:
        for bad_value in (math.nan, math.inf):
            with self.subTest(bad_value=bad_value):
                with self.assertRaises(ValueError):
                    FinalHoldoutEvidence(
                        selected_candidate="linear",
                        candidate_metrics={"rmse": bad_value},
                        baseline_metrics={"rmse": 4.0},
                        holdout_row_count=10,
                    )


class RemainingPublicContractTests(unittest.TestCase):
    def test_run_specification_rejects_non_json_parameters(self) -> None:
        with self.assertRaises(ValueError):
            RunSpecification(
                run_id="run-1",
                experiment_id="experiment-1",
                specification_version=1,
                dataset_snapshot=snapshot(),
                submitted_at=NOW,
                parameters={"unsafe": object()},
                environment={"python": "3.11"},
                code_revision="abcdef0",
            )

    def test_reviewed_candidate_is_a_reference_not_an_artifact(self) -> None:
        value = ReviewedCandidateReference(
            candidate_id="candidate-1",
            run_id="run-1",
            experiment_id="experiment-1",
            specification_version=1,
            snapshot_id="snapshot-1",
            model_artifact_hash=f"sha256:{SHA}",
            review_status="reviewed_candidate",
            reviewed_at=NOW,
            reviewed_by="developer-1",
            intended_use="Offline demand estimation review.",
            prohibited_use=("Automated deployment.",),
        )
        self.assertNotIn("estimator", value.to_dict())

    def test_structured_errors_reject_tracebacks_and_paths(self) -> None:
        value = StructuredError(
            code="invalid_split",
            message="The grouped split needs at least three groups.",
            remediation="Choose another group column or collect more groups.",
        )
        self.assertEqual(value.code, "invalid_split")
        for unsafe in ("Traceback (most recent call last): boom", "Read C:\\secret\\model.pkl"):
            with self.subTest(unsafe=unsafe):
                with self.assertRaises(ValueError):
                    StructuredError(code="unsafe_error", message=unsafe, remediation="Retry safely.")


if __name__ == "__main__":
    unittest.main()
