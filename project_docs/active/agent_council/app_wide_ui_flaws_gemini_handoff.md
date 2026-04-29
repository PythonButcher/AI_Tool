# App-Wide UI Flaws Gemini Handoff

## Purpose

This handoff turns the Agent Council's app-wide UI flaw review into a Gemini implementation prompt.

The user priority is clear: iron out UI flaws across the app before adding more features. Improvements are welcome across frontend and backend if needed, but the current theme and tone should remain.

## Council Output

The full structured council artifact is:

`project_docs/active/agent_council/outputs/2026-04-28-app-wide-ui-flaws-gemini-council.json`

Validate it with:

`python project_docs/active/agent_council/validate_council_json.py project_docs/active/agent_council/outputs/2026-04-28-app-wide-ui-flaws-gemini-council.json`

## Current Truth

This is a Gemini frontend implementation task. Codex is coordinating the handoff.

Preserve the current dark, dense, professional, operations-focused theme. Do not turn the app into a marketing-style interface. Do not remove, hide, downgrade, or simplify existing capability unless the user explicitly approves that change.

The existing React state-flow review is still useful, but one important finding appears stale: the duplicate `WindowProvider` issue does not appear to match current `index.js` and `App.jsx`. Gemini should revalidate before acting on that finding.

Decision Intelligence Slice 3 behavior must be preserved: primary and secondary actions, disabled states, availability explanations, no duplicate action surfaces, scoped action state, and truthful observational analysis behavior.

## Main Defects To Fix

The highest-risk flaw is that AI chat actions on older cards may execute using the latest component-level `sessionState` rather than the state represented by that card. This must be checked and fixed before broad visual cleanup.

The second major flaw is continuity. Chat `open_workspace` should carry the same draft workspace into the Decisions destination instead of leaving chat and Decisions as parallel products.

The third major flaw is truthfulness. UI copy must not imply simulation, optimization, autonomous decisioning, ranked recommendations, finalized strategy, or final decisions. Use operational language such as draft decision frame, ready for structured analysis, observational analysis, review blockers, and open workspace.

The fourth flaw is inspectability. Draft previews and analysis summaries should expose enough backend-provided structure for users to see what was understood and why the analysis result matters. Use existing fields when present, including decision kickoff, prompt frame, objective, levers, segments, guardrails, assumptions, blockers, scoped diagnostics, and legacy diagnostics.

The fifth flaw is UI noise. AI shell tabs and context surfaces that do not reflect real session state should be hidden, disabled, or clearly marked as unavailable. Keep the Ask/Explore/Decide mode flow and result pane as the main experience.

The sixth flaw is recovery. In Decisions and Dashboards, semantic definitions are important. If readiness is missing semantic context, make the right DataPane or a Review Definitions action easy to discover.

The seventh flaw is accessibility and verification. Icon-only controls need accessible names, and Gemini should add or run focused frontend verification for stale card behavior, disabled actions, duplicate filtering, nested recommended actions, and keyboard navigation.

## Files To Inspect

Start with:

`project_docs/INDEX.md`

`project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`

`project_docs/active/status/decision_intelligence_execution_status.md`

`project_docs/active/decision_intelligence/phase_4_5_ai_chat_decision_intelligence_plan.md`

`project_docs/active/reviews/react_state_flow_review.md`

Then inspect:

`frontend/frontend/src/App.jsx`

`frontend/frontend/src/components/layout/CanvasContainer.jsx`

`frontend/frontend/src/components/layout/DestinationHome.jsx`

`frontend/frontend/src/components/layout/DestinationHome.css`

`frontend/frontend/src/components/layout/DataPane.jsx`

`frontend/frontend/src/components/layout/DataPane.css`

`frontend/frontend/src/features/ai/AIShell.jsx`

`frontend/frontend/src/features/ai/AIShell.css`

`frontend/frontend/src/features/business/decision/DecisionPanel.jsx`

`frontend/frontend/src/features/business/decision/DecisionIntakeFlow.jsx`

`frontend/frontend/src/features/business/decision/DecisionWorkspaceView.jsx`

`frontend/frontend/src/features/business/decision/DecisionWorkspace.css`

If chat workspace continuity lacks enough backend data, inspect:

`backend/decision_engine/chat_service.py`

`backend/routes/decision.py`

Stop and document the backend gap for Codex review instead of inventing frontend-only fake state.

## Acceptance Checks

Run the frontend build.

Manually verify the ready prompt: `How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?`

Manually verify the incomplete prompt: `How should we adjust discount rate by region next quarter?`

Run a two-prompt stale-card check: ask the ready prompt, then ask a second unrelated decision prompt, then click `Analyze workspace` on the first card. The result must match the first card's workspace, not the newest session state.

Verify `Open workspace` from AI chat navigates to Decisions and shows the same drafted workspace context.

Verify `Analyze workspace` renders observational diagnostic detail without simulation, optimizer, autonomous recommendation, or final-decision language.

Search visible UI strings for `optimization`, `simulation`, `optimizer`, `final decision`, `autonomous`, `trade-off`, `strategy finalized`, and `ranked recommendations`. These should only appear in truthful limitation or unavailable contexts.

Keyboard-test AI mode selection, chat input, send, artifact inspect, results-pane close, and action buttons. Icon-only controls must have accessible names.

Update `project_docs/active/status/decision_intelligence_execution_status.md` truthfully after implementation.

## Short Gemini CLI Prompt

Read `project_docs/INDEX.md` first, then the active frontend guardrail, Decision Intelligence status, Phase 4.5 plan, React state-flow review, and `project_docs/active/agent_council/app_wide_ui_flaws_gemini_handoff.md`. Implement the first app-wide UI flaw cleanup before adding any new features. Preserve the current dark, dense, professional operations-focused theme and preserve all existing AI chat, chart, dashboard, workflow, and Decision Intelligence capability.

Focus first on correctness and trust. In `frontend/frontend/src/features/ai/AIShell.jsx`, verify and fix older chat card actions so they execute against that card's own decision/session context, not the latest component-level `sessionState`. Support both top-level and nested `recommended_next_action` shapes without duplicate action buttons. Keep disabled actions non-executable and keep availability explanations visible.

Then fix chat-to-Decisions continuity. If the backend action returns a draft or opened decision workspace, wire `open_workspace` through the frontend so AI chat can navigate to the Decisions destination and hydrate the same workspace in `DecisionPanel` instead of starting a fresh flow. Touch `App.jsx`, `CanvasContainer.jsx`, `AIShell.jsx`, and Decision components as needed. If the backend response lacks required data, document the gap for Codex instead of inventing fake frontend-only workspace state.

Clean the visible UI truthfulness and tone. Keep the theme, but remove or rewrite language that implies simulation, optimization, autonomous decisioning, ranked recommendations, finalized strategy, or final decisions. Use language like draft decision frame, ready for structured analysis, observational analysis, review blockers, and open workspace. Reduce marketing-like empty-state copy while keeping the app polished and work-focused.

Improve inspectability without adding features. Render existing backend-provided decision draft and analysis details where available, including objective, levers, segments, guardrails, assumptions, blockers, prompt framing, scoped diagnostics, and legacy diagnostics. Hide, disable, or truthfully label AI shell tabs and context surfaces that are not backed by real session state. Make semantic definitions easier to discover in Decisions and Dashboards when readiness is incomplete.

Add accessible names for icon-only controls and run verification. Build the frontend, test the ready marketing-spend/channel/gross-margin prompt, test the incomplete discount-rate/region prompt, run the two-prompt stale-card action check, verify Open workspace carries the same context into Decisions, search UI copy for unsupported capability claims, keyboard-test the main AI controls, and add or run focused frontend tests where practical. Update `project_docs/active/status/decision_intelligence_execution_status.md` truthfully when done.
