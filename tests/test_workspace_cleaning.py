"""Integration evidence for the governed preparation commit boundary."""

from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from flask import Flask

from backend.db import backend_db
from backend.repositories.source_workspace_repository import get_source, get_workspace
from backend.routes.manual_cleaning import manual_cleaning_bp
from backend.routes.ml_studio import _resolve_workspace_state
from backend.routes.upload import upload_bp
from backend.services import workspace_context
from backend.services.dataset_context import load_datahub_dataset


class WorkspaceCleaningTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.db_path = backend_db.DB_PATH
        self.upload_root = workspace_context.MANAGED_UPLOAD_ROOT
        backend_db.DB_PATH = str(Path(self.temp.name) / "catalog.db")
        backend_db._SCHEMA_READY = False
        workspace_context.MANAGED_UPLOAD_ROOT = Path(self.temp.name) / "managed"
        app = Flask(__name__)
        app.register_blueprint(upload_bp)
        app.register_blueprint(manual_cleaning_bp)
        self.client = app.test_client()
        self.first = self.upload()
        self.second = self.upload()

    def tearDown(self):
        backend_db.DB_PATH = self.db_path
        backend_db._SCHEMA_READY = False
        workspace_context.MANAGED_UPLOAD_ROOT = self.upload_root
        self.temp.cleanup()

    def upload(self):
        body = b"row_id,value\n" + b"".join(f"{i},{i}\n".encode() for i in range(150))
        response = self.client.post('/api/upload', data={"file": (BytesIO(body), "sample.csv")}, content_type="multipart/form-data")
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()

    def clean(self, **overrides):
        payload = {"workspace_version": 1, "source_id": self.first["source"]["source_id"],
                   "steps": [{"type": "remove_columns", "params": {"columns": ["value"]}}],
                   "preview_only": True}
        payload.update(overrides)
        return self.client.post(f'/api/data-workspaces/{self.first["workspace"]["workspace_id"]}/manual-cleaning', json=payload)

    def test_preview_and_discard_preserve_durable_and_global_data(self):
        before = get_workspace(self.first["workspace"]["workspace_id"])
        files = set(workspace_context.MANAGED_UPLOAD_ROOT.iterdir())
        with patch('backend.routes.manual_cleaning.set_cleaned_data') as legacy_write:
            response = self.clean()
        self.assertEqual(response.status_code, 200, response.get_json())
        result = response.get_json()
        self.assertEqual(len(result["preview"]), 100)
        self.assertEqual(result["row_count"], 150)
        self.assertFalse(result["committed"])
        self.assertIsNone(result["receipt"])
        self.assertNotIn("cleaned_data", result)
        self.assertEqual(get_workspace(before["workspace_id"]), before)
        self.assertEqual(set(workspace_context.MANAGED_UPLOAD_ROOT.iterdir()), files)
        self.assertEqual(load_datahub_dataset(self.first["source"]["source_id"])["dataframe"].shape, (150, 2))
        legacy_write.assert_not_called()

    def test_recipe_uses_intermediate_schema_and_numeric_filter_values(self):
        response = self.clean(steps=[
            {'type': 'rename_columns', 'params': {'mappings': {'value': 'amount'}}},
            {'type': 'filter_rows', 'params': {'conditions': [{'column': 'amount', 'operator': 'gte', 'value': '140'}]}},
            {'type': 'keep_columns', 'params': {'columns': ['amount']}},
        ])
        self.assertEqual(response.status_code, 200, response.get_json())
        result = response.get_json()
        self.assertEqual((result['row_count'], result['removed_row_count']), (10, 140))
        self.assertEqual(result['preview'][0], {'amount': 140})

    def test_invalid_recipe_columns_are_not_silently_ignored(self):
        for steps in (
            [{'type': 'remove_nulls', 'params': {'columns': ['missing_column']}}],
            [{'type': 'rename_columns', 'params': {'mappings': {'value': 'row_id'}}}],
            [{'type': 'keep_columns', 'params': {}}],
            [{'type': 'remove_columns', 'params': {'columns': ['value']}}, {'type': 'trim_whitespace', 'params': {'columns': ['value']}}],
        ):
            with self.subTest(steps=steps):
                self.assertEqual(self.clean(steps=steps, preview_only=False).status_code, 400)
        self.assertEqual(get_workspace(self.first['workspace']['workspace_id'])['version'], 1)

    def test_foreign_and_stale_requests_are_rejected(self):
        for override in ({"source_id": self.second["source"]["source_id"]}, {"workspace_version": 2}):
            response = self.clean(preview_only=False, **override)
            self.assertEqual(response.status_code, 409, response.get_json())
        self.assertEqual(get_workspace(self.first["workspace"]["workspace_id"])["version"], 1)

    def test_apply_receipt_matches_reloaded_ml_workspace_and_leaves_original(self):
        response = self.clean(preview_only=False)
        self.assertEqual(response.status_code, 200, response.get_json())
        receipt = response.get_json()["receipt"]
        workspace = get_workspace(receipt["workspace_id"])
        source = get_source(receipt["source_id"])
        frame, truth = _resolve_workspace_state(receipt["workspace_id"])
        self.assertEqual(workspace["version"], 2)
        self.assertEqual(workspace["primary_source_id"], receipt["source_id"])
        self.assertEqual(source["content_fingerprint"], receipt["content_fingerprint"])
        self.assertEqual(source["schema"], receipt["schema"])
        self.assertEqual(source["schema_version"], receipt["schema_version"])
        self.assertEqual(list(frame.columns), ["row_id"])
        self.assertEqual(truth["workspace_version"], receipt["workspace_version"])
        self.assertEqual(truth["source_ids"], [receipt["source_id"]])
        self.assertEqual(load_datahub_dataset(self.first["source"]["source_id"])["dataframe"].shape, (150, 2))
        self.assertEqual(get_workspace(self.second["workspace"]["workspace_id"])["version"], 1)
        self.assertEqual(self.clean(preview_only=False).status_code, 409)

    def test_commit_race_rolls_back_catalog_and_cleans_staged_file(self):
        from backend.services.workspace_context import WorkspaceContextError
        files = set(workspace_context.MANAGED_UPLOAD_ROOT.iterdir())
        with patch('backend.services.workspace_context.replace_workspace_primary', side_effect=WorkspaceContextError("workspace_version_conflict", "Conflict")):
            response = self.clean(preview_only=False)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(set(workspace_context.MANAGED_UPLOAD_ROOT.iterdir()), files)
        self.assertEqual(get_workspace(self.first["workspace"]["workspace_id"])["version"], 1)

    def test_invalid_steps_empty_apply_and_client_rows_are_rejected(self):
        for overrides in ({"steps": [{"type": "unknown"}]}, {"preview_only": "false"}, {"rows": []},
                          {"preview_only": False, "steps": [{"type": "remove_columns", "params": {"columns": ["row_id", "value"]}}]}):
            self.assertEqual(self.clean(**overrides).status_code, 400)

    def test_governance_blocked_apply_does_not_commit(self):
        with patch('backend.services.workspace_cleaning.evaluate_dataset_readiness', return_value={"status": "blocked"}):
            self.assertEqual(self.clean(preview_only=False).status_code, 422)
        self.assertEqual(get_workspace(self.first["workspace"]["workspace_id"])["version"], 1)

    def test_version_change_during_cleaning_rejects_actual_repository_commit(self):
        from backend.services.manual_cleaning_engine import ManualCleaningEngine
        original_apply = ManualCleaningEngine.apply_steps
        def advance_then_clean(engine, steps, dataframe):
            conn = backend_db.get_db_connection()
            try:
                conn.execute("UPDATE data_workspaces SET version = 2 WHERE workspace_id = ?", (self.first["workspace"]["workspace_id"],))
                conn.commit()
            finally:
                conn.close()
            return original_apply(engine, steps, dataframe)
        files = set(workspace_context.MANAGED_UPLOAD_ROOT.iterdir())
        with patch.object(ManualCleaningEngine, 'apply_steps', advance_then_clean):
            response = self.clean(preview_only=False)
        self.assertEqual(response.status_code, 409, response.get_json())
        self.assertEqual(set(workspace_context.MANAGED_UPLOAD_ROOT.iterdir()), files)
        self.assertEqual(get_workspace(self.first["workspace"]["workspace_id"])["primary_source_id"], self.first["source"]["source_id"])

    def test_explicit_string_conversion_survives_durable_reload(self):
        response = self.clean(preview_only=False, steps=[{"type": "convert_type", "params": {"columns": ["value"], "target": "string"}}])
        self.assertEqual(response.status_code, 200, response.get_json())
        receipt = response.get_json()["receipt"]
        frame = load_datahub_dataset(receipt["source_id"])["dataframe"]
        self.assertEqual(frame.iloc[0]["value"], "0")
        self.assertEqual(workspace_context.dataframe_schema(frame), receipt["schema"])

    def test_apply_preserves_source_shared_by_another_workspace(self):
        workspace_context.add_source_to_workspace(
            workspace_id=self.second["workspace"]["workspace_id"],
            source_id=self.first["source"]["source_id"], version=1, alias="shared", role="lookup",
        )
        before = get_workspace(self.second["workspace"]["workspace_id"])
        response = self.clean(preview_only=False)
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(get_workspace(before["workspace_id"]), before)
        self.assertEqual(load_datahub_dataset(self.first["source"]["source_id"])["dataframe"].shape, (150, 2))

    def test_relationship_drafts_are_rejected_without_preview_writes(self):
        workspace_id = self.first["workspace"]["workspace_id"]
        conn = backend_db.get_db_connection()
        try:
            conn.execute("""INSERT INTO workspace_relationships
                (relationship_id, workspace_id, left_source_id, right_source_id,
                 field_pairs_json, cardinality, join_behavior, filter_direction,
                 validation_state, created_at, updated_at)
                VALUES (?, ?, ?, ?, '[]', 'one_to_one', 'left', 'none', 'unvalidated', 'now', 'now')""",
                ('edge', workspace_id, self.first["source"]["source_id"], self.second["source"]["source_id"]))
            conn.commit()
        finally:
            conn.close()
        for preview in (True, False):
            response = self.clean(preview_only=preview)
            self.assertEqual(response.status_code, 409, response.get_json())
            self.assertEqual(response.get_json()["error"]["code"], 'preparation_relationships_unsupported')
