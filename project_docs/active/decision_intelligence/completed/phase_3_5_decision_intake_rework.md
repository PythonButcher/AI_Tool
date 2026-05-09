> COMPLETED REFERENCE ONLY: This file is not part of the default active scan path. Any old wording below such as "active", "next", "required", or "handoff" is historical unless the current status or active execution plan explicitly points here.
# Phase 3.5 Decision Intake Rework

## Status

This was the Decision Intelligence intake rework step before Phase 4.

Plain English:

- the current intake form is too hard
- it asks users to think like our system
- business users should not need to understand objective / levers / constraints before the product helps them
- we need to simplify this a lot before we move into chat-first Decision Intelligence

## Why This Exists

The current intake experience is not good enough to be the front door for Decision Intelligence.

Problems with the current form:

- too many structured fields too early
- too much product language before trust is earned
- feels like paperwork instead of help
- makes the user define the whole decision manually
- does not feel interesting, smart, or inviting

The result is simple:

- users will bounce
- users will not feel helped
- the product will feel harder than it should

## Goal

Replace the current heavy intake form with a simpler, more inviting, more product-grade decision kickoff flow.

The new intake should feel like:

- easy to start
- clear
- helpful
- smart
- calm

It should not feel like:

- a requirements document
- a semantic-model admin tool
- a workflow engine config form

## Core Product Decision

The current structured intake should stop being the primary entry.

The new primary entry should be:

- one plain-English starting prompt
- a few optional helper prompts
- system-drafted decision structure underneath

The old structured fields can remain only as:

- advanced editing
- clarification
- refinement after the draft exists

## Proposed New Intake Shape

### Step 1: Start With One Question

Primary prompt:

- `What are you trying to decide?`

Optional supporting prompts:

- `What matters most?`
- `Anything you want to avoid, protect, or stay within?`

That is enough to start.

### Step 2: System Draft

After the user answers, the product should draft:

- likely objective
- likely levers
- likely constraints
- likely missing inputs
- likely relevant metrics and dimensions

The user should react to a draft, not build everything from zero.

### Step 3: Guided Refinement

The UI should then help the user refine the draft with simple actions like:

- `Yes, use this`
- `Change the goal`
- `Add a limit`
- `Show what is missing`
- `Open advanced setup`

### Step 4: Open Workspace

Once the user is comfortable, open the full decision workspace.

The workspace should feel like the deeper layer, not the first burden.

## Backend Support Now Available

Phase 3.5 now has additive backend support on:

- `POST /api/decision/workspaces`

New prompt-first request support:

- `intake_mode: "prompt_first"`
- `decision_prompt`
- optional `decision_intake.what_matters`
- optional `decision_intake.what_to_avoid`
- optional `decision_intake.additional_context`

In prompt-first mode:

- `objective` is optional
- `levers` are optional
- `constraints` are optional
- backend drafts missing structure from the plain-English intake plus semantic context

The response now includes additive draft metadata at:

- `decision_workspace.drafting`

That object includes:

- `intake_mode`
- `helper_prompts`
- `source_summary`
- `prompt_matches`
- `clarification_hints`

Gemini should use that object to power the draft-preview step instead of forcing users into the old structured composer first.

## Phase 3.6 Hardening Note

The prompt-first contract is now implemented, but the first live pass exposed a backend drafting failure:

- prompts that mixed a goal metric, lever metrics, and a guardrail in one sentence could incorrectly promote a lever metric into the drafted goal

Phase 3.6 backend hardening now addresses that by:

- extracting the objective clause separately from lever and guardrail clauses
- ranking objective matches against the objective clause instead of the whole prompt
- ranking lever candidates against the lever clause instead of the whole prompt
- excluding objective and guardrail metrics from drafted levers
- lightly normalizing prompt tokens so phrasing like `discounting` still matches `Discount Rate`

Practical expectation for prompts like:

- `How should we grow revenue next quarter using discount rate and marketing spend changes by region without hurting gross margin?`

Expected draft shape:

- objective: `Revenue`
- levers: `Discount Rate`, `Marketing Spend`, `Region mix`
- guardrail: `Gross Margin %`

## UX Rules

- use plain English
- do not front-load jargon
- keep the first step visually clean
- make the experience feel interesting and premium
- show the product helping, not interrogating

Important:

- Gemini should step up on visual quality here
- this needs stronger product design, not just fewer fields

## Recommended Screen Behavior

The first Decision Intelligence screen should likely have:

- one strong hero prompt input
- 3 to 5 example starter decisions
- a small explanation of what the system will do next
- gentle trust language about what is and is not automatic

Examples:

- `What inventory should we restock first?`
- `Which products are most at risk of stocking out?`
- `Should we discount slow-moving stock?`
- `How can we reduce stock risk without over-prioritizing expensive items?`

## What Happens After Submit

After submit, the UI should present a drafted decision card or draft panel with:

- your goal
- what we think you can change
- what limits might matter
- what information is still missing

This should feel editable and safe, not final.

## What We Are Not Doing In Phase 3.5

Not yet:

- full chat-first flow
- simulation engine
- trade-off engine
- fake autonomous recommendations

This phase is about fixing the front door.

## Codex Responsibilities

Codex should handle:

- product framing
- backend contract planning for a lighter intake flow
- deciding how much of the current workspace contract can be auto-drafted
- handoff docs and implementation guidance

Codex should not build frontend code unless explicitly authorized.

## Gemini Responsibilities

Gemini should handle:

- redesigning the intake UI
- simplifying the interaction model
- making it feel attractive and high quality
- preserving truthfulness
- keeping advanced structure accessible without making it the default burden

Gemini should now design against the prompt-first backend support described above.

Recommended backend handoff for Gemini:

- `project_docs/active/decision_intelligence/completed/decision_intelligence_v3_gemini_handoff_03_phase_3_5_prompt_first_intake.md`

## Verification Standard

Phase 3.5 is successful when:

- a normal business user can start a decision without understanding product jargon
- the first screen asks for very little
- the system does more of the structuring work
- the UI feels simpler and more interesting than the current form
- advanced structure still exists, but is not the primary burden

## What Comes After This

After Phase 3.5 is solid:

- move into Phase 4 chat-first Decision Intelligence

That later work should build on the same product truth:

- the system helps draft structure
- the user does not start with paperwork

## One-Line Truth

Before we make AI chat the main Decision Intelligence feature, we need to fix the current intake so the product feels helpful instead of heavy.
