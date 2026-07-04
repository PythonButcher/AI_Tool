import json
import os
import tempfile
import unittest

from flask import Flask

from backend.db import backend_db
from backend.routes.decision import decision_bp
from backend.services.decision_asset_service import DecisionAssetService


def decision_output_fixture():
    """Return a contract-shaped decision output without dataset rows or chat text."""
    return {
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
        "advanced_gates": [],
        "command_center": {
            "schema_version": "di_command_center_v1",
            "surface": "ai_chat_decision_command_center",
            "status": "limited",
            "section_order": ["executive_brief"],
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
                "section_count": 1,
                "section_order": ["executive_brief"],
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
        self.assertIn("immutable observational snapshot", saved["snapshot_notice"])
        self.assertEqual(saved["decision_output"], decision_output)
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
        self.assertEqual(
            summaries[0],
            {
                "asset_id": saved["asset_id"],
                "title": "Q1 Revenue Review",
                "created_at": saved["created_at"],
                "dataset_label": "Q1 Sales",
                "readiness_state": "analysis_ready",
                "truth_boundary": "observational_analysis_only",
            },
        )

        detail = self.client.get(f"/api/decision/assets/{saved['asset_id']}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.get_json(), saved)

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
        detail = self.client.get(f"/api/decision/assets/{saved['asset_id']}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.get_json()["graph_state"], graph_state)

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
