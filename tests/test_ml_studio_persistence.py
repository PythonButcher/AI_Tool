"""Focused durability, isolation, and artifact-safety tests for ML Studio."""

from __future__ import annotations

import os
import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch

from backend.ml_studio.artifacts import ArtifactStoreError, ManagedArtifactStore
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
    RunSpecification,
    SelectionEvidence,
    SourceFingerprint,
    SplitEvidence,
    SplitPolicy,
    StructuredError,
    TruthBoundary,
)
from backend.ml_studio.repository import MLStudioRepository, PersistenceError


SHA = "a" * 64
NOW = datetime(2026, 9, 14, 12, tzinfo=UTC)


def snapshot(snapshot_id: str = "snapshot-1") -> DatasetSnapshotIdentity:
    return DatasetSnapshotIdentity(
        snapshot_id=snapshot_id,
        workspace_id="workspace-1",
        workspace_version=3,
        source_ids=("source-1",),
        relationship_ids=(),
        source_fingerprints=(SourceFingerprint("source-1", f"sha256:{SHA}", 2),),
        schema_version=2,
        semantic_model_version="semantic-v2",
        governance_result={"status": "ready", "reasons": []},
        transformation_recipe_hash=f"sha256:{SHA}",
        row_count=100,
        column_profile=(
            ColumnProfile("feature", "numeric", 0, 100),
            ColumnProfile("target", "numeric", 0, 92),
        ),
        created_at=NOW,
    )


def experiment(version: int = 1, experiment_id: str = "experiment-1") -> ExperimentSpecification:
    return ExperimentSpecification(
        experiment_id=experiment_id,
        specification_version=version,
        task_type="regression",
        target="target",
        feature_roles=FeatureRoles(numeric=("feature",)),
        excluded_columns=("row_id",),
        split_policy=SplitPolicy("random", 0.2, 2),
        candidate_families=("regularized_linear",),
        metric_policy=MetricPolicy("rmse", "minimize", ("rmse", "mae")),
        resource_limits=ResourceLimits(1000, 20, 2, 60),
        random_seed_policy=RandomSeedPolicy(11, 12, 13),
    )


def run(run_id: str = "run-1", *, snapshot_id: str = "snapshot-1") -> RunSpecification:
    return RunSpecification(
        run_id=run_id,
        experiment_id="experiment-1",
        specification_version=1,
        dataset_snapshot=snapshot(snapshot_id),
        submitted_at=NOW,
        parameters={"alpha": 0.5},
        environment={"python": "3.11"},
        code_revision="abcdef1",
    )


def evaluation(run_id: str = "run-1") -> EvaluationResult:
    return EvaluationResult(
        run_id=run_id,
        task_type="regression",
        dataset_snapshot=snapshot(),
        experiment_id="experiment-1",
        specification_version=1,
        selection_evidence=SelectionEvidence(
            baseline_name="mean",
            baseline_fold_metrics=({"rmse": 5.0}, {"rmse": 4.8}),
            candidates=(CandidateSelectionEvidence("regularized_linear", ({"rmse": 3.0}, {"rmse": 3.2}), {"rmse": 3.1}),),
            selected_candidate="regularized_linear",
            development_row_count=80,
        ),
        final_holdout_evidence=FinalHoldoutEvidence(
            "regularized_linear", {"rmse": 3.4}, {"rmse": 5.2}, 20
        ),
        split_evidence=SplitEvidence(
            "random",
            f"sha256:{SHA}",
            f"sha256:{'b' * 64}",
            80,
            20,
            0,
            None,
            None,
            (FoldEvidence(40, 40, f"sha256:{'c' * 64}", f"sha256:{'d' * 64}", 0, None, None),),
        ),
        warnings=(),
        limitations=("Small local sample.",),
        leakage_findings=(LeakageFinding("identifier_like", "warning", "Review identifiers."),),
        feature_influence=FeatureInfluence("permutation", {"feature": 0.5}, ("Association only.",)),
        runtime_versions={"python": "3.11"},
        random_seeds=RandomSeedPolicy(11, 12, 13),
        truth_boundary=TruthBoundary(("Evaluated on this snapshot.",), ("Production readiness.",)),
    )


class RepositoryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.database = self.root / "ml_studio.sqlite3"
        self.repository = MLStudioRepository(self.database)
        self.repository.create_experiment(experiment())

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_experiment_versions_are_immutable_and_monotonic(self) -> None:
        second = experiment(2)
        self.repository.create_experiment(second)
        self.assertEqual(
            [item["specification_version"] for item in self.repository.list_experiment_versions("experiment-1")],
            [1, 2],
        )
        with self.assertRaisesRegex(PersistenceError, "next immutable version"):
            self.repository.create_experiment(replace(second, specification_version=4))
        with self.assertRaises(PersistenceError):
            self.repository.create_experiment(experiment())

    def test_submission_is_idempotent_without_storing_raw_key(self) -> None:
        created, was_created = self.repository.submit_run(run(), idempotency_key="private-request-token")
        repeated, was_repeated_created = self.repository.submit_run(run(), idempotency_key="private-request-token")
        self.assertTrue(was_created)
        self.assertFalse(was_repeated_created)
        self.assertEqual(created, repeated)
        self.assertNotIn("idempotency", created)
        with closing(sqlite3.connect(self.database)) as connection:
            stored = connection.execute("SELECT idempotency_key_hash FROM ml_runs").fetchone()[0]
        self.assertEqual(len(stored), 64)
        self.assertNotEqual(stored, "private-request-token")

    def test_idempotency_key_cannot_cross_snapshot_or_run_identity(self) -> None:
        self.repository.submit_run(run(), idempotency_key="one-request")
        with self.assertRaisesRegex(PersistenceError, "different experiment, version, or snapshot"):
            self.repository.submit_run(run("run-2", snapshot_id="snapshot-2"), idempotency_key="one-request")

    def test_concurrent_run_identities_do_not_overwrite_each_other(self) -> None:
        first, _ = self.repository.submit_run(run("run-1"), idempotency_key="request-1")
        second, _ = self.repository.submit_run(run("run-2"), idempotency_key="request-2")
        self.assertEqual(first["run_id"], "run-1")
        self.assertEqual(second["run_id"], "run-2")
        self.assertEqual(self.repository.get_run("run-1")["status"], "queued")

    def test_concurrent_duplicate_submission_creates_exactly_one_run(self) -> None:
        repositories = (self.repository, MLStudioRepository(self.database))
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(
                executor.map(
                    lambda repository: repository.submit_run(run(), idempotency_key="shared-request"),
                    repositories,
                )
            )
        self.assertEqual(sum(1 for _, created in results if created), 1)
        self.assertEqual({record["run_id"] for record, _ in results}, {"run-1"})

    def test_lifecycle_timestamps_and_terminal_immutability(self) -> None:
        self.repository.submit_run(run(), idempotency_key="request-1")
        running = self.repository.transition_run("run-1", "running", progress_stage="training")
        completed = self.repository.transition_run(
            "run-1", "completed", progress_stage="finished", evaluation_result=evaluation(), warnings=("bounded",)
        )
        self.assertIsNotNone(running["started_at"])
        self.assertIsNotNone(completed["finished_at"])
        self.assertEqual(completed["warnings"], ["bounded"])
        self.assertEqual(completed["evaluation_result"]["run_id"], "run-1")
        with self.assertRaisesRegex(PersistenceError, "not allowed"):
            self.repository.transition_run("run-1", "running")

    def test_completion_and_failure_require_structured_evidence(self) -> None:
        self.repository.submit_run(run(), idempotency_key="request-1")
        self.repository.transition_run("run-1", "running")
        with self.assertRaisesRegex(PersistenceError, "evaluation result"):
            self.repository.transition_run("run-1", "completed")
        with self.assertRaisesRegex(PersistenceError, "structured failure"):
            self.repository.transition_run("run-1", "failed")
        failed = self.repository.transition_run(
            "run-1",
            "failed",
            failure=StructuredError("evaluation_failed", "Evaluation could not complete.", "Review the experiment and retry."),
        )
        self.assertEqual(failed["failure"]["code"], "evaluation_failed")

    def test_completion_rejects_evidence_from_another_run(self) -> None:
        self.repository.submit_run(run(), idempotency_key="request-1")
        self.repository.transition_run("run-1", "running")
        with self.assertRaisesRegex(PersistenceError, "immutable run identity"):
            self.repository.transition_run("run-1", "completed", evaluation_result=evaluation("run-other"))

    def test_cancellation_is_immediate_when_queued_and_cooperative_when_running(self) -> None:
        self.repository.submit_run(run("run-1"), idempotency_key="request-1")
        self.repository.submit_run(run("run-2"), idempotency_key="request-2")
        self.assertEqual(self.repository.request_cancellation("run-1")["status"], "cancelled")
        self.repository.transition_run("run-2", "running")
        self.assertEqual(self.repository.request_cancellation("run-2")["status"], "cancel_requested")
        self.assertEqual(self.repository.transition_run("run-2", "cancelled")["status"], "cancelled")

    def test_restart_recovery_marks_every_non_terminal_run_interrupted(self) -> None:
        self.repository.submit_run(run("run-1"), idempotency_key="request-1")
        self.repository.submit_run(run("run-2"), idempotency_key="request-2")
        self.repository.transition_run("run-2", "running", progress_stage="fit")
        reopened = MLStudioRepository(self.database)
        self.assertEqual(reopened.recover_incomplete_runs(), ["run-1", "run-2"])
        self.assertEqual(reopened.get_run("run-1")["status"], "interrupted")
        self.assertEqual(reopened.get_run("run-2")["progress_stage"], "restart_recovery")

    def test_public_records_do_not_expose_paths_bytes_or_idempotency_hashes(self) -> None:
        persisted, _ = self.repository.submit_run(run(), idempotency_key="request-1")
        serialized = str(persisted).casefold()
        self.assertNotIn(str(self.root).casefold(), serialized)
        self.assertNotIn("idempotency", serialized)
        self.assertNotIn("artifact_bytes", serialized)


class ArtifactStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.store = ManagedArtifactStore(self.root / "managed", max_bytes=1024)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_write_is_atomic_immutable_and_integrity_checked(self) -> None:
        metadata = self.store.write(
            "run-1", "model.bin", b"trusted-model", media_type="application/octet-stream", server_created=True
        )
        self.assertEqual(metadata.size_bytes, len(b"trusted-model"))
        self.assertEqual(self.store.verify("run-1", "model.bin"), metadata)
        self.assertNotIn(str(self.root), str(metadata.to_dict()))
        with self.assertRaisesRegex(ArtifactStoreError, "cannot be overwritten"):
            self.store.write(
                "run-1", "model.bin", b"replacement", media_type="application/octet-stream", server_created=True
            )

    def test_untrusted_or_oversized_content_is_rejected(self) -> None:
        with self.assertRaisesRegex(ArtifactStoreError, "server-created"):
            self.store.write("run-1", "model.bin", b"pickle", media_type="application/octet-stream", server_created=False)
        with self.assertRaisesRegex(ArtifactStoreError, "storage limit"):
            self.store.write("run-1", "large.bin", b"x" * 1025, media_type="application/octet-stream", server_created=True)

    def test_paths_reject_traversal_absolute_and_symlink_escape(self) -> None:
        for name in ("../escape", "folder/file", "C:\\escape.bin", "/escape.bin"):
            with self.subTest(name=name), self.assertRaises(ArtifactStoreError):
                self.store.write("run-1", name, b"x", media_type="application/octet-stream", server_created=True)
        outside = self.root / "outside"
        outside.mkdir()
        run_link = self.root / "managed" / "run-link"
        try:
            run_link.symlink_to(outside, target_is_directory=True)
        except OSError:
            self.skipTest("symbolic links are unavailable for this test account")
        with self.assertRaisesRegex(ArtifactStoreError, "unsafe"):
            self.store.write("run-link", "model.bin", b"x", media_type="application/octet-stream", server_created=True)

    def test_tampering_fails_integrity_verification(self) -> None:
        self.store.write("run-1", "model.bin", b"trusted", media_type="application/octet-stream", server_created=True)
        (self.root / "managed" / "run-1" / "model.bin").write_bytes(b"tampered")
        with self.assertRaisesRegex(ArtifactStoreError, "integrity check"):
            self.store.verify("run-1", "model.bin")

    def test_failed_sidecar_commit_removes_partial_artifact(self) -> None:
        real_replace = os.replace
        calls = 0

        def fail_second_replace(source: object, destination: object) -> None:
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError("injected sidecar failure")
            real_replace(source, destination)

        with patch("backend.ml_studio.artifacts.os.replace", side_effect=fail_second_replace):
            with self.assertRaises(OSError):
                self.store.write(
                    "run-1", "model.bin", b"trusted", media_type="application/octet-stream", server_created=True
                )
        self.assertFalse((self.root / "managed" / "run-1" / "model.bin").exists())

    def test_repository_registers_metadata_without_path_or_bytes(self) -> None:
        repository = MLStudioRepository(self.root / "metadata.sqlite3")
        repository.create_experiment(experiment())
        repository.submit_run(run(), idempotency_key="request-1")
        metadata = self.store.write(
            "run-1", "metrics.json", b"{}", media_type="application/json", server_created=True
        )
        registered = repository.register_artifact(metadata)
        self.assertEqual(repository.list_artifacts("run-1"), [registered])
        self.assertNotIn("path", registered)
        self.assertNotIn("content", registered)
        with self.assertRaisesRegex(PersistenceError, "cannot be overwritten"):
            repository.register_artifact(metadata)


if __name__ == "__main__":
    unittest.main()
