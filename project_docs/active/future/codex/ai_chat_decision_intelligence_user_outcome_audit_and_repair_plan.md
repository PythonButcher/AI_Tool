# AI Chat and Decision Intelligence Audit and Repair Plan

Written: 2026-07-14  
Author: Codex  
Status: Approved planning source. Release 2 is active through the Decision Intelligence gate. Release 3 has a deferred preparation package; later work remains deferred until promoted.

## Purpose

This audit combines the UI-focused plan at `project_docs/active/future/ai_chat_di_ui_audit_and_repair_plan.md` with the functional audit at `project_docs/active/future/ai_chat_di_functional_gap_audit.md`.

The goal is practical: make AI Chat help a user ask a business question, understand the result, compare choices, record a decision, and return later to review what happened.

## Verdict

The existing audits correctly identify a confusing interface and several disconnected capabilities. The larger problem is that AI Chat does not provide one dependable journey.

The target journey should be:

`Choose data → Ask → Confirm understanding → Analyze → Compare choices → Record decision → Act and review`

Today, the application usually stops around analysis and produces a dense framework before the user confirms what the system understood.

## Confirmed Gaps

| Priority | Gap | User impact | Required result |
| --- | --- | --- | --- |
| 1 | Dataset mentions do not select the mentioned dataset. AI Chat still sends the global cleaned or full dataset. | A result can appear grounded in one dataset while using another. | Show and enforce the active dataset, filters, period, and freshness. Dataset changes must invalidate or deliberately rebase an existing result. |
| 2 | The frontend sends conversation history, but the Decision Chat backend does not use it. | Normal follow-ups such as “use margin instead” or “only for the Northeast” are unreliable. | Preserve conversational references, clarifications, and corrections across turns. |
| 3 | Ask, explore, and decide routing is hidden and based mainly on overlapping keywords. | Natural prompts can enter the wrong workflow without explanation. | Add `Auto`, `Ask data`, `Explore`, and `Decide` choices. Ambiguous prompts should ask one confirmation question. |
| 4 | Some enabled-looking Evidence Board, Decision Map, Command Center, and graph actions have no complete execution path. | Clicking a control can do nothing or stop at an internal action plan. | Every enabled action must execute. Otherwise it must be disabled with an inline reason or rendered as plain information. |
| 5 | A decision prompt opens a large Command Center before the frame is confirmed. | Users receive internal structure instead of a clear answer and next step. | First show a compact interpretation card with goal, data, time period, levers, guardrails, missing information, and `Confirm` or `Change` actions. |
| 6 | The system has levers and a Decision Map, but no real alternatives comparison. | Users cannot compare concrete options or their trade-offs. | Add an options table with user-controlled criteria, guardrails, evidence, and visible unknowns. The user—not the system—selects the option. |
| 7 | Scenario Compare has no normal user input path and performs direct arithmetic adjustments. | The feature is inaccessible and can be mistaken for forecasting. | Build a user-controlled `Sensitivity Compare` surface. Keep it explicitly non-predictive unless a validated model is added later. |
| 8 | Missing inputs are listed as blockers rather than resolved through guided questions. | Users are told what is wrong without being helped to finish the frame. | Turn missing metric, period, segment, lever, and guardrail information into answerable choices with undo. |
| 9 | Saved DecisionAssets are snapshots, not complete decision records. | The workflow ends with a report instead of a choice and follow-through. | Record the selected option, rationale, owner, actions, due dates, success metric, guardrails, and review date. |
| 10 | Refresh loses the chat and active result, and `open_workspace` can use stale local history. | Work disappears or an old result can reopen. | Persist safe structured session state, add `New Chat`, and reopen the current backend workspace rather than scanning old messages. |

## Corrections to the Existing Functional Audit

| Existing suggestion | Codex correction |
| --- | --- |
| Wire Scenario Compare as though the backend feature is complete. | The route is a bounded sensitivity calculator, not a simulation or forecasting engine. It needs a user input surface and accurate naming. |
| Add separate frontend buttons for Signals, Brief, and Recommendations. | The older pipeline already combines these services, while the current workspace has a newer scoped analysis flow. Consolidate them into one useful analysis instead of exposing service topology. “Recommendations” should be presented as suggested investigations or follow-up checks. |
| Graph candidate relevance is a frontend-only fix. | Candidate discovery currently ignores the decision frame and Evidence Board. Backend ranking and the frontend request both need work. |
| Export sections are not rendered. | The Command Center renders equivalent sections through `section_order`, and PDF export uses `export_sections`. Verify parity rather than building a duplicate renderer. |
| `resolveDatasetForNlp` is not passed to the decision review. | It is passed. The real problem is stale decision state when the active dataset changes. |
| Expand keywords and add a message-length fallback. | This would create more routing collisions. Use visible mode control and confidence-aware confirmation instead. |

## Repair Order

### Release 1 — Make the current experience trustworthy

Fix dataset identity, routing, no-op actions, stale `open_workspace` behavior, refresh recovery, `New Chat`, misleading welcome actions, and unfinished navigation controls.

Release 1 is accepted when the named dataset is always the analyzed dataset, ambiguous comparison prompts are confirmed, every enabled control works, refresh restores the session, and changing datasets cannot silently reuse an old result.

### Release 2 — Make analysis conversational

Use conversation history, support plain-language refinements, turn blockers into guided clarification, and replace the immediate Command Center dump with a confirmable interpretation card followed by a concise result.

The result should lead with what was found, the strongest evidence, important uncertainty, and the next useful action. Detailed readiness and boundary information can remain under `Details`.

Release 2 is accepted when a user can ask for a metric, refine the segment or period, change the metric, request a chart, and continue the same grounded conversation without rebuilding everything.

### Release 3 — Add real decision comparison

Add named alternatives, user-controlled criteria, guardrails, evidence-linked trade-offs, and Sensitivity Compare. Consolidate useful signal, brief, and follow-up-check output into the scoped analysis instead of adding unrelated endpoint buttons.

Release 3 is accepted when users can compare at least two options, see missing evidence without invented scores, run several direct-adjustment cases, and trace displayed claims to the active data.

### Release 4 — Complete the decision cycle

Let users record their choice and rationale, assign actions and ownership, define success and guardrail metrics, set a review date, and later compare the original snapshot with current data.

Release 4 is accepted when a saved decision can be reopened, understood as historical or current, deliberately rerun, and reviewed against its recorded outcome measures.

## Essential Acceptance Checks

| Task | Expected behavior |
| --- | --- |
| Ask “What were sales last quarter?” | Returns the answer and shows the dataset, measure, period, and filters used. |
| Ask “Compare pricing options.” | Confirms chart comparison versus decision comparison when intent is uncertain. |
| Ask a decision question with missing details | Shows a confirmable frame and asks only the necessary questions. |
| Say “Use net margin instead, only for enterprise customers.” | Updates the existing analysis and shows what changed. |
| Mention another dataset | Actually switches datasets or refuses clearly; it never analyzes the old dataset under the new name. |
| Click every enabled next action | Every action produces a visible result or transition. |
| Refresh or change datasets | Safely restores the session or marks the current result stale. |
| Save and reopen a decision | Separates the original snapshot from current data and offers rerun and outcome review. |

## Implementation Areas

| Area | Main files |
| --- | --- |
| Chat, session, routing UI, and action dispatch | `AIShell.jsx`, `AIShell.css`, `mode_detection.py`, `chat_service.py` |
| Decision result and comparison UI | `DecisionOutputReview.jsx`, `DecisionCommandCenter.jsx`, `ScenarioPreview.jsx` |
| Graph continuation | `DecisionGraphWorkspace.jsx`, `InspectorPanel.jsx`, `decisionApi.js`, `decision_graph_service.py` |
| Scoped analysis consolidation | `decision_workspace_service.py`, `decision_output_service.py`, and the older signal, brief, recommendation, and pipeline services |
| Saved decision lifecycle | DecisionAsset service/routes plus the saved decision UI |

Frontend ownership remains Gemini or Antigravity unless Codex is explicitly authorized to edit frontend files in the implementation session. Codex owns backend truth, tests, architecture, documentation, and review.

## Recommendation

Approve Release 1 before wiring more dormant endpoints or adding more readiness UI. The immediate goal is to make data selection, routing, actions, and session behavior trustworthy. Then add conversational clarification and real alternatives comparison.
