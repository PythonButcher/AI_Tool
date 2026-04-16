# UI Overhaul Execution Status

## Purpose

This file is the quick status index for the UI overhaul handoff set.

Use it to understand:

- which overhaul phases are still planning artifacts
- which phases are backed by live implementation
- where Gemini should resume frontend work next
- where Codex should resume backend and contract work next

## Codex Guardrail

Before any Codex session touches frontend files for this initiative, read:

- `ai_handoff/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`

That guardrail is mandatory unless the user explicitly authorizes Codex to make frontend changes in the current session.

## Critical Transition Notice

Decision Intelligence V2 is now closed **as-is**.

This is a project-label and handoff decision, not a claim that the feature vision is complete.

From this point forward:

- V2 should be treated as the frozen baseline
- V3 is the active continuation path
- Codex and Gemini should both resume remaining Decision Intelligence work under V3

Primary V3 resume file:

- `ai_handoff/ui_overhaul/decision_intelligence_v3_resume_handoff.md`

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

- **COMPLETE** (implementation active in code)

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

## Decision Intelligence 2.0 (Historical Baseline)

Primary file:

- `decision_intelligence_2_0_overhaul.md`

Primary backend/product contract:

- `ai_handoff/shared_contracts/decision_intelligence_2_0_contract_v1.md`

Role:

- full overhaul of the decision-making architecture
- move the product from broad dataset-level insight summaries to scoped decision workflows
- center the system on objective, levers, constraints, simulations, trade-offs, and uncertainty
- preserve the broader app shell, theme, and non-relevant features while replacing the weak decision paradigm

Status:
- **CLOSED AS V2 BASELINE**
- keep as historical implementation context
- do not treat this label as the active continuation target
- remaining work moves to V3

## Chat-First Decision Intelligence (Historical V2 Record)

Primary file:
- `ai_handoff/phase_docs/decision_intelligence_chat_first_v2_execution_plan.md`

Frontend handoff:
- `ai_handoff/ui_overhaul/decision_intelligence_chat_shell_gemini_handoff_01.md`

Status:
- **PHASE 1 COMPLETE**: New AI destination shell implemented.
- Core chat logic relocated from floating `AIChat.jsx` to dedicated `AIShell.jsx`.
- Three-region layout established: Navigation Rail, Conversation Area, and Context/Artifact Pane.
- Floating `AIChat` icon converted to a global navigation shortcut for the AI destination.
- Preserved all existing AI capabilities: natural language charting, dataset mentions, and `/charts` / `/clean` commands.
- Truth-aligned placeholders added for Skills, Recipes, Sources, and Decision Drafting.
- Treat this as V2 recordkeeping only; further completion/polish belongs to V3.

## Phase 4 (Decision Intelligence 2.0 Historical Record)

Primary file:

- `decision_intelligence_2_0_overhaul.md`

Contracts:

- `ai_handoff/shared_contracts/decision_intelligence_2_0_contract_v1.md` (historical baseline)
- `ai_handoff/shared_contracts/decision_intelligence_2_0_contract_v2.md` (historical draft)

Frontend handoffs:

- `decision_intelligence_2_0_gemini_handoff_01_scoped_decision_workspace.md` (historical)
- `decision_intelligence_2_0_gemini_handoff_02_simulation_and_tradeoffs.md` (historical blocked planning handoff)
- `decision_intelligence_2_0_gemini_handoff_04_v1_frontend_contract_alignment.md` (historical V2 completion handoff)

Status:
- **CLOSED AS-IS UNDER V2**
- useful baseline, not final completion state
- any remaining UI/product/backend follow-up continues under V3


Active Codex work:

- none under the V2 label beyond historical maintenance
- new work should be framed as V3 work

Frontend follow-up after Codex:

- move to V3 planning and execution instead of continuing V2 completion language

## What Is Actually Implemented Today

The live frontend already has:

- destination-based app state in `App.jsx`
- left-rail destination navigation in `SideBar.jsx`
- context/setup menu bar in `MenuBar.jsx`
- destination-aware canvas home states in `CanvasContainer.jsx` and `DestinationHome.jsx`
- DI 2.0 scoped decision workspace flow (composer + view)
- active Decision Intelligence run flow and panel rendering
- backend-driven readiness metadata wired into frontend state

The backend already has:

- `POST /api/decision/workspaces`
- normalization for objective, levers, and constraints
- contract-faithful `ready` / `needs_input` / `limited` status classification
- honest scoped metric and dimension selection anchored on objective, levers, constraints, and applied filters
- contract-faithful `time_context` and `period_context` with metric-first, scoped-slice, and time-horizon fallback behavior
- stronger unknown and blocker generation for unresolved objective, lever, and hard-constraint gaps
- additive legacy-path preservation without using the legacy decision bundle as the primary DI 2.0 model

## Resume Point For Gemini

Gemini should not resume under the V2 label.

Gemini should resume from:

- `ai_handoff/ui_overhaul/decision_intelligence_v3_resume_handoff.md`

Use the older V2 Gemini files only as historical implementation references.

## Resume Point For Next Codex Branch

When starting the next branch or fresh Codex session, begin from:

- `ai_handoff/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
- `ai_handoff/ui_overhaul/ui_overhaul_execution_status.md`
- `ai_handoff/ui_overhaul/decision_intelligence_v3_resume_handoff.md`

Then use:

- the relevant V2 historical contract/handoff files only as supporting context

Treat those files as the active execution set for beginning V3 from the frozen V2 baseline.

## Guidance For Codex

Codex should actively handle:

- backend logic implementation
- contract enforcement
- architecture decisions
- logic review
- markdown handoff maintenance inside `ai_handoff/`

Codex should not implement frontend/UI code directly for this initiative unless the user explicitly instructs otherwise.
