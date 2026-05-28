# Decision Intelligence Execution Status

This is the short active status file. Detailed historical status was archived so active agents have a map, not a 1000 page instruction manual.

Full preserved status history: `project_docs/archive/superseded_active_2026_05_24/decision_intelligence_execution_status_full_2026_05_24.md`

## Current Truth

Decision Intelligence V3 is active.

Phase 1 reliability foundation is complete. Phase 2 semantic metadata plumbing is complete. Phase 2.5 semantic frame completion is complete. Phase 3 correction actions and ranked observational evidence are complete on the backend and frontend. Phase 4.5 AI Chat hardening is complete.

The old standalone Phase 4 Canonical Active Dataset handoff is superseded as the active next path. Dataset truth is still important, but it now belongs inside the AI Chat decision output unification plan as Dataset Trust.

## Active Direction

AI Chat is the primary work surface.

Existing AI Chat behavior must remain: normal answers, charting, exploration, decide mode, artifact inspection, and exports.

Decision Intelligence should become a richer structured output in the AI Chat results pane. The Decisions window should later become secondary: saved decision library, fullscreen review, or historical asset viewer.

## Active Plan

Read: `project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md`

The active work is to unite existing work, not start a separate dashboard project.

## Ownership

Codex owns backend truth, contracts, tests, architecture, documentation, cleanup planning, and review.

Gemini owns frontend implementation unless the user explicitly authorizes Codex frontend edits in the current session.

## Active Workstreams

| Workstream | Status |
| --- | --- |
| AI Chat answer/chart/explore behavior | Keep and protect |
| Decision chat contract and actions | Complete foundation |
| Workspace drafting and correction | Complete foundation |
| Ranked observational evidence | Complete foundation |
| Dataset Trust inside AI Chat output | Active next backend/frontend contract target |
| Unified AI Chat decision output artifact | Active next Codex contract target |
| Decisions window required-continuation flow | Superseded direction |
| Legacy recommendations, Autopilot, AutoML prominence | Prune or rewrite after replacement path exists |

## Verification Baseline

Existing backend and frontend verification details live in the archived full status file. New work must record only current facts here: files changed, checks run, and remaining gaps.

## Phase 1 AI Chat Decision Output Protection - 2026-05-25

Codex inspected the active backend decision chat service, decision routes, decision object contract, and focused backend tests. Existing tests already covered the main answer, chart, decide-mode preview, workspace analysis, and action response paths. Phase 1 added focused regression assertions in `tests/test_decision_chat_service.py` for stable artifact metadata on `answer`, `chart`, `workspace_preview`, and `workspace_analysis_summary`, plus a correction-action route check that preserves the existing `workspace_preview` response contract.

No `decision_output` or Dataset Trust implementation started in this slice. `python -m py_compile tests\test_decision_chat_service.py` passed. `python -m unittest tests.test_decision_chat_service` could not run in the current interpreter because Flask/Werkzeug dependencies are incomplete locally; dependency installation was not approved in this session.

Gemini review verdict: useful. The review confirmed the Phase 1 tests provide meaningful regression protection for current AI Chat artifact routing, metadata, decide-mode compatibility, and correction response shape, with no frontend or `GEMINI.md` changes and no premature Phase 2 implementation. Before or during Phase 2, resolve the local Flask/Werkzeug test environment so the focused backend suite can move from compile-only verification to full behavioral verification.

Next active slice: Phase 2, add backend-owned Dataset Trust to AI Chat decision output payloads additively while preserving all Phase 1 protected artifact contracts.

## Phase 2 Dataset Trust Backend Slice - 2026-05-26

Codex resolved the local backend test runner blocker enough for focused tests to execute by installing the project requirements into the workspace-local `.codex_tmp_py/site-packages` target and running tests with `PYTHONPATH=.codex_tmp_py\site-packages`. The default `python` interpreter still does not see the user-site Flask install, and a direct user-site reinstall hit a Windows permission error while replacing MarkupSafe, so the reliable project-local test command currently needs that `PYTHONPATH` prefix.

Backend Dataset Trust is now additive in AI Chat decision responses. `backend/services/decision_support.py` owns a conservative `build_dataset_trust` helper. `backend/decision_engine/chat_service.py` returns top-level `dataset_trust`, attaches the same object to returned artifacts, and stores it in returned session state where context or decision state exists. `backend/routes/decision.py` adds `dataset_trust` to Decision Chat turn/action validation errors so missing-dataset failures can still tell the frontend what the backend knows.

Frontend and future Phase 3 work can rely on `dataset_trust.dataset`, `source_label`, `row_count`, `column_count`, `semantic_ready`, `transform_state`, `stale_state`, and `warnings`. Loaded datasets can report explicit source, transform, and stale state when provided. Inline payloads are identified as `Inline payload`, default to `raw`, and use `not_applicable` stale state. Missing datasets return `dataset: null`, zero counts, and warnings instead of guessing.

Updated contract: `project_docs/active/contracts/decision_objects.md`. Focused tests added in `tests/test_decision_chat_service.py` cover loaded dataset, inline dataset, and missing dataset Dataset Trust behavior. No `decision_output` artifact was implemented. No frontend files or `GEMINI.md` files were touched.

Verification run with `PYTHONPATH=.codex_tmp_py\site-packages`: the three new Dataset Trust tests passed, and `python -m py_compile backend\services\decision_support.py backend\decision_engine\chat_service.py backend\routes\decision.py tests\test_decision_chat_service.py` passed. The full `python -m unittest tests.test_decision_chat_service` suite now runs but still has 7 pre-existing behavioral failures unrelated to Dataset Trust: chart source expectation `chart_engine` versus current `semantic_metric`, stale `draft_workspace_preview` still present after an analytic follow-up, and several prompt-drafting expectations for mix levers such as `Channel mix`, `Region mix`, and `Product Category mix`.

Phase 3 remains: define the unified `decision_output` artifact after the existing Phase 1 contracts and the new Dataset Trust contract are stable. Before treating the full chat suite as a green regression gate, the 7 baseline chat-service expectation mismatches need a separate cleanup or test-truth pass.

## Phase 3 Readiness Gate - 2026-05-26

The project is not yet cleanly ready to start Phase 3 implementation as a normal green-gate backend slice. Phase 2 Dataset Trust is implemented and its focused tests pass, but the focused Decision Chat suite still has 7 failures. Those failures touch behavior Phase 3 must protect: chart artifact source truth, explore follow-up behavior after a decision prompt, and prompt-first drafting expectations for mix levers such as Channel mix, Region mix, and Product Category mix.

The next Codex session should start with a Phase 3 readiness pass, not immediate `decision_output` implementation. That pass should decide whether each failing assertion is a stale test expectation or a real regression, then update code or tests accordingly. Only after `PYTHONPATH=.codex_tmp_py\site-packages python -m unittest tests.test_decision_chat_service` passes, or after a documented owner-approved exception, should Codex implement the `decision_output` artifact.

When the gate is cleared, Phase 3 should remain backend-only: document the `decision_output` contract, add a small composer service or function, return `decision_output` alongside existing `workspace_preview` and `workspace_analysis_summary`, preserve Dataset Trust, preserve all existing artifact types, and add focused tests for complete draft, incomplete draft, analyze action, and correction action.

## Phase 2 Baseline Cleanup - 2026-05-28

Codex cleared the 7 remaining Decision Chat baseline failures left after Phase 2. The focused suite now treats semantic metric chart requests as `source: "semantic_metric"` while preserving `type: "chart"` and chart rendering metadata. Prompt-first drafting tests now follow the Phase 2.5 contract: `by channel`, `by region`, and `by product category` are asserted through `segment_dimensions` and readable kickoff `segments`, not duplicated as fake mix levers.

One backend response-shape fix was made in `backend/decision_engine/chat_service.py`: explore follow-ups can preserve a prior draft in `session_state` without surfacing that prior draft as the active top-level `draft_workspace_preview`. This keeps decision continuity available while letting answer and chart turns remain response-specific.

Verification passed with `PYTHONPATH=.codex_tmp_py\site-packages python -m unittest tests.test_decision_chat_service` and `PYTHONPATH=.codex_tmp_py\site-packages python -m py_compile backend\decision_engine\chat_service.py tests\test_decision_chat_service.py`.

## Canonical Resume Order

| Step | Read |
| --- | --- |
| 1 | `project_docs/INDEX.md` |
| 2 | `project_docs/active/README.md` |
| 3 | `project_docs/active/status/decision_intelligence_execution_status.md` |
| 4 | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` |
| 5 | `project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md` |

## One-Line Status Truth

Decision Intelligence should now be unified through AI Chat's output pane while preserving existing AI Chat answers, charts, exploration, artifact inspection, and exports.
