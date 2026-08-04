# Project Active Gate — AI Chat Conversation Continuity And Backend Isolation

Goal: Make AI Chat answer every new question correctly across sustained conversations and isolate Decision Intelligence compatibility services from the primary BI backend runtime without removing supported AI Chat, charting, data, semantic-model, governance, artifact, or export behavior.

## User Outcome

Users can ask more than three distinct questions in one AI Chat conversation and receive an answer to the latest question every time. A new question must not replay the first answer, reuse a stale chart, or silently treat an unrelated request as a refinement. Legitimate follow-up requests still retain the governed dataset, workspace, metric, dimension, filters, and lineage needed for continuity.

The primary backend exposes and executes BI-first AI Chat behavior without loading Decision Intelligence workspaces, decision frames, readiness panels, command-center output, decision assets, graphs, scenarios, or recommendation pipelines into the normal request path. Compatibility-only services remain isolated and recoverable while their callers, routes, tests, and data dependencies are audited.

## Scope

Start by reproducing the sustained-conversation defect through `POST /api/decision/chat/turns` with at least eight distinct user questions in one session. Pass each returned `session_state` into the next request and supply the same rolling role/content message-list shape used by `frontend/frontend/src/features/ai/AIShell.jsx`. Prove whether the defect originates in request construction, mode detection, conversation-context alignment, session-state normalization, analytical refinement, artifact reuse, or response rendering before changing behavior.

The first backend targets are `backend/decision_engine/chat_service.py`, `backend/decision_engine/mode_detection.py`, `backend/routes/decision.py`, and focused coverage in `tests/test_decision_chat_service.py`. Inspect `frontend/frontend/src/features/ai/AIShell.jsx` only to verify the request and response boundary. Codex must not edit frontend files without explicit user authorization and a verified frontend defect.

Repair continuity so the current `user_message` is authoritative for every independent question. Structured state may carry dataset identity and validated analytical context, but it must not substitute an old `decision_prompt`, first-turn intent, cached artifact, or stale answer for the current request. Explicit refinements may reuse the last analytical context only when the request supplies valid refinement evidence.

Then inventory the runtime imports, blueprint registrations, endpoints, service calls, tests, persistence tables, and frontend callers for `backend/routes/decision.py`, `backend/decision_engine/`, and `backend/services/decision_*.py`. Separate active BI chat responsibilities from Decision Intelligence compatibility responsibilities at module and application-registration boundaries. Do not delete or disable a Python module, endpoint, persistence record, or response field until its active callers and compatibility requirements are proven.

Keep `/api/decision/chat/turns` compatible while the primary AI Chat boundary is separated. Any route migration must use a compatibility adapter and requires contract evidence plus a bounded frontend handoff only when source review proves one is necessary.

Use `project_docs/active/contracts/decision_objects.md`, `project_docs/active/contracts/multiple_data_source_workspace.md`, and `project_docs/active/contracts/multiple_data_source_relationships.md` as the supporting contracts. Update them only with behavior verified in source and tests.

## Contracts

Every AI Chat turn accepts the latest `user_message`, a bounded role/content message list, and structured `session_state`. The backend returns a new response derived from the latest message, an updated state, grounded artifacts when requested, and stable dataset or relationship lineage. Conversation length must not impose a hidden three-question limit.

Independent questions replace stale analytical intent while retaining only safe dataset and workspace identity. Follow-up refinements preserve the last compatible metric, dimension, filters, chart type, and governed analysis context. Dataset or workspace changes invalidate incompatible state instead of replaying old output.

AI Chat remains a BI-first surface. Grounded answers, tables, natural-language charting, conversational refinement, semantic metrics, multi-source execution, lineage, artifact inspection, dashboard pinning, exports, cleaning, governance, and one-source compatibility are protected behavior.

Decision Intelligence compatibility services are not primary AI Chat dependencies. Their registration and execution must be explicit, isolated, testable, and unable to alter AI Chat mode selection, session continuity, artifacts, or startup reliability.

## Acceptance

An automated conversation test sends at least eight distinct questions through the public chat route using a realistic rolling message list and returned state. Every response addresses its own current question, no turn repeats the first answer or chart unless the user explicitly asks for it, and the test includes both independent questions and valid refinements beyond the third question.

Focused tests cover message-list truncation, stale `decision_prompt` state, mode changes, unrelated new questions, chart-to-answer and answer-to-chart transitions, dataset changes, multi-source context, explicit filters, and one-source compatibility. Natural-language charting continues resolving readable measures and dimensions without accidental filters.

A source-backed backend inventory classifies each Decision Intelligence route and service as primary BI chat, compatibility-only, or unused with evidence. Primary application startup and normal AI Chat requests do not import or execute compatibility-only workspace, output, graph, asset, scenario, or recommendation pipelines. Compatibility behavior that remains supported has focused tests and an explicit registration boundary.

No supported AI Chat or data feature is removed. API and artifact compatibility remains stable unless a separately verified migration contract and owner handoff are created.

## Verification

Run the focused sustained-conversation test first, then `python -m unittest tests.test_decision_chat_service tests.test_nlp_chart_reliability tests.test_relationship_execution`. Add the focused route, application-registration, and compatibility suites affected by backend isolation.

Run `python -m py_compile` for every changed Python module, `python .codex/hooks/agent_harness_check.py`, `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`, and `git diff --check`.

## Owner And Control Return

Codex owns reproduction, backend implementation, compatibility inventory, contract updates, tests, documentation, and integration review. No frontend handoff is active. If source review proves a frontend defect or route migration requirement, Codex creates one bounded Antigravity handoff and retains control until that implementation returns for review.
