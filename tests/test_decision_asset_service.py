import json
import os
import tempfile
import unittest

from flask import Flask

from backend.db import backend_db
from backend.routes.decision import decision_bp
from backend.services.decision_asset_service import DecisionAssetService
from backend.services.decision_output_service import DecisionOutputService


def decision_output_fixture():
    """Return a contract-shaped decision output without dataset rows or chat text."""
    output = {
        "type": "decision_output",
        "render_hint": "decision_output",
        "inspectable": True,
        "default_view": "inspector",
        "schema_version": "di_phase3_decision_output_v1",
        "title": "Decision output: Revenue growth review",
        "summary": "Revenue and margin are ready for observational analysis.",
        "dataset_trust": {
            "dataset": {
                "source": "active",
                "dataset_id": "sales_q1",
                "dataset_name": "Q1 Sales",
                "row_count": 4,
                "column_count": 3,
            },
            "source_label": "Active dataset",
            "row_count": 4,
            "column_count": 3,
            "semantic_ready": True,
            "transform_state": "cleaned",
            "stale_state": "current",
            "warnings": [],
        },
        "frame": {"goal": {}, "drivers": [], "limits": [], "breakdowns": []},
        "readiness": {
            "readiness_state": "analysis_ready",
            "truth_boundary": "observational_analysis_only",
        },
        "evidence_board": {"status": "not_analyzed", "items": []},
        "decision_map": {"nodes": [], "edges": [], "causal_status": "not_causal_claim"},
        "scenario_compare": {"status": "not_applicable", "projections": []},
        "advanced_readiness": {
            "schema_version": "di_advanced_readiness_v1",
            "overall_state": "blocked",
            "summary": "Advanced capabilities remain blocked for this saved snapshot.",
            "capabilities": [],
            "state_counts": {
                "supported": 0,
                "limited": 0,
                "blocked": 4,
                "not_evaluated": 0,
            },
            "limitations": ["Readiness diagnostics do not perform advanced analysis."],
            "truth_boundary": "observational_analysis_only",
        },
        "advanced_gates": [],
        "command_center": {
            "schema_version": "di_command_center_v1",
            "surface": "ai_chat_decision_command_center",
            "status": "limited",
            "section_order": list(DecisionOutputService.REQUIRED_EXPORT_SECTION_IDS),
            "stale_state": "current",
            "rerun_state": {
                "status": "analysis_not_run",
                "action_id": "analyze_workspace",
                "reason": "Run observational analysis to populate the Evidence Board.",
            },
            "allowed_next_checks": [
                {
                    "check_id": "run_observational_analysis",
                    "label": "Run observational analysis",
                    "description": "Populate or refresh the Evidence Board from the current decision frame.",
                    "enabled": True,
                    "status": "ready",
                    "source": "readiness",
                    "action_id": "analyze_workspace",
                }
            ],
            "disabled_next_checks": [
                {
                    "check_id": "unsupported_final_recommendation",
                    "label": "Final Recommendation",
                    "enabled": False,
                    "status": "disabled",
                    "source": "advanced_gates",
                    "reason": "Final recommendations are unsupported.",
                }
            ],
            "export_readiness": {
                "ready": True,
                "status": "ready",
                "section_count": len(DecisionOutputService.REQUIRED_EXPORT_SECTION_IDS),
                "section_order": list(DecisionOutputService.REQUIRED_EXPORT_SECTION_IDS),
                "reason": "Backend export_sections are ready for the AI Chat decision PDF.",
            },
            "limitations": [
                "The command center is observational decision support only; it does not make a final recommendation.",
                "Saved DecisionAssets remain immutable historical snapshots and do not refresh live data.",
            ],
            "source_refs": {
                "workspace_id": "workspace_sales_q1",
                "workspace_status": "analysis_ready",
                "workspace_analysis_present": False,
                "ranked_diagnostic_ids": [],
                "scenario_status": None,
            },
            "truth_boundary": "observational_analysis_only",
        },
        "export_sections": [
            {
                "section_id": "executive_brief",
                "title": "Executive Brief",
                "summary": "Revenue and margin are ready for observational analysis.",
                "body": "Revenue and margin are ready for observational analysis.",
            }
        ],
        "source_refs": {
            "workspace_id": "workspace_sales_q1",
            "workspace_status": "analysis_ready",
            "ranked_diagnostic_ids": [],
            "truth_boundary": "observational_analysis_only",
        },
        "truth_boundary": "observational_analysis_only",
    }
    advanced = output["advanced_readiness"]
    output["export_sections"] = [
        {
            "section_id": section_id,
            "title": section_id.replace("_", " ").title(),
            "summary": (
                advanced["summary"]
                if section_id == "advanced_readiness"
                else f"Saved {section_id.replace('_', ' ')} section."
            ),
            "body": (
                advanced["summary"]
                if section_id == "advanced_readiness"
                else f"Saved {section_id.replace('_', ' ')} section."
            ),
        }
        for section_id in DecisionOutputService.REQUIRED_EXPORT_SECTION_IDS
    ]
    return output


def graph_state_fixture():
    """Return the restricted carry-forward graph state allowed in an asset."""
    return {
        "schema_version": "di_phase7_3_decision_graph_v1",
        "state_kind": "decision_graph_build_state",
        "persistence": "client_session_or_saved_decision_asset",
        "graph_mode": "mixed",
        "selected_variables": {
            "metric_ids": ["metric_revenue_sum"],
            "dimension_ids": ["dimension_region"],
        },
        "selected_evidence_ids": ["diagnostic_revenue"],
        "user_hypotheses": [],
        "filters": [],
        "truth_boundary": "observational_analysis_only",
        "limitations": ["Graph state remains observational only."],
    }


class DecisionAssetApiTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.original_db_path = backend_db.DB_PATH
        self.original_schema_ready = backend_db._SCHEMA_READY
        backend_db.DB_PATH = os.path.join(self.temporary_directory.name, "decision_assets.db")
        backend_db._SCHEMA_READY = False

        app = Flask(__name__)
        app.register_blueprint(decision_bp)
        self.client = app.test_client()

    def tearDown(self):
        backend_db.DB_PATH = self.original_db_path
        backend_db._SCHEMA_READY = self.original_schema_ready
        self.temporary_directory.cleanup()

    def test_save_list_and_detail_preserve_an_immutable_snapshot(self):
        decision_output = decision_output_fixture()
        response = self.client.post(
            "/api/decision/assets",
            json={"title": "  Q1   Revenue Review  ", "decision_output": decision_output},
        )

        self.assertEqual(response.status_code, 201)
        saved = response.get_json()
        self.assertTrue(saved["asset_id"].startswith("decision_asset_"))
        self.assertEqual(saved["schema_version"], "di_decision_asset_v1")
        self.assertEqual(saved["title"], "Q1 Revenue Review")
        self.assertIsNone(saved["archived_at"])
        self.assertEqual(saved["lifecycle_state"], "active")
        self.assertIn("immutable observational snapshot", saved["snapshot_notice"])
        self.assertEqual(saved["decision_output"], decision_output)
        self.assertEqual(
            saved["decision_output"]["advanced_readiness"],
            decision_output["advanced_readiness"],
        )
        self.assertNotIn("graph_state", saved)

        conn = backend_db.get_db_connection()
        try:
            stored_snapshot = conn.execute(
                "SELECT decision_output_json FROM decision_assets WHERE asset_id = ?",
                (saved["asset_id"],),
            ).fetchone()["decision_output_json"]
        finally:
            conn.close()
        self.assertEqual(
            stored_snapshot,
            json.dumps(saved["decision_output"], ensure_ascii=False, separators=(",", ":")),
        )

        # A fresh schema check simulates application reload without changing the stored database.
        backend_db._SCHEMA_READY = False
        listed = self.client.get("/api/decision/assets")
        self.assertEqual(listed.status_code, 200)
        summaries = listed.get_json()["assets"]
        self.assertEqual(len(summaries), 1)
        self.assertEqual(summaries[0]["asset_id"], saved["asset_id"])
        self.assertEqual(summaries[0]["title"], "Q1 Revenue Review")
        self.assertEqual(summaries[0]["created_at"], saved["created_at"])
        self.assertEqual(summaries[0]["dataset_label"], "Q1 Sales")
        self.assertEqual(summaries[0]["readiness_state"], "analysis_ready")
        self.assertEqual(summaries[0]["truth_boundary"], "observational_analysis_only")
        self.assertIsNone(summaries[0]["archived_at"])
        self.assertEqual(summaries[0]["lifecycle_state"], "active")
        self.assertIn("immutable observational snapshot", summaries[0]["snapshot_notice"])
        self.assertEqual(summaries[0]["review_metadata"]["dataset_label"], "Q1 Sales")
        self.assertEqual(summaries[0]["review_metadata"]["evidence_item_count"], 0)
        self.assertEqual(summaries[0]["review_metadata"]["graph_state_summary"], {"available": False})
        self.assertEqual(
            summaries[0]["provenance"]["source_refs"],
            decision_output["source_refs"],
        )
        self.assertEqual(
            summaries[0]["snapshot_export"],
            {
                "ready": True,
                "source": "saved_decision_asset_snapshot",
                "section_count": len(DecisionOutputService.REQUIRED_EXPORT_SECTION_IDS),
                "section_order": list(DecisionOutputService.REQUIRED_EXPORT_SECTION_IDS),
                "endpoint": "GET /api/decision/assets/<asset_id>/export",
            },
        )

        detail = self.client.get(f"/api/decision/assets/{saved['asset_id']}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.get_json(), saved)

    def test_saved_export_readiness_requires_all_canonical_sections(self):
        incomplete_output = decision_output_fixture()
        incomplete_output["export_sections"] = [
            section
            for section in incomplete_output["export_sections"]
            if section["section_id"] != "advanced_readiness"
        ]

        response = self.client.post(
            "/api/decision/assets",
            json={"decision_output": incomplete_output},
        )

        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.get_json()["snapshot_export"]["ready"])

    def test_list_is_newest_first_and_title_falls_back_to_decision_output(self):
        first = self.client.post(
            "/api/decision/assets",
            json={"decision_output": decision_output_fixture()},
        ).get_json()
        second_output = decision_output_fixture()
        second_output["title"] = "Decision output: Margin protection"
        second = self.client.post(
            "/api/decision/assets",
            json={"title": "Margin review", "decision_output": second_output},
        ).get_json()

        self.assertEqual(first["title"], "Decision output: Revenue growth review")
        listed = self.client.get("/api/decision/assets?limit=2")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(
            [asset["asset_id"] for asset in listed.get_json()["assets"]],
            [second["asset_id"], first["asset_id"]],
        )

    def test_valid_graph_state_is_stored_with_the_snapshot(self):
        graph_state = graph_state_fixture()
        response = self.client.post(
            "/api/decision/assets",
            json={"decision_output": decision_output_fixture(), "graph_state": graph_state},
        )

        self.assertEqual(response.status_code, 201)
        saved = response.get_json()
        self.assertEqual(saved["graph_state"], graph_state)
        self.assertEqual(saved["review_metadata"]["graph_state_summary"]["available"], True)
        self.assertEqual(saved["review_metadata"]["graph_state_summary"]["selected_metric_count"], 1)
        detail = self.client.get(f"/api/decision/assets/{saved['asset_id']}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.get_json()["graph_state"], graph_state)

    def test_archive_restore_and_delete_asset_lifecycle(self):
        saved = self.client.post(
            "/api/decision/assets",
            json={"title": "Archive candidate", "decision_output": decision_output_fixture()},
        ).get_json()

        archive_response = self.client.post(f"/api/decision/assets/{saved['asset_id']}/archive")
        self.assertEqual(archive_response.status_code, 200)
        archived = archive_response.get_json()
        self.assertEqual(archived["asset_id"], saved["asset_id"])
        self.assertEqual(archived["lifecycle_state"], "archived")
        self.assertIsInstance(archived["archived_at"], str)
        self.assertEqual(archived["decision_output"], saved["decision_output"])

        default_list = self.client.get("/api/decision/assets")
        self.assertEqual(default_list.status_code, 200)
        self.assertEqual(default_list.get_json()["assets"], [])

        archived_list = self.client.get("/api/decision/assets?archived_state=archived")
        self.assertEqual(archived_list.status_code, 200)
        self.assertEqual([asset["asset_id"] for asset in archived_list.get_json()["assets"]], [saved["asset_id"]])
        self.assertEqual(archived_list.get_json()["assets"][0]["lifecycle_state"], "archived")

        all_list = self.client.get("/api/decision/assets?include_archived=true")
        self.assertEqual(all_list.status_code, 200)
        self.assertEqual([asset["asset_id"] for asset in all_list.get_json()["assets"]], [saved["asset_id"]])

        restore_response = self.client.post(f"/api/decision/assets/{saved['asset_id']}/restore")
        self.assertEqual(restore_response.status_code, 200)
        restored = restore_response.get_json()
        self.assertEqual(restored["lifecycle_state"], "active")
        self.assertIsNone(restored["archived_at"])

        delete_response = self.client.delete(f"/api/decision/assets/{saved['asset_id']}")
        self.assertEqual(delete_response.status_code, 200)
        self.assertEqual(delete_response.get_json(), {"status": "deleted", "asset_id": saved["asset_id"]})
        missing_response = self.client.get(f"/api/decision/assets/{saved['asset_id']}")
        self.assertEqual(missing_response.status_code, 404)

        missing_delete = self.client.delete("/api/decision/assets/decision_asset_missing")
        self.assertEqual(missing_delete.status_code, 404)

    def test_list_filters_export_and_comparison_use_saved_snapshots(self):
        first = self.client.post(
            "/api/decision/assets",
            json={"title": "Revenue review", "decision_output": decision_output_fixture()},
        ).get_json()
        second_output = decision_output_fixture()
        second_output["title"] = "Decision output: Margin risk"
        second_output["dataset_trust"]["dataset"]["dataset_name"] = "Margin Workbook"
        second_output["dataset_trust"]["source_label"] = "Uploaded data"
        second_output["readiness"]["readiness_state"] = "limited"
        second_output["evidence_board"] = {
            "status": "analyzed",
            "items": [{"source_diagnostic_id": "diagnostic_margin"}],
        }
        evidence_section = next(
            section for section in second_output["export_sections"]
            if section["section_id"] == "evidence_board"
        )
        evidence_section.update({
            "summary": "One saved diagnostic is available.",
            "body": "One saved diagnostic is available.",
        })
        second = self.client.post(
            "/api/decision/assets",
            json={
                "title": "Margin risk",
                "decision_output": second_output,
                "graph_state": graph_state_fixture(),
            },
        ).get_json()

        filtered = self.client.get("/api/decision/assets?dataset_label=margin&readiness_state=limited&has_graph_state=true")
        self.assertEqual(filtered.status_code, 200)
        self.assertEqual([asset["asset_id"] for asset in filtered.get_json()["assets"]], [second["asset_id"]])
        self.assertEqual(filtered.get_json()["assets"][0]["review_metadata"]["evidence_item_count"], 1)

        exported = self.client.get(f"/api/decision/assets/{second['asset_id']}/export")
        self.assertEqual(exported.status_code, 200)
        export_payload = exported.get_json()
        self.assertEqual(export_payload["schema_version"], "di_decision_asset_export_v1")
        self.assertEqual(export_payload["export_source"], "saved_decision_asset_snapshot")
        self.assertEqual(export_payload["export_sections"], second_output["export_sections"])
        saved_advanced = next(
            section for section in export_payload["export_sections"]
            if section["section_id"] == "advanced_readiness"
        )
        self.assertEqual(saved_advanced["body"], second_output["advanced_readiness"]["summary"])
        self.assertEqual(export_payload["dataset_trust"]["dataset"]["dataset_name"], "Margin Workbook")
        self.assertIn("immutable observational snapshot", export_payload["snapshot_notice"])

        comparison = self.client.post(
            "/api/decision/assets/compare",
            json={"asset_ids": [first["asset_id"], second["asset_id"]]},
        )
        self.assertEqual(comparison.status_code, 200)
        body = comparison.get_json()
        self.assertEqual(body["schema_version"], "di_decision_asset_comparison_v1")
        self.assertEqual(body["comparison_kind"], "historical_snapshot_comparison")
        self.assertEqual(body["asset_ids"], [first["asset_id"], second["asset_id"]])
        self.assertIn("does not refresh live data", body["snapshot_notice"])
        self.assertEqual(body["items"][0]["dataset_label"], "Q1 Sales")
        self.assertEqual(body["items"][1]["dataset_label"], "Margin Workbook")
        self.assertEqual(body["items"][1]["evidence_item_count"], 1)
        self.assertIn("live_saved_asset_refresh", body["unsupported_capabilities"])
        self.assertEqual(
            body["differences"]["export_section_counts"],
            {
                first["asset_id"]: len(DecisionOutputService.REQUIRED_EXPORT_SECTION_IDS),
                second["asset_id"]: len(DecisionOutputService.REQUIRED_EXPORT_SECTION_IDS),
            },
        )

    def test_missing_asset_returns_404(self):
        response = self.client.get("/api/decision/assets/decision_asset_missing")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["error"]["code"], "DECISION_ASSET_NOT_FOUND")

    def test_rejects_boundary_unsafe_oversized_and_invalid_graph_payloads(self):
        cases = []

        invalid_boundary = decision_output_fixture()
        invalid_boundary["truth_boundary"] = "live_analysis"
        cases.append(({"decision_output": invalid_boundary}, "truth_boundary"))

        raw_rows = decision_output_fixture()
        raw_rows["dataset_rows"] = [{"Revenue": 100}]
        cases.append(({"decision_output": raw_rows}, "raw dataset rows"))

        chat_transcript = decision_output_fixture()
        chat_transcript["conversation_history"] = [{"role": "user", "content": "Do not save this"}]
        cases.append(({"decision_output": chat_transcript}, "chat transcripts"))

        invalid_trust = decision_output_fixture()
        invalid_trust["dataset_trust"]["warnings"] = "not an array"
        cases.append(({"decision_output": invalid_trust}, "warnings"))

        oversized = decision_output_fixture()
        oversized["summary"] = "x" * (DecisionAssetService.MAX_SNAPSHOT_BYTES + 1)
        cases.append(({"decision_output": oversized}, "snapshot limit"))

        invalid_graph = graph_state_fixture()
        invalid_graph["state_kind"] = "decision_graph"
        cases.append(({"decision_output": decision_output_fixture(), "graph_state": invalid_graph}, "state_kind"))

        for payload, expected_message in cases:
            with self.subTest(expected_message=expected_message):
                response = self.client.post("/api/decision/assets", json=payload)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.get_json()["error"]["code"], "INVALID_DECISION_ASSET_REQUEST")
                self.assertIn(expected_message, response.get_json()["error"]["message"])

        limit_response = self.client.get("/api/decision/assets?limit=51")
        self.assertEqual(limit_response.status_code, 400)
        self.assertIn("between 1 and 50", limit_response.get_json()["error"]["message"])
