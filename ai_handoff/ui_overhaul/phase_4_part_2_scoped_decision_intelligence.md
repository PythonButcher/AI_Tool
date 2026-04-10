# Phase 4 Part 2: Scoped Decision Intelligence

## Purpose

This file prepares the next Decision Intelligence maturity step after the current Phase 4 stabilization work.

Phase 4 Part 1 focused on making Decision Intelligence:

- visible
- understandable
- safe to run
- honest about readiness
- resistant to stale/no-data failures

Phase 4 Part 2 should focus on making Decision Intelligence more precise.

The next step is scoped decision-making.

That means users should be able to run Decision Intelligence against a deliberate subset of business context instead of only treating the current dataset and semantic model as one broad analysis surface.

## Why This Comes Next

Scoped decisions were intentionally deferred until the system became usable at all.

The work sequence so far has been:

1. stabilize the shell and destination model
2. make Decision Intelligence runnable end to end
3. make the decision output understandable

Only after those foundations does scoped decision-making make product sense.

If scoped decision workflows had been added earlier, they would have been layered on top of:

- hidden runs
- weak readiness guidance
- poor evidence rendering
- unclear destination behavior
- unstable frontend architecture

That would have multiplied confusion instead of improving usefulness.

## Core Product Goal

Decision Intelligence should evolve from:

- "analyze whatever the current app context broadly contains"

to:

- "analyze this specific business slice on purpose"

The user should be able to understand both:

- what scope is being analyzed
- why the resulting recommendations belong to that scope

## Primary Questions To Resolve

Phase 4 Part 2 is not just a UI tweak.

Codex should first resolve the product and contract decisions below before Gemini begins major frontend implementation.

### 1. What defines decision scope?

Possible scope inputs include:

- dashboard filters
- selected metrics
- Explore context
- manual scope picker inside `Decisions`
- a combination of the above

Codex should decide which of these are first-class for the first scoped-decision release.

### 2. Where is decision scope created?

Possible entry points include:

- `Workspace`
- `Explore`
- `Dashboards`
- inside `Decisions`

Codex should decide whether scope is:

- created upstream and passed into `Decisions`
- created directly inside `Decisions`
- or supported in both ways with a clear primary pattern

### 3. Is scope temporary or saved?

Codex should decide whether a scope is:

- one-time for the current run
- persistent while the user stays in a destination
- saveable as a reusable decision context

Phase 4 Part 2 should probably begin with temporary or session-scoped behavior unless there is a strong reason to introduce saved presets immediately.

### 4. How does scope affect downstream outputs?

Codex should define how scope propagates into:

- the brief
- signals
- recommendations
- scenario preview
- recommendation-driven chart launches

The output should make the active scope explicit.

## Initial Recommended Direction

Unless product priorities change, the recommended first scoped-decision model is:

1. support metric scoping
2. support filter scoping
3. support dashboard-to-decisions handoff
4. keep the first release session-scoped, not saved

Why this is the recommended starting point:

- the backend already supports `metric_ids`, `metric_names`, and `filters`
- dashboard context is already one of the most natural user mental models
- this delivers real value without requiring a full saved-scope system immediately

## Codex Ownership

Codex should own the following before Gemini does major frontend implementation:

- product definition of scope
- backend contract review
- decision-payload shape
- architectural rules for scope propagation
- markdown handoff maintenance

Codex may also need to implement backend work if the current contract is not sufficient for the chosen scoped-decision model.

## Gemini Boundary

Gemini should remain frontend-only unless Codex explicitly reopens backend work.

Gemini should not invent new scope rules.

Gemini should not decide on its own:

- which sources of scope are canonical
- how scope persists
- how scope should alter backend decision behavior

Gemini should implement the frontend once Codex has finalized those decisions.

## Minimum Deliverables For Part 2

Phase 4 Part 2 should aim to deliver the following:

### 1. Visible active scope

The app should make it obvious when Decision Intelligence is being run against:

- all compatible metrics
- selected metrics
- a filtered business slice
- dashboard-derived context

### 2. User-controlled scope

The user should be able to deliberately choose or inherit scope rather than accidentally analyzing everything.

### 3. Traceable results

The brief, signals, and recommendations should reflect the active scope clearly enough that the user can trust why they are seeing those results.

### 4. Safe fallback behavior

If scope is incomplete, invalid, or stale:

- the app should not silently fall back to a broader or older scope
- the app should show guidance instead of pretending the run is trustworthy

### 5. Preserved recommendation workflows

Scoped decisions must not break:

- chart-launch actions
- scenario preview
- current decision readability
- no-data protections

## Candidate Implementation Sequence

This is the recommended order for the next Codex-led branch:

1. document the scoped-decision contract and first-release rules
2. decide which scope sources are supported first
3. confirm or extend backend payload support
4. define how the active scope is shown in the UI
5. hand the frontend implementation slice to Gemini
6. verify that no-data protections and current Phase 4 behavior remain intact

## Constraints

Phase 4 Part 2 must preserve the current gains from Part 1.

Do not regress:

- no-data safety
- readiness honesty
- cross-destination visibility
- readable evidence rendering
- additive time-context support

Do not turn this into:

- a full Phase 5 planning system
- a saved report builder
- a dashboard rewrite
- a broad semantic-model redesign

## Recommended Next Codex Task

The next Codex task should be:

- design the first scoped-decision contract and interaction model

That task should answer:

- what scope inputs are supported first
- what the payload shape is
- how scope is displayed in the resulting decision experience
- what Gemini should implement versus what remains backend work

## Resume Note

When the next branch starts, treat this file as the starting planning handoff for Phase 4 Part 2.

Do not resume from the earlier "make Decisions usable" framing.

That baseline work is already complete enough.

The next maturity target is scoped decision intelligence.
