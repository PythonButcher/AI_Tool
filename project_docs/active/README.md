# Active Documentation Map

Give Codex and Gemini a map, not a 1000 page instruction manual.

This file is the active navigation hub. If this file conflicts with an archived or completed document, this file wins.

## Read First

| Step | Read | Why |
| --- | --- | --- |
| 1 | `project_docs/active/status/decision_intelligence_execution_status.md` | Short current truth |
| 2 | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` | Ownership boundary |
| 3 | `project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md` | Active rollout |
| 4 | `project_docs/active/contracts/decision_objects.md` | Contract reference when touching payloads |
| 5 | `project_docs/active/codex_harness_engineering.md` | Run efficiency for substantial Codex work |

## Current Direction

AI Chat is the primary work surface. Existing AI Chat answers, charts, exploration outputs, artifact inspection, and exports must remain.

Decision Intelligence should become a richer structured output inside the AI Chat results pane. The Decisions window should later become secondary: saved decision library, fullscreen review, or historical asset viewer.

Dataset truth remains important, but the old standalone Phase 4 dataset handoff is superseded. Dataset truth should now appear as Dataset Trust inside the AI Chat decision output.

## Active Areas

| Area | Location | Rule |
| --- | --- | --- |
| Status | `project_docs/active/status/` | Keep short; archive long history |
| Current rollout | `project_docs/active/decision_intelligence/current/` | One active plan only |
| Completed plans | `project_docs/active/decision_intelligence/completed/` | Reference only |
| Contracts | `project_docs/active/contracts/` | Backend/frontend payload truth |
| Handoffs | `project_docs/active/ai_hand_off/` | Active handoffs only |
| Reviews | `project_docs/active/reviews/` | Focused review docs |
| Archive | `project_docs/archive/` | Historical context only |

## Response Clarity Rule

Rollout plans must be written in plain language. Use short phase names, one purpose at a time, and direct acceptance checks. If a plan mentions a technical concept such as CDD, Decision Map, Dataset Trust, gates, or dashboard state, define it immediately.

## Phase Wrap-Up Rule

When Codex wraps up a project phase or clears a phase gate, the final response must automatically include a clean, paste-ready prompt for starting the next session. The wrap-up summary may describe the phase just completed, but the next-session prompt must not recap prior phases, review history, implementation history, or who approved earlier work. It may include only the minimum prerequisite state needed to start safely, such as `backend contract is ready` or `active handoff exists`, then point to the current docs and name the next task. Do not include sentences like `Phase N is complete`, `Codex implemented`, `reviewed by`, or detailed verification history inside the next-session prompt.

## Current Active File

`project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md`

## Superseded Or Completed Records

| Record | Current Location |
| --- | --- |
| Full old active status | `project_docs/archive/superseded_active_2026_05_24/decision_intelligence_execution_status_full_2026_05_24.md` |
| Old Phase 4 dataset plan | `project_docs/archive/superseded_active_2026_05_24/next_focus_execution_plan_old_phase4_dataset_2026_05_24.md` |
| Old Phase 4 Gemini dataset handoff | `project_docs/archive/superseded_active_2026_05_24/phase_4_gemini_frontend_canonical_active_dataset.md` |
| Completed Phase 2.5 plan | `project_docs/active/decision_intelligence/completed/phase_2_5_semantic_frame_completion_plan.md` |
| Completed Phase 3 plan | `project_docs/active/decision_intelligence/completed/phase_3_correction_and_observational_evidence_plan.md` |

Previous full active README was preserved at `project_docs/archive/superseded_active_2026_05_24/active_README_pre_map_cleanup_2026_05_24.md`.
