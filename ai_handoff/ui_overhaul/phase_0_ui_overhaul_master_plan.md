# Phase 0: UI Overhaul Master Plan

## Section 1 - Overhaul Intent

This initiative is a frontend UX/UI modernization and product-flow overhaul for the existing React + Flask application.

It is not a backend rewrite, a semantic-layer rewrite, a Decision Intelligence rewrite, or a feature-reduction effort.

The purpose of this initiative is to:

- modernize the interface without breaking current capability
- improve clarity, flow, and usability across the full product
- make complex functionality feel integrated and guided
- reduce friction, confusion, and visual overload
- establish a frontend architecture that supports a more coherent product experience

This effort must work with the current backend, current contracts, and current functional surface area. The objective is to improve how the system is organized, presented, and experienced by users, not to replace the underlying application model.

## Section 2 - Product Experience Goals

The target product experience for the overhaul is:

- modern: current, polished, and intentionally designed rather than improvised or stacked over time
- sleek: visually refined, disciplined, and lower-friction
- lightweight: less crowded, less heavy, and easier to scan
- guided: users should know what to do next without guesswork
- discoverable: important capabilities should be easy to find at the moment they are needed
- integrated: charting, dashboards, semantic setup, API workflows, NLP, and Decision Intelligence should feel like one connected system
- powerful but not overwhelming: advanced capability should remain available without forcing all complexity onto every screen at once

Success means the application still feels sophisticated and capable, but users no longer experience the product as dense, fragmented, or difficult to navigate.

## Section 3 - Non-Negotiable Constraints

The following constraints are mandatory throughout all overhaul phases:

- Preserve all existing backend endpoints and request/response contracts.
- Preserve the `decision_bundle` structure.
- Preserve current charting behavior, including the metric + `group_by` workflow model.
- Preserve semantic layer capabilities and current analytical power.
- Preserve dashboards and dashboard-related workflows.
- Preserve Decision Intelligence logic and feature scope.
- Preserve the current theme and tone of the product.
- Do not introduce destructive rewrites that replace working product logic without explicit approval.
- Do not remove features without explicit approval.
- Do not invent new backend contracts to support frontend changes unless separately approved.
- Do not break existing functionality while restructuring UI architecture.

If a UI change appears to require backend changes, that dependency must be documented and escalated rather than assumed.

## Section 4 - Core UX Problems To Solve

The overhaul must directly address the following product experience failures:

- Users do not understand how to use Decision Intelligence or when they should engage with it.
- Users must hunt for functionality because features are buried, fragmented, or disconnected from the workflows that need them.
- Too much information and too many controls are shown at once, creating a crowded and heavy interface.
- Visual hierarchy is weak, so users cannot quickly identify the primary action, the current context, or the next step.
- Business and semantic terminology is overexposed, causing unnecessary cognitive load for users who are trying to complete tasks.
- The intelligence/business-oriented sections are not currently usable enough to support confident adoption.
- The application does not provide a clear end-to-end flow, so users are left navigating by trial and error.

These issues are not cosmetic. They affect comprehension, workflow completion, discoverability, adoption of advanced features, and overall product confidence.

## Section 5 - New Product Interaction Direction

The redesigned product experience should behave according to the following principles:

- Decision help must be available anytime within the user journey, not buried in a separate conceptual area that users have to remember to visit.
- Features must feel connected to the user workflow rather than isolated in disconnected screens or sections.
- Charting, NLP, APIs, dashboards, semantic definitions, and Decision Intelligence must read as parts of one system with one coherent interaction model.
- Users must be guided step-by-step through key workflows, especially where setup, interpretation, or advanced actions are involved.
- Important actions must be obvious from the current context.
- Users should not need to search mentally or physically for where a feature lives.
- Complexity should be progressively revealed based on user intent, workflow stage, and need for advanced control.
- The product should emphasize task completion and insight generation over internal system terminology.

The new interaction direction is not to make the system simpler by removing power. It is to make the system easier to enter, easier to navigate, and easier to understand while preserving advanced capability.

## Section 6 - Overhaul Phase Structure

The UI overhaul will proceed through multiple implementation-planning phases. Each phase should produce a concrete handoff artifact that narrows ambiguity for implementation.

### Phase 1 - UI Audit and Information Architecture

Purpose:

- inventory the current frontend structure and navigation
- identify overloaded screens, duplicated surfaces, and fragmented entry points
- map where major features currently live
- document gaps between current structure and desired user flow
- propose a cleaner top-level information architecture

### Phase 2 - Navigation and Global Information Architecture Redesign

Purpose:

- define a clearer top-level navigation model
- establish where primary workflows should live
- reduce section sprawl and redundant pathways
- determine how users move between setup, analysis, decision support, dashboards, APIs, and advanced tools

### Phase 3 - Workspace and Application Shell Redesign

Purpose:

- redesign the overall shell, page framing, workspace structure, and persistent navigation behavior
- define consistent regions for page title, primary action, secondary tools, contextual help, and status
- reduce crowding and improve scanning at the app level

### Phase 4 - Decision Experience Redesign

Purpose:

- make Decision Intelligence understandable, actionable, and naturally accessible
- define how decision help appears within relevant workflows
- remove the current disconnect between intelligence capability and everyday product use
- ensure decision support feels embedded rather than hidden

### Phase 5 - Business and Semantic Definitions Restructuring

Purpose:

- reorganize how business and semantic concepts are introduced and managed in the UI
- reduce terminology overload
- separate foundational configuration from routine usage
- keep semantic power intact while making the experience more approachable and less intimidating

### Phase 6 - Charting Entry-Point and Analysis Flow Redesign

Purpose:

- improve how users start charting and analytical exploration
- preserve metric + `group_by` behavior while making the entry point clearer
- connect chart creation more naturally with semantic configuration, dashboards, and downstream insight workflows
- reduce friction in moving from question to chart

### Phase 7 - NLP and AI Interaction Surface Redesign

Purpose:

- define a unified interaction surface for NLP and AI-assisted workflows
- ensure AI assistance supports the broader product journey rather than feeling bolted on
- clarify where conversational, assisted, and direct-manual workflows intersect

### Phase 8 - API Workflow Discoverability and Integration

Purpose:

- make API-related workflows easier to find and understand
- clarify how API capabilities relate to the rest of the product
- ensure API access feels integrated into the platform rather than hidden in a disconnected utility area

### Phase 9 - Screen-Level Prioritization and Progressive Disclosure Rules

Purpose:

- define common rules for density reduction, prioritization, section expansion, defaults, and advanced controls
- ensure all major screens follow the same logic for what is shown first and what is deferred
- prevent the redesigned experience from re-accumulating clutter

### Phase 10 - Final Polish, Consistency, and Implementation Readiness

Purpose:

- align interaction patterns, naming, hierarchy, spacing, and visual language across the product
- identify any remaining inconsistency before implementation execution
- create final guidance that implementation work can follow without re-opening core structural decisions

## Section 7 - Frontend System Guidance for Gemini

Gemini should follow the guidance below in all later overhaul phases:

- Reduce density across primary workflows. Default screens should show less at once.
- Improve hierarchy so each view has a clearly dominant purpose, primary action, and readable supporting structure.
- Use progressive disclosure aggressively. Advanced capability should remain available, but it should not dominate default states.
- Separate setup from routine usage from advanced configuration. Users should not be forced to process all three simultaneously.
- Simplify language throughout the interface. Replace internal or overly technical phrasing with clearer task-oriented wording where possible.
- Avoid overusing the terms "business" and "semantic" in user-facing surfaces when a simpler label can communicate the purpose more clearly.
- Ensure the UI explains itself through structure, labels, grouping, and action placement rather than relying on users to already understand the system model.
- Design for guided flow. The interface should indicate what the user can do now, what happens next, and where to go when they need deeper control.
- Preserve power-user capability through layered access, not through front-loading every option.
- Keep related capabilities adjacent in the experience so the system feels unified rather than assembled from disconnected tools.

This guidance applies across navigation, shell structure, screen composition, terminology, action design, and workflow sequencing.

## Section 8 - Required Deliverables for Each Phase

Every overhaul phase must produce a markdown file inside:

`/ai_handoff/ui_overhaul/`

Each phase deliverable must:

- have a clear phase-specific filename
- describe the scope of that phase precisely
- document findings, decisions, constraints, and recommended direction for that phase
- be specific enough for Gemini to use as an implementation guide in later steps
- remain consistent with the constraints in this master plan

No overhaul-related planning files should be mixed into prior handoff folders. The `ui_overhaul` folder is the single communication location for this initiative.

## Section 9 - Immediate Next Step

The next file to create is:

`/ai_handoff/ui_overhaul/phase_1_ui_audit_and_information_architecture.md`

That phase must:

- audit the current UI structure and major screens
- identify overloaded areas, fragmented workflows, and confusing surfaces
- map where current features live across the frontend
- identify where navigation, hierarchy, and workflow clarity break down
- propose a cleaner top-level structure for the application

Phase 1 must be based on the existing product as implemented today. It should not skip directly to visual redesign. Its job is to establish a grounded audit and information architecture baseline that the later overhaul phases can build on safely.
