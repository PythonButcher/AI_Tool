> ARCHIVED REFERENCE ONLY: This file is historical. Do not treat old wording below such as "active", "next", "source of truth", or "handoff" as current project truth.
# Decision Intelligence Chat-First V2 Execution Plan

## Status Notice

This file is now a **historical V2 planning record**.

Decision Intelligence V2 is closed as-is.

Any remaining completion, polish, straightening, or expansion work should now be framed as **V3** work.

For active resume guidance, read:

- `ai_handoff/ui_overhaul/decision_intelligence_v3_resume_handoff.md`

## Objective

Shift the product toward a chat-first Decision Intelligence experience without breaking the current AI chat behavior or pretending V2 decision math already exists.

This plan keeps three truths in place:

- chat becomes the primary front door
- the semantic layer remains the grounding system
- the real decision engine still requires backend work beyond the shell

## Immediate Priority

The first implementation milestone is **not** simulation.

The first milestone is:

- build the new AI chat shell
- preserve current AI chat behavior inside that shell
- create placeholders for future domain context features
- make the shell feel like the future product direction

## Design Direction

The target shell should be inspired by the Analytics Agent layout from the referenced Meta article, but adapted to this app's tone and structure.

Do not copy it directly.

The shell should feel:

- analytical
- product-grade
- conversational first
- grounded in data work
- consistent with the current app shell and theme

## Product Framing

The AI destination should evolve from:

- a floating assistant panel

into:

- a first-class analytics workspace for conversation, artifacts, and decision drafting

The Decision Workspace remains important, but should become something the chat can produce and hand off into, not the only way to begin.

## Phase Order

### Phase 1: Chat Shell Foundation

Goal:

- replace the current "AI chat as floating side panel" mental model with a true AI destination shell

Required outcome:

- the new shell exists
- current AI chat features still work
- chart requests, dataset mentions, and existing command flows still function
- placeholder tabs and affordances exist for future features

Scope:

- create a dedicated AI destination shell component
- preserve current send/receive behavior
- preserve current backend endpoints
- keep current command support working:
  - `/charts`
  - `/clean`
  - natural-language chart requests
  - dataset mention flow
- introduce placeholder surface areas for future concepts like:
  - Skills
  - domain context / Ingredients
  - saved workflows / Recipes
  - workspace draft preview

Non-goals:

- no fake semantic intent visualizer yet unless clearly labeled as placeholder
- no fake decision engine
- no fake autonomous actions
- no fake simulation/trade-off UI

### Phase 2: Chat-Oriented UX Tightening

Goal:

- make the shell feel intentionally built for analytics conversations instead of just restyled chat bubbles

Scope:

- richer thread layout
- stronger artifact area for charts / summaries / future cards
- conversation list or session rail
- space reserved for workspace drafting
- clearer system framing around data context

This phase can still use placeholders where backend support does not yet exist.

### Phase 3: Semantic-Grounded Chat Backend Planning

Goal:

- define the backend contract for chat-first conversational analytics

Scope:

- semantic intent resolution
- metric / dimension / period grounding
- ambiguity handling
- decision-intent detection
- optional draft workspace generation

This is primarily Codex/backend planning work.

### Phase 4: Chat-to-Workspace Bridge

Goal:

- allow conversations to materialize into a draft decision workspace

Scope:

- generate scoped workspace candidates from conversation
- show missing inputs
- allow user to enter the full decision workspace view

### Phase 5: True Decision Engine Work

Goal:

- implement the actual DI backend beyond shell and framing

Scope:

- unified intelligence model
- real simulation engine
- trade-off path generation
- later goal-seeking

## Codex Responsibilities

Codex owns:

- implementation sequencing
- backend architecture and contracts
- truth alignment
- shell integration decisions
- docs and Gemini coordination

In the first new session, Codex should focus on:

- defining the new AI shell integration path
- deciding which existing AIChat logic gets preserved vs extracted
- ensuring the shell uses current working chat behavior
- documenting the frontend boundary for Gemini

## Gemini Responsibilities

Gemini owns:

- frontend implementation and polish for the new shell
- layout, component structure, presentation, and styling
- preserving working chat behavior while improving the shell

Gemini should not:

- invent backend capabilities
- imply the new shell already has semantic reasoning or V2 decision execution
- break current working chat commands while restyling the experience

## Technical Direction For Phase 1

The safest path is to separate **behavior** from **shell**.

Recommended approach:

1. Treat the current `AIChat.jsx` logic as the working behavior source.
2. Extract reusable state/handlers where useful, or wrap the current behavior inside a new destination shell.
3. Move toward a dedicated AI destination experience instead of relying primarily on the floating icon/panel.
4. Keep a fallback path only if needed during transition.

The shell should likely introduce three regions:

### Left Rail

Purpose:

- conversation/session navigation
- quick actions
- placeholders for future domain assets

Suggested contents:

- Chats
- Skills (placeholder)
- Recipes / Playbooks (placeholder)
- Context / Sources (placeholder)

### Main Thread

Purpose:

- current AI chat conversation
- input composer
- existing command support
- analytics responses

This is where the current AI chat functionality must survive intact.

### Right Context Pane

Purpose:

- artifact preview
- workspace draft preview
- future semantic/intent grounding summaries

Phase 1 can keep this partially placeholder, but it should exist so the shell already teaches the product direction.

## UI Rules

- preserve the app's tone and theme
- do not make a direct clone of the Meta UI
- keep the shell lighter and clearer than the current floating panel
- make placeholders explicit where behavior is not implemented yet
- do not imply decision execution, optimization, or autonomous action

## Truth Alignment Rules

These are active constraints during implementation:

- if a feature is placeholder, label it as placeholder
- if a pane is future-facing, make that obvious
- if semantic grounding is not yet real in the shell, do not fake it
- if workspace drafting is not yet live, present it as reserved space rather than simulated intelligence

## Deliverables

### Deliverable 1

New frontend shell for AI destination that preserves current AI chat behavior.

### Deliverable 2

Clear Gemini handoff for shell implementation and boundaries.

### Deliverable 3

Follow-up Codex plan for backend chat-first contracts after shell stabilization.

## Verification For Phase 1

Phase 1 is complete when:

- the AI destination has a new shell
- current chat still sends and receives messages
- current chart-related flows still work
- current cleaning command flow still works
- dataset mention behavior still works
- placeholder tabs/buttons exist without misleading users
- the UI clearly feels like the start of a chat-first analytics product

## Files To Read First In The Next Session

- `C:/Users/18022/Desktop/AI_Tool/ai_handoff/phase_docs/decision_intelligence_chat_first_consultant_handoff.md`
- `C:/Users/18022/Desktop/AI_Tool/ai_handoff/ui_overhaul/decision_intelligence_2_0_gemini_handoff_05_truth_alignment_before_v2.md`
- `C:/Users/18022/Desktop/AI_Tool/ai_handoff/ui_overhaul/decision_intelligence_chat_shell_gemini_handoff_01.md`
- `C:/Users/18022/Desktop/AI_Tool/frontend/frontend/src/features/ai/AIChat.jsx`
- `C:/Users/18022/Desktop/AI_Tool/frontend/frontend/src/features/ai/AIChat.css`
