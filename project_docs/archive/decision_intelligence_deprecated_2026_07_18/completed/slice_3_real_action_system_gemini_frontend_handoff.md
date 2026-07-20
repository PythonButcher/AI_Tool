> COMPLETED REFERENCE ONLY: This file is not part of the default active scan path. Any old wording below such as "active", "next", "required", or "handoff" is historical unless the current status or active execution plan explicitly points here.
# Slice 3 Gemini Frontend Handoff

## Status

Complete.

Phase 4.5 Slice 3 backend and frontend work is finished, reviewed, and verified. The real action system now has stable backend action contracts, frontend primary/secondary and disabled-state rendering, duplicate-action filtering, scoped action-state persistence for thread and inspector views, and truthful observational analysis behavior.

## Purpose

This handoff is the frontend execution plan for Phase 4.5 Slice 3: Real Action System.

Codex completed the backend contract hardening first. Gemini owns the frontend action rendering pass.

## Backend Truth

The backend decision chat action contract is now stricter and more explicit in `backend/decision_engine/chat_service.py`.

Every decision action returned in `suggested_actions`, `session_state.available_actions`, and `action_state.available_actions` now carries a stable `action_id`, `label`, `intent`, `description`, `priority`, `enabled`, `availability_reason`, and `payload_expectations`.

The supported action IDs are `draft_workspace`, `show_assumptions`, `show_blockers`, `analyze_workspace`, and `open_workspace`.

Unsupported action IDs, including anything that implies an optimizer or autonomous decision engine, return a truthful backend error instead of a placeholder success path.

Action priority and enabled state are now meaningful. A structurally ready draft makes `analyze_workspace` the enabled primary action. An incomplete draft makes `show_blockers` the enabled primary action and disables `analyze_workspace` until the objective, lever, and guardrail structure is ready. Actions with no current content, such as assumptions or blockers, can be returned disabled with an availability reason.

Action responses are also normalized. Explicit action calls now return `executed_action`, `suggested_actions`, `action_state`, and annotated artifacts. `workspace_preview` artifacts include action context at the artifact top level. `workspace_analysis_summary` artifacts include action context inside `content`, plus `workspace_id`, `workspace_status`, `missing_inputs`, and a truthfulness note.

## Frontend Scope

Read first:

`project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`

Then inspect:

`frontend/frontend/src/features/ai/AIShell.jsx`

Likely styling remains near the existing AI shell styles. Preserve existing chat, chart, inspector, mode, and artifact behavior.

## Required Rendering Behavior

Render decision actions as real controls, not decorative chips.

The frontend should use `priority` to distinguish the main action from secondary actions, use `enabled` for disabled/loading state, and use `availability_reason` as the explanatory tooltip or nearby accessible explanation. Disabled actions should not execute. Avoid duplicate action surfaces when the same action appears in both message-level and state-level data.

The frontend should prefer the backend action contract over frontend guessing. Use `action_id` when invoking `/api/decision/chat/actions`. Treat `intent` and `payload_expectations` as metadata for rendering/debugging and future-safe handoff, not as a reason to invent new capabilities.

For artifact rendering, keep `workspace_preview` and `workspace_analysis_summary` compatible with the existing renderer while recognizing the normalized action fields. The UI must not imply recommendations, simulations, optimizers, or final decisions. `analyze_workspace` remains observational analysis only.

## Acceptance Check

Use the prompt:

`How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?`

Expected behavior: `Analyze workspace` is the enabled primary action, `Show blockers` is secondary and disabled when there are no blockers, all visible action controls explain their availability, and clicking `Analyze workspace` returns an observational analysis artifact without recommendation or simulation language.

Use the prompt:

`How should we adjust discount rate by region next quarter?`

Expected behavior: `Show blockers` is the enabled primary action, `Analyze workspace` is disabled with a clear reason, and blocker rendering shows the missing objective metric input.

After frontend changes, run the frontend build and perform live UI verification for both prompts. Update the active status doc truthfully when done.

## Short Gemini CLI Prompt

Implement the Phase 4.5 Slice 3 frontend action rendering pass for Decision Intelligence AI chat. Read the active docs and frontend guardrail first, especially `project_docs/active/decision_intelligence/completed/slice_3_real_action_system_gemini_frontend_handoff.md`. The backend now returns stable action contracts with `action_id`, `label`, `intent`, `priority`, `enabled`, `availability_reason`, and `payload_expectations`, plus normalized action response artifacts. Update `frontend/frontend/src/features/ai/AIShell.jsx` and nearby styles only as needed so decision actions render as real controls with primary versus secondary treatment, disabled and loading states, clear availability explanations, no duplicate action surfaces, and no fake recommendation, simulation, optimizer, or final-decision language. Verify the ready marketing-spend/channel/gross-margin prompt and the incomplete discount-rate/region prompt, run the frontend build, and update `project_docs/active/status/decision_intelligence_execution_status.md` truthfully.
