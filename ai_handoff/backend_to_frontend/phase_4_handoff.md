# Phase 4 Backend To Frontend Handoff

## Status

Frontend work required.

Phase 4 does **not** introduce a new backend endpoint.

Instead, the existing decision pipeline now exposes the readiness metadata needed for a frontend-led usability pass:

- `POST /api/decision/run`
- additive `readiness`
- existing `decision_bundle`
- UI-safe `warnings`

## What Gemini Should Read Together

Gemini should use these files together:

- `ai_handoff/ui_overhaul/phase_4_decision_experience_redesign.md`
- `ai_handoff/phase_docs/phase_4_backend_usability_support.md`

The first file defines the product and shell direction.

The second file defines the backend readiness behavior and the exact frontend interpretation rules.

## Backend Reality For Phase 4

The current backend already supports the core frontend needs for this phase:

- guided empty success states
- readiness metadata
- non-blocking warnings
- additive bundle structure
- recommendation-driven chart launch payloads

That means Gemini should begin with frontend behavior and presentation refinement rather than waiting for more backend work.

## Critical Rules

- do not expect a separate readiness endpoint
- do not treat missing setup requirements as blocking backend failures
- do not change `decision_bundle`
- do not change the `metric_id` plus `group_by` action contract
- do not introduce new backend dependencies without handing the request back to Codex

## Frontend Focus

Gemini should use the backend exactly as documented and concentrate on:

- guided readiness states
- clearer pre-run decision orientation
- more readable evidence and recommendation rendering
- better destination-level integration of the decision flow

## Codex / Gemini Boundary

Codex continues owning backend logic and markdown coordination.

Gemini should keep this phase frontend-only unless Codex explicitly reopens backend work.
