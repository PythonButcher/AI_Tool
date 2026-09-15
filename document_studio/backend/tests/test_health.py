"""Focused contract test for GET /health.

Acceptance criteria (from the handoff):
    - HTTP 200
    - Exact JSON: {"service": "document-studio", "status": "ok", "version": "0.1.0"}
    - No extra or missing fields

This test uses FastAPI's built-in TestClient (backed by httpx) so the
server does not need to be running.
"""

import json
import unittest

from fastapi.testclient import TestClient

from document_studio.api.app import create_app


class TestHealthEndpoint(unittest.TestCase):
    """Verify the /health contract is exact and stable."""

    def setUp(self) -> None:
        """Create a fresh application instance for each test."""
        self.app = create_app()
        self.client = TestClient(self.app)

    def test_health_returns_200(self) -> None:
        """GET /health must return HTTP 200."""
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)

    def test_health_content_type_is_json(self) -> None:
        """The response must be application/json."""
        response = self.client.get("/health")
        self.assertIn("application/json", response.headers.get("content-type", ""))

    def test_health_payload_is_exact_contract(self) -> None:
        """The JSON body must match the exact contracted shape and values.

        Expected:
            {"service": "document-studio", "status": "ok", "version": "0.1.0"}
        """
        response = self.client.get("/health")
        payload = response.json()

        expected = {
            "service": "document-studio",
            "status": "ok",
            "version": "0.1.0",
        }
        self.assertEqual(payload, expected)

    def test_health_has_no_extra_fields(self) -> None:
        """The response must contain exactly the three contracted keys."""
        response = self.client.get("/health")
        payload = response.json()

        expected_keys = {"service", "status", "version"}
        self.assertEqual(set(payload.keys()), expected_keys)

    def test_health_version_matches_package(self) -> None:
        """The version in the health response must match __version__."""
        from document_studio import __version__

        response = self.client.get("/health")
        payload = response.json()
        self.assertEqual(payload["version"], __version__)


if __name__ == "__main__":
    unittest.main()
