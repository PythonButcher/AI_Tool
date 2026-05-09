> ARCHIVED REFERENCE ONLY: This file is historical. Do not treat old wording below such as "active", "next", "source of truth", or "handoff" as current project truth.
# Phase 2: Navigation and Global Information Architecture

## Audience

This file is written for Gemini as the current source-of-truth navigation handoff for the UI overhaul.

It replaces the earlier "design prompt" version of Phase 2 with a code-backed status record so later frontend work can start from what is already implemented instead of re-opening settled decisions.

## Phase Status

Phase 2 is partially complete in the frontend.

The destination-based navigation direction is implemented enough to be treated as the active product structure, but it is not fully normalized across the shell yet.

What is settled:

- the product is no longer being framed around the old ribbon-first information architecture
- destination-based navigation is the correct direction
- the left rail is now the primary global navigation surface
- the top bar is now an orientation and setup surface rather than the primary navigation model
- Decision Intelligence frontend integration is live and must remain part of the destination model

What is not yet settled:

- exact destination ownership rules
- dashboard behavior versus destination state
- right-side field pane behavior by destination
- separation of Decisions from semantic-definition management
- exact shell/window behavior for default states versus opened work

## Current Implemented Navigation Reality

The live frontend now uses five top-level destinations:

- Workspace
- Explore
- Dashboards
- Decisions
- AI

This is implemented in:

- `frontend/frontend/src/App.jsx`
- `frontend/frontend/src/components/layout/SideBar.jsx`
- `frontend/frontend/src/components/layout/MenuBar.jsx`
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`
- `frontend/frontend/src/components/layout/DestinationHome.jsx`

Important clarification:

The original Phase 2 implementation record called this a 4-destination model, but the current code clearly supports five destinations because AI remains a first-class destination. Later phases should treat the five-destination model as canonical unless there is explicit approval to remove AI as a top-level area.

## What Phase 2 Has Already Achieved

## 1. Global Navigation Authority Moved to the Left Rail

The left rail in `SideBar.jsx` is now the clearest top-level navigation system in the app.

It does the following:

- displays the primary destinations
- highlights the active destination
- opens a destination-specific drawer
- gives each destination a distinct entry point rather than relying on overlapping ribbon tabs and workflow icons

This means later work should continue to strengthen the rail, not reintroduce competing top-level nav systems.

## 2. The Menu Bar Was Demoted from "Main Navigation" to "Context + Setup"

`MenuBar.jsx` now behaves primarily as:

- app identity
- active destination breadcrumb
- data/setup access
- utility actions

That is a good direction and should remain in place.

The top bar should not drift back into being a second primary navigation system.

## 3. Destination State Exists in App-Level Orchestration

`App.jsx` now owns:

- `activeDestination`
- `handleDestinationSelect`

The app uses that destination state to coordinate:

- sidebar highlighting
- top-bar breadcrumb
- canvas empty states
- compatibility mappings into older workflow state

This is the architectural backbone for the overhaul and should be preserved.

## 4. The Canvas Is Destination-Aware

`CanvasContainer.jsx` now changes some default behavior based on destination and renders `DestinationHome.jsx` for destination-level landing states.

This is important because it means the product is no longer only a neutral floating-window canvas. The shell now has the beginnings of destination-specific framing.

## 5. Decision Intelligence Integration Is No Longer Hypothetical

Decision Intelligence is implemented through:

- `frontend/frontend/src/features/business/decision/decisionApi.js`
- `frontend/frontend/src/features/business/decision/DecisionPanel.jsx`
- `frontend/frontend/src/App.jsx`

The `POST /api/decision/run` orchestration path is live and should be treated as a preserved capability during all later UI work.

Relevant supporting docs:

- `ai_handoff/backend_to_frontend/phase_3_handoff.md`
- `ai_handoff/phase_docs/phase_3_frontend_integration.md`

## The Current Information Architecture Decision

The active IA direction should be treated as:

### Workspace

Purpose:

- orientation
- data intake/setup entry
- readiness awareness
- first landing point when the user enters the product

### Explore

Purpose:

- charting
- exploratory analysis
- raw plus semantic field interaction
- fast path from question to chart

### Dashboards

Purpose:

- KPI monitoring
- dashboard charting
- dashboard-wide filters
- monitoring and saved analysis views

### Decisions

Purpose:

- decision readiness
- signals
- recommendations
- scenario preview
- downstream analytical actions launched from decision output

### AI

Purpose:

- conversational assistance
- AI charting / NLP workflows
- AI Workflow Lab
- AI report and narrative surfaces

## Important IA Constraints That Are Still Active

Later frontend work must preserve all of the following:

- existing backend endpoints and request/response contracts
- `decision_bundle`
- metric + `group_by` chart behavior
- semantic layer power
- dashboard and KPI workflows
- Decision Intelligence logic
- AI-assisted workflows
- current theme and tone

Do not remove capabilities in order to simplify the navigation model.

## What Phase 2 Did Not Fully Resolve

The destination model exists, but these issues remain open and now belong to Phase 3 execution:

## 1. Dashboards Is Still Both a Destination and a Visibility Mode

`handleDestinationSelect('dashboards')` opens dashboard state, but dashboard rendering still depends on `dashboardState.isVisible`.

That means Dashboards is not yet fully normalized into destination ownership.

## 2. Decisions Still Shares Space with Definitions

The Decisions drawer still includes `SemanticModelPanel`, which means semantic-definition management is still mixed into the Decision Intelligence area.

This preserves capability, but it keeps the old ambiguity alive.

## 3. The Right Data Pane Is Still Structurally Ambiguous

`DataPane.jsx` remains globally mounted and the `FieldsPanel` content is only lightly destination-aware.

This means the product still has an unresolved question:

- is the pane global
- destination-contextual
- Explore-first but available elsewhere
- or a guided helper surface

## 4. Chart Entry Is Improved but Not Yet Canonical

Explore is the intended analysis destination, but charting still has multiple entry paths:

- Explore drawer
- semantic quick actions
- dashboard actions
- AI chat
- decision recommendation actions

That is acceptable, but Explore must become the clearly dominant manual entry point.

## 5. AI Is Both a Destination and a Global Assistant

That is directionally acceptable, but the exact boundary is not fully documented yet.

Phase 3 must define the difference between:

- global AI help
- AI destination workflows
- AI outputs that appear inside the shared canvas

## Explicit Direction for Gemini

Do not reopen the top-level navigation labels unless something is materially broken.

The current destination set is good enough to continue from:

- Workspace
- Explore
- Dashboards
- Decisions
- AI

The next work should refine ownership, shell behavior, and workflow clarity inside that model rather than re-running a broad IA brainstorm.

## Relationship to the Phase 2 Implementation Record

Use this file as the current structural summary.

Use `phase_2_navigation_and_logic_overhaul.md` as the implementation-history companion document for the visual and state-management work already completed.

## Handoff Into Phase 3

Phase 3 should now focus on:

- shell stability
- destination ownership
- contextual pane behavior
- window behavior rules
- reducing lingering ambiguity between setup, analysis, monitoring, decisions, and AI workflows

Gemini should treat the navigation model as established and move the overhaul from "new direction" into "execution-ready shell behavior."
