Goal: Improve how Datastream AI Chat interprets everyday requests for relative months and category comparisons, then return the implementation and verification evidence to Codex for review.

## User Outcome

Users can ask “How much revenue did we make last month?” or “Compare revenue for Online and Retail” and get results for the date range or categories they asked about. If the chat cannot tell which date or category field the user means, it asks a focused follow-up before returning a number.

## Scope And Ownership

This is a prepared backend assignment for Claude Opus 5.5 to use when the user gives it directly. Read `AGENTS.md`, `project_docs/INDEX.md`, the execution status, phase authorization, and sole active gate. Follow the authorization recorded for the work and surface any conflict to Codex before editing backend code. Codex owns integration review and any gate or contract updates.

Read [AI Chat scope](README.md), the BI grounding and refinement sections of [the response contract](../contracts/decision_objects.md), and the [model routing contract](../contracts/ai_chat_model_routing.md). Use the normal `POST /api/decision/chat/turns` entry point for verification.

Target `backend/decision_engine/chat_service.py`, `backend/decision_engine/bi_intent.py` if a focused parser change belongs there, and `tests/test_decision_chat_workspace.py`. Inspect `backend/services/metric_resolver.py` and `backend/nlp_engine/nlp_interpreter.py` as needed to understand execution and fallback. Keep changes within the semantic metric path and its existing response contract. Preserve the frontend, raw interpreter, provider routing, dependency set, and unrelated worktree edits.

## Reproduce And Implement

1. **Relative months.** “How much revenue did we make last month?” returned the fixture’s all-time total of $505 with no date filters. Support “last month” and “previous month” as the previous complete calendar month. Use a deterministic clock seam for tests, follow the contract’s UTC convention, and test a January-to-December rollover. Use the existing inclusive date filter semantics and replace a previous period on the same analytical context while retaining unrelated filters. When the date field cannot be resolved, use existing clarification or unsupported-result behavior. A relative-month request must never produce an unfiltered total.
2. **Category comparisons.** “Compare revenue for Online and Retail” filtered to both values and returned a combined $505. Recognize comparison phrasing such as “Compare Online and Retail revenue” and “Online vs Retail revenue.” Resolve both values against the active dataset, group by the verified shared dimension, and return each requested category with its own value through an existing artifact type. Preserve existing date and unrelated category filters. Ask for clarification or return a concrete unsupported result if the category field or values cannot be resolved. Ordinary requests to filter to both categories without asking for a comparison should retain their existing behavior.
3. **Combined request.** “Compare Online and Retail revenue last month” must apply both constraints on the same execution. Use a fixture with distinct category totals, rows outside the intended month, and an unrequested category inside it. Assert the category labels and values, not just a successful response or a summary total.

Use the established semantic metric and dimension IDs, filter validation, and deterministic metric resolver. Keep `bi_grounding.metric_definition`, `.dimensions`, `.filters`, and `.row_count` aligned with the artifact. Preserve the `contract_version` and `session_state.analytics_state` fields used by follow-up turns, including `metric_id`, `group_by`, `filters`, and `time_period`. Use the existing `analytics_clarification_required` response where the server has valid choices. Prevent recognized but unresolved intent from falling through to a misleading raw or unfiltered result. Treat broader synonym coverage and model-assisted parsing as possible follow-up work for Codex review.

## Verification And Return

Add route-level regression coverage for the paraphrases, date boundaries, ambiguous or unavailable fields or values, combined requests, and follow-up filter continuity. Check the existing explicit date, metric ambiguity, raw fallback for supported queries, dashboard draft, and provider routing cases for regressions.

From the repository root in PowerShell, run `$env:PYTHONPATH = '.codex_tmp_py;.codex_tmp_py/site-packages'` if the bundled dependencies are needed. Run `python -m unittest tests.test_decision_chat_workspace tests.test_decision_chat_service tests.test_nlp_chart_reliability tests.test_chat_model_router tests.test_metric_resolver`, `python -m compileall -q backend/decision_engine/chat_service.py backend/decision_engine/bi_intent.py`, and `git diff --check`.

Return the changed file list, the intent decisions and any limitations, before-and-after results for the reproduced prompts with representative grounding, and exact commands with pass counts or blockers. Leave the diff available for Codex to review. Stop after returning evidence to the user for Codex review.
