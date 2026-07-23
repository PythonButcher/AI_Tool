"""Focused acceptance coverage for relationship persistence and trust."""

from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from flask import Flask

from backend.db import backend_db
from backend.routes.source_relationships import source_relationships_bp
from backend.routes.upload import upload_bp
from backend.services import workspace_context


class SourceRelationshipTests(unittest.TestCase):
    """Exercise the public contract without enabling any joined execution."""

    def setUp(self):
        self.temp_dir = TemporaryDirectory()
        self.original_db_path = backend_db.DB_PATH
        self.original_upload_root = workspace_context.MANAGED_UPLOAD_ROOT
        self.db_path = Path(self.temp_dir.name) / "relationships.db"
        backend_db.DB_PATH = str(self.db_path)
        backend_db._SCHEMA_READY = False
        workspace_context.MANAGED_UPLOAD_ROOT = Path(self.temp_dir.name) / "managed"

        app = Flask(__name__)
        app.register_blueprint(upload_bp)
        app.register_blueprint(source_relationships_bp)
        self.client = app.test_client()

    def tearDown(self):
        backend_db.DB_PATH = self.original_db_path
        backend_db._SCHEMA_READY = False
        workspace_context.MANAGED_UPLOAD_ROOT = self.original_upload_root
        self.temp_dir.cleanup()

    def _upload(self, filename: str, body: bytes):
        """Register a governed source through the compatibility-safe upload path."""
        response = self.client.post(
            "/api/upload",
            data={"file": (BytesIO(body), filename)},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()

    def _add_member(self, workspace_id: str, source_id: str, alias: str):
        """Attach fixture sources because membership mutation is outside this gate."""
        connection = backend_db.get_db_connection()
        connection.execute(
            """
            INSERT INTO workspace_sources (
                workspace_id, source_id, alias, role, position_json, added_at
            ) VALUES (?, ?, ?, 'lookup', NULL, '2026-07-22T00:00:00Z')
            """,
            (workspace_id, source_id, alias),
        )
        connection.execute(
            "UPDATE data_workspaces SET version = version + 1 WHERE workspace_id = ?",
            (workspace_id,),
        )
        connection.commit()
        connection.close()

    def _workspace(self, sources):
        """Create several durable sources and place them in the first workspace."""
        uploads = [self._upload(name, body) for name, body in sources]
        workspace_id = uploads[0]["workspace"]["workspace_id"]
        for index, upload in enumerate(uploads[1:], start=2):
            self._add_member(workspace_id, upload["source"]["source_id"], f"source_{index}")
        return workspace_id, [upload["source"]["source_id"] for upload in uploads]

    def _create(self, workspace_id: str, left_id: str, right_id: str, **overrides):
        """Create a relationship with concise valid defaults."""
        payload = {
            "left_source_id": left_id,
            "right_source_id": right_id,
            "field_pairs": [{"left_field": "id", "right_field": "id"}],
            "cardinality": "one_to_one",
            "join_behavior": "left",
            "filter_direction": "left_to_right",
            **overrides,
        }
        return self.client.post(
            f"/api/data-workspaces/{workspace_id}/relationships", json=payload
        )

    def _validate(self, workspace_id: str, relationship_id: str):
        """Request a fresh aggregate profile for one stored relationship."""
        return self.client.post(
            f"/api/data-workspaces/{workspace_id}/relationships/{relationship_id}/validate"
        )

    def test_schema_and_one_to_one_crud_are_restart_safe_and_versioned(self):
        workspace_id, source_ids = self._workspace(
            [
                ("orders.csv", b"id,amount\n1,10\n2,20\n"),
                ("customers.csv", b"id,name\n1,Ada\n2,Lin\n"),
            ]
        )
        created_response = self._create(workspace_id, *source_ids)
        self.assertEqual(created_response.status_code, 201, created_response.get_json())
        created = created_response.get_json()["relationship"]
        connection = backend_db.get_db_connection()
        relationship_columns = {
            row["name"]
            for row in connection.execute(
                "PRAGMA table_info(workspace_relationships)"
            ).fetchall()
        }
        connection.close()
        self.assertTrue(
            {
                "relationship_id", "workspace_id", "field_pairs_json",
                "diagnostics_json", "source_fingerprints_json", "version",
            }.issubset(relationship_columns)
        )
        self.assertTrue(created["relationship_id"].startswith("rel_"))
        self.assertEqual(created["validation_state"], "unvalidated")
        self.assertFalse(created["is_active"])

        validated = self._validate(workspace_id, created["relationship_id"]).get_json()["relationship"]
        self.assertEqual(validated["validation_state"], "valid")
        self.assertGreater(validated["version"], created["version"])
        self.assertIsNotNone(validated["validated_at"])
        self.assertEqual(set(validated["source_fingerprints"]), {"left", "right"})

        activated_response = self.client.patch(
            f"/api/data-workspaces/{workspace_id}/relationships/{created['relationship_id']}",
            json={"version": validated["version"], "is_confirmed": True, "is_active": True},
        )
        self.assertEqual(activated_response.status_code, 200, activated_response.get_json())
        activated = activated_response.get_json()["relationship"]
        self.assertTrue(activated["is_confirmed"])
        self.assertTrue(activated["is_active"])

        # Simulate process restart and prove SQLite, not module state, is authoritative.
        backend_db._SCHEMA_READY = False
        retrieved = self.client.get(
            f"/api/data-workspaces/{workspace_id}/relationships/{created['relationship_id']}"
        ).get_json()["relationship"]
        self.assertEqual(retrieved["relationship_id"], created["relationship_id"])
        self.assertTrue(retrieved["is_active"])

        deleted = self.client.delete(
            f"/api/data-workspaces/{workspace_id}/relationships/{created['relationship_id']}"
        )
        self.assertEqual(deleted.status_code, 204)

    def test_one_to_many_and_composite_keys_validate_from_observed_uniqueness(self):
        workspace_id, source_ids = self._workspace(
            [
                ("accounts.csv", b"tenant,id\nA,1\nA,2\nB,1\n"),
                ("events.csv", b"tenant,id,event\nA,1,x\nA,1,y\nA,2,z\nB,1,q\n"),
            ]
        )
        response = self._create(
            workspace_id,
            *source_ids,
            field_pairs=[
                {"left_field": "tenant", "right_field": "tenant"},
                {"left_field": "id", "right_field": "id"},
            ],
            cardinality="one_to_many",
        )
        relationship = response.get_json()["relationship"]
        validated = self._validate(workspace_id, relationship["relationship_id"]).get_json()["relationship"]
        self.assertEqual(validated["validation_state"], "valid")
        profile = next(item for item in validated["diagnostics"] if item["code"] == "relationship_key_profile")
        self.assertTrue(profile["evidence"]["left_unique"])
        self.assertFalse(profile["evidence"]["right_unique"])

    def test_missing_fields_and_type_mismatch_are_deterministically_invalid(self):
        workspace_id, source_ids = self._workspace(
            [
                ("numeric.csv", b"id,value\n1,10\n2,20\n"),
                ("labels.csv", b"id,label\na,A\nb,B\n"),
            ]
        )
        missing = self._create(
            workspace_id,
            *source_ids,
            field_pairs=[{"left_field": "missing", "right_field": "id"}],
        ).get_json()["relationship"]
        missing_result = self._validate(workspace_id, missing["relationship_id"]).get_json()["relationship"]
        self.assertEqual(missing_result["validation_state"], "invalid")
        self.assertEqual(missing_result["diagnostics"][0]["code"], "relationship_field_missing")

        mismatch = self._create(workspace_id, *source_ids).get_json()["relationship"]
        mismatch_result = self._validate(workspace_id, mismatch["relationship_id"]).get_json()["relationship"]
        self.assertEqual(mismatch_result["validation_state"], "invalid")
        self.assertEqual(mismatch_result["diagnostics"][0]["code"], "relationship_type_mismatch")

    def test_invalid_membership_is_rejected_without_storing_a_relationship(self):
        first = self._upload("first.csv", b"id,value\n1,a\n")
        second = self._upload("second.csv", b"id,value\n1,b\n")
        workspace_id = first["workspace"]["workspace_id"]
        response = self._create(
            workspace_id,
            first["source"]["source_id"],
            second["source"]["source_id"],
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["error"]["code"], "source_not_in_workspace")
        listing = self.client.get(
            f"/api/data-workspaces/{workspace_id}/relationships"
        ).get_json()["relationships"]
        self.assertEqual(listing, [])

    def test_unmatched_null_and_row_multiplication_evidence_is_explainable(self):
        workspace_id, source_ids = self._workspace(
            [
                ("left.csv", b"id,value\n1,a\n1,b\n1,c\n1,d\n2,e\n,f\n"),
                ("right.csv", b"id,value\n1,a\n1,b\n1,c\n1,d\n3,e\n"),
            ]
        )
        relationship = self._create(
            workspace_id, *source_ids, cardinality="many_to_many"
        ).get_json()["relationship"]
        validated = self._validate(workspace_id, relationship["relationship_id"]).get_json()["relationship"]
        codes = {item["code"] for item in validated["diagnostics"]}
        self.assertEqual(validated["validation_state"], "blocked")
        self.assertIn("relationship_unmatched_keys", codes)
        self.assertIn("estimated_row_multiplication", codes)
        self.assertIn("many_to_many_execution_unsupported", codes)

    def test_cycle_and_ambiguous_active_path_block_activation(self):
        workspace_id, source_ids = self._workspace(
            [
                ("a.csv", b"id,value\n1,a\n2,b\n"),
                ("b.csv", b"id,value\n1,a\n2,b\n"),
                ("c.csv", b"id,value\n1,a\n2,b\n"),
            ]
        )
        for left_id, right_id in ((source_ids[0], source_ids[1]), (source_ids[1], source_ids[2])):
            relationship = self._create(workspace_id, left_id, right_id).get_json()["relationship"]
            validated = self._validate(workspace_id, relationship["relationship_id"]).get_json()["relationship"]
            activated = self.client.patch(
                f"/api/data-workspaces/{workspace_id}/relationships/{relationship['relationship_id']}",
                json={"version": validated["version"], "is_confirmed": True, "is_active": True},
            )
            self.assertEqual(activated.status_code, 200, activated.get_json())

        closing = self._create(
            workspace_id, source_ids[0], source_ids[2]
        ).get_json()["relationship"]
        validated = self._validate(workspace_id, closing["relationship_id"]).get_json()["relationship"]
        codes = {item["code"] for item in validated["diagnostics"]}
        self.assertEqual(validated["validation_state"], "blocked")
        self.assertIn("relationship_cycle", codes)
        self.assertIn("ambiguous_active_path", codes)

    def test_source_fingerprint_and_schema_changes_mark_validation_stale(self):
        workspace_id, source_ids = self._workspace(
            [("left.csv", b"id,value\n1,a\n"), ("right.csv", b"id,value\n1,b\n")]
        )
        relationship = self._create(workspace_id, *source_ids).get_json()["relationship"]
        validated = self._validate(workspace_id, relationship["relationship_id"]).get_json()["relationship"]
        self.assertEqual(validated["validation_state"], "valid")

        connection = backend_db.get_db_connection()
        connection.execute(
            """
            UPDATE datahub_datasets
            SET content_fingerprint = 'sha256:changed', schema_version = schema_version + 1
            WHERE id = ?
            """,
            (source_ids[1],),
        )
        connection.commit()
        connection.close()

        stale = self.client.get(
            f"/api/data-workspaces/{workspace_id}/relationships/{relationship['relationship_id']}"
        ).get_json()["relationship"]
        self.assertEqual(stale["validation_state"], "stale")
        self.assertFalse(stale["is_active"])
        self.assertEqual(stale["diagnostics"][0]["code"], "relationship_source_stale")

    def test_workspace_isolation_hides_relationship_identity(self):
        first_workspace, first_sources = self._workspace(
            [("a.csv", b"id,value\n1,a\n"), ("b.csv", b"id,value\n1,b\n")]
        )
        second = self._upload("c.csv", b"id,value\n1,c\n")
        relationship = self._create(first_workspace, *first_sources).get_json()["relationship"]
        response = self.client.get(
            f"/api/data-workspaces/{second['workspace']['workspace_id']}/relationships/{relationship['relationship_id']}"
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["error"]["code"], "relationship_not_found")

    def test_candidates_are_evidence_backed_and_never_implicitly_active(self):
        workspace_id, _ = self._workspace(
            [
                ("orders.csv", b"customer_id,amount\n1,10\n2,20\n"),
                ("customers.csv", b"customer_id,name\n1,Ada\n2,Lin\n"),
            ]
        )
        response = self.client.post(
            f"/api/data-workspaces/{workspace_id}/relationship-candidates"
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        candidates = response.get_json()["candidates"]
        self.assertEqual(len(candidates), 1)
        self.assertFalse(candidates[0]["is_active"])
        self.assertFalse(candidates[0]["is_confirmed"])
        self.assertTrue(candidates[0]["confirmation_required"])
        self.assertIn("do not prove", candidates[0]["explanation"])


if __name__ == "__main__":
    unittest.main()
