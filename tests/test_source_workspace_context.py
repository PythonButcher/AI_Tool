"""Focused coverage for durable governed sources and one-source workspaces."""

from io import BytesIO
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

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

    def test_source_listing_returns_only_public_catalog_records(self):
        first = self._upload("orders.csv").get_json()["source"]
        second = self._upload("customers.csv", b"customer_id,name\n1,Ada\n").get_json()["source"]

        response = self.client.get("/api/data-sources")

        self.assertEqual(response.status_code, 200)
        sources = response.get_json()["sources"]
        self.assertEqual(
            [source["source_id"] for source in sources],
            [first["source_id"], second["source_id"]],
        )
        for source in sources:
            self.assertNotIn("path", source)
            self.assertNotIn("private_locator", source)
            self.assertNotIn(str(self.managed_root), str(source))

    def test_existing_catalog_source_joins_workspace_and_advances_once(self):
        orders = self._upload("orders.csv").get_json()
        customers = self._upload(
            "customers.csv", b"customer_id,name\n1,Ada\n"
        ).get_json()
        workspace_id = orders["workspace"]["workspace_id"]

        response = self.client.post(
            f"/api/data-workspaces/{workspace_id}/sources",
            json={
                "source_id": customers["source"]["source_id"],
                "alias": "customers",
                "role": "lookup",
                "version": orders["workspace"]["version"],
            },
        )

        self.assertEqual(response.status_code, 200, response.get_json())
        body = response.get_json()
        self.assertEqual(body["source"]["source_id"], customers["source"]["source_id"])
        self.assertEqual(body["workspace"]["version"], 2)
        self.assertEqual(body["workspace"]["source_count"], 2)
        self.assertEqual(
            body["analysis_context"]["source_ids"],
            [orders["source"]["source_id"]],
        )
        self.assertEqual(body["analysis_context"]["relationship_ids"], [])

        backend_db._SCHEMA_READY = False
        restarted = get_workspace(workspace_id)
        self.assertEqual(restarted["version"], 2)
        self.assertEqual(
            [membership["alias"] for membership in restarted["sources"]],
            ["orders", "customers"],
        )

    def test_workspace_source_position_is_versioned_and_restart_safe(self):
        """Save one node position without changing analytical workspace truth."""
        orders = self._upload("orders.csv").get_json()
        workspace = orders["workspace"]
        source_id = orders["source"]["source_id"]

        response = self.client.patch(
            f"/api/data-workspaces/{workspace['workspace_id']}/sources/{source_id}/position",
            json={"version": workspace["version"], "position": {"x": 125.5, "y": -40}},
        )

        self.assertEqual(response.status_code, 200, response.get_json())
        updated = response.get_json()["workspace"]
        self.assertEqual(set(response.get_json()), {"workspace"})
        self.assertEqual(updated["version"], workspace["version"] + 1)
        self.assertEqual(updated["primary_source_id"], workspace["primary_source_id"])
        self.assertEqual(updated["source_count"], workspace["source_count"])
        self.assertEqual(updated["sources"][0]["position"], {"x": 125.5, "y": -40})

        # Force a fresh schema/connection path to prove persisted retrieval.
        backend_db._SCHEMA_READY = False
        restarted = get_workspace(workspace["workspace_id"])
        self.assertEqual(restarted["version"], 2)
        self.assertEqual(restarted["sources"][0]["position"], {"x": 125.5, "y": -40})

    def test_workspace_source_position_rejects_invalid_stale_and_foreign_writes(self):
        """Keep invalid coordinates and non-member writes transactionally inert."""
        orders = self._upload("orders.csv").get_json()
        customers = self._upload(
            "customers.csv", b"customer_id,name\n1,Ada\n"
        ).get_json()
        workspace = orders["workspace"]
        workspace_id = workspace["workspace_id"]
        source_id = orders["source"]["source_id"]
        endpoint = (
            f"/api/data-workspaces/{workspace_id}/sources/{source_id}/position"
        )

        invalid_positions = [
            None,
            {"x": 1},
            {"x": 1, "y": 2, "z": 3},
            {"x": True, "y": 2},
            {"x": "1", "y": 2},
            {"x": float("nan"), "y": 2},
            {"x": float("inf"), "y": 2},
            {"x": 10**400, "y": 2},
        ]
        for position in invalid_positions:
            with self.subTest(position=position):
                response = self.client.patch(
                    endpoint,
                    json={"version": workspace["version"], "position": position},
                )
                self.assertEqual(response.status_code, 400)
                self.assertEqual(
                    response.get_json()["error"]["code"],
                    "invalid_workspace_position",
                )

        stale = self.client.patch(
            endpoint,
            json={"version": workspace["version"] + 1, "position": {"x": 1, "y": 2}},
        )
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(
            stale.get_json()["error"]["code"], "workspace_version_conflict"
        )

        foreign_source_id = customers["source"]["source_id"]
        foreign = self.client.patch(
            f"/api/data-workspaces/{workspace_id}/sources/{foreign_source_id}/position",
            json={"version": workspace["version"], "position": {"x": 1, "y": 2}},
        )
        self.assertEqual(foreign.status_code, 409)
        self.assertEqual(
            foreign.get_json()["error"]["code"], "source_not_in_workspace"
        )
        missing = self.client.patch(
            f"/api/data-workspaces/{workspace_id}/sources/src_missing/position",
            json={"version": workspace["version"], "position": {"x": 1, "y": 2}},
        )
        self.assertEqual(missing.status_code, 409)
        self.assertEqual(
            missing.get_json()["error"]["code"], "source_not_in_workspace"
        )
        missing_workspace = self.client.patch(
            f"/api/data-workspaces/ws_missing/sources/{source_id}/position",
            json={"version": workspace["version"], "position": {"x": 1, "y": 2}},
        )
        self.assertEqual(missing_workspace.status_code, 404)
        self.assertEqual(
            missing_workspace.get_json()["error"]["code"], "workspace_not_found"
        )

        unchanged = get_workspace(workspace_id)
        self.assertEqual(unchanged["version"], workspace["version"])
        self.assertIsNone(unchanged["sources"][0]["position"])

    def test_membership_conflicts_and_invalid_requests_leave_workspace_unchanged(self):
        orders = self._upload("orders.csv").get_json()
        customers = self._upload(
            "customers.csv", b"customer_id,name\n1,Ada\n"
        ).get_json()
        regions = self._upload(
            "regions.csv", b"region_id,region\n1,East\n"
        ).get_json()
        workspace_id = orders["workspace"]["workspace_id"]
        initial_version = orders["workspace"]["version"]

        invalid_role = self.client.post(
            f"/api/data-workspaces/{workspace_id}/sources",
            json={
                "source_id": customers["source"]["source_id"],
                "role": "primary",
                "version": initial_version,
            },
        )
        self.assertEqual(invalid_role.status_code, 400)
        self.assertEqual(invalid_role.get_json()["error"]["code"], "invalid_workspace_role")
        invalid_alias = self.client.post(
            f"/api/data-workspaces/{workspace_id}/sources",
            json={
                "source_id": customers["source"]["source_id"],
                "alias": 42,
                "role": "lookup",
                "version": initial_version,
            },
        )
        self.assertEqual(invalid_alias.status_code, 400)
        self.assertEqual(invalid_alias.get_json()["error"]["code"], "invalid_source_alias")

        attached = self.client.post(
            f"/api/data-workspaces/{workspace_id}/sources",
            json={
                "source_id": customers["source"]["source_id"],
                "alias": "customers",
                "role": "lookup",
                "version": initial_version,
            },
        )
        self.assertEqual(attached.status_code, 200)

        cases = [
            (
                {
                    "source_id": customers["source"]["source_id"],
                    "alias": "customers_again",
                    "role": "lookup",
                    "version": 2,
                },
                "duplicate_workspace_membership",
            ),
            (
                {
                    "source_id": regions["source"]["source_id"],
                    "alias": "customers",
                    "role": "context",
                    "version": 2,
                },
                "workspace_alias_conflict",
            ),
            (
                {
                    "source_id": regions["source"]["source_id"],
                    "alias": "regions",
                    "role": "context",
                    "version": 1,
                },
                "workspace_version_conflict",
            ),
        ]
        for payload, error_code in cases:
            with self.subTest(error_code=error_code):
                response = self.client.post(
                    f"/api/data-workspaces/{workspace_id}/sources", json=payload
                )
                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.get_json()["error"]["code"], error_code)

        missing_source = self.client.post(
            f"/api/data-workspaces/{workspace_id}/sources",
            json={"source_id": "src_missing", "version": 2},
        )
        self.assertEqual(missing_source.status_code, 404)
        self.assertEqual(missing_source.get_json()["error"]["code"], "source_not_found")
        missing_workspace = self.client.post(
            "/api/data-workspaces/ws_missing/sources",
            json={"source_id": regions["source"]["source_id"], "version": 1},
        )
        self.assertEqual(missing_workspace.status_code, 404)
        self.assertEqual(
            missing_workspace.get_json()["error"]["code"], "workspace_not_found"
        )

        unchanged = get_workspace(workspace_id)
        self.assertEqual(unchanged["version"], 2)
        self.assertEqual(unchanged["source_count"], 2)

    def test_upload_can_join_existing_workspace_without_selecting_new_source(self):
        orders = self._upload("orders.csv").get_json()
        workspace_id = orders["workspace"]["workspace_id"]

        response = self._upload(
            "customers.csv",
            b"customer_id,name\n1,Ada\n",
            workspace_id=workspace_id,
            workspace_version=str(orders["workspace"]["version"]),
            alias="customers",
            role="lookup",
        )

        self.assertEqual(response.status_code, 200, response.get_json())
        body = response.get_json()
        self.assertEqual(body["workspace"]["workspace_id"], workspace_id)
        self.assertEqual(body["workspace"]["version"], 2)
        self.assertEqual(body["workspace"]["source_count"], 2)
        self.assertEqual(
            body["analysis_context"]["source_ids"],
            [orders["source"]["source_id"]],
        )
        self.assertEqual(body["analysis_context"]["relationship_ids"], [])
        self.assertTrue(
            (self.managed_root / body["source"]["managed_locator"]["storage_key"]).is_file()
        )

    def test_failed_workspace_upload_removes_file_and_rolls_back_catalog(self):
        orders = self._upload("orders.csv").get_json()
        files_before = {path.name for path in self.managed_root.iterdir()}

        with patch(
            "backend.repositories.source_workspace_repository._insert_membership",
            side_effect=RuntimeError("forced membership write failure"),
        ), patch("backend.routes.upload.logger.exception"):
            response = self._upload(
                "customers.csv",
                b"customer_id,name\n1,Ada\n",
                workspace_id=orders["workspace"]["workspace_id"],
                workspace_version=str(orders["workspace"]["version"]),
                alias="customers",
                role="lookup",
            )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            {path.name for path in self.managed_root.iterdir()}, files_before
        )
        workspace = get_workspace(orders["workspace"]["workspace_id"])
        self.assertEqual(workspace["version"], 1)
        self.assertEqual(workspace["source_count"], 1)
        source_ids = [
            source["source_id"]
            for source in self.client.get("/api/data-sources").get_json()["sources"]
        ]
        self.assertEqual(source_ids, [orders["source"]["source_id"]])


if __name__ == "__main__":
    unittest.main()
