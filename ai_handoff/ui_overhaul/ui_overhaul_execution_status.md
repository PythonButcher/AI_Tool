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

## Decision Intelligence 2.0 (Current Priority)

Primary file:

- `decision_intelligence_2_0_overhaul.md`

Primary backend/product contract:

- `ai_handoff/shared_contracts/decision_intelligence_2_0_contract_v1.md`

Current Codex focus:

- backend V1 follow-up only if frontend integration or contract bugs are discovered

Current Gemini handoff:

- `decision_intelligence_2_0_gemini_handoff_04_v1_frontend_contract_alignment.md`

Role:

- full overhaul of the decision-making architecture
- move the product from broad dataset-level insight summaries to scoped decision workflows
- center the system on objective, levers, constraints, simulations, trade-offs, and uncertainty
- preserve the broader app shell, theme, and non-relevant features while replacing the weak decision paradigm

Status:
- **POLISHED & STABLE** (Frontend layout rebuilt for product-grade UX)
- Decision composer transformed from schema form to "Guided Brief" UX
- Rebuilt compound-input patterns to eliminate layout overlap and improve responsive stacking
- High-fidelity "Decision Brief" rendering in Workspace View
- Legacy broad-scan bleed is removed; diagnostic signals are additive and secondary
- Phase 4 (V2) simulation/trade-off work is ready for architectural planning

## Chat-First Decision Intelligence (Current Priority)

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

## Phase 4 (Decision Intelligence 2.0)

Primary file:

- `decision_intelligence_2_0_overhaul.md`

Contracts:

- `ai_handoff/shared_contracts/decision_intelligence_2_0_contract_v1.md` (active)
- `ai_handoff/shared_contracts/decision_intelligence_2_0_contract_v2.md` (draft)

Frontend handoffs:

- `decision_intelligence_2_0_gemini_handoff_01_scoped_decision_workspace.md` (historical)
- `decision_intelligence_2_0_gemini_handoff_02_simulation_and_tradeoffs.md` (unblocked for planning)
- `decision_intelligence_2_0_gemini_handoff_04_v1_frontend_contract_alignment.md` (POLISHED)

Status:

- **POLISHED: V1 decision surface is visually stable and product-grade**
- Layout regressions from initial contract alignment are resolved
- Composer uses guided patterns rather than raw schema fields
- View emphasizes strategic objective and levers as a cohesive brief
- Readiness architecture is explicitly rendered to guide user input


Active Codex work:

- monitor and support frontend integration if contract bugs are discovered
- maintain the handoff and contract docs as the source of truth
- keep legacy decision-bundle behavior additive rather than primary

Frontend follow-up after Codex:

- consume the corrected backend contract behavior
- finish the remaining V1 request-shape and rendering gaps
- remove legacy bundle bleed from the primary DI 2.0 flow
- keep reset and create-new-workspace paths clean and trustworthy

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

Gemini should **not** resume from V2 yet.

Gemini should resume now from:

- `ai_handoff/ui_overhaul/decision_intelligence_2_0_gemini_handoff_04_v1_frontend_contract_alignment.md`

Priority work for that Gemini session:

- finish the remaining V1 frontend request fields that matter for honest workspace resolution
- render the remaining V1 scoped-context fields
- remove legacy broad-scan bleed from the primary DI 2.0 path
- align the UI behavior with the corrected backend `ready` / `needs_input` / `limited` semantics

## Resume Point For Next Codex Branch

When starting the next branch or fresh Codex session, begin from:

- `ai_handoff/shared_contracts/decision_intelligence_2_0_contract_v1.md`
- `backend/services/decision_workspace_service.py`
- `ai_handoff/ui_overhaul/decision_intelligence_2_0_overhaul.md`

Then use:

- `decision_intelligence_2_0_gemini_handoff_04_v1_frontend_contract_alignment.md`

Treat those files as the active execution set for supporting Gemini’s frontend completion pass and for policing any backend regressions before V2 work begins.

## Guidance For Codex

Codex should actively handle:

- backend logic implementation
- contract enforcement
- architecture decisions
- logic review
- markdown handoff maintenance inside `ai_handoff/`

Codex should not implement frontend/UI code directly for this initiative unless the user explicitly instructs otherwise.
