"""Focused coverage for durable governed sources and one-source workspaces."""

from io import BytesIO
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory
import unittest

from flask import Flask

from backend.db import backend_db
from backend.repositories.source_workspace_repository import get_source, get_workspace
from backend.routes.data_workspaces import data_workspaces_bp
from backend.routes.upload import upload_bp
from backend.services import workspace_context
from backend.services.dataset_context import load_datahub_dataset


class SourceWorkspaceContextTests(unittest.TestCase):
    """Verify migration, registration, restart safety, and isolation."""

    def setUp(self):
        self.temp_dir = TemporaryDirectory()
        self.original_db_path = backend_db.DB_PATH
        self.original_upload_root = workspace_context.MANAGED_UPLOAD_ROOT
        self.db_path = Path(self.temp_dir.name) / "catalog.db"
        self.managed_root = Path(self.temp_dir.name) / "managed"
        backend_db.DB_PATH = str(self.db_path)
        backend_db._SCHEMA_READY = False
        workspace_context.MANAGED_UPLOAD_ROOT = self.managed_root

        app = Flask(__name__)
        app.register_blueprint(upload_bp)
        app.register_blueprint(data_workspaces_bp)
        self.client = app.test_client()

    def tearDown(self):
        backend_db.DB_PATH = self.original_db_path
        backend_db._SCHEMA_READY = False
        workspace_context.MANAGED_UPLOAD_ROOT = self.original_upload_root
        self.temp_dir.cleanup()

    def _upload(self, filename="orders.csv", body=b"order_id,revenue\n1,100\n2,125\n", **fields):
        """Post a small governed dataset and return its response."""
        data = {"file": (BytesIO(body), filename), **fields}
        return self.client.post("/api/upload", data=data, content_type="multipart/form-data")

    def test_legacy_schema_migrates_to_versioned_sources_and_workspaces(self):
        legacy = sqlite3.connect(self.db_path)
        legacy.execute(
            """
            CREATE TABLE datahub_datasets (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL,
                uploadedAt TEXT, numRows INTEGER DEFAULT 0, numCols INTEGER DEFAULT 0,
                schema_json TEXT, preview_json TEXT
            )
            """
        )
        legacy.commit()
        legacy.close()

        connection = backend_db.get_db_connection()
        source_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(datahub_datasets)").fetchall()
        }
        table_names = {
            row["name"]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
        }
        connection.close()

        self.assertTrue(
            {"source_kind", "locator_kind", "locator_json", "content_fingerprint", "schema_version", "created_at", "updated_at"}.issubset(source_columns)
        )
        self.assertTrue({"data_workspaces", "workspace_sources"}.issubset(table_names))

    def test_upload_is_additive_and_registers_source_bound_metadata(self):
        response = self._upload(
            path="C:/client/should-never-be-trusted.csv",
            governance_policy='{"required_fields":["revenue"]}',
        )

        self.assertEqual(response.status_code, 200, response.get_json())
        body = response.get_json()
        for legacy_field in (
            "message", "data_preview", "full_data", "numeric_summary",
            "categorical_summary", "semantic_model", "governance_readiness",
        ):
            self.assertIn(legacy_field, body)

        source = body["source"]
        context = body["analysis_context"]
        self.assertTrue(source["source_id"].startswith("src_"))
        self.assertEqual(source["source_kind"], "upload")
        self.assertEqual(source["locator_kind"], "managed_file")
        self.assertNotIn("path", source)
        self.assertNotIn("C:/client", str(source))
        self.assertTrue(source["content_fingerprint"].startswith("sha256:"))
        self.assertEqual(source["semantic_model"]["dataset"]["id"], source["source_id"])
        self.assertEqual(source["governance_policy"]["required_fields"], ["revenue"])
        self.assertEqual(source["governance_readiness"], body["governance_readiness"])
        self.assertEqual(context["primary_source_id"], source["source_id"])
        self.assertEqual(context["source_ids"], [source["source_id"]])
        self.assertEqual(context["relationship_ids"], [])

        private_path = self.managed_root / source["managed_locator"]["storage_key"]
        self.assertTrue(private_path.is_file())

    def test_source_workspace_and_decision_identity_survive_new_connections(self):
        body = self._upload().get_json()
        source_id = body["source"]["source_id"]
        workspace_id = body["workspace"]["workspace_id"]

        # Simulate a process restart so retrieval must come from SQLite and the
        # managed file, never from the process-global compatibility adapter.
        backend_db._SCHEMA_READY = False
        source = get_source(source_id)
        workspace = get_workspace(workspace_id)
        bundle = load_datahub_dataset(source_id)

        self.assertEqual(source["source_id"], source_id)
        self.assertEqual(workspace["primary_source_id"], source_id)
        self.assertEqual(bundle["dataset_ref"]["dataset_id"], source_id)
        self.assertEqual(bundle["semantic_model"]["dataset"]["id"], source_id)
        self.assertEqual(bundle["dataframe"].shape, (2, 2))

    def test_workspace_context_rejects_cross_workspace_membership(self):
        first = self._upload("orders.csv").get_json()
        second = self._upload("customers.csv", b"customer_id,name\n1,Ada\n").get_json()

        response = self.client.get(
            f"/api/data-workspaces/{first['workspace']['workspace_id']}/analysis-context",
            query_string={"source_id": second["source"]["source_id"]},
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["error"]["code"], "source_not_in_workspace")
        first_workspace = self.client.get(
            f"/api/data-workspaces/{first['workspace']['workspace_id']}"
        ).get_json()["workspace"]
        self.assertEqual(
            [item["source_id"] for item in first_workspace["sources"]],
            [first["source"]["source_id"]],
        )

    def test_missing_managed_file_fails_without_exposing_private_path(self):
        body = self._upload().get_json()
        source = body["source"]
        managed_file = self.managed_root / source["managed_locator"]["storage_key"]
        managed_file.unlink()

        response = self.client.get(
            f"/api/data-workspaces/{body['workspace']['workspace_id']}/analysis-context"
        )

        self.assertEqual(response.status_code, 409)
        error = response.get_json()["error"]
        self.assertEqual(error["code"], "managed_source_unavailable")
        self.assertNotIn(str(self.managed_root), error["message"])


if __name__ == "__main__":
    unittest.main()
