# Active Documentation Map

Give Codex and Gemini a map, not a 1000 page instruction manual.

This file is the active navigation hub. If this file conflicts with an archived or completed document, this file wins.

## Read First

| Step | Read | Why |
| --- | --- | --- |
| 1 | `project_docs/active/status/decision_intelligence_execution_status.md` | Short current truth |
| 2 | `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` | Ownership boundary |
| 3 | `project_docs/active/contracts/decision_objects.md` | Contract reference when touching payloads |
| 4 | `project_docs/active/codex_harness_engineering.md` | Run efficiency for substantial Codex work |
| 5 | `project_docs/active/agent_harness/README.md` | Reusable harness, hooks, and future-project template |

## Current Direction

AI Chat is the primary work surface. Existing AI Chat answers, charts, exploration outputs, artifact inspection, and exports must remain.

Decision Intelligence is now a richer structured output inside the AI Chat results pane. The completed rollout includes Dataset Trust, decision framing, chat-native corrections, Evidence Board, Decision Graph support, Scenario Compare, and export-ready decision sections.

The Decisions window remains secondary. It should not become a required continuation path unless a new approved slice defines a saved decision library, fullscreen review, or historical asset viewer.

Dataset truth remains important, but the old standalone Phase 4 dataset handoff is superseded. Dataset truth now appears as Dataset Trust inside the AI Chat decision output.

## Active Areas

| Area | Location | Rule |
| --- | --- | --- |
| Status | `project_docs/active/status/` | Keep short; archive long history |
| Current status | `project_docs/active/status/decision_intelligence_execution_status.md` | Single current source of truth |
| Implementation reference | `project_docs/active/decision_intelligence/current/ai_chat_decision_output_unification_rollout.md` | Completed rollout details and acceptance guidance; status file wins on current gate |
| Completed plans | `project_docs/active/decision_intelligence/completed/` | Reference only |
| Contracts | `project_docs/active/contracts/` | Backend/frontend payload truth |
| Agent harness | `project_docs/active/agent_harness/` | Reusable agent backbone, hooks, and validation |
| Handoffs | `project_docs/active/ai_hand_off/` | Active handoffs only |
| Reviews | `project_docs/active/reviews/` | Focused review docs |
| Archive | `project_docs/archive/` | Historical context only |

## Response Clarity Rule

Rollout plans must be written in plain language. Use short phase names, one purpose at a time, and direct acceptance checks. If a plan mentions a technical concept such as CDD, Decision Map, Dataset Trust, gates, or dashboard state, define it immediately.

## Orchestration Rule

Codex must facilitate the project, not only complete isolated implementation slices. Every wrap-up for Decision Intelligence work must say the current gate in plain language: complete end to end, backend-only complete, frontend verification needed, Gemini handoff needed, blocked, or ready for the next phase.

Do not leave the user to decide whether Gemini is needed. Codex should make that call from the active docs and verified evidence. If evidence is missing, the next task is a named audit, not a vague prompt.

Do not create a Gemini handoff until Codex has confirmed a concrete frontend gap or the user explicitly asks for Gemini to implement frontend work. Backend-only completion should be recorded as backend-only completion, not phase completion.

When Codex determines Gemini needs work, Codex must give the user a clean paste-ready Gemini prompt in the same final response. The user should not have to ask for the prompt separately.

Gemini frontend reviews must stay lightweight unless the user asks for deeper verification. Codex should use the active handoff, targeted source review, focused diff, and contract evidence before running expensive tools. A source-level blocker is enough to call `Not complete`; do not keep spending tokens on builds, browser automation, or broad scans after the blocker is clear.

Frontend builds are for inconclusive source review, missing or questionable Gemini build evidence, likely syntax/import failures, or explicit user requests. Browser/E2E checks are not the default review path; use them only when the gate depends on visible behavior and cheaper evidence is clean or insufficient.

## Status File Discipline

The active status file is for current truth, the current gate, and the latest verified fact. It is not an implementation diary. When a phase is fully closed and verified, move detailed slice notes to `project_docs/archive/` and leave a short archive pointer in active status.

## Phase Wrap-Up Rule

When Codex wraps up a project phase or clears a phase gate, the final response must automatically include a clean, paste-ready prompt for starting the next session. The wrap-up summary may describe the phase just completed, but the next-session prompt must not recap prior phases, review history, implementation history, or who approved earlier work. It may include only the minimum prerequisite state needed to start safely, such as `backend contract is ready` or `active handoff exists`, then point to the current docs and name the next task. Do not include sentences like `Phase N is complete`, `Codex implemented`, `reviewed by`, or detailed verification history inside the next-session prompt.

Before sending a final response after substantial Decision Intelligence work, Codex must run this stop check: did this response clear a backend gate, clear a frontend gate, wrap a project phase, mark a goal complete, or identify Gemini as the next owner? If yes, include the paste-ready next-session or Gemini prompt in the final response. A status summary without that prompt is incomplete.

## Current Active File

`project_docs/active/status/decision_intelligence_execution_status.md`

## Superseded Or Completed Records

| Record | Current Location |
| --- | --- |
| Full old active status | `project_docs/archive/superseded_active_2026_05_24/decision_intelligence_execution_status_full_2026_05_24.md` |
| Old Phase 4 dataset plan | `project_docs/archive/superseded_active_2026_05_24/next_focus_execution_plan_old_phase4_dataset_2026_05_24.md` |
| Old Phase 4 Gemini dataset handoff | `project_docs/archive/superseded_active_2026_05_24/phase_4_gemini_frontend_canonical_active_dataset.md` |
| Completed Phase 2.5 plan | `project_docs/active/decision_intelligence/completed/phase_2_5_semantic_frame_completion_plan.md` |
| Completed Phase 3 plan | `project_docs/active/decision_intelligence/completed/phase_3_correction_and_observational_evidence_plan.md` |
| Completed AI Chat emergency overhaul plan | `project_docs/active/decision_intelligence/completed/ai_chat_emergency_overhaul_action_plan.md` |

Previous full active README was preserved at `project_docs/archive/superseded_active_2026_05_24/active_README_pre_map_cleanup_2026_05_24.md`.
