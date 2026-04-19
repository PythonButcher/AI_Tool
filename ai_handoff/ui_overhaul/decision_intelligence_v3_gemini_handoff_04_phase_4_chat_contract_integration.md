# Decision Intelligence V3 Gemini Handoff 04

## Status

This is the frontend handoff for the first real Phase 4 backend chat contract.

Plain English:

- the backend chat contract now exists
- Gemini should integrate the AI destination with that contract
- the goal is to make the AI destination feel like a real decision product, not a generic chat panel

Current correction:

- the latest frontend pass is not complete yet
- the three modes are visible, but they still read as mostly cosmetic
- the legacy chart shortcut path is still bypassing the new Phase 4 chat contract for chart-like prompts
- `answer` artifacts still need cleaner structured rendering instead of raw object fallback

## Goal

Wire the AI destination to the new decision chat backend and render its artifacts honestly.

The user should be able to:

- ask grounded analytics questions in chat
- get chart or answer artifacts in-thread
- move from analytics into decision framing in the same conversation
- see a draft workspace preview in chat
- trigger real backend decision actions from the UI

This refreshed handoff is specifically about fixing the gaps in the current frontend implementation, not starting from zero.

## Product Reference Direction

The product direction for this pass is now clearer.

We want our own version of the strong analytics-agent workspace pattern shown in the referenced Meta article:

- chat-heavy thread on the left
- top-row tabs that make the AI surface feel like a system
- a real result pane on the right for inspecting the currently active output

But we do **not** want a clone.

Rules:

- keep this app's tone, theme, spacing, and visual language
- do not copy Meta's labels directly
- do not copy their kitchen metaphor directly
- do not turn the UI into someone else's product with our logo pasted on it

The left conversation area should still feel like the core of the experience.
Most of the chat window should stay structurally familiar.
The change is that the workspace around it should feel more like a purpose-built analytics agent.

## Backend Contract Gemini Must Use

### Turn endpoint

`POST /api/decision/chat/turns`

Send:

- dataset context
- semantic model context
- `user_message`
- `conversation_history`
- `session_state`
- optional `decision_workspace`

Receive:

- `assistant_message`
- `mode`
- `suggested_actions`
- `artifacts`
- `draft_workspace_preview`
- updated `session_state`
- `grounding_summary`
- `warnings`

### Action endpoint

`POST /api/decision/chat/actions`

Supported actions right now:

- `draft_workspace`
- `show_assumptions`
- `show_blockers`
- `analyze_workspace`
- `open_workspace`

Gemini should not invent extra action ids.

## What The Frontend Should Render

### 1. Conversation messages

Render `assistant_message` as the main assistant reply for each turn.

### 2. Artifacts

The backend may return these artifact types:

- `answer`
- `chart`
- `workspace_preview`
- `workspace_analysis_summary`

Gemini should render each type in a clean, compact card style inside the conversation flow.

Important:

- do not hide the artifact because the assistant message already exists
- the artifact is the product surface, not just extra metadata
- `answer` artifacts must not fall back to raw `JSON.stringify(...)` blobs for structured backend content

### 3. Suggested actions

Render `suggested_actions` as real action controls, not decorative chips.

When clicked, they should call:

- `POST /api/decision/chat/actions`

and then append the returned assistant message and artifacts back into the conversation.

### 4. Session state

Gemini must preserve `session_state` locally and send it back on every next turn.

This is important.

Without sending the updated `session_state`, follow-up analytics and follow-up decision behavior will regress.

## UI Direction

The AI destination should visibly support three modes:

- `Ask`
- `Explore`
- `Decide`

This does not need to become a tabbed workflow, but the UI should make it legible which kind of work the user is currently doing.

Fresh direction:

- keep the left rail mode icons, but do not rely on them as the primary mode display
- add a clearer visible mode control inside the main workspace header area
- the best version for this pass is a segmented `Ask / Explore / Decide` control or compact mode bar with:
  - label
  - one-line promise
  - clear active styling
- the empty state should reinforce all three modes as one coherent system, not just swap isolated hero copy

Additional product direction:

- add a slim top-row tab system above or around the conversation area
- those tabs should help the AI destination feel like a real analytics workspace rather than a single blank chat shell
- the tab labels should be ours, not copied from the Meta article

Good tab patterns for this app would be app-specific concepts such as:

- threads
- playbooks
- definitions
- briefs
- checks

Gemini should choose labels that fit this app's premium neutral tone and current product vocabulary.
The names can be a little playful, but they must still feel professional and coherent inside this product.

Important truth rule:

- if the user clicks a mode, that choice must meaningfully affect the next chat turn
- mode selection cannot remain a cosmetic-only local UI toggle
- Gemini should either:
  - pass the selected mode as an explicit frontend hint in the turn payload, or
  - align the UI so it reflects only backend-returned mode

Do not leave the UI in a state where:

- the mode looks selected
- but the backend is actually doing something different

Good outcomes:

- grounded analytics feels fast
- decision framing feels serious
- workspace preview feels like a structured handoff
- the AI destination feels like a real analytics workspace with conversation plus inspection
- the right pane feels useful the moment a result appears

Bad outcomes:

- generic chatbot styling
- fake consultant language
- backend-driven actions hidden behind vague chips
- assistant messages with no structured artifact rendering
- a beautiful mode switch that has no real behavioral meaning
- copying the Meta UI too literally
- inventing novelty labels that clash with this app's tone

## Critical Fixes Required

### 1. Stop bypassing the Phase 4 chat contract

Chart-like prompts should not short-circuit into the legacy NLP chart path before the new Phase 4 turn endpoint runs.

Gemini should remove or refactor that early bypass so:

- chart-style prompts still work
- but they go through the real `/api/decision/chat/turns` path first for Phase 4 behavior
- `session_state` and backend artifacts remain in play for explore-mode continuity

### 2. Make mode selection behaviorally honest

If a user selects `Ask`, `Explore`, or `Decide`, the next turn should respect that mode in a truth-aligned way.

At minimum:

- do not present mode selection as a strong control if it only swaps copy
- do not let the UI suggest a mode state that contradicts backend-returned mode

### 3. Upgrade `answer` artifact rendering

Structured `answer` artifacts need a proper card renderer.

Gemini should render:

- summary value
- grouped rows when present
- relevant labels or fields

Do not dump raw structured content as stringified JSON.

### 4. Rebalance the right pane into a true result pane

The right side should feel more like a live result or inspection surface.

That means:

- keep the current context capability
- preserve the existing placeholder and context features
- but change the visual hierarchy so the active artifact gets the strongest presentation when one exists

Practical direction:

- charts should be inspectable in the right pane
- workspace previews should be inspectable in the right pane
- analysis summaries should be inspectable in the right pane
- the chat thread should still show inline artifacts, but the right pane should act as the focused detail view

This is important.

The desired feeling is:

- ask in chat on the left
- inspect the result on the right

not:

- ask in chat on the left
- stare at a mostly static sidebar on the right

## Placeholder Decision Context Area

Gemini should add a visible right-side `Decision Context` area for future work.

For this phase, it should include placeholder modules such as:

- `Schema Notes`
- `Business Terms`
- `Assumptions / Constraints`

These placeholders must be honest:

- visible
- clearly labeled `Coming Soon`
- no fake upload behavior
- no fake grounding claims

These modules should now sit beneath the active result area or below the primary inspection surface.
They should not dominate the right pane when a real chart, answer summary, or workspace preview is available.

## Files Gemini May Change

- `frontend/frontend/src/features/ai/AIShell.jsx`
- `frontend/frontend/src/features/ai/AIChat.jsx` if needed
- supporting AI destination components
- `frontend/frontend/src/App.jsx` if needed for handoff or state plumbing

Gemini should prefer adding small focused components for artifact rendering instead of turning `AIShell.jsx` into one giant file.

## Verification Standard

Do not call this handoff complete unless:

- current AI chat still opens and works
- existing chart-related chat flows still work
- the new decision chat endpoints are used for the Phase 4 path, including chart-like prompts that belong in the chat flow
- artifacts render in-thread
- `answer` artifacts render as intentional UI, not raw serialized objects
- suggested actions call the backend successfully
- `session_state` is preserved across turns
- mode selection is behaviorally honest and not just cosmetic
- draft workspace preview can hand off to Decisions cleanly
- the top-row tab system feels intentional and on-brand for this app
- the right pane behaves like a focused result viewer when artifacts are present
- placeholder decision-context modules look intentional and honest

## Read With

- `ai_handoff/phase_docs/decision_intelligence_v3_phase_4_execution_checklist.md`
- `ai_handoff/phase_docs/decision_intelligence_v3_phase_4_backend_checkpoint.md`
- `ai_handoff/phase_docs/decision_intelligence_v3_phase_4_chat_engine_execution_plan.md`
- `ai_handoff/ui_overhaul/decision_intelligence_v3_gemini_handoff_02_chat_decision_bridge.md`

## One-Line Product Truth

The backend chat contract is now real, so the frontend job is to make that contract feel like a real decision product.
