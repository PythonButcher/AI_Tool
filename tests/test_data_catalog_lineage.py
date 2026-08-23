"""Regression coverage for backend-only dataset governance gates."""

import unittest
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

import pandas as pd
from flask import Flask

from backend.routes.automl import automl_bp
from backend.routes.decision_chat import decision_chat_bp
from backend.routes.export import export_bp
from backend.routes.nlp_routes import nlp_bp
from backend.routes.upload import upload_bp
from backend.db import backend_db
from backend.services import workspace_context
from backend.services.data_catalog_lineage import evaluate_dataset_readiness
from backend.utils.global_state import set_cleaned_data, set_governance_state


BAD_DATASET = [
    {"id": "duplicate", "amount": -5, "email": "a@example.com"},
    {"id": "duplicate", "amount": 500, "email": None},
]
BAD_POLICY = {
    "required_fields": ["required_metric"],
    "null_thresholds": {"default": 0.20},
    "duplicate_keys": ["id"],
    "value_ranges": {"amount": {"min": 0, "max": 100}},
    "pii": {"mode": "warning"},
}


class DataCatalogLineageTests(unittest.TestCase):
    def setUp(self):
        # Uploads are durable now, so every test gets an isolated catalog and
        # server-managed storage root instead of mutating repository data.
        self.temp_dir = TemporaryDirectory()
        self.original_db_path = backend_db.DB_PATH
        self.original_upload_root = workspace_context.MANAGED_UPLOAD_ROOT
        backend_db.DB_PATH = str(Path(self.temp_dir.name) / "catalog.db")
        backend_db._SCHEMA_READY = False
        workspace_context.MANAGED_UPLOAD_ROOT = Path(self.temp_dir.name) / "managed"
        app = Flask(__name__)
        app.register_blueprint(nlp_bp)
        app.register_blueprint(decision_chat_bp)
        app.register_blueprint(automl_bp)
        app.register_blueprint(export_bp)
        app.register_blueprint(upload_bp)
        self.client = app.test_client()

    def tearDown(self):
        # Prevent shared in-memory dataframe state from leaking into other tests.
        set_cleaned_data(None)
        set_governance_state(None, None)
        backend_db.DB_PATH = self.original_db_path
        backend_db._SCHEMA_READY = False
        workspace_context.MANAGED_UPLOAD_ROOT = self.original_upload_root
        self.temp_dir.cleanup()

    def test_policy_reports_explainable_blocking_reasons(self):
        readiness = evaluate_dataset_readiness(pd.DataFrame(BAD_DATASET), BAD_POLICY, operation="test")

        self.assertEqual(readiness["status"], "blocked")
        self.assertEqual(readiness["severity"], "critical")
        reason_codes = {reason["code"] for reason in readiness["reasons"]}
        self.assertTrue({"required_field_missing", "duplicate_key_values", "value_range_violation"}.issubset(reason_codes))
        self.assertTrue(readiness["next_action"])
        self.assertTrue(all(reason["next_action"] for reason in readiness["reasons"]))

    def test_freshness_pii_and_retention_rules_are_explainable(self):
        readiness = evaluate_dataset_readiness(
            pd.DataFrame([{"event_at": "2020-01-01", "email": "person@example.com"}]),
            {
                "freshness": {"field": "event_at", "max_age_days": 1, "required": True},
                "pii": {"mode": "warning"},
                "retention": {"expires_at": "2020-02-01T00:00:00Z"},
            },
            operation="test",
        )

        reasons = {reason["code"]: reason for reason in readiness["reasons"]}
        self.assertEqual(reasons["pii_detected"]["severity"], "warning")
        self.assertEqual(reasons["dataset_stale"]["severity"], "critical")
        self.assertEqual(reasons["retention_expired"]["severity"], "critical")

    def test_bad_dataset_is_blocked_before_chart_ai_chat_automl_and_export(self):
        chart_response = self.client.post(
            "/api/nlp/chart",
            json={"query": "show amount by id", "dataset": BAD_DATASET, "governance_policy": BAD_POLICY},
        )
        self.assertEqual(chart_response.status_code, 422)
        self.assertEqual(chart_response.get_json()["governance_readiness"]["status"], "blocked")

        chat_response = self.client.post(
            "/api/decision/chat/turns",
            json={
                "user_message": "Show amount by id as a chart",
                "dataset": BAD_DATASET,
                "governance_policy": BAD_POLICY,
                "session_state": {},
            },
        )
        self.assertEqual(chat_response.status_code, 422)
        self.assertNotIn("artifacts", chat_response.get_json())

        automl_response = self.client.post(
            "/api/automl/train",
            json={"dataset": BAD_DATASET, "target_column": "amount", "governance_policy": BAD_POLICY},
        )
        self.assertEqual(automl_response.status_code, 422)

        set_cleaned_data(pd.DataFrame(BAD_DATASET))
        set_governance_state(BAD_POLICY, evaluate_dataset_readiness(pd.DataFrame(BAD_DATASET), BAD_POLICY, operation="test"))
        export_response = self.client.get("/api/export?format=csv")
        self.assertEqual(export_response.status_code, 422)
        self.assertEqual(export_response.get_json()["governance_readiness"]["status"], "blocked")

    def test_ordinary_csv_with_a_non_unique_inferred_id_uploads_with_a_warning(self):
        response = self.client.post(
            "/api/upload",
            data={"file": (BytesIO(b"id,name\n1,Alpha\n1,Beta\n"), "ordinary.csv")},
            content_type="multipart/form-data",
        )

        self.assertEqual(response.status_code, 200, response.get_json())
        readiness = response.get_json()["governance_readiness"]
        self.assertEqual(readiness["status"], "warning")
        self.assertIn("duplicate_key_values", {reason["code"] for reason in readiness["reasons"]})


if __name__ == "__main__":
    unittest.main()
