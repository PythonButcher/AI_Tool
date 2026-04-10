# UI Overhaul Execution Status

## Purpose

This file is the quick status index for the UI overhaul handoff set.

Use it to understand:

- which overhaul phases are still planning artifacts
- which phases are backed by live implementation
- where Gemini should resume frontend work next

## Current Status Snapshot

## Phase 0

File:

- `phase_0_ui_overhaul_master_plan.md`

Role:

- master constraints
- non-negotiable product direction
- phase structure

Status:

- active and still valid

## Phase 1

File:

- `phase_1_ui_audit_and_information_architecture.md`

Role:

- grounded audit of the pre-overhaul UI
- identifies fragmentation, overload, and IA problems

Status:

- complete as planning baseline

## Phase 2

Primary file:

- `phase_2_navigation_and_global_information_architecture.md`

Companion implementation record:

- `phase_2_navigation_and_logic_overhaul.md`

Role:

- records the destination-based navigation direction now active in the frontend
- documents which navigation decisions are settled versus still incomplete

Status:

- partially complete in code
- treat the destination model as established

## Phase 3

File:

- `phase_3_workspace_shell_and_destination_behavior.md`

Role:

- execution handoff for finishing shell behavior, destination ownership, pane behavior, and CTA wiring

Status:

- **COMPLETE** (Implementation active in code)

## Intermission Cleanup

File:

- `intermission_window_behavior_and_right_pane_cleanup.md`

Role:

- one-off cleanup slice between Phase 3 and Phase 4
- improve window sizing and resize stability across populated windows
- reduce right-pane bulk while preserving expandability and tone
- make field-catalog drag-and-drop clearer and more teachable

Status:

- baseline implementation work appears in code
- keep this file as a quality constraint reference, not as the active resume point

## Phase 4 (Current Priority)

Primary file:

- `phase_4_decision_experience_redesign.md`

Supporting backend/frontend handoff:

- `../backend_to_frontend/phase_4_handoff.md`

Supporting backend usability contract:

- `../phase_docs/phase_4_backend_usability_support.md`

Supporting time-intelligence requirement:

- `../phase_docs/phase_4_time_intelligence_requirement.md`

Role:

- **Decision Experience Redesign**
- Make Decision Intelligence understandable, actionable, and naturally accessible.
- Convert readiness metadata into guided setup and pre-run orientation states.
- Refine the current decision surface into a product-grade workflow instead of a basic payload view.

Status:

- active planning handoff complete
- backend time-label contract pass is now implemented
- frontend cleanup and contract-consumption should resume here next

## Phase 4 Part 2 (Next Planning Slice)

Primary file:

- `phase_4_part_2_scoped_decision_intelligence.md`

Role:

- define the next Decision Intelligence maturity step after the current stabilization pass
- move from broad current-context decision runs toward deliberate scoped decision workflows
- clarify how metric scope, filter scope, and dashboard-context handoff should work

Status:

- planning handoff created
- intended as the next Codex-led design task on a new branch/chat

## Backend / Decision Integration Inputs

Supporting docs outside this folder that remain important:

- `ai_handoff/backend_to_frontend/phase_3_handoff.md`
- `ai_handoff/backend_to_frontend/phase_4_handoff.md`
- `ai_handoff/phase_docs/phase_3_frontend_integration.md`
- `ai_handoff/phase_docs/phase_4_backend_usability_support.md`

These confirm that Decision Intelligence frontend/backend integration is already implemented and should be preserved during shell work.

The latest backend pass also finalized additive business-facing period metadata for the current sequential comparison flow:

- `decision_bundle.brief.period_context`
- `decision_bundle.brief.key_metrics[].period_label`
- `decision_bundle.brief.key_metrics[].comparison_label`
- `decision_bundle.scenario_preview.period_context`
- `decision_bundle.scenario_preview.projections[].baseline_label`
- `decision_bundle.scenario_preview.projections[].projected_label`

Important remaining limitation:

- explicit fiscal-calendar support is still not implemented, so `fiscal_calendar` remains `null`

## What Is Actually Implemented Today

The live frontend already has:

- destination-based app state in `App.jsx`
- left-rail destination navigation in `SideBar.jsx`
- context/setup menu bar in `MenuBar.jsx`
- destination-aware canvas home states in `CanvasContainer.jsx` and `DestinationHome.jsx`
- active Decision Intelligence run flow and panel rendering
- backend-driven readiness metadata wired into frontend state

## What Is Still Ambiguous

Phase 4 still needs Gemini implementation work for:

- turning readiness into stronger setup guidance and pre-run orientation
- making decision output easier to read and act on
- reducing the sense that Decision Intelligence is a separate hidden subsystem
- adding lightweight decision reachability from adjacent workflows without reopening navigation
- tightening decision-facing language so it matches the destination model

## Resume Point For Gemini

Resume from `phase_4_decision_experience_redesign.md`.

Use these alongside it:

- `ai_handoff/backend_to_frontend/phase_4_handoff.md`
- `ai_handoff/phase_docs/phase_4_backend_usability_support.md`
- `ai_handoff/phase_docs/phase_4_time_intelligence_requirement.md`

Treat the following as already decided:

- the app is destination-based
- the left rail is the primary navigation surface
- AI remains a top-level destination
- Decision Intelligence integration stays
- the new additive period/comparison fields are the current backend contract for time-aware decision labels

Treat the following as the active implementation target:

- preserve the current destination model while making Decision Intelligence materially easier to understand and use
- use backend readiness metadata as the source of truth for guided setup states
- improve the current Decisions destination and related decision entry points rather than reopening shell structure
- keep the decision UX ready for fiscal/calendar comparison context without inventing frontend-only time intelligence

## Resume Point For Next Codex Branch

When starting the next branch for the next Decision Intelligence maturity step, begin from:

- `phase_4_part_2_scoped_decision_intelligence.md`

Treat that file as the planning handoff for scoped decision intelligence rather than continuing to expand the current Phase 4 Part 1 stabilization file indefinitely.

## Guidance For Codex

Codex should continue handling:

- logic review
- architecture decisions
- planning refinement
- markdown handoff maintenance inside `ai_handoff/`

Codex should not implement frontend/UI code directly for this initiative unless explicitly instructed otherwise.
