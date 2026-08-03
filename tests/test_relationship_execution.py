"""Focused acceptance coverage for bounded multi-source execution."""

from io import BytesIO
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from flask import Flask

from backend.db import backend_db
from backend.decision_engine.chat_service import DecisionChatService
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
    resolve_active_model_analysis_context,
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
        resolved_context = resolve_active_model_analysis_context(workspace_id)
        expected_source_ids = [
            membership["source_id"]
            for membership in get_workspace(workspace_id)["sources"]
        ]
        self.assertEqual(resolved_context["source_ids"], expected_source_ids)
        self.assertEqual(
            resolved_context["relationship_ids"],
            [first["relationship_id"], second["relationship_id"]],
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

    def test_large_join_estimate_is_refused_before_materializing_merge(self):
        """Validation evidence must enforce the hard row ceiling pre-merge."""
        workspace_id, source_ids = self._workspace([
            ("primary.csv", b"id,value\n1,a\n2,b\n"),
            ("lookup.csv", b"id,label\n1,A\n2,B\n"),
        ])
        relationship = self._activate(workspace_id, *source_ids)
        diagnostics = list(relationship["diagnostics"])
        profile = next(
            diagnostic
            for diagnostic in diagnostics
            if diagnostic["code"] == "relationship_key_profile"
        )
        profile["evidence"]["estimated_join_rows"] = 300_000
        connection = backend_db.get_db_connection()
        connection.execute(
            """
            UPDATE workspace_relationships
            SET diagnostics_json = ?
            WHERE relationship_id = ?
            """,
            (json.dumps(diagnostics), relationship["relationship_id"]),
        )
        connection.commit()
        connection.close()

        with patch(
            "pandas.DataFrame.merge",
            side_effect=AssertionError("merge must not execute after failed preflight"),
        ):
            with self.assertRaises(RelationshipExecutionError) as error:
                execute_analysis_context(
                    self._context(
                        workspace_id,
                        source_ids,
                        [relationship["relationship_id"]],
                    )
                )

        self.assertEqual(error.exception.code, "row_expansion_limit_exceeded")
        self.assertTrue(error.exception.diagnostics[0]["preflight"])
        self.assertEqual(error.exception.diagnostics[0]["estimated_rows"], 300_000)

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

    def test_active_model_resolver_ignores_inactive_relationship_drafts(self):
        workspace_id, source_ids = self._workspace([
            ("orders.csv", b"id,revenue\n1,10\n"),
            ("customers.csv", b"id,region\n1,East\n"),
        ])
        created = self.client.post(
            f"/api/data-workspaces/{workspace_id}/relationships",
            json={
                "left_source_id": source_ids[0],
                "right_source_id": source_ids[1],
                "field_pairs": [{"left_field": "id", "right_field": "id"}],
                "cardinality": "one_to_one",
                "join_behavior": "left",
                "filter_direction": "left_to_right",
            },
        )
        self.assertEqual(created.status_code, 201, created.get_json())

        resolved = resolve_active_model_analysis_context(workspace_id)

        self.assertEqual(resolved["source_ids"], [source_ids[0]])
        self.assertEqual(resolved["relationship_ids"], [])

    def test_active_model_resolver_refuses_stale_and_disconnected_graphs(self):
        stale_workspace_id, stale_source_ids = self._workspace([
            ("stale_orders.csv", b"id,revenue\n1,10\n"),
            ("stale_customers.csv", b"id,region\n1,East\n"),
        ])
        self._activate(stale_workspace_id, *stale_source_ids)
        connection = backend_db.get_db_connection()
        connection.execute(
            "UPDATE datahub_datasets SET content_fingerprint = 'sha256:changed' WHERE id = ?",
            (stale_source_ids[1],),
        )
        connection.commit()
        connection.close()
        with self.assertRaises(RelationshipExecutionError) as stale_error:
            resolve_active_model_analysis_context(stale_workspace_id)
        self.assertEqual(stale_error.exception.code, "active_data_model_stale")
        self.assertIn("Data Model", str(stale_error.exception))

        disconnected_workspace_id, disconnected_source_ids = self._workspace([
            ("primary.csv", b"id,value\n1,A\n"),
            ("lookup_a.csv", b"id,label\n1,A\n"),
            ("lookup_b.csv", b"id,label\n1,B\n"),
        ])
        self._activate(
            disconnected_workspace_id,
            disconnected_source_ids[1],
            disconnected_source_ids[2],
        )
        with self.assertRaises(RelationshipExecutionError) as disconnected_error:
            resolve_active_model_analysis_context(disconnected_workspace_id)
        self.assertEqual(
            disconnected_error.exception.code,
            "active_data_model_disconnected",
        )
        self.assertIn("Data Model", str(disconnected_error.exception))

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

    def test_decision_chat_resolves_active_model_and_retains_it_for_refinement(self):
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
                "workspace_id": workspace_id,
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

    def test_cross_source_revenue_by_category_uses_business_semantics_and_all_groups(self):
        """A natural question must resolve governed fields without alias-derived filters."""
        workspace_id, source_ids = self._workspace([
            (
                "sales_transactions_5000.csv",
                b"TransactionID,ProductID,Quantity,UnitPrice,TotalAmount\n"
                b"TXN-000001,PROD-001,2,60,120\n"
                b"TXN-000002,PROD-002,1,80,80\n"
                b"TXN-000003,PROD-001,1,60,60\n"
                b"TXN-000004,PROD-003,3,20,60\n",
            ),
            (
                "hardware_inventory_5000.csv",
                b"ProductID,Category\n"
                b"PROD-001,Hardware\n"
                b"PROD-002,Office\n"
                b"PROD-003,Accessories\n",
            ),
        ])
        connection = backend_db.get_db_connection()
        connection.execute(
            "UPDATE workspace_sources SET alias = ? WHERE workspace_id = ? AND source_id = ?",
            ("sales_transactions_5000_csv", workspace_id, source_ids[0]),
        )
        connection.execute(
            "UPDATE workspace_sources SET alias = ? WHERE workspace_id = ? AND source_id = ?",
            ("hardware_inventory_5000_csv", workspace_id, source_ids[1]),
        )
        connection.commit()
        connection.close()
        self._activate(
            workspace_id,
            source_ids[0],
            source_ids[1],
            field_pairs=[{"left_field": "ProductID", "right_field": "ProductID"}],
            cardinality="many_to_one",
        )

        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "workspace_id": workspace_id,
                "user_message": (
                    "Which inventory categories generated the most total sales revenue? "
                    "Show total revenue by category as a bar chart."
                ),
            },
        )

        self.assertEqual(response.status_code, 200, response.get_json())
        body = response.get_json()
        chart = next(item for item in body["artifacts"] if item["type"] == "chart")
        content = chart["content"]
        self.assertEqual(
            content["fieldsUsed"]["value"],
            "sales_transactions_5000_csv.TotalAmount",
        )
        self.assertEqual(
            content["fieldsUsed"]["category"],
            "hardware_inventory_5000_csv.Category",
        )
        self.assertEqual(content["filtersApplied"], [])
        self.assertEqual(
            content["chartData"]["labels"],
            ["Hardware", "Office", "Accessories"],
        )
        self.assertEqual(content["chartData"]["datasets"][0]["data"], [180, 80, 60])
        self.assertEqual(content["chartData"]["datasets"][0]["label"], "Total Sales Revenue")
        self.assertEqual(
            content["chartData"]["meta"]["axisLabels"],
            {
                "x": "Inventory Category",
                "y": "Total Sales Revenue",
            },
        )
        self.assertEqual(chart["title"], "Total Sales Revenue chart")
        self.assertIn("Total Sales Revenue", body["assistant_message"])
        self.assertIn("Hardware", body["assistant_message"])
        self.assertNotIn("hardware_inventory_5000_csv", body["assistant_message"])
        self.assertEqual(
            body["session_state"]["last_analytic_context"]["source"],
            "semantic_metric",
        )
        self.assertEqual(
            content["result_context"]["metric"]["label"],
            "Total Sales Revenue",
        )
        self.assertEqual(
            content["result_context"]["group_by"][0]["label"],
            "Inventory Category",
        )

        filtered_response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "workspace_id": workspace_id,
                "user_message": (
                    "Show total sales revenue by inventory category for "
                    "Hardware as a bar chart."
                ),
            },
        )
        self.assertEqual(
            filtered_response.status_code,
            200,
            filtered_response.get_json(),
        )
        filtered_chart = next(
            item
            for item in filtered_response.get_json()["artifacts"]
            if item["type"] == "chart"
        )
        filtered_content = filtered_chart["content"]
        self.assertEqual(filtered_content["chartData"]["labels"], ["Hardware"])
        self.assertEqual(
            filtered_content["filtersApplied"],
            [{
                "field": "hardware_inventory_5000_csv.Category",
                "dimension_id": "hardware_inventory_5000_csv.dimension_category",
                "label": "Inventory Category",
                "operator": "eq",
                "value": "Hardware",
                "values": None,
            }],
        )
        self.assertEqual(
            filtered_content["chartSpec"]["slicers"][0]["label"],
            "Inventory Category",
        )

    def test_qualified_field_reference_does_not_create_a_value_filter(self):
        """A value inside a technical namespace is not explicit filter evidence."""
        dataset = [
            {
                "hardware_inventory_5000_csv.Category": "Hardware",
                "sales_transactions_5000_csv.TotalAmount": 120,
            },
            {
                "hardware_inventory_5000_csv.Category": "Office",
                "sales_transactions_5000_csv.TotalAmount": 80,
            },
        ]
        semantic_model = {
            "dimensions": [
                {
                    "id": "hardware_inventory_5000_csv.dimension_category",
                    "field": "hardware_inventory_5000_csv.Category",
                    "name": "hardware_inventory_5000_csv.Category",
                    "label": "Inventory Category",
                }
            ]
        }

        implicit = DecisionChatService._build_semantic_filters(
            user_message="Group by hardware_inventory_5000_csv.Category",
            dataset=dataset,
            semantic_model=semantic_model,
            analytic_state={},
        )
        explicit = DecisionChatService._build_semantic_filters(
            user_message="Show only Category = Hardware",
            dataset=dataset,
            semantic_model=semantic_model,
            analytic_state={},
        )

        self.assertEqual(implicit, [])
        self.assertEqual(
            explicit,
            [
                {
                    "field": "hardware_inventory_5000_csv.Category",
                    "operator": "eq",
                    "value": "Hardware",
                    "values": None,
                }
            ],
        )

    def test_nlp_chart_route_returns_grounded_error_for_text_measure(self):
        """The public chart boundary must not turn an empty series into success."""
        response = self.client.post(
            "/api/nlp/chart",
            json={
                "query": "Chart: Bar; Value: TransactionID; Dimension: Category",
                "dataset": [
                    {"TransactionID": "TXN-000001", "Category": "Hardware"},
                    {"TransactionID": "TXN-000002", "Category": "Office"},
                ],
            },
        )

        self.assertEqual(response.status_code, 422, response.get_json())
        self.assertEqual(
            response.get_json()["error"]["code"],
            "chart_measure_not_numeric",
        )
        self.assertIn(
            "usable numeric values",
            response.get_json()["error"]["message"],
        )

    def test_decision_chat_returns_grounded_error_for_text_semantic_measure(self):
        """Decision Chat must not fall back after a resolved metric proves unusable."""
        response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "user_message": "Show Transaction ID by Category as a bar chart",
                "dataset": [
                    {"TransactionID": "TXN-000001", "Category": "Hardware"},
                    {"TransactionID": "TXN-000002", "Category": "Office"},
                ],
                "semantic_model": {
                    "metrics": [
                        {
                            "id": "metric_transaction_id_sum",
                            "name": "Transaction ID",
                            "label": "Transaction ID",
                            "field": "TransactionID",
                            "default_aggregation": "sum",
                            "expression": {
                                "type": "column_aggregation",
                                "column": "TransactionID",
                                "aggregation": "sum",
                            },
                        }
                    ],
                    "dimensions": [
                        {
                            "id": "dimension_category",
                            "name": "Category",
                            "label": "Category",
                            "field": "Category",
                        }
                    ],
                },
            },
        )

        self.assertEqual(response.status_code, 400, response.get_json())
        error = response.get_json()["error"]
        self.assertEqual(error["code"], "INVALID_DECISION_CHAT_TURN_REQUEST")
        self.assertIn("metric_measure_not_numeric", error["message"])
        self.assertIn("usable numeric values", error["message"])

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
