# Phase 4 Backend To Frontend Handoff

## Status

Frontend cleanup and contract-consumption work required.

Phase 4 does **not** introduce a new backend endpoint.

Instead, the existing decision pipeline now exposes the metadata needed for a frontend-led usability pass:

- `POST /api/decision/run`
- additive `readiness`
- existing `decision_bundle`
- UI-safe `warnings`
- additive business-facing time metadata:
  - `brief.period_context`
  - `brief.key_metrics[].period_label`
  - `brief.key_metrics[].comparison_label`
  - `scenario_preview.period_context`
  - `scenario_preview.projections[].baseline_label`
  - `scenario_preview.projections[].projected_label`

## What Gemini Should Read Together

Gemini should use these files together:

- `ai_handoff/ui_overhaul/phase_4_decision_experience_redesign.md`
- `ai_handoff/phase_docs/phase_4_backend_usability_support.md`

The first file defines the product and shell direction.

The second file defines the backend readiness behavior and the exact frontend interpretation rules.

Gemini should also treat fiscal/calendar time intelligence as an active product requirement for this phase.

## Backend Reality For Phase 4

The current backend now supports the core frontend needs for this phase:

- guided empty success states
- readiness metadata
- non-blocking warnings
- additive bundle structure
- recommendation-driven chart launch payloads
- business-facing period labels for the existing sequential time comparison flow

What this means in practice:

- Gemini should consume the new additive period/comparison fields instead of inventing labels in the UI
- Gemini should preserve all current features while improving clarity
- Gemini should still not invent fiscal logic the backend does not provide

Current limitation that remains real:

- the backend does **not** yet expose a populated `fiscal_calendar` object
- `fiscal_calendar` is currently `null` unless Codex explicitly adds fiscal support later
- current comparison labeling reflects sequential observed/calendar periods, not true fiscal-year logic

Emergency correction now implemented:

- Decision Intelligence may no longer use hidden backend "active dataset" fallback when the frontend has no explicit dataset context
- the frontend now sends the current explicit dataset/semantic-model context for decision runs when available
- if the current UI has no dataset rows, readiness must stay in the missing-dataset state and the app must not advertise a connected decision source
If the desired time-intelligence behavior requires true fiscal support, Gemini should report the gap back to Codex instead of simplifying or hiding the feature.

## Critical Rules

- do not expect a separate readiness endpoint
- do not treat missing setup requirements as blocking backend failures
- do not change `decision_bundle`
- do not change the `metric_id` plus `group_by` action contract
- do not introduce new backend dependencies without handing the request back to Codex
- do not remove or weaken existing decision features just because the current time-intelligence support is incomplete
- do not reinterpret `fiscal_calendar: null` as permission to hide time context; use the available period labels and leave room for richer fiscal support later
- do not reintroduce any frontend behavior that makes Decisions appear ready when no explicit current dataset exists

## Frontend Focus

Gemini should use the backend exactly as documented and concentrate on:

- guided readiness states
- clearer pre-run decision orientation
- more readable evidence and recommendation rendering
- better destination-level integration of the decision flow
- cleanup of the duplicate frontend `WindowProvider` architecture issue without regressing behavior
- frontend cleanup that consumes the finalized period/comparison fields cleanly
- frontend UX that is ready for richer fiscal/calendar comparison context when backend support expands

## Codex / Gemini Boundary

Codex continues owning backend logic and markdown coordination.

Gemini should keep this phase frontend-only unless Codex explicitly reopens backend work.
