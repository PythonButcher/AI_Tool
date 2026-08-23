> CLOSED REFERENCE — The user accepted the current inspector layout and waived this optional repair.

# Antigravity Handoff — Relationship Inspector Flush Layout

## REPAIR REQUIRED

Goal: Keep every relationship source and field selector flush inside the right-side inspector so long dataset or field names never push controls off-screen or create a horizontal scrollbar.

## Repair Blocker

The relationship inspector is 400px wide with 20px body padding, but `.source-select` has no bounded width or flex/grid shrink rule. A long selected source name gives the native select an intrinsic width that expands the `.source-headers` row beyond the inspector. The right selector is clipped beyond the viewport and the inspector body gains horizontal scrolling.

## Target Files

Read `project_docs/active/status/project_execution_status.md` and inspect `frontend/frontend/src/features/data-model/RelationshipInspector.css` plus the source-selector and field-pair markup in `RelationshipInspector.jsx`.

Implement the repair in `RelationshipInspector.css` unless a minimal markup adjustment is genuinely required. Do not change relationship state, API calls, validation behavior, mutation sequencing, copy, or backend files. Do not edit `GEMINI.md`.

## Required Layout

The inspector must remain inside its containing canvas at its normal width and at narrower available widths. Account for borders and padding with explicit box sizing and a bounded width such as the smaller of the preferred inspector width and the available container width.

Make the left and right source controls share the available row width with shrinkable columns, a fixed compact relationship separator, and no intrinsic-width expansion from long option labels. Each select must have `min-width: 0`, a bounded `width` or `max-width`, and consistent box sizing. Long selected labels may truncate visually inside the closed control, but the entire control and its focus outline must remain visible.

Apply the same shrink discipline to field-pair rows so both field selectors, the equals sign, and the remove control stay within the inspector padding. Do not use `overflow-x: hidden` as the only repair; the controls themselves must calculate within the available width. Vertical scrolling may remain when content is tall, but there must be no horizontal scrollbar.

## Acceptance

At the current 400px inspector width, both source selectors must align flush inside the 20px body padding with the separator centered between them. A long dataset name such as `intelligence_prompt_first_demo_clean` must not move the right selector off-screen. The same must hold for long field names and for a narrower containing canvas.

Existing relationship creation, field-pair editing, validation, activation, deletion, keyboard focus, labels, and error presentation must remain unchanged.

Run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `npm --prefix frontend\frontend run build`. Return the exact changed-file list and verification results to Codex, then stop for targeted review. User browser acceptance remains in chat.
