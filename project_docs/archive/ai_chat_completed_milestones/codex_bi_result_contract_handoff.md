> COMPLETED REFERENCE ONLY: The backend goal in this handoff was implemented and verified. Do not execute it as an active task.

Goal: Implement the BI Result Contract for AI Chat.

Target Files:
- `backend/decision_engine/chat_service.py`
- `project_docs/active/contracts/decision_objects.md`
- `tests/test_decision_chat_service.py`

Requirements:
Define normalized `bi_grounding`, structured `analytics_refinement`, and typed `suggested_actions` for BI analytical turns. Cover canonical dataset identity, row basis, freshness, cleaning state, semantic metric definition, aggregation, dimensions, filters, time period, and compact row-free session state.

Acceptance Checks:
- The contract reference documents all three BI result fields.
- Analytical answer and chart artifacts receive backend-derived BI grounding.
- Structured refinements execute through the deterministic metric resolver.
- The Decision Chat backend suite passes.

Ownership:
Codex owns this completed backend implementation.
