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

### 3. Draft Workspace Preview

When chat has enough information, show a draft decision workspace card or preview with:

- objective
- levers
- constraints
- missing inputs
- a clear action to open the workspace

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

## Read With

- `ai_handoff/ui_overhaul/decision_intelligence_v3_resume_handoff.md`
- `ai_handoff/phase_docs/decision_intelligence_v3_phase_4_chat_engine_execution_plan.md`
- `ai_handoff/ui_overhaul/decision_intelligence_chat_shell_gemini_handoff_01.md`

## One-Line Product Truth

We are moving Decision Intelligence into AI chat because that is the feature users will actually feel.
