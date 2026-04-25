# Decision Intelligence V3 Gemini Handoff 02

## Status

This is the active next frontend handoff after the small workspace-analysis cleanup is finished.

Plain English:

- finish the small analysis cleanup first
- then move to AI chat
- AI chat is now the important Decision Intelligence frontend feature

## Goal

Build the first real chat-to-decision bridge inside the AI destination.

The user should be able to:

- talk through a decision in chat
- see clear decision-focused actions
- create a draft decision workspace from chat
- open that workspace without confusion

## Execution Scope For This Handoff

This handoff should start the frontend side of Phase 4 without pretending the full Phase 4 stack is already complete.

Practical scope:

- start with the first real bridge from AI chat into Decision Intelligence
- make conversational decision entry feel intentional and product-grade
- show real tool actions only where there is a real backend path or a clearly honest placeholder state
- prioritize the first visible slice of Phase 4A through early Phase 4C

That means Gemini should primarily deliver:

- clear decision entry inside AI chat
- decision-focused actions that feel like real product tools
- draft workspace preview and handoff behavior
- honest UI framing around what is observational versus what is not yet implemented

This handoff should **not** try to complete:

- full simulation
- full trade-off execution
- goal-seeking
- fake recommendation theater
- a giant all-at-once rebuild of the AI destination

## Backend Truth Gemini Should Design Against

Current backend support that is real today:

- `POST /api/decision/workspaces`
- prompt-first drafting through `intake_mode: "prompt_first"` with `decision_intake`
- `POST /api/decision/workspaces/analyze` for scoped observational diagnostics

Current backend support that is **not** real today:

- full simulation engine
- real trade-off execution in chat
- autonomous decisioning
- goal-seeking optimizer behavior

Gemini should use the real workspace drafting and analysis paths where needed, but the UI must stay truthful about what those paths actually do.

## What Gemini Should Build

### 1. Decision Entry In AI Chat

Add a clear way for users to start a decision flow from AI chat.

Examples:

- “Start a decision”
- “Draft a decision workspace”
- “Help me make a business decision”

### 2. Decision Tool Actions In Chat

Show simple, real tool actions in the AI destination such as:

- Draft workspace
- Ask missing questions
- Review assumptions
- Review blockers
- Open workspace

These should feel like product actions, not random suggestions.

Important implementation note:

- prefer actions that map cleanly to current product behavior
- if a tool is shown before the full backend path exists, it must be visually and textually honest about that status
- do not present decorative chips as if they are intelligent system outputs

### 3. Draft Workspace Preview

When chat has enough information, show a draft decision workspace card or preview with:

- objective
- levers
- constraints
- missing inputs
- a clear action to open the workspace

This preview should feel like a handoff artifact, not a final answer. It should help the user understand why moving into the Decisions destination is the next step.

### 4. Honest Boundaries

Keep all labels honest.

Do not imply:

- simulation exists in chat already
- trade-off engine exists in chat already
- autonomous decisioning exists

## Files Gemini May Change

- `frontend/frontend/src/features/ai/AIShell.jsx`
- `frontend/frontend/src/features/ai/AIChat.jsx`
- supporting AI destination components
- `frontend/frontend/src/App.jsx`
- Decision Intelligence shared components only if needed for the handoff bridge

## What Gemini Must Not Do

- do not invent backend capabilities
- do not fake decision recommendations
- do not fake trade-off paths
- do not remove working AI chat behavior
- do not break current chart commands or dataset mention behavior
- do not mix this handoff with unrelated intake redesign or legacy cleanup work

## UX Direction

The AI destination should feel like:

- a smart business decision workspace in conversation form

It should not feel like:

- a generic chatbot
- a fake consultant demo
- a wall of placeholders

## Verification Standard

Do not call this handoff complete unless:

- current AI chat still works
- current chart-related chat flows still work
- current data-related chat flows still work
- users can clearly start a decision flow from chat
- a draft workspace can be previewed or handed off cleanly
- the UI stays simple and honest

The first successful version does **not** need to solve everything in chat. It only needs to make the chat-to-decision bridge believable, useful, and truthful.

## Recommended Build Order Inside This Handoff

Gemini should implement this in order:

1. preserve the current AI destination and existing chat behavior
2. add a clear decision entry path in chat
3. add real decision action affordances
4. render a draft workspace preview card when enough decision structure exists
5. wire a clean open-in-Decisions handoff
6. polish labels and empty states so the UI does not overclaim intelligence

## Read With

- `project_docs/active/decision_intelligence/decision_intelligence_v3_resume_handoff.md`
- `project_docs/active/decision_intelligence/decision_intelligence_v3_phase_4_chat_engine_execution_plan.md`
- `project_docs/active/decision_intelligence/phase_3_5_decision_intake_rework.md`
- `project_docs/active/decision_intelligence/phase_4_5_ai_chat_decision_intelligence_plan.md`

## One-Line Product Truth

We are moving Decision Intelligence into AI chat because that is the feature users will actually feel.
