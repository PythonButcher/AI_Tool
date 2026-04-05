# Phase 3: Workspace Shell and Destination Behavior

## Gemini: What To Do Next

Continue the UI overhaul, but do not keep making broad shell changes by instinct.

At this point, your next job is to define and then implement the shell behavior clearly.

The goal of this phase is simple:

- make the app feel like one product
- make each top-level area feel different and clear
- stop the user from feeling lost
- keep all existing power and features

## Very Important

Do not create a new backend contract.

Do not remove features.

Do not simplify away charts, dashboards, Decision Intelligence, semantic power, AI workflows, APIs, or existing logic.

Do not turn this into a generic dashboard app.

Do not treat this phase as just a visual styling pass.

## What Is Already Decided

The app is moving toward a destination-based structure.

The current top-level destinations are:

- Workspace
- Explore
- Dashboards
- Decisions

That direction is acceptable.

Do not undo that direction unless something is clearly broken.

## What Is Not Clear Enough Yet

You must resolve these things during this phase:

### 1. What each destination actually owns

Define very clearly:

- what belongs in Workspace
- what belongs in Explore
- what belongs in Dashboards
- what belongs in Decisions

The user should not have to guess why they are in one area versus another.

### 2. What the shell should always show

Decide what parts of the UI are always present and what parts are contextual.

Be explicit about:

- top bar
- left rail
- right-side data/field pane
- floating AI help
- floating windows

The shell must feel stable.

### 3. What changes when the user switches destinations

Each destination should have a different job.

That means the app should clearly communicate:

- where the user is
- what they can do here
- what the primary next action is

Do not let all destinations feel like the same canvas with different labels.

### 4. Where AI belongs

This is a major unresolved issue.

AI must be:

- available from anywhere when help is needed
- clearly integrated into the product
- not hidden
- not treated like a random extra tool

You need to make a clean decision about:

- what AI does globally
- what AI does inside Explore
- whether any AI workflows stay destination-specific

### 5. Where Decision Intelligence belongs

Decisions must feel easy to find and easy to understand.

But do not let the Decisions area become a renamed version of the old overloaded Business area.

Decision Intelligence should focus on:

- readiness
- signals
- recommendations
- scenario preview
- downstream actions

Do not let advanced semantic configuration swallow the Decisions area.

### 6. Where semantic definitions belong

This is another major unresolved issue.

You must decide what should happen with:

- semantic metrics
- semantic dimensions
- metric editing
- advanced definitions

These should still be easy to reach, but they should not dominate the product or confuse the user.

Keep the semantic power.

Reduce the semantic burden.

### 7. How the right-side field/data pane should behave

This pane is important.

It currently does too much without enough explanation.

You need to decide whether it should:

- stay visible everywhere
- change by destination
- become more guided
- become less noisy

Whatever you choose, it must help users act faster, not just expose more information.

### 8. How windows should behave inside the new shell

The app uses floating windows.

That is acceptable.

But the windows must now support the destination model instead of competing with it.

You need to define:

- what windows are primary in each destination
- what windows are secondary utilities
- what should open automatically
- what should open on demand
- what should stay visible versus feel temporary

## Practical Rule For This Phase

When you change the shell, always ask:

- does this make the current destination clearer
- does this reduce hunting
- does this reduce overload
- does this keep the feature set intact

If the answer is no, do not make that change.

## Plain-Language Product Rules

Use these rules while working:

- Workspace should feel like the starting point.
- Explore should feel like the main place for analysis and charting.
- Dashboards should feel like monitoring, not just another canvas mode.
- Decisions should feel like decision help, not like semantic setup with a new name.
- AI should help everywhere, even if some AI tools live inside specific areas.
- Setup should not overpower day-to-day use.
- Advanced definitions should be reachable without being shoved in the user’s face all the time.

## What You Should Build In This Phase

You should focus on shell behavior and destination clarity.

That means:

- refine the shell so each destination has a clear role
- improve how the top bar, left rail, right pane, and canvas work together
- make the active destination obvious
- make the next action obvious
- reduce duplicated navigation signals
- reduce confusion between setup, analysis, monitoring, and decisions

## What You Should Not Build In This Phase

Do not spend this phase on:

- final visual polish only
- detailed chart redesign
- detailed dashboard redesign
- detailed Decision panel redesign
- backend refactors
- removing old capabilities because they are hard to place

This phase is about structure and behavior first.

## Specific Warning

Do not bury:

- AI
- API workflows
- semantic definitions
- Decision Intelligence

They all must remain available.

But they also must stop feeling scattered.

That is the balance you need to achieve.

## Output Expectation

As you continue implementation, make sure the shell clearly answers these questions for the user:

- Where am I?
- What is this area for?
- What should I do next?
- Where do I go if I need help?
- Where do I go if I want charts?
- Where do I go if I want dashboards?
- Where do I go if I want decisions?

If the interface does not answer those questions quickly, keep refining.

## Final Direction

Your task now is not to invent a new app.

Your task is to make the current app understandable, guided, and unified.

Preserve the intelligence and analytical depth.

Reduce confusion.

Make the shell teach the product.
