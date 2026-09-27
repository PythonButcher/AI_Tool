"""Draft persistence keeps incomplete edits separate from immutable runs."""

from __future__ import annotations

import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from backend.ml_studio.repository import MLStudioRepository, PersistenceError
from backend.ml_studio.service import MLStudioService, MLStudioServiceError
from tests.test_ml_studio_persistence import snapshot


class DraftRepositoryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "ml-studio.sqlite"
        self.repository = MLStudioRepository(self.path)

    def test_create_reopen_and_workspace_isolation(self) -> None:
        draft = self.repository.create_draft({"workspace_id": "workspace-1", "name": "Initial"})
        self.assertEqual(draft["draft_revision"], 1)
        self.assertIsNone(draft["snapshot_id"])
        reopened = MLStudioRepository(self.path)
        self.assertEqual(reopened.get_draft(draft["experiment_id"], "workspace-1"), draft)
        self.assertIsNone(reopened.get_draft(draft["experiment_id"], "workspace-2"))
        self.assertEqual(reopened.list_drafts("workspace-1"), [draft])
        self.assertEqual(reopened.list_drafts("workspace-2"), [])

    def test_stale_etag_cannot_overwrite_and_duplicate_has_new_identity(self) -> None:
        draft = self.repository.create_draft({"workspace_id": "workspace-1"})
        saved = self.repository.update_draft(
            draft["experiment_id"], "workspace-1", draft["etag"],
            {"name": "Working draft", "active_stage": "Configure", "guidance_enabled": False},
        )
        self.assertEqual(saved["draft_revision"], 2)
        self.assertNotEqual(saved["etag"], draft["etag"])
        with self.assertRaises(PersistenceError) as error:
            self.repository.update_draft(draft["experiment_id"], "workspace-1", draft["etag"], {"name": "Lost edit"})
        self.assertEqual(error.exception.code, "draft_revision_conflict")
        self.assertEqual(self.repository.get_draft(draft["experiment_id"], "workspace-1"), saved)
        duplicate = self.repository.duplicate_draft(draft["experiment_id"], "workspace-1")
        self.assertNotEqual(duplicate["experiment_id"], draft["experiment_id"])
        self.assertEqual(duplicate["draft_revision"], 1)
        self.assertEqual(duplicate["active_stage"], "Data & Goal")
        self.assertFalse(duplicate["guidance_enabled"])
        self.assertIsNone(duplicate["latest_assessment_id"])

    def test_two_repository_instances_cannot_both_save_one_revision(self) -> None:
        draft = self.repository.create_draft({"workspace_id": "workspace-1"})
        other = MLStudioRepository(self.path)

        def save(repository: MLStudioRepository, name: str) -> str:
            try:
                repository.update_draft(draft["experiment_id"], "workspace-1", draft["etag"], {"name": name})
                return "saved"
            except PersistenceError as exc:
                return exc.code

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda item: save(*item), ((self.repository, "First"), (other, "Second"))))
        self.assertCountEqual(results, ["saved", "draft_revision_conflict"])
        self.assertEqual(self.repository.get_draft(draft["experiment_id"], "workspace-1")["draft_revision"], 2)

    def test_rejects_server_owned_state_paths_and_role_conflicts(self) -> None:
        bad_edits = (
            {"workspace_id": "workspace-1", "rows": [{"secret": 1}]},
            {"workspace_id": "workspace-1", "validation": {"path": "C:\\private\\data.csv"}},
            {"workspace_id": "workspace-1", "workflow_state": {"complete": True}},
            {"workspace_id": "workspace-1", "recipe_id": "client-issued"},
            {"workspace_id": "workspace-1", "validation": {"file_path": "\\\\server\\share\\data.csv"}},
            {"workspace_id": "workspace-1", "roles": {"target": "y", "numeric": ["y"]}},
            {"workspace_id": "workspace-1", "guidance_enabled": "yes"},
        )
        for edit in bad_edits:
            with self.subTest(edit=edit), self.assertRaises(PersistenceError):
                self.repository.create_draft(edit)
        self.assertEqual(self.repository.list_drafts("workspace-1"), [])

    def test_service_derives_stage_from_existing_workspace_snapshot(self) -> None:
        service = MLStudioService(
            self.repository, lambda workspace_id: {}, lambda metadata: None,
            workspace_resolver=lambda workspace_id: {"workspace_id": workspace_id} if workspace_id == "workspace-1" else None,
        )
        self.repository.create_snapshot(snapshot())
        result = service.create_draft({
            "workspace_id": "workspace-1", "snapshot_id": "snapshot-1", "task_type": "regression",
            "active_stage": "Prepare Data",
        })
        self.assertEqual(result["workflow_state"]["active_stage"], "Prepare Data")
        self.assertEqual(result["workflow_state"]["stages"][2]["state"], "locked")
        with self.assertRaises(MLStudioServiceError) as error:
            service.update_draft(result["draft"]["experiment_id"], "workspace-1", result["draft"]["etag"], {"active_stage": "Train"})
        self.assertEqual(error.exception.code, "draft_stage_locked")
        with self.assertRaises(MLStudioServiceError) as error:
            service.create_draft({"workspace_id": "workspace-1", "snapshot_id": "other"})
        self.assertEqual(error.exception.code, "snapshot_not_found")


if __name__ == "__main__":
    unittest.main()
