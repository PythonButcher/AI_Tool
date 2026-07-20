> COMPLETED REFERENCE ONLY: This file is not part of the default active scan path. Any old wording below such as "active", "next", "required", or "handoff" is historical unless the current status or active execution plan explicitly points here.
# Decision Intelligence V3 Gemini Handoff 03

## Scope

This handoff is for **Phase 3.5 only**.

Do not move into Phase 4 chat-first Decision Intelligence in this branch.

The job here is:

- replace the heavy structured intake as the primary front door
- use the new backend prompt-first draft support
- let the product draft structure before asking the user to do advanced setup

## Product Truth

The current `DecisionWorkspaceComposer` is still a structured config screen.

That is no longer the right first experience.

The new first step should feel like:

- one strong plain-English question
- a few optional helper prompts
- a drafted decision preview
- lightweight refinement before the full workspace

The first screen should not ask users to manually author:

- objective definition
- lever catalogs
- guardrail configuration
- scope tuning

Those belong behind the draft, not ahead of it.

## Backend Support Now Available

Backend support is additive on the existing endpoint:

- `POST /api/decision/workspaces`

Prompt-first request shape now supported:

```json
{
  "dataset": [],
  "dataset_ref": {
    "source": "datahub",
    "dataset_id": "sales_q1"
  },
  "semantic_model": {},
  "intake_mode": "prompt_first",
  "decision_prompt": "How should we grow revenue next quarter without hurting gross margin?",
  "decision_intake": {
    "what_matters": "Grow revenue next quarter",
    "what_to_avoid": "Protect gross margin",
    "additional_context": "We can change discounting and regional mix."
  }
}
```

Important behavior:

- `objective`, `levers`, and `constraints` are now optional in prompt-first mode
- backend drafts missing structure from the prompt, helper text, and semantic context
- explicit structured inputs still win if frontend supplies them
- this is still the scoped workspace path, not Phase 4 chat

## New Response Fields Gemini Should Use

The response still returns `decision_workspace`, but now includes:

- `decision_workspace.drafting.intake_mode`
- `decision_workspace.drafting.helper_prompts`
- `decision_workspace.drafting.source_summary`
- `decision_workspace.drafting.prompt_matches`
- `decision_workspace.drafting.clarification_hints`

Use those fields to power the draft-preview step.

Suggested rendering model:

- show the drafted goal from `decision_scope.objective`
- show drafted levers from `decision_scope.levers`
- show drafted guardrails from `decision_scope.constraints`
- show missing or uncertain items from `unknowns` and `readiness.missing_inputs`
- show quick follow-up chips from `drafting.clarification_hints`

## Recommended Frontend Flow

### Screen 1

Show:

- hero prompt: `What are you trying to decide?`
- helper prompt: `What matters most?`
- helper prompt: `Anything to avoid, protect, or stay within?`
- optional helper prompt: `Any extra context?`
- 3 to 5 starter examples

### After Submit

Call `POST /api/decision/workspaces` in prompt-first mode.

Then render a draft preview instead of dropping users into the full legacy-style structured form.

That preview should feel like:

- editable
- provisional
- system-assisted
- safe to refine

### Quick Actions

The draft preview should support actions like:

- `Use this draft`
- `Change the goal`
- `Add a limit`
- `What is missing?`
- `Open advanced setup`

## What To Keep Honest

- if the backend could not bind a real metric, show that clearly
- if no controllable lever was inferred, do not pretend the draft is complete
- if constraints are still vague, treat them as refinement work, not solved logic
- do not imply simulation, trade-offs, or autonomous recommendations are done

## What Not To Do

Do not:

- turn this into chat
- route the user into AI conversation as the main path
- mix Phase 3.5 intake work with Phase 4 bridge work
- keep the current structured composer as the hero experience

## One-Line Implementation Goal

Make the first Decision Intelligence screen feel like a smart kickoff prompt that produces an editable draft, not a form the user has to architect from scratch.
