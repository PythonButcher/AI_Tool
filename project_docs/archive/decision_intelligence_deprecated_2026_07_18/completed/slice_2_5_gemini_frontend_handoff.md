> COMPLETED REFERENCE ONLY: This file is not part of the default active scan path. Any old wording below such as "active", "next", "required", or "handoff" is historical unless the current status or active execution plan explicitly points here.
# Slice 2.5 Gemini Frontend Handoff

## Purpose

This handoff is the frontend execution plan for Slice 2.5: Decision-Readable Draft Responses.

Codex completed the backend portion first. Gemini owns the frontend rendering pass.

## Backend Truth

The backend now returns richer draft workspace preview content from AI chat decision prompts.

Relevant backend response surfaces:

- `draft_workspace_preview`
- `artifacts[]` items with `type: "workspace_preview"`

The preview now includes both the older compatibility fields and new readable fields:

- `decision_kickoff`
- `status_label`
- `objective_metric`
- `time_horizon`
- `levers`
- `segment_dimensions`
- `guardrails`
- `readiness_meaning`
- `truthfulness_note`
- `recommended_next_action`
- `prompt_frame`

The frontend should prefer the new readable fields when present, but preserve fallback behavior for older preview shapes.

## Problem To Fix

The current AI chat draft workspace preview can still feel like a debug card because it surfaces `Status ready`, lever counts, and `Inputs Needed: 0` without explaining what the system understood or what the user should do next.

For a prompt like:

`How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?`

The frontend should render the response as a decision kickoff, not as a sparse contract summary.

## Frontend Scope

Read first:

`project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`

Then inspect:

`frontend/frontend/src/features/ai/AIShell.jsx`

Likely related styling lives near the AI shell styles. Preserve the existing visual system and do not introduce unrelated redesign work.

## Required Rendering Behavior

When `decision_kickoff` exists, the workspace preview should clearly show:

What the system understood: objective, time horizon, levers, segment dimensions, and guardrails.

What ready means: `ready` means structurally ready for observational workspace analysis, not ready for a final decision.

Truthfulness: the draft is not a recommendation, simulation, optimizer, or final decision.

Next action: show the recommended next action from `recommended_next_action`, usually `Analyze workspace` for structurally complete drafts.

The UI should avoid foregrounding `Inputs Needed: 0` as the main message. Missing inputs are still useful when nonzero, but zero missing inputs should not be the hero of the card.

## Constraints

Preserve existing AI chat behavior, chart rendering, action handling, inspector behavior, and fallback rendering.

Do not add frontend-only fake intelligence.

Do not imply that a draft workspace is a recommendation, simulation, optimizer, or final decision.

Do not hide, remove, disable, or simplify existing features unless explicitly approved by the user.

Do not weaken the backend contract by inventing frontend interpretations when the backend already provides readable fields.

## Acceptance Check

Use this prompt:

`How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?`

Expected visible result:

The draft preview should show objective `Revenue`, lever `Marketing Spend`, segment `Channel`, guardrail `Gross Margin %`, readiness as structurally ready for observational analysis, the truthfulness note, and `Analyze workspace` as the recommended next action.

The user should understand what was framed, why it is analysis-ready, and why the next step is analysis rather than a final recommendation.

## Short Gemini CLI Prompt

Update Slice 2.5 frontend rendering for Decision Intelligence AI chat. Read the active docs and frontend guardrail first, especially the Slice 2.5 Gemini handoff. Use the new backend draft preview fields in `draft_workspace_preview` and `workspace_preview`, especially `decision_kickoff`, `status_label`, `readiness_meaning`, `truthfulness_note`, and `recommended_next_action`, so the draft workspace preview becomes a plain-English decision kickoff instead of a sparse Status ready / Inputs Needed card. Preserve existing AI chat, chart, action, inspector, and fallback behavior. Do not imply recommendation, simulation, optimization, or final decision. Test the marketing spend by channel / gross margin prompt and update the active status doc truthfully when done.
