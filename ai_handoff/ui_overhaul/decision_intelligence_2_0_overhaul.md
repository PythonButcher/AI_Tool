# Decision Intelligence 2.0 Overhaul

## Status Notice

Decision Intelligence V2 is closed as-is and should now be treated as a historical baseline.

This file still matters for product direction and constraints, but it is no longer the active completion label.

All unfinished continuation work should now move forward as **V3** work.

Active resume file:

- `ai_handoff/ui_overhaul/decision_intelligence_v3_resume_handoff.md`

## Purpose

This file replaces the older Phase 4 decision redesign and scoped-decision planning docs.

The old direction improved wording, readiness, and presentation around an existing dataset-scan engine.

That is no longer the product direction.

Decision Intelligence 2.0 is a full overhaul of how decision-making should work in this application.

This does **not** mean deleting relevant product features.

It means rebuilding the decision architecture so the application stops behaving like:

- data in
- scan the whole dataset
- return generic insights

And instead behaves like:

- define the decision
- define the business context for that decision
- simulate realistic paths forward
- present trade-offs, risks, and recommended actions

## Non-Negotiable Rules

These rules are active for all future Decision Intelligence work.

### Product Rules

- do not delete non-relevant features
- preserve existing useful capability unless the user explicitly approves removal
- keep the same theme, UI tone, and general visual language
- preserve the current destination-based shell
- preserve the broader app structure unless explicitly reopened

### Ownership Rules

- Codex owns planning, backend logic, contracts, architecture, and markdown handoff maintenance
- Gemini must do frontend implementation
- Codex must not make frontend changes for this initiative unless the user explicitly reopens that boundary

### Design Rules

- Decision Intelligence must revolve around the decision, not the dataset
- the app must stop treating full-dataset scanning as the core decision workflow
- outputs must be honest about what is known, what is assumed, and what is uncertain
- recommendations must lead to real usable workflows, not dead-end buttons or fake actions
- scenario-style outputs must represent realistic modeled choices or be clearly framed as lightweight estimates

## Core Paradigm Shift

The application must move from:

- "What does this dataset say?"

to:

- "What should I do about this specific problem?"

The system should not pull the whole dataset into one broad decision pass unless a deliberately broad scan is the explicit user goal.

The default should be scoped decision work.

That means the system should only pull and reason over the data needed for the defined problem.

## What Decision Intelligence 2.0 Means

Decision Intelligence 2.0 is prescriptive, not just descriptive.

The job of the feature is not to summarize data.

The job of the feature is to help a user choose between actions.

That means the application must become centered on:

- objective
- levers
- constraints
- simulations
- trade-offs
- uncertainty

## The Four Pillars

### 1. Unified Intelligence Model

The application should behave as if it has one unified business model.

Do not frame the product around a split between "raw" and "semantic" thinking when making decisions.

Conceptually, the decision engine should use one unified state that contains:

- data
- business definitions
- KPIs
- formulas
- dimensions
- constraints
- other resolved business context

This unified state becomes the single source of truth for decision reasoning.

Implementation note:

- this does not require deleting current systems immediately
- it does require the decision layer to stop acting like disconnected logic stitched on top of multiple separate contexts

### 2. Decision Scope

Before analysis begins, the UI must capture the structure of the decision.

Every serious decision flow should define:

- the objective
- the levers
- the constraints

#### Objective

Examples:

- maximize revenue
- reduce churn
- improve margin
- reduce stockouts
- improve fulfillment speed

#### Levers

These are the variables the user can actually change.

Examples:

- price
- ad spend
- discounting
- staffing
- inventory routing
- reorder timing
- product mix

#### Constraints

These define the limits the user cannot ignore.

Examples:

- budget cap
- time window
- minimum service level
- maximum inventory risk
- available headcount
- supply limits

### 3. Simulation Engine

Once the system has the unified model and the decision scope, it should act like a simulator.

It should test different lever combinations and estimate likely outcomes.

Examples:

- higher spend and lower price
- lower spend and higher price
- faster reorder and tighter inventory threshold

The system should explore realistic future states from the defined decision space.

### 4. Trade-Off Engine

The app should not return one vague answer.

It should return 2 to 3 real paths forward.

Each path must explain:

- what action to take
- what improves
- what gets worse
- what risk is introduced
- how confident the system is

Example framing:

- Option A improves short-term revenue but increases stockout risk
- Option B protects margin but slows growth
- Option C is lower-risk but has smaller upside

## Required Product Experiences

These are the target experiences that should shape the overhaul.

### A. Decision Brief Workflow

The decision flow should begin from a problem statement.

Example:

- "I need to decide if I should expand into the Canadian market."

The system should:

- parse the decision
- identify the likely objective, levers, and constraints
- pull only the relevant KPIs and business context
- build a temporary scoped decision workspace
- avoid drowning the user in unrelated dataset noise

### B. Goal-Seeking

The app should support reverse planning.

Example:

- "I want to achieve 15% growth next quarter."

The system should estimate:

- what lever changes are needed
- what combinations are realistic
- which path is aggressive, balanced, or conservative

### C. Unknowns and Risk Highlighting

The app must explicitly show uncertainty.

It should say what it does not know.

Examples:

- missing historical data
- weak competitor context
- low sample confidence
- model uncertainty
- assumptions that could materially change the recommendation

This must be designed as a first-class part of the experience, not a buried warning.

## What Must Stop

The overhaul should explicitly move away from these patterns:

- feeding the whole dataset into one generic decision pass by default
- acting like generic trend summaries are decision intelligence
- returning canned recommendation cards that are not backed by real decision structure
- producing scenario outputs that look authoritative but are only simple arithmetic scaffolds
- hiding uncertainty behind confident UI language

## What Must Be Preserved

The overhaul does not justify deleting working systems that still matter.

Preserve and adapt where useful:

- dataset loading
- semantic model work
- metric resolution
- dashboarding
- charting
- readiness and guidance concepts
- destination-based shell
- theme and UI tone

The correct move is to reuse strong foundations while replacing the weak decision logic on top.

## Delivery Strategy

Do not try to ship the full end-state in one step.

The overhaul should be delivered in deliberate layers.

### Layer 1: Replace Broad Scan With Scoped Decision Entry

Build a new entry flow where the user defines:

- the decision prompt
- objective
- candidate levers
- constraints

This becomes the root of the decision run.

### Layer 2: Build Temporary Scoped Decision Workspaces

The result of a decision entry should be a temporary workspace containing:

- only relevant KPIs
- only relevant dimensions
- only relevant comparisons
- decision-specific notes, assumptions, and uncertainties

### Layer 3: Add Multi-Path Recommendation Output

The system should return multiple paths forward with trade-offs.

Avoid single-answer framing.

### Layer 4: Add Goal-Seeking and More Advanced Simulation

Once the scoped decision workflow is stable, add:

- reverse planning
- stronger simulation
- richer uncertainty modeling

## Immediate Build Priorities

This is the current recommended order of work.

### 1. Codex

Codex should do the following first:

- define the new decision object model
- define the new decision-scope contract
- define objective, lever, and constraint payload shapes
- identify which current backend pieces can be reused
- identify which current decision services should be deprecated or rewritten
- maintain the markdown handoff set

Codex has now completed the active backend V1 correction pass.

That backend pass now covers:

- real backend readiness and status semantics for `ready`, `needs_input`, and `limited`
- honest decision-scoped metric and dimension selection
- contract-faithful `time_context` and `period_context`
- stronger blocker and unknown handling for unresolved objective, lever, and hard-constraint gaps
- additive migration behavior that keeps legacy endpoints available without letting them remain the primary DI 2.0 frame

### 2. Gemini

Gemini should now resume frontend work against the corrected backend behavior for the first Decision Intelligence 2.0 contract.

Gemini should focus on:

- the new decision entry workflow
- scoped decision workspace presentation
- trade-off presentation
- uncertainty presentation
- preserving the existing app theme and tone

Gemini must not invent backend rules or payload semantics.

## Strict Codex to Gemini Communication Format

Use this structure in future handoffs.

### 1. Goal

State the exact user-facing outcome.

### 2. What Is Already Decided

List the non-negotiable decisions Gemini must treat as fixed.

### 3. What Gemini Is Allowed To Change

Be explicit about the frontend surface area Gemini owns.

### 4. What Gemini Must Not Change

Be explicit about forbidden edits and architectural boundaries.

### 5. Backend Contract

List the exact payload shape and interpretation rules Gemini must follow.

### 6. UX Direction

Describe the intended feel, hierarchy, and tone.

Be strict about the behavior.

Allow creativity in how Gemini expresses the design inside those boundaries.

### 7. Verification Standard

List the states Gemini must verify before calling the work complete.

## Gemini Execution Standard

Gemini should be strict about behavior and creative about presentation.

That means:

- preserve the established theme and tone
- do not redesign the app into a different visual product
- do not remove useful capability to simplify the task
- do not fake backend logic in the UI
- do not invent product semantics that Codex has not defined
- make the workflow feel intentional, modern, and product-grade
- prefer a clear, confident interaction model over generic placeholder UI

## Status

Decision Intelligence 2.0 is now the active direction.

Older Phase 4 decision docs should no longer be treated as the source of truth.

This file is now the primary planning handoff for the decision overhaul.

## Current Execution Reality

The frontend V1 correction pass improved the product materially, but V1 is not closed yet.

Treat the current state as:

- frontend V1 is partially advanced
- backend V1 contract behavior is materially corrected
- the active remaining gap is frontend alignment against that corrected contract
- V2 simulation and trade-off work is not the current execution target

The honest sequence is:

1. Codex lands and maintains backend V1 correctness and contract behavior.
2. Gemini finishes the remaining V1 frontend alignment against that corrected backend behavior.
3. Only then does the project move into V2 simulation and trade-off execution.

## Resume Point

The next Codex branch or fresh Codex session should begin here.

The first backend/product contract is now:

- `ai_handoff/shared_contracts/decision_intelligence_2_0_contract_v1.md`

The next task is:

- use the corrected backend contract as fixed execution reality
- let Gemini finish frontend workspace creation and rendering gaps so the primary DI 2.0 flow is contract-faithful
- keep the current decision bundle endpoints additive during migration
- only pull Codex back into backend work if frontend integration reveals a real contract bug
- do not begin V2 simulation and trade-off execution until V1 is genuinely complete end to end
