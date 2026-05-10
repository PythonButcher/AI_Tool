# Active Documentation Navigation

This is the first active documentation page after `project_docs/INDEX.md`.

Its job is to stop agents from scanning old plans, completed handoffs, and archive material by accident. If another document conflicts with this navigation file or the active status file, this navigation file and the status file win.

## Current Scan Path

| Step | Read | Why |
| --- | --- | --- |
| 1 | `project_docs/active/status/decision_intelligence_execution_status.md` | Current project truth, current phase state, and next recommended work. |
| 2 | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` | Ownership boundary: Codex does backend/contracts/docs; Gemini owns frontend unless explicitly reauthorized. |
| 3 | `project_docs/active/agent_council/outputs/application-next-focus-priorities/README.md` | Current next-focus decision after Phase 4.5 hardening. |
| 4 | `project_docs/active/agent_council/outputs/application-next-focus-priorities/2026-05-01-council.json` | Detailed ranked recommendations for the next work. |
| 5 | `project_docs/active/decision_intelligence/current/phase_2_semantic_role_strengthening_plan.md` | Active implementation plan. |
| 6 | `project_docs/active/decision_intelligence/current/next_focus_execution_plan.md` | Council-derived roadmap and later-phase sequencing. |
| 7 | `project_docs/active/contracts/decision_objects.md` | Current backend/frontend decision object contract reference. |

Do not start by reading every file in `project_docs/active/decision_intelligence/`. That folder now has a README plus `current/` and `completed/` subfolders. Read the README first and open only the specific file needed.

## Current Project Truth

Decision Intelligence V3 is the active product line. Phase 4.5 AI Chat hardening is complete. The app has a real backend chat contract, grounded `ask`, `explore`, and `decide` modes, real action handling, chat-to-Decisions continuity, truthful observational-analysis language, and improved artifact rendering.

Phase 1 reliability foundation is complete. The active next priority is Phase 2 semantic role strengthening, not broad feature expansion. The next Codex-owned slice should add decision-aware semantic roles, confidence, aliases, polarity, controllability, and unresolved mapping details while preserving existing contracts. Gemini frontend work should wait until backend semantic fields and contracts stabilize.

## Documentation Areas

| Area | Location | Default Action |
| --- | --- | --- |
| Current status | `project_docs/active/status/` | Read first for active truth. |
| Rules | `project_docs/active/rules/` | Read when ownership or frontend scope matters. |
| Current council decision | `project_docs/active/agent_council/outputs/application-next-focus-priorities/` | Read when choosing next work. |
| Contracts | `project_docs/active/contracts/` | Read when touching backend response shape, frontend consumption, or Gemini handoff. |
| Decision Intelligence docs | `project_docs/active/decision_intelligence/` | Do not bulk scan. Use `current/` for active docs and `completed/` only for reference. |
| Reviews | `project_docs/active/reviews/` | Read only when the task touches the reviewed area. |
| Archive | `project_docs/archive/` | Do not scan unless an active doc explicitly points there or the user asks for historical context. |

## Current Next Work

The next implementation slice should be:

Implement Phase 2 semantic role strengthening. Add additive backend semantic metadata that helps decision framing distinguish objective metrics, controllable levers, guardrails, segment dimensions, temporal fields, weak mappings, and ambiguity without pretending low-confidence matches are certain.

The active plan for that work is `project_docs/active/decision_intelligence/current/phase_2_semantic_role_strengthening_plan.md`.

Good first files for that slice are `backend/services/semantic_model.py`, `backend/routes/semantic_model.py`, `backend/decision_engine/chat_service.py`, `backend/services/decision_workspace_service.py`, `tests/test_decision_reliability_benchmark.py`, `tests/test_decision_workspace_service.py`, and `project_docs/active/contracts/decision_objects.md`.

## Do Not Scan By Default

Do not scan `project_docs/archive/`.

Do not scan `project_docs/active/decision_intelligence/completed/` unless the current task specifically asks for completed plans, historical implementation details, or frontend handoff review.

Do not treat old Phase 4 checklist items as current truth if they conflict with `project_docs/active/status/decision_intelligence_execution_status.md`.

Do not treat the Agent Council sample JSON as a live council result.
