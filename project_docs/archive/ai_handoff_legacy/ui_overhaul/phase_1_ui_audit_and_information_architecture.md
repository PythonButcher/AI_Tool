> ARCHIVED REFERENCE ONLY: This file is historical. Do not treat old wording below such as "active", "next", "source of truth", or "handoff" as current project truth.
# Phase 1: UI Audit and Information Architecture

## Audience

This file is written for Gemini as the implementation-planning baseline for the UI overhaul.

Use it as an audit and structure document, not as a pixel-level design prescription. It is intentionally detailed about current frontend reality, pain points, and desired structural direction, while leaving room for creative design decisions in later phases.

## Scope of This Phase

This phase audits the current frontend UI structure and identifies:

- how the app is currently organized
- where major features currently live
- which surfaces are overloaded or fragmented
- where discoverability and guided flow break down
- what cleaner top-level information architecture should replace the current experience

This phase does not redesign the final UI. It establishes the planning baseline that later overhaul phases must respect.

## Ground Rules

This audit assumes the constraints from `phase_0_ui_overhaul_master_plan.md` remain fully active:

- preserve existing backend contracts
- preserve `decision_bundle`
- preserve metric + `group_by` charting behavior
- preserve semantic layer capabilities
- preserve dashboards
- preserve Decision Intelligence logic
- preserve current product theme and tone
- do not remove features without approval
- do not rely on backend rewrites to fix frontend usability

## Current Frontend Architecture Snapshot

## 1. App Structure Model

The current frontend is not organized as a route-driven product with clearly separated pages.

It is organized as a multi-surface desktop-style shell built around:

- a top ribbon (`MenuBar.jsx`)
- a left workflow rail and drawer (`SideBar.jsx`)
- a persistent right-side data/field pane (`DataPane.jsx`)
- a large central floating-window workspace (`CanvasContainer.jsx`)
- a floating AI chat overlay (`AIChat.jsx`)

Primary shell orchestration is centered in:

- `frontend/frontend/src/App.jsx`
- `frontend/frontend/src/components/layout/MenuBar.jsx`
- `frontend/frontend/src/components/layout/SideBar.jsx`
- `frontend/frontend/src/components/layout/DataPane.jsx`
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`

The system is powerful, but the interaction model depends on users understanding multiple layers of UI at once.

## 2. Shell Composition

The current app shell consists of five major surface types that coexist simultaneously:

### A. Top ribbon

The ribbon is the closest thing to top-level navigation. Current visible tabs are:

- Home
- Visualise
- Business
- AI
- Dashboard
- Settings

The ribbon also contains inline panels for:

- file upload
- data hub
- API connection
- database connection

This means the top bar serves both as navigation and as a command launcher.

### B. Left workflow rail and drawer

The left rail provides workflow icons for:

- Data
- Visualise
- Intelligence
- AI
- Dashboard
- Whiteboard

Selecting a workflow opens a drawer with context-specific actions and embedded panels.

### C. Right data pane

The right-side pane contains the `Field Explorer`, which mixes:

- raw dataset columns
- semantic metrics
- semantic dimensions
- drag-and-drop interactions
- quick semantic actions for charts, KPI cards, filters, and editing

This is one of the most important surfaces in the app, but it is not treated as the primary guidance surface.

### D. Floating window canvas

The center workspace is a window manager rather than a conventional page layout. It can display:

- data preview
- raw data viewer
- charts
- dashboard charts
- KPI cards
- AI workflow lab
- AI reports
- story panel
- whiteboard
- machine learning panel
- Decision Intelligence panel

This makes the app highly flexible, but also raises cognitive load because the workspace has no default primary narrative.

### E. Floating AI chat overlay

AI chat is always available through a floating launcher. It is visually and structurally separate from the main shell and can generate charts, cleaning actions, or general AI responses.

## 3. Navigation Reality

The app currently has multiple parallel navigation systems instead of one dominant information architecture:

- ribbon tabs
- left workflow rail
- drawer-level action cards
- right field explorer
- floating windows
- modal chart picker
- floating AI chat launcher

This is the root cause of much of the “where is that feature?” feeling.

Users are not navigating one product. They are navigating several overlapping control systems.

## Current Feature Map

## 1. Data Intake and Dataset Preparation

Current locations:

- file upload: ribbon Home tab inline panel
- managed datasets / hub: ribbon Home tab inline panel
- API connect: ribbon Home tab inline panel
- database connect: ribbon Home tab inline panel
- dataset preview: left drawer Data workflow and floating preview window
- raw viewer: left drawer Data workflow and floating window
- cleaning tools: embedded in Data workflow drawer
- filtering: separate filter panel launched from shell actions
- export: embedded in Data workflow drawer
- AI cleaning: AI chat `/clean`

Observations:

- data onboarding is functionally rich
- setup actions live in one place, but usage actions immediately jump to other surfaces
- preparation is fragmented across ribbon, drawer, filter panel, preview window, raw viewer, and AI chat

## 2. Field / Semantic / Business Definition Layer

Current locations:

- right `Field Explorer` pane
- `Business` ribbon tab
- `Intelligence` left workflow drawer
- `SemanticModelPanel`
- chart semantic controls inside `SmartChartWindow`
- KPI metric selection inside `KpiCardWindow`

What lives here today:

- raw fields
- semantic metrics
- semantic dimensions
- metric editing
- semantic chart seeding
- KPI seeding
- dashboard filter seeding

Observations:

- business/semantic capability is spread across too many different UI surfaces
- the product exposes internal model concepts repeatedly rather than contextually
- users must understand the semantic layer before they understand what task they are trying to complete

## 3. Charting and Analytical Exploration

Current locations:

- Visualise ribbon tab
- Visualise left drawer
- chart gallery modal (`DataVisualization.jsx`)
- quick chart shortcuts in the left drawer
- drag-and-drop field mapping in chart windows
- semantic chart actions from semantic/business panels
- AI chat chart generation
- dashboard chart creation
- decision recommendation action that opens a chart

Observations:

- charting is one of the most fragmented workflows in the app
- there is no single canonical “start analysis” entry point
- users can reach charts through multiple unrelated concepts, which is powerful but difficult to learn

## 4. Dashboards and KPI Monitoring

Current locations:

- Dashboard ribbon tab
- Dashboard left drawer
- dashboard canvas state inside `CanvasContainer`
- KPI card creation from dashboard drawer
- dashboard chart creation from dashboard drawer
- semantic KPI creation from business/semantic surfaces
- dashboard filters via filter panel and semantic quick actions

Observations:

- dashboards are integrated technically, but not narratively
- the dashboard canvas behaves like a mode inside the general window workspace rather than a clearly framed destination
- KPI creation and chart creation are available, but the surrounding guidance is weak

## 5. Decision Intelligence

Current locations:

- left rail “Intelligence” workflow
- `Business` ribbon tab
- semantic/business surface messaging
- separate floating `DecisionPanel`

Current user path:

- user must know to enter the intelligence/business area
- user must understand readiness requirements
- user must run Decision Intelligence
- results open in a separate panel
- some recommendations can open downstream charts

Observations:

- Decision Intelligence is present, but it still feels like a special hidden subsystem
- it is conceptually disconnected from the rest of the primary product flow
- setup guidance exists, but it is trapped inside the Decision panel state rather than shaping the broader user journey

## 6. AI / NLP / Assisted Workflows

Current locations:

- AI ribbon tab
- AI left drawer
- floating AI chat
- AI workflow lab window
- story panel
- AI report window
- natural-language chart generation through chat

Observations:

- AI capability is broad and useful
- AI is treated as a separate cluster of tools rather than an integrated layer across workflows
- chat is always available, but not structurally tied to decision help, semantic guidance, or charting guidance

## 7. Whiteboard and Machine Learning

Current locations:

- whiteboard workflow in left rail
- machine learning launch points in Data and Whiteboard workflows

Observations:

- these features are preserved capabilities, but they currently compete for top-level attention even though they are not the core daily flow for most users

## Core UX Problems Identified in the Current UI

## 1. Too Many Primary Surfaces Compete at Once

The app asks users to interpret:

- a ribbon
- a workflow drawer
- a persistent field explorer
- a floating canvas
- floating windows
- modals
- a floating AI chat

All of these are active or potentially active in the same session. This creates power, but not clarity.

## 2. There Is No Clear Primary Product Flow

A user cannot easily infer the intended sequence for:

- loading data
- preparing it
- understanding available metrics and dimensions
- creating charts
- building dashboards
- invoking Decision Intelligence
- using AI assistance

The system contains the pieces, but not a strong guided flow between them.

## 3. Features Are Discoverable Only If the User Already Understands the System

Many important capabilities are easy to miss unless the user already knows the shell model. Examples:

- semantic chart creation
- semantic KPI creation
- dashboard filter seeding from semantic objects
- decision readiness requirements
- AI-generated charts
- workflow lab
- separate raw vs preview experiences

This is a discoverability problem, not a capability problem.

## 4. The Product Overexposes Internal Terminology

The current UI uses overlapping terms such as:

- Business
- Intelligence
- Field Intelligence
- Business Definitions
- Semantic Layer
- semantic metrics
- semantic dimensions

The result is conceptual overload. The user has to decode the product’s internal architecture before they can complete a task.

## 5. Charting Is Powerful but Entered Through Too Many Doors

Charts can be created from:

- Visualise drawer
- chart gallery modal
- semantic definitions
- decision recommendations
- AI chat
- dashboard actions

This should be an integrated strength, but currently feels scattered because the product does not define one main analytical entry point and several secondary accelerators.

## 6. Decision Intelligence Still Feels Separate From Everyday Work

Decision Intelligence currently behaves like a feature the user has to remember to go find, rather than an available system capability that can support them from within normal workflows.

This is one of the biggest product-experience gaps.

## 7. Setup, Usage, and Advanced Configuration Are Mixed Together

The app often places:

- setup tasks
- routine user actions
- advanced semantic configuration
- power-user tooling

inside the same interaction zones.

That makes the product feel heavier than it needs to.

## Most Overloaded Areas

## 1. The Business / Intelligence Surface

Why it is overloaded:

- mixes semantic model management
- mixes metric editing
- mixes KPI/chart seeding
- mixes dashboard filter creation
- mixes Decision Intelligence launch
- uses business-heavy terminology while also acting as a technical configuration surface

Result:

- the user does not know whether this area is for setup, analysis, monitoring, or decision support

## 2. The Charting Experience

Why it is overloaded:

- multiple entry points
- raw and semantic chart modes
- drag-and-drop mapping
- chart gallery modal
- dashboard chart overlap
- AI-generated charts

Result:

- charting power exists, but the starting point is unclear

## 3. The Workspace Shell

Why it is overloaded:

- ribbon plus drawer plus right pane plus window canvas plus floating chat
- too many zones can demand attention at once
- hierarchy between global navigation, local actions, and content is not strong enough

Result:

- the whole app feels heavier than the actual tasks require

## 4. Data Intake and Preparation

Why it is overloaded:

- multiple import paths
- preview and raw viewer are separate concepts
- cleaning sits in a drawer
- filtering is separate
- AI cleaning is separate again

Result:

- onboarding into analysis is not staged cleanly

## Information Architecture Gaps and Structural Inconsistencies

## 1. No Route-Level IA

There is no page-based structure establishing a stable user mental model. The product is largely a persistent shell controlling floating surfaces.

This is not inherently wrong, but it means hierarchy must be stronger than it is now.

## 2. Ribbon vs Workflow Model Is Not Fully Unified

The app maintains mappings between ribbon tabs and workflows in `App.jsx`, but the visible tab set and workflow model are not perfectly aligned.

Important example:

- `App.jsx` still defines `Explore` in ribbon-to-workflow mapping
- visible ribbon tabs in `MenuBar.jsx` do not include an `Explore` tab
- the field explorer instead lives as a persistent right-side pane

This indicates the app is between architectures rather than fully resolved into one.

## 3. The Most Important Supporting Surface Is Not Framed as Such

The `Field Explorer` is one of the core operational surfaces in the entire app:

- it bridges raw and semantic data
- it powers drag-and-drop charting
- it enables KPI and dashboard seeding
- it influences discoverability of semantic capabilities

But it behaves more like a side utility than a guided primary context surface.

## 4. Dashboard Is a Mode, a Canvas, and a Feature Cluster at the Same Time

Dashboard behavior currently spans:

- a top-level navigation concept
- a visibility mode in shared canvas state
- a chart/KPI feature set
- a filter orchestration system

This works technically, but the mental model is fuzzy.

## 5. AI Is Both Global and Separate

AI chat is globally available, but AI workflows also live in a dedicated cluster.

This creates ambiguity:

- is AI a universal assistant layer?
- is AI a separate product area?
- is AI a set of tools?

The current UI says all three.

## Proposed Cleaner Top-Level Structure

This is the recommended information architecture direction for later phases. It is not the final UI layout. Gemini should use this as the structural baseline for future redesign work.

## IA Principle

The top-level structure should be organized around user outcomes, not around internal system mechanics.

That means the primary navigation should emphasize:

- what the user is trying to do
- where they are in the product flow
- what the next meaningful action is

It should not foreground semantic/business terminology as the main framing mechanism.

## Recommended Primary Product Areas

### 1. Workspace

Purpose:

- orient the user
- show current dataset/project state
- show suggested next actions
- provide a stable sense of “where to begin” and “where to continue”

This should become the primary re-entry point for the product rather than forcing users to interpret the shell every time.

### 2. Explore

Purpose:

- data preview and inspection
- field exploration
- chart creation
- raw and semantic analysis entry
- ad hoc exploratory work

This should become the canonical analysis home.

Charting should feel centered here, even if secondary accelerators remain elsewhere.

### 3. Dashboards

Purpose:

- KPI monitoring
- dashboard charts
- dashboard-level filters
- saved or active monitoring views

This should feel like a focused destination, not just a toggle inside the general canvas.

### 4. Decisions

Purpose:

- decision readiness
- decision recommendations
- signals and evidence
- scenario preview
- downstream actions from decision output

Decision Intelligence should be elevated into a clear, usable destination while also remaining callable from other relevant workflows.

### 5. AI Assist

Purpose:

- conversational help
- NLP charting
- workflow lab
- AI story/report generation
- contextual assistance across the system

AI should be framed as both:

- its own place for deeper assisted workflows
- an always-available support layer across the rest of the product

## Recommended Supporting Areas

These are important, but they should not dominate the core navigation as if they are the primary user journey.

### A. Data Sources and Prep

Includes:

- upload
- hub
- API
- database
- cleaning
- filtering
- export

This can remain highly accessible, but it should feel like onboarding/setup support for work, not the work itself.

### B. Definitions

Includes:

- semantic metrics
- semantic dimensions
- advanced field mappings
- metric editing

This should remain powerful, but should be reframed as an enabling layer for exploration, dashboards, and decisions, not the main front-door identity of the product.

## Structural Direction for Gemini

Gemini should treat the future product IA as:

- a small number of clearly understandable primary destinations
- supported by contextual drawers, panes, and assistants
- with setup and advanced configuration layered behind primary tasks

Not as:

- many equal-weight tool clusters exposed at once
- many parallel nav systems competing for control
- internal semantic/business concepts driving the primary top-level labels

## Desired Relationship Between Major Capabilities

The later redesign should make these relationships obvious:

- data sources and preparation feed exploration
- definitions enrich exploration, dashboards, and decisions
- charts are a core exploration tool, not an isolated feature
- dashboards are a monitoring layer built from exploration and definitions
- Decision Intelligence consumes prepared semantic context and produces actionable next steps
- AI assist can help at every stage instead of feeling detached from the product flow

## What Should No Longer Be True After the Overhaul

The redesigned IA should eliminate the following current conditions:

- users needing to interpret multiple competing navigation models
- users having to remember whether a feature lives in ribbon, drawer, pane, modal, or chat
- users encountering business/semantic terminology before they understand the task
- Decision Intelligence feeling hidden or disconnected
- charting feeling scattered across unrelated entry points
- dashboards feeling like a side mode rather than a core destination

## Implementation Anchors for Later Phases

These files define the current shell and should be treated as primary audit anchors in later phases:

- `frontend/frontend/src/App.jsx`
- `frontend/frontend/src/components/layout/MenuBar.jsx`
- `frontend/frontend/src/components/layout/SideBar.jsx`
- `frontend/frontend/src/components/layout/DataPane.jsx`
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`
- `frontend/frontend/src/components/insights/FieldsPanel.jsx`
- `frontend/frontend/src/components/insights/SemanticModelPanel.jsx`
- `frontend/frontend/src/features/business/decision/DecisionPanel.jsx`
- `frontend/frontend/src/features/charts/SmartChartWindow.jsx`
- `frontend/frontend/src/features/dashboard/KpiCardWindow.jsx`
- `frontend/frontend/src/features/ai/AIChat.jsx`
- `frontend/frontend/src/context/WindowContext.jsx`
- `frontend/frontend/src/context/DataContext.jsx`

## Phase 1 Output Summary

This phase establishes the following baseline conclusions:

- the app is capability-rich but structurally fragmented
- the shell currently exposes too many equally loud control surfaces
- the current IA is not strongly task-based
- business/semantic concepts are overexposed in the top-level experience
- charting, dashboards, AI, and Decision Intelligence are technically connected but experientially disconnected
- the next phases should reorganize the product around a clearer primary flow and a smaller number of obvious destinations

## Required Follow-Through Into Phase 2

The next phase should use this audit to define:

- the new primary navigation model
- what becomes a primary destination vs contextual tool
- how the shell hierarchy should work
- which current surfaces are retained, merged, demoted, or reframed
- how the app stops feeling crowded without removing capability

Gemini should preserve the system’s power, but the top-level structure must stop making users think like the implementation.
