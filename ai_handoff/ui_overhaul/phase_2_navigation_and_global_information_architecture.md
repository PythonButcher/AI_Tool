# Phase 2: Navigation and Global Information Architecture

## Gemini Role

Gemini review and design exploration is needed for this phase.

This phase should be handled as a high-level product structure and navigation design problem, not as an implementation task and not as a backend task.

Your job in this phase is to define the next navigation and global information architecture direction for the app so that later implementation work has a clear structural target.

You should be creative in how the future experience is framed, but you must remain grounded in the current product reality and the non-negotiable constraints from Phase 0 and Phase 1.

## What This Phase Must Solve

The current app has too many competing navigation systems:

- top ribbon tabs
- left workflow rail
- workflow drawers
- right data pane
- floating windows
- modals
- floating AI chat

The result is that the product feels powerful but hard to enter, hard to learn, and hard to navigate.

This phase must define a cleaner global structure that:

- gives the user a clear top-level product map
- reduces the feeling of scattered features
- creates stronger hierarchy between primary destinations and secondary tools
- keeps advanced capability intact
- makes the app feel like one integrated system

## Inputs You Must Use

Base your work on:

- `phase_0_ui_overhaul_master_plan.md`
- `phase_1_ui_audit_and_information_architecture.md`

You must assume the current frontend architecture described in Phase 1 is accurate:

- desktop-style shell
- floating-window workspace
- current semantic/chart/dashboard/decision/AI capabilities
- non-route-driven structure
- strong overlap between shell surfaces

## Non-Negotiable Constraints

Do not violate any of the following:

- preserve all existing backend endpoints and contracts
- preserve the `decision_bundle` structure
- preserve chart behavior, including metric + `group_by`
- preserve semantic layer power
- preserve dashboards and KPI workflows
- preserve Decision Intelligence
- preserve AI-assisted workflows
- preserve current theme and tone
- do not remove features without approval
- do not assume backend rewrites
- do not simplify away core logic just to make navigation cleaner

This is a navigation and architecture redesign phase, not a capability reduction exercise.

## Product Experience Target

The navigation and IA direction should make the app feel:

- modern
- sleek
- lightweight
- guided
- discoverable
- integrated
- powerful without feeling crowded

The user should no longer feel like they have to remember where features are hidden.

## Core Problems Your Navigation Proposal Must Address

Your output must directly address these current failures:

- users do not know where to start
- users do not know what to do next
- users must hunt for features
- decision support is hidden behind business/intelligence concepts
- charting starts from too many unrelated places
- semantic/business terminology dominates too much of the top-level experience
- dashboards feel like a mode rather than a clear destination
- AI feels both separate and everywhere, without a clean structural role
- the field explorer is important but not clearly positioned in the product hierarchy

## What You Should Produce In Your Response

Your response for this phase should define a proposed global navigation and information architecture for the product.

It should include:

- the recommended primary top-level destinations
- the role of each destination
- what belongs in each destination
- what should be primary vs secondary vs contextual
- how the shell hierarchy should work
- how users should move from setup to exploration to dashboards to decisions to AI support
- how always-available help or decision support should fit into the shell
- how the current drawer/pane/window model should be reframed conceptually, even if some of it remains technically

Do not give implementation code.

Do not give step-by-step React changes.

Do not redesign individual screens in detail yet.

This phase is about product structure and navigation architecture.

## Strong Directional Guidance

You should work from the assumption that the future app should have a smaller number of clearer primary destinations.

The navigation should be organized around user goals, not internal architecture.

That means the structure should likely elevate concepts such as:

- workspace or home
- exploration / analysis
- dashboards / monitoring
- decisions / decision support
- AI assist

And it should likely demote or reframe concepts such as:

- “business” as a primary top-level label
- “semantic” as a top-level label
- raw implementation-driven shell controls being treated as equal to product destinations

You do not have to use those exact labels if a better structure exists, but your proposal should move in that direction.

## Specific Questions You Must Resolve

Your navigation proposal should answer the following clearly:

### 1. What are the primary top-level destinations?

Define the future primary navigation set.

Keep it focused and understandable.

### 2. What becomes contextual rather than top-level?

Decide which current concepts should stop being primary navigation items and instead become:

- contextual tools
- workspace side panels
- secondary entry points
- progressive disclosure surfaces

### 3. What is the role of the shell?

Clarify what the persistent global shell should do versus what belongs inside destination-level content.

### 4. What is the role of the field explorer / data pane?

It is clearly important today.

Decide whether it should remain persistent, become contextual, become destination-bound, or evolve into a more structured guided panel.

### 5. How should Decision Intelligence be surfaced?

It must feel like a natural capability of the system, not a hidden specialist feature.

Clarify whether it should be:

- a primary destination
- a contextual assistant layer
- both

### 6. How should AI be framed?

Resolve the ambiguity between:

- AI as a global assistant
- AI as a destination
- AI as a set of workflow tools

Your answer should make that relationship coherent.

### 7. How should charting be entered?

There should be one clear primary charting entry concept, even if multiple accelerators remain available.

Clarify where charting truly belongs in the IA.

### 8. How should dashboards be framed?

Dashboards should feel like a destination and workflow, not just a visibility toggle on a shared canvas.

### 9. How should setup vs usage vs advanced configuration be separated?

This is a major source of visual and cognitive overload in the current product.

Your proposal should clearly distinguish:

- source/setup work
- routine analytical work
- monitoring work
- advanced definition/configuration work

## Deliverable Shape

Please structure your response as a design-planning artifact, not casual commentary.

A strong output for this phase should include sections similar to:

- recommended navigation model
- destination definitions
- shell hierarchy
- contextual surfaces
- role of AI and decision support
- migration notes from current structure to future structure
- rationale and tradeoffs

You may choose your own section titles, but the result must be easy to turn into later implementation planning.

## What You Should Not Do Yet

Do not:

- redesign individual screens in high detail
- propose backend/API changes
- remove features
- collapse advanced semantic capability into oversimplified UI
- prescribe exact implementation steps in React
- treat this as a visual polish pass

Phase 2 is structural. It should produce the product map that later phases build upon.

## Creative Freedom

You should absolutely use design judgment here.

You are expected to improve clarity, hierarchy, and product coherence.

You are not expected to preserve the current shell organization if a cleaner architecture is clearly better.

However:

- preserve the product’s intelligence-heavy identity
- preserve the analytical power of the system
- preserve the integrated nature of charts, dashboards, semantics, decisions, and AI
- do not make the product feel generic or stripped down

## Desired Outcome

After this phase, we should have a clear answer to:

- what the top-level product structure should be
- how the app should be navigated
- which surfaces are primary vs supporting
- how to stop the current “hunt for functionality” experience
- how to make the product feel unified before moving into shell and screen redesign

This phase should give the overhaul initiative a strong structural backbone for the next stages.
