Goal: Implement the Slice 1 BI Result Contract for AI Chat.

Target Files:
- `backend/decision_engine/chat_service.py` (and related routing/mode detection if necessary)
- `project_docs/active/contracts/decision_objects.md`
- Related backend test files for `chat_service.py`

Context:
Antigravity and the user have finalized the new BI-First AI Chat Product Direction. We are starting Slice 1. The old Decision Intelligence objects are decoupled from AI Chat. We need a robust BI-focused contract for the frontend to consume.

Requirements:
1. Define a normalized `bi_grounding` contract attached to every answer and chart (Dataset identity, row count, freshness, cleaning state, metric definition, aggregation, dimensions, filters, time period).
2. Define `analytics_refinement` payload expectations for structured follow-ups (e.g., `remove_filter`, `set_aggregation`).
3. Define typed `suggested_actions` for guided BI exploration based on available semantic dimensions/time fields (e.g., "Break down by Region").
4. Add backend tests for dataset identity, filters, aggregation, time context, and compact session state to ensure this new BI payload is robust.

Acceptance Checks:
- `decision_objects.md` (or a new BI chat contract file if preferred) documents the `bi_grounding`, `analytics_refinement`, and `suggested_actions` schemas.
- `chat_service.py` (or equivalent BI chat handlers) returns these payloads for analytical turns.
- Backend tests pass.

Ownership:
Codex owns this backend implementation. Once complete and verified by tests, please update `ai_chat_execution_status.md` and pass the baton back to Antigravity via a handoff file so we can begin Slice 2 (Trusted Result Card frontend).
