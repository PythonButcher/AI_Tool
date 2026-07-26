"""Focused acceptance coverage for bounded multi-source execution."""

from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from flask import Flask

from backend.db import backend_db
from backend.repositories.source_workspace_repository import get_workspace
from backend.routes.decision import decision_bp
from backend.routes.nlp_routes import nlp_bp
from backend.routes.source_relationships import source_relationships_bp
from backend.routes.upload import upload_bp
from backend.services import workspace_context
from backend.services.relationship_execution import (
    RelationshipExecutionError,
    _validate_graph,
    execute_analysis_context,
)
from backend.services.metric_resolver import MetricResolver


class RelationshipExecutionTests(unittest.TestCase):
    """Prove safe joins, lineage, bounds, and one-source compatibility."""

    def setUp(self):
        self.temp_dir = TemporaryDirectory()
        self.original_db_path = backend_db.DB_PATH
        self.original_upload_root = workspace_context.MANAGED_UPLOAD_ROOT
        backend_db.DB_PATH = str(Path(self.temp_dir.name) / "execution.db")
        backend_db._SCHEMA_READY = False
        workspace_context.MANAGED_UPLOAD_ROOT = Path(self.temp_dir.name) / "managed"
        app = Flask(__name__)
        app.register_blueprint(upload_bp)
        app.register_blueprint(source_relationships_bp)
        app.register_blueprint(decision_bp)
        app.register_blueprint(nlp_bp)
        self.client = app.test_client()

    def tearDown(self):
        backend_db.DB_PATH = self.original_db_path
        backend_db._SCHEMA_READY = False
        workspace_context.MANAGED_UPLOAD_ROOT = self.original_upload_root
        self.temp_dir.cleanup()

    def _upload(self, name: str, body: bytes):
        """Create one governed catalog source through the public upload path."""
        response = self.client.post(
            "/api/upload",
            data={"file": (BytesIO(body), name)},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()

    def _workspace(self, fixtures):
        """Attach fixture sources to the first workspace for execution tests."""
        uploads = [self._upload(name, body) for name, body in fixtures]
        workspace_id = uploads[0]["workspace"]["workspace_id"]
        connection = backend_db.get_db_connection()
        for index, upload in enumerate(uploads[1:], start=2):
            connection.execute(
                """
                INSERT INTO workspace_sources (
                    workspace_id, source_id, alias, role, position_json, added_at
                ) VALUES (?, ?, ?, 'lookup', NULL, '2026-07-22T00:00:00Z')
                """,
                (workspace_id, upload["source"]["source_id"], f"source_{index}"),
            )
            connection.execute(
                "UPDATE data_workspaces SET version = version + 1 WHERE workspace_id = ?",
                (workspace_id,),
            )
        connection.commit()
        connection.close()
        return workspace_id, [item["source"]["source_id"] for item in uploads]

    def _activate(self, workspace_id: str, left_id: str, right_id: str, **overrides):
        """Create, freshly validate, confirm, and activate one explicit edge."""
        payload = {
            "left_source_id": left_id,
            "right_source_id": right_id,
            "field_pairs": [{"left_field": "id", "right_field": "id"}],
            "cardinality": "one_to_one",
            "join_behavior": "left",
            "filter_direction": "left_to_right",
            **overrides,
        }
        created_response = self.client.post(
            f"/api/data-workspaces/{workspace_id}/relationships", json=payload
        )
        self.assertEqual(created_response.status_code, 201, created_response.get_json())
        created = created_response.get_json()["relationship"]
        validated_response = self.client.post(
            f"/api/data-workspaces/{workspace_id}/relationships/{created['relationship_id']}/validate"
        )
        self.assertEqual(validated_response.status_code, 200, validated_response.get_json())
        validated = validated_response.get_json()["relationship"]
        activated_response = self.client.patch(
            f"/api/data-workspaces/{workspace_id}/relationships/{created['relationship_id']}",
            json={"version": validated["version"], "is_confirmed": True, "is_active": True},
        )
        self.assertEqual(activated_response.status_code, 200, activated_response.get_json())
        return activated_response.get_json()["relationship"]

    def _context(self, workspace_id: str, source_ids, relationship_ids):
        """Build an exact current-version analysis identity."""
        workspace = get_workspace(workspace_id)
        return {
            "workspace_id": workspace_id,
            "workspace_version": workspace["version"],
            "primary_source_id": workspace["primary_source_id"],
            "source_ids": list(source_ids),
            "relationship_ids": list(relationship_ids),
        }

    def test_direct_join_namespaces_fields_and_returns_complete_lineage(self):
        workspace_id, source_ids = self._workspace([
            ("orders.csv", b"id,revenue\n1,10\n2,20\n3,30\n"),
            ("customers.csv", b"id,region\n1,East\n2,West\n"),
        ])
        relationship = self._activate(workspace_id, *source_ids)
        bundle = execute_analysis_context(
            self._context(workspace_id, source_ids, [relationship["relationship_id"]])
        )

        self.assertEqual(
            list(bundle["dataframe"].columns),
            ["orders.id", "orders.revenue", "source_2.id", "source_2.region"],
        )
        self.assertEqual(len(bundle["dataframe"]), 3)
        lineage = bundle["analysis_lineage"]
        self.assertEqual(lineage["relationship_ids"], [relationship["relationship_id"]])
        self.assertEqual(lineage["relationships"][0]["version"], relationship["version"])
        self.assertEqual(lineage["join_order"][0]["unmatched_keys"]["left_unmatched_key_count"], 1)
        self.assertEqual(lineage["field_origins"]["source_2.region"]["source_id"], source_ids[1])
        self.assertEqual(lineage["observed_fanout"]["row_expansion_ratio"], 1.0)
        self.assertTrue(
            any(item["field"] == "source_2.region" for item in bundle["semantic_model"]["dimensions"])
        )
        metric = next(item for item in bundle["semantic_model"]["metrics"] if item["field"] == "orders.revenue")
        resolved = MetricResolver.resolve(
            metric_id=metric["id"],
            dataset=bundle["dataframe"].to_dict(orient="records"),
            semantic_model=bundle["semantic_model"],
            group_by=["source_2.region"],
        )
        self.assertEqual(
            [row["group"]["source_2.region"] for row in resolved["rows"]],
            ["East", "West", None],
        )

    def test_composite_multi_hop_join_uses_selected_source_order(self):
        workspace_id, source_ids = self._workspace([
            ("orders.csv", b"tenant,id,total\nA,1,10\nA,2,20\n"),
            ("items.csv", b"tenant,id,sku\nA,1,X\nA,2,Y\n"),
            ("products.csv", b"sku,category\nX,One\nY,Two\n"),
        ])
        first = self._activate(
            workspace_id,
            source_ids[0],
            source_ids[1],
            field_pairs=[
                {"left_field": "tenant", "right_field": "tenant"},
                {"left_field": "id", "right_field": "id"},
            ],
        )
        second = self._activate(
            workspace_id,
            source_ids[1],
            source_ids[2],
            field_pairs=[{"left_field": "sku", "right_field": "sku"}],
        )
        bundle = execute_analysis_context(
            self._context(
                workspace_id,
                source_ids,
                [second["relationship_id"], first["relationship_id"]],
            )
        )
        self.assertEqual(
            [item["relationship_id"] for item in bundle["analysis_lineage"]["join_order"]],
            [first["relationship_id"], second["relationship_id"]],
        )
        self.assertEqual(bundle["dataframe"]["source_3.category"].tolist(), ["One", "Two"])

    def test_stale_workspace_and_source_relationship_are_refused(self):
        workspace_id, source_ids = self._workspace([
            ("a.csv", b"id,value\n1,a\n"),
            ("b.csv", b"id,value\n1,b\n"),
        ])
        relationship = self._activate(workspace_id, *source_ids)
        stale_context = self._context(workspace_id, source_ids, [relationship["relationship_id"]])
        connection = backend_db.get_db_connection()
        connection.execute(
            "UPDATE data_workspaces SET version = version + 1 WHERE workspace_id = ?", (workspace_id,)
        )
        connection.commit()
        connection.close()
        with self.assertRaisesRegex(RelationshipExecutionError, "stale") as workspace_error:
            execute_analysis_context(stale_context)
        self.assertEqual(workspace_error.exception.code, "workspace_version_stale")

        current_context = self._context(workspace_id, source_ids, [relationship["relationship_id"]])
        connection = backend_db.get_db_connection()
        connection.execute(
            "UPDATE datahub_datasets SET content_fingerprint = 'sha256:changed' WHERE id = ?",
            (source_ids[1],),
        )
        connection.commit()
        connection.close()
        with self.assertRaises(RelationshipExecutionError) as relationship_error:
            execute_analysis_context(current_context)
        self.assertEqual(relationship_error.exception.code, "relationship_not_freshly_valid")

    def test_cross_workspace_and_missing_relationship_ids_are_hidden(self):
        first_workspace, first_sources = self._workspace([
            ("first_a.csv", b"id,value\n1,a\n"),
            ("first_b.csv", b"id,value\n1,b\n"),
        ])
        foreign_relationship = self._activate(first_workspace, *first_sources)
        second_workspace, second_sources = self._workspace([
            ("second_a.csv", b"id,value\n1,a\n"),
            ("second_b.csv", b"id,value\n1,b\n"),
        ])
        for relationship_id in (foreign_relationship["relationship_id"], "rel_missing"):
            with self.assertRaises(RelationshipExecutionError) as hidden:
                execute_analysis_context(
                    self._context(second_workspace, second_sources, [relationship_id])
                )
            self.assertEqual(hidden.exception.code, "relationship_not_found")

    def test_many_to_many_and_row_expansion_are_refused(self):
        workspace_id, source_ids = self._workspace([
            ("primary.csv", b"id,value\n1,a\n"),
            ("detail.csv", b"id,item\n1,a\n1,b\n1,c\n1,d\n1,e\n1,f\n"),
        ])
        relationship = self._activate(
            workspace_id, *source_ids, cardinality="one_to_many"
        )
        with self.assertRaises(RelationshipExecutionError) as expansion_error:
            execute_analysis_context(
                self._context(workspace_id, source_ids, [relationship["relationship_id"]])
            )
        self.assertEqual(expansion_error.exception.code, "row_expansion_limit_exceeded")

        created = self.client.post(
            f"/api/data-workspaces/{workspace_id}/relationships",
            json={
                "left_source_id": source_ids[0],
                "right_source_id": source_ids[1],
                "field_pairs": [{"left_field": "id", "right_field": "id"}],
                "cardinality": "many_to_many",
                "join_behavior": "left",
                "filter_direction": "both",
            },
        ).get_json()["relationship"]
        with self.assertRaises(RelationshipExecutionError) as many_error:
            execute_analysis_context(
                self._context(workspace_id, source_ids, [created["relationship_id"]])
            )
        self.assertEqual(many_error.exception.code, "many_to_many_execution_unsupported")

    def test_compiler_refuses_ambiguous_and_cyclic_selected_graphs(self):
        """Selected IDs cannot encode parallel choices or a cycle."""
        relationships = [
            {"relationship_id": "rel_ab", "left_source_id": "a", "right_source_id": "b"},
            {"relationship_id": "rel_bc", "left_source_id": "b", "right_source_id": "c"},
            {"relationship_id": "rel_ac", "left_source_id": "a", "right_source_id": "c"},
        ]
        with self.assertRaises(RelationshipExecutionError) as ambiguous:
            _validate_graph(["a", "b", "c"], relationships, "a")
        self.assertEqual(ambiguous.exception.code, "ambiguous_relationship_path")

        parallel = [
            {"relationship_id": "rel_ab_1", "left_source_id": "a", "right_source_id": "b"},
            {"relationship_id": "rel_ab_2", "left_source_id": "a", "right_source_id": "b"},
        ]
        with self.assertRaises(RelationshipExecutionError) as cyclic:
            _validate_graph(["a", "b", "c"], parallel, "a")
        self.assertEqual(cyclic.exception.code, "cyclic_relationship_path")

    def test_one_source_context_keeps_original_fields_and_model(self):
        upload = self._upload("sales.csv", b"region,revenue\nEast,10\n")
        workspace_id = upload["workspace"]["workspace_id"]
        source_id = upload["source"]["source_id"]
        bundle = execute_analysis_context(self._context(workspace_id, [source_id], []))
        self.assertEqual(list(bundle["dataframe"].columns), ["region", "revenue"])
        self.assertIsNone(bundle["analysis_lineage"])
        self.assertEqual(bundle["dataset_ref"]["dataset_id"], source_id)

    def test_default_source_governance_warnings_do_not_become_blocks(self):
        workspace_id, source_ids = self._workspace([
            ("orders.csv", b"id,note\n1,\n2,ok\n3,\n"),
            ("lookup.csv", b"id,label\n1,A\n2,B\n3,C\n"),
        ])
        relationship = self._activate(workspace_id, *source_ids)
        bundle = execute_analysis_context(
            self._context(workspace_id, source_ids, [relationship["relationship_id"]])
        )
        self.assertEqual(bundle["governance_readiness"]["status"], "warning")
        primary_readiness = bundle["governance_readiness"]["sources"][0]["readiness"]
        self.assertEqual(primary_readiness["status"], "warning")
        self.assertFalse(primary_readiness["policy"]["null_thresholds"]["configured"])

    def test_decision_chat_chart_and_refinement_retain_verified_context(self):
        workspace_id, source_ids = self._workspace([
            ("orders.csv", b"id,revenue\n1,12345.67\n2,23456.78\n"),
            ("customers.csv", b"id,region\n1,East\n2,West\n"),
        ])
        relationship = self._activate(workspace_id, *source_ids)
        analysis_context = self._context(
            workspace_id, source_ids, [relationship["relationship_id"]]
        )
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "user_message": "Show orders.Revenue by source_2.Region as a chart",
                "analysis_context": analysis_context,
            },
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        body = response.get_json()
        self.assertEqual(
            {key: body["analysis_context"][key] for key in analysis_context}, analysis_context
        )
        self.assertEqual(body["analysis_context"]["contract_version"], "multi_source_workspace_v1")
        self.assertEqual(body["analysis_lineage"]["relationship_ids"], [relationship["relationship_id"]])
        self.assertIn("chart", [item["type"] for item in body["artifacts"]], body)
        chart = next(item for item in body["artifacts"] if item["type"] == "chart")
        self.assertEqual(chart["analysis_lineage"], body["analysis_lineage"])
        self.assertEqual(chart["bi_grounding"]["analysis_lineage"], body["analysis_lineage"])

        refinement = self.client.post(
            "/api/decision/chat/turns",
            json={
                "user_message": "Show the same result as an answer",
                "analytics_refinement": {
                    "operation": "set_output",
                    "arguments": {"output": "answer"},
                },
                "session_state": body["session_state"],
            },
        )
        self.assertEqual(refinement.status_code, 200, refinement.get_json())
        refined_body = refinement.get_json()
        self.assertEqual(
            {key: refined_body["analysis_context"][key] for key in analysis_context}, analysis_context
        )
        self.assertEqual(refined_body["analysis_lineage"], body["analysis_lineage"])

    def test_nlp_chart_returns_relationship_lineage_in_chart_meta(self):
        workspace_id, source_ids = self._workspace([
            ("orders.csv", b"id,revenue\n1,12345.67\n2,23456.78\n"),
            ("customers.csv", b"id,region\n1,East\n2,West\n"),
        ])
        relationship = self._activate(workspace_id, *source_ids)
        response = self.client.post(
            "/api/nlp/chart",
            json={
                "query": "Chart: Bar; Value: orders.revenue; Dimension: source_2.region",
                "analysis_context": self._context(
                    workspace_id, source_ids, [relationship["relationship_id"]]
                ),
            },
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        body = response.get_json()
        self.assertEqual(body["analysis_lineage"]["relationship_ids"], [relationship["relationship_id"]])
        self.assertEqual(
            body["chartData"]["meta"]["analysis_lineage"], body["analysis_lineage"]
        )


if __name__ == "__main__":
    unittest.main()
