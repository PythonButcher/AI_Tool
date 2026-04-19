# Decision Intelligence V3 Phase 4 Execution Checklist

## Summary

Phase 4 is the chat-first Decision Intelligence build.

The AI destination becomes the front door for decision work, but it should not be powered by loose generic chat logic alone. This phase should establish a dedicated backend decision engine, expose a clean chat-to-decision contract, and let Gemini build the AI chat experience on top of that foundation.

The operating rule for this phase is strict:

- no fake simulation
- no fake trade-off engine
- no fake autonomous recommendation theater

The model can help with framing, clarification, and explanation, but grounded state, tool execution, workspace drafting, and workspace analysis must remain deterministic backend responsibilities.

## Core Phase Direction

Phase 4 should be executed as a backend-first, hybrid-grounded program.

That means:

- AI chat is the primary user-facing feature
- the backend decision engine is the critical system investment
- Gemini can add honest placeholders where the product needs visible future affordances
- the placeholder upload idea for decision context should be surfaced in UI now, but real ingestion should wait until a later phase

The long-term upload idea is valid. Users will likely need a way to attach decision-specific context such as:

- schema notes
- business terms
- assumptions
- guardrails
- supporting documents for the decision

But for Phase 4, that should remain a clearly labeled placeholder surface rather than a rushed ingestion feature.

## Execution Checklist

### 1. Backend Foundation: Dedicated Decision Engine

- [ ] Create a dedicated `backend/decision_engine/` package as the single owner of Phase 4 chat-to-decision orchestration.
- [ ] Keep current generic AI routes and older decision services available, but treat them as legacy paths rather than the new chat foundation.
- [ ] Split the new backend engine into clear subsystems:
  - contract and state handling
  - intent and mode detection
  - context grounding
  - tool routing
  - workspace draft generation
  - workspace analysis bridging
  - artifact formatting for chat
- [ ] Use a hybrid-grounded design:
  - LLM handles intent reading, clarifying questions, and explanation copy
  - deterministic services handle decision state, scoped context, workspace drafting, workspace analysis, and tool execution
- [ ] Use a stateless turn contract for Phase 4:
  - backend returns `session_state`
  - frontend sends `session_state` back on the next turn
  - no server-side persistence is required in this phase
- [ ] Define explicit engine modes:
  - `ask`
  - `explore`
  - `decide`
- [ ] Require every turn response to declare its current mode.

### 2. Public Contract: New Decision Chat API

- [ ] Add `POST /api/decision/chat/turns` as the primary Phase 4 chat contract.
- [ ] Request payload should include:
  - dataset context
  - semantic model context
  - `user_message`
  - `conversation_history`
  - `session_state`
  - optional active decision workspace context
- [ ] Response payload should include:
  - `assistant_message`
  - `mode`
  - `suggested_actions`
  - `artifacts`
  - `draft_workspace_preview`
  - updated `session_state`
  - `grounding_summary`
  - `warnings`
- [ ] Add `POST /api/decision/chat/actions` for explicit tool actions from the UI so Gemini does not need prompt-hack buttons for:
  - `Draft workspace`
  - `Show blockers`
  - `Show assumptions`
  - `Analyze workspace`
  - `Open workspace`
- [ ] Keep `POST /api/decision/workspaces` and `POST /api/decision/workspaces/analyze` as underlying engine tools rather than primary chat endpoints.
- [ ] Do not build a real decision-context upload ingestion API in Phase 4.

### 3. Decision Engine Behavior

- [ ] Support conversational analytics:
  - answer grounded questions about the active dataset and semantic model
  - support follow-up turns without restarting context
  - route chart requests through existing grounded chart and NLP capabilities
  - return chart artifacts with clear explanation of what data and logic were used
- [ ] Support decision framing:
  - detect when the user is moving from analysis into decision work
  - extract or propose objective, levers, constraints, and missing inputs
  - ask plain-English follow-up questions when scope is incomplete
- [ ] Support workspace handoff:
  - generate a draft workspace preview from chat state
  - show assumptions, blockers, and missing inputs before opening the workspace
  - support clean handoff into the Decisions destination
- [ ] Enforce honest boundaries:
  - explicitly label simulation, trade-off execution, and goal-seeking as not yet implemented
  - never imply modeled recommendation quality when only observational analysis exists

### 4. Gemini Frontend Handoff

- [ ] Update the AI destination so the chat experience is visibly organized around:
  - `Ask`
  - `Explore`
  - `Decide`
- [ ] Replace decorative chips with real action controls wired to backend actions.
- [ ] Render chat artifacts cleanly in-thread:
  - grounded answers
  - chart or result cards
  - draft workspace preview cards
- [ ] Add a right-side `Decision Context` area with placeholder modules for future uploads:
  - `Schema Notes`
  - `Business Terms`
  - `Assumptions / Constraints`
- [ ] Make those upload modules honest placeholders:
  - visible
  - clearly marked `Coming Soon`
  - no fake upload, ingest, or grounding behavior
- [ ] Preserve current AI chat value:
  - existing data questions still work
  - current chart-related chat flows still work
  - dataset grounding and mentions do not regress
- [ ] Treat this checklist plus the V3 Phase 4 chat execution plan as the Gemini implementation reference.

### 5. Important Interfaces And Types

- [ ] Introduce `session_state` as the key new Phase 4 type.
- [ ] `session_state` should carry only what the next turn needs:
  - active mode
  - resolved objective, levers, and constraints draft
  - active scoped context summary
  - known missing inputs
  - latest artifacts and action availability
- [ ] Define `artifacts` with explicit types at minimum:
  - `answer`
  - `chart`
  - `workspace_preview`
  - `workspace_analysis_summary`
  - `coming_soon`
- [ ] Keep future decision-context uploads out of the real contract for this phase. Only reserve the UI structure and naming.

## Test Checklist

### Backend Tests

- [ ] Unit tests for mode detection across `ask`, `explore`, and `decide`
- [ ] Unit tests for tool routing for chart generation, workspace drafting, and workspace analysis actions
- [ ] Unit tests for `session_state` carry-forward across follow-up turns
- [ ] Unit tests for honest fallback when a requested capability is not implemented

### API Tests

- [ ] Grounded analytics question on active dataset returns a grounded answer
- [ ] Follow-up question reuses prior session state cleanly
- [ ] Decision-framing prompt produces objective, levers, guardrails, and missing-input handling
- [ ] Draft workspace preview is generated from chat state
- [ ] Explicit actions like `Show blockers` and `Show assumptions` return structured results

### Regression Tests

- [ ] Prompt-first workspace drafting still works
- [ ] Workspace analysis still works
- [ ] Natural-language chart routing still works

### Frontend Verification

- [ ] AI destination still handles existing chart and data chat flows
- [ ] Action controls render only when backend says they are available
- [ ] Draft workspace preview opens the Decisions destination cleanly
- [ ] Placeholder upload modules appear but do not pretend to work

### Manual Acceptance Scenarios

- [ ] `What is low stock right now?` returns a grounded answer
- [ ] `Show revenue by region` returns a chart artifact
- [ ] `How should we grow revenue next quarter without hurting gross margin?` enters decision mode and drafts structure
- [ ] `Draft workspace` produces a preview before handoff
- [ ] `Analyze workspace` returns observational analysis only and does not claim simulation

## Assumptions And Defaults

- Phase 4 is backend-first, not frontend-first.
- The new backend lives under `backend/decision_engine/`.
- The architecture is hybrid-grounded, not LLM-led.
- The new contract centers on `/api/decision/chat`, not the legacy `/ai` route.
- Phase 4 includes placeholder-only upload surfaces for future decision context.
- Existing legacy AI and decision services remain available during Phase 4 and are wrapped or adapted rather than immediately removed.
- Simulation, trade-off execution, and goal-seeking are explicitly out of scope for this phase even if the UI reserves space for them later.

## One-Line Phase Truth

Phase 4 succeeds when AI chat becomes the real front door for Decision Intelligence and the backend behind it is strong enough to deserve that role.
