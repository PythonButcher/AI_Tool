> COMPLETED REFERENCE ONLY: This file is not part of the active handoff path. Current truth lives in `project_docs/active/status/decision_intelligence_execution_status.md` and the active rollout.

# Phase 5 Gemini Handoff: Chat-Native Corrections

## Purpose

Make Phase 5 complete end to end by wiring AI Chat frontend correction behavior to the verified backend correction contract.

Backend Phase 5 is already verified. The remaining gap is frontend-owned: AI Chat can call generic decision actions and auto-focus returned `decision_output`, but it does not currently create or submit a correction payload. Also, the `decision_output` correction-state renderer checks for `status === "success"`, while the backend contract now reports `correction_state.status: "updated"`.

## Backend Truth

Correction actions use the Decision Chat action endpoint:

`POST /api/decision/chat/actions`

The request must include:

`action: "draft_workspace"`

`session_state` from the active AI Chat decision turn

`dataset`

`semantic_model`

`correction`, using the existing deterministic correction contract with fields such as `correction_type`, `target_path`, `replacement`, and `reason`

Backend responses preserve compatibility by returning `workspace_preview` first and appending updated `decision_output`. The frontend should use the appended `decision_output` as the active result pane artifact when present.

Backend correction state now uses:

`decision_output.correction_state.status: "updated"`

The latest correction detail is under:

`decision_output.correction_state.latest`

Do not treat `status: "success"` as the only valid corrected state.

## Evidence From Codex Audit

`frontend/frontend/src/features/ai/AIShell.jsx` currently posts generic action payloads in `handleActionClick`, but that payload only includes `action`, `session_state`, `dataset`, and `semantic_model`. It does not include a `correction` object.

`AIShell.jsx` already auto-focuses the last rich artifact returned by action responses, including `decision_output`. That part is good.

`AIShell.jsx` currently renders `decision_output` correction state only when `doCorrection.status === "success"`. This misses the backend `updated` status and may also read fields from the wrong level, because the detailed correction fields live under `correction_state.latest`.

## Target Files

Primary file:

`frontend/frontend/src/features/ai/AIShell.jsx`

Likely style file only if UI controls need small styling:

`frontend/frontend/src/features/ai/AIShell.css`

Do not edit backend files unless a concrete backend contract mismatch is found.

Do not edit any `GEMINI.md` file.

## Required Frontend Behavior

AI Chat must expose a way to apply a deterministic correction to the active decision output. The correction UI may start small and explicit; it does not need to parse arbitrary natural language.

At minimum, the user should be able to correct one supported decision frame field through AI Chat, submit the correction through `/api/decision/chat/actions`, and see the active result pane refresh to the returned updated `decision_output`.

Use the existing backend correction contract. Do not invent unsupported recommendation, optimization, simulation, autonomous decisioning, prediction certainty, or causal claims.

After a correction response, the message should preserve the compatibility `workspace_preview` artifact and the results pane should show the appended `decision_output` when present.

The `decision_output` renderer must show active correction state when `correction_state.status === "updated"` and should read display details from `correction_state.latest` when available.

Follow-up allowed actions, especially `analyze_workspace`, must use the returned `session_state` from the correction response.

## Acceptance Check

Start from a decision prompt that produces a `decision_output`.

Apply a correction through AI Chat using the new frontend correction path.

Verify the network request to `/api/decision/chat/actions` includes `action: "draft_workspace"` and a valid `correction` object.

Verify the response artifacts keep `workspace_preview` first and include appended `decision_output`.

Verify the active result pane shows the updated `decision_output`, correction state displays as active, Dataset Trust remains visible, and readiness or allowed actions reflect the corrected state.

Run follow-up `analyze_workspace` from the corrected result and verify it uses the corrected state.

Also verify ordinary answer prompts still return answer artifacts and ordinary chart prompts still return chart artifacts.

## Verification Commands

Run:

`npm --prefix frontend\frontend run build`

Run:

`git diff --check`

Run one browser flow covering a normal answer, a normal chart, a decision prompt, a correction, and follow-up analyze action from the corrected decision output.

## Status Update Requirement

After implementation and verification, update `project_docs/active/status/decision_intelligence_execution_status.md`.

If the browser flow passes, set the project gate to Phase 5 end-to-end complete and ready for the next rollout phase. If anything remains unverified, say exactly what remains and do not mark Phase 5 complete.
