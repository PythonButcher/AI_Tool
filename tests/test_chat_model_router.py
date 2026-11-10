"""Routing and cost/grounding boundaries, without live paid provider calls."""

import copy
import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from flask import Flask, jsonify
import httpx

from backend.routes.decision_chat import decision_chat_bp
from backend.services.chat_model_router import add_model_commentary, _provider_messages
from backend.services.chat_model_router import _create_client as create_provider_client
from tests.test_decision_chat_service import DATASET, SEMANTIC_MODEL


RESULT = {
    "status": "success", "mode": "explore", "assistant_message": "Revenue totals 505.",
    "artifacts": [{"type": "answer", "content": {"value": 505},
                   "bi_grounding": {"metric_definition": {"id": "revenue"}}}],
    "session_state": {"active_mode": "explore"},
    "bi_grounding": {"metric_definition": {"id": "revenue"}, "aggregation": "sum"},
}


class ChatModelRouterTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict("os.environ", {"OPENAI_API_KEY": "test-only",
                              "AI_CHAT_QUICK_MODEL": "gpt-4.1-mini", "AI_CHAT_DEEP_MODEL": "gpt-5-mini"})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.factory_patch = patch("backend.services.chat_model_router._create_client")
        self.factory = self.factory_patch.start()
        self.addCleanup(self.factory_patch.stop)
        self.client = MagicMock()
        self.factory.return_value.__enter__.return_value = self.client
        self.client.chat.completions.create.return_value = SimpleNamespace(
            model="gpt-4.1-mini-2025-04-14", usage=SimpleNamespace(prompt_tokens=20, completion_tokens=10, total_tokens=30),
            choices=[SimpleNamespace(finish_reason="stop", message=SimpleNamespace(content="This is the computed revenue total."))])

    def test_local_and_old_clients_do_not_call_provider(self):
        for payload in ({"user_message": "Revenue total"}, {"model_mode": "auto", "user_message": "Revenue total"}):
            self.assertEqual(add_model_commentary(payload, RESULT)["model_routing"]["status"], "local")
        self.factory.assert_not_called()

    def test_new_defaults_work_through_installed_sdk_without_network(self):
        def respond(client, request, **kwargs):
            body = json.loads(request.content)
            self.assertFalse(body["store"])
            self.assertNotIn("temperature", body)
            self.assertEqual(request.extensions["timeout"]["read"], 45.0)
            return httpx.Response(200, request=request, json={
                "id": "test-completion", "object": "chat.completion", "created": 1,
                "model": body["model"], "choices": [{"index": 0, "finish_reason": "stop",
                    "message": {"role": "assistant", "content": "An explanation of the computed result."}}],
            })

        self.factory.side_effect = create_provider_client
        with patch.dict(os.environ):
            os.environ.pop("AI_CHAT_QUICK_MODEL", None)
            os.environ.pop("AI_CHAT_DEEP_MODEL", None)
            with patch("httpx.Client.send", autospec=True, side_effect=respond) as transport:
                for mode, model, effort, budget in (("quick", "gpt-5.6-luna", "low", 2000),
                                                     ("deep", "gpt-5.6-sol", "medium", 6000)):
                    reply = add_model_commentary({"model_mode": mode, "user_message": "Explain revenue"}, RESULT)
                    self.assertEqual(reply["model_routing"]["status"], "completed")
                    self.assertEqual(reply["model_routing"]["model"], model)
                    body = json.loads(transport.call_args.args[1].content)
                    self.assertEqual(body["reasoning_effort"], effort)
                    self.assertEqual(body["max_completion_tokens"], budget)
                self.assertEqual(transport.call_count, 2)

    def test_real_sdk_does_not_retry_or_escalate_when_provider_rejects_model(self):
        self.factory.side_effect = create_provider_client
        def unavailable(client, request, **kwargs):
            return httpx.Response(503, request=request, json={"error": {"message": "Unavailable", "type": "server_error"}})
        with patch.dict(os.environ):
            os.environ.pop("AI_CHAT_QUICK_MODEL", None)
            with patch("httpx.Client.send", autospec=True, side_effect=unavailable) as transport:
                reply = add_model_commentary({"model_mode": "quick", "user_message": "Explain revenue"}, RESULT)
                self.assertEqual(reply["model_routing"]["status"], "unavailable")
                self.assertEqual(reply["model_routing"]["attempted_model"], "gpt-5.6-luna")
                self.assertIsNone(reply["model_routing"]["model"])
                self.assertEqual(reply["artifacts"], RESULT["artifacts"])
                transport.assert_called_once()

    def test_quick_preserves_all_verified_results(self):
        baseline = copy.deepcopy(RESULT)
        reply = add_model_commentary({"model_mode": "quick", "user_message": "Explain revenue"}, RESULT)
        self.assertEqual(RESULT, baseline)
        for key in baseline:
            self.assertEqual(reply[key], baseline[key])
        self.assertEqual(reply["model_routing"]["model"], "gpt-4.1-mini-2025-04-14")
        self.assertEqual(reply["model_routing"]["usage"]["total_tokens"], 30)
        kwargs = self.client.chat.completions.create.call_args.kwargs
        self.assertEqual(kwargs["model"], "gpt-4.1-mini")
        self.assertEqual(kwargs["max_completion_tokens"], 900)
        self.assertFalse(kwargs["store"])

    def test_auto_complexity_and_explicit_override(self):
        for mode, question, expected in (("auto", "Explain revenue", "quick"),
                                         ("auto", "Detailed revenue implications", "deep"),
                                         ("quick", "Detailed revenue implications", "quick"),
                                         ("deep", "Revenue", "deep")):
            with self.subTest(mode=mode, question=question):
                route = add_model_commentary({"model_mode": mode, "user_message": question}, RESULT)["model_routing"]
                self.assertEqual(route["selected_mode"], expected)
                if expected == "deep":
                    kwargs = self.client.chat.completions.create.call_args.kwargs
                    self.assertEqual(kwargs["model"], "gpt-5-mini")
                    self.assertEqual(kwargs["reasoning_effort"], "medium")
                    self.assertEqual(kwargs["max_completion_tokens"], 6000)
                    self.assertNotIn("temperature", kwargs)

    def test_clarification_cannot_be_overridden(self):
        result = copy.deepcopy(RESULT)
        result["artifacts"][0]["content"]["reason_code"] = "analytics_clarification_required"
        self.assertEqual(add_model_commentary({"model_mode": "deep"}, result)["model_routing"]["status"], "local")
        self.factory.assert_not_called()

    def test_no_key_or_unsupported_configuration_never_calls_provider(self):
        for changes in ({"OPENAI_API_KEY": ""}, {"AI_CHAT_QUICK_MODEL": "unapproved-model"}):
            with patch.dict("os.environ", changes):
                reply = add_model_commentary({"model_mode": "quick"}, RESULT)
                self.assertEqual(reply["model_routing"]["status"], "unavailable")
                self.assertIsNone(reply["model_routing"]["model"])
        self.factory.assert_not_called()

    def test_provider_failure_keeps_local_result_without_retry_or_escalation(self):
        self.client.chat.completions.create.side_effect = TimeoutError("private diagnostic")
        reply = add_model_commentary({"model_mode": "quick"}, RESULT)
        self.assertEqual(reply["assistant_message"], RESULT["assistant_message"])
        self.assertIsNone(reply["model_routing"]["model"])
        self.assertNotIn("private diagnostic", json.dumps(reply))
        self.client.chat.completions.create.assert_called_once()

    def test_truncated_output_is_not_presented_as_complete(self):
        self.client.chat.completions.create.return_value.choices[0].finish_reason = "length"
        reply = add_model_commentary({"model_mode": "deep"}, RESULT)
        self.assertNotIn("ai_commentary", reply)
        self.assertEqual(reply["model_routing"]["status"], "unavailable")

    def test_provider_context_is_bounded_and_excludes_raw_data_and_system_history(self):
        messages = _provider_messages({"dataset": [{"secret_row": "private"}], "user_message": "q" * 20000,
            "conversation_history": [{"role": "system", "content": "UNTRUSTED_SYSTEM"},
                                     {"role": "user", "content": "x" * 10000}]}, RESULT, "quick")
        text = json.dumps(messages)
        self.assertNotIn("secret_row", text)
        self.assertNotIn("UNTRUSTED_SYSTEM", text)
        self.assertLess(len(text), 20000)
        self.assertIn("Revenue totals 505", text)

    def test_invalid_mode_and_governance_blocks_never_call_provider(self):
        app = Flask(__name__)
        app.register_blueprint(decision_chat_bp)
        client = app.test_client()
        for mode in ("arbitrary-model", {}, None):
            response = client.post("/api/decision/chat/turns", json={"model_mode": mode})
            self.assertEqual(response.status_code, 400)
        with app.app_context(), patch("backend.routes.decision_chat.governance_for_payload",
                                      return_value=({}, (jsonify({"error": "blocked"}), 422))):
            response = client.post("/api/decision/chat/turns", json={"model_mode": "deep", "user_message": "Revenue",
                                   "dataset": DATASET, "semantic_model": SEMANTIC_MODEL, "requested_mode": "explore"})
            self.assertEqual(response.status_code, 422)
        self.factory.assert_not_called()

    def test_route_integrates_routing_after_computation(self):
        app = Flask(__name__)
        app.register_blueprint(decision_chat_bp)
        response = app.test_client().post("/api/decision/chat/turns", json={"model_mode": "deep", "user_message": "What is revenue?",
            "dataset": DATASET, "semantic_model": SEMANTIC_MODEL, "requested_mode": "explore"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["model_routing"]["status"], "completed")
        self.assertTrue(response.json["artifacts"])
        self.client.chat.completions.create.assert_called_once()


if __name__ == "__main__":
    unittest.main()
