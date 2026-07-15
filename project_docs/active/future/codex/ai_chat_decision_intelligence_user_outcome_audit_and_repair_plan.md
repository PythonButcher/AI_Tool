# AI Chat and Decision Intelligence User-Outcome Audit and Repair Plan

Written: 2026-07-14  
Author: Codex  
Status: Deferred proposal awaiting user approval; this is not the active implementation gate.

## Purpose

This audit answers one product question: can a normal user move from a business question to a trustworthy analysis, compare realistic choices, make and save a decision, and return later to see whether it worked?

The answer today is no. The application contains a large amount of Decision Intelligence structure, but the visible journey is fragmented. It can draft a frame, run observational diagnostics, render evidence, export a structured result, save a snapshot, and open a graph. It does not yet behave like a coherent decision assistant. Users must discover hidden trigger phrases, accept routing they cannot see, interpret a dense Command Center, work around controls that do not act, and stop before the most important parts of decision work: comparing alternatives, recording a choice, assigning follow-through, and reviewing an outcome.

This plan cross-checks the Antigravity UI audit at `project_docs/active/decision_intelligence/active_gate/phase_1_ai_chat_di_audit_and_repair_plan.md` and the deeper functional audit at `project_docs/active/future/ai_chat_di_functional_gap_audit.md`. It adopts their strong findings, corrects claims that do not match the current source, and adds the missing end-to-end product capabilities.

The priority is visible user value. Backend contracts, semantic fields, and services matter only when they enable a user to understand the result, take the next step, or safely recover from failure.

There is also a current gate conflict that must be resolved before implementation. The status file and active-gate README name Multiple Data Sources Foundation Discovery as the active Codex gate, but the plan and goal paths they declare do not exist in `active_gate/`; deferred versions remain under this Codex future folder. At the same time, `phase_1_ai_chat_di_audit_and_repair_plan.md` remains in the active-gate folder and labels itself the active execution plan. These states cannot all be true under the one-gate rule, and the agent harness correctly fails on the missing declared files. This Codex proposal does not silently choose between the directions. After the user approves a direction, the active gate should be rewritten so it names exactly one existing plan, one existing goal, and one owner, with the other work returned to deferred planning or sequenced explicitly.

## Executive Verdict

The largest problem is not that the application lacks another backend schema. The largest problem is that AI Chat does not maintain a dependable conversation-to-decision loop.

The current experience has six breaks in that loop. The app does not reliably understand what the user is trying to do. It does not reliably use the dataset the user thinks they selected. It does not use the conversation history it sends to the backend. It renders some enabled-looking next actions that do nothing. It presents a decision framework without a real alternatives comparison or a user-owned final choice. It saves an observational snapshot without a strong path to resume, rerun, act, and measure the result.

The repair should therefore not be organized as a collection of disconnected endpoint buttons. It should create one guided journey:

`Choose data → Ask or frame → Confirm understanding → Analyze → Compare choices → Record decision → Act and review`

Every screen, action, and service should earn its place in that journey.

## What the Current Product Actually Does

The source supports several valuable capabilities. `DecisionChatService` routes ask, explore, and decide turns. `DecisionWorkspaceService` drafts a prompt-first decision frame and runs scoped observational diagnostics. `DecisionOutputService` composes Dataset Trust, frame, readiness, Evidence Board, Decision Map, bounded Scenario Compare data when supplied, export sections, and a Command Center. The frontend can render charts, save immutable DecisionAssets, reopen saved assets, export PDFs, and launch the Decision Graph.

Those capabilities are real, but their integration creates a misleading mental model. AI Chat looks like a conversational agent while much of its behavior is deterministic keyword routing. A standard ask-mode question can return only a status message describing row, column, metric, and dimension counts. Conversation history is sent by `AIShell.jsx` but is not consumed by `backend/decision_engine/chat_service.py`. Dataset mentions are detected and displayed as grounded, but `resolved_datasets` is not used by the Decision Chat backend to select the mentioned data; the payload still contains the global cleaned or full dataset. A decision prompt immediately produces a large decision output even before the user has confirmed the interpretation.

The result is a product that often appears more capable than the interaction actually is. That mismatch is the main source of confusion.

## Corrections to the Two Existing Audits

The existing audits are useful, but implementation should not begin from their priority lists without correcting the following source-level issues.

| Existing claim | Codex finding | Product decision |
| --- | --- | --- |
| Scenario Compare is backend-complete and only needs a frontend call. | The route exists, but it performs a bounded direct arithmetic adjustment. AI Chat only includes a precomputed `scenario_preview`; it does not create one. This is a sensitivity check, not a predictive scenario engine. | Build a user-controlled Sensitivity Compare surface and preserve the non-predictive label. Do not market direct adjustment as a forecast or simulation. |
| Decision Signals, Decision Brief, and Recommendations should each become new frontend actions. | The older `/api/decision/run` pipeline already combines these services but is unused by the current AI Chat path. Workspace analysis has a newer scoped diagnostic flow and can optionally attach older signals as secondary evidence. The recommendation service explicitly produces observational follow-up checks, not final recommendations. | Reconcile the old pipeline with the current workspace flow. Integrate scoped findings into one analysis result instead of adding a button for every endpoint. Rename legacy recommendations to Suggested Investigations or Follow-up Checks. |
| Passing `evidence_board` and `frame` to graph candidate discovery is a frontend-only fix. | `DecisionGraphService.discover_candidates()` currently ignores both fields and returns semantic metrics and dimensions in generic order. The build route uses the decision context later, but candidate discovery does not. | Change both backend candidate ranking and the frontend request. Preselect or rank variables that match the active objective, levers, constraints, breakdowns, and evidence. |
| Export sections are assembled but not rendered. | The raw `export_sections` objects are not directly mapped into the React view, but the Command Center renders equivalent sections using backend `section_order`, and PDF export consumes `export_sections`. | Do not create a duplicate renderer. Verify parity between visible sections and exported sections, then fix only proven omissions. |
| `resolveDatasetForNlp` is not passed to `DecisionOutputReview`. | It is passed from `AIShell.jsx`, and the current dataset is resolved during render. | Drop this claim. Fix the real lifecycle problem: the active decision artifact and session are not invalidated or visibly marked stale when the active dataset changes. |
| Expanding the keyword list plus a message-length fallback solves routing. | More overlapping keywords create new collisions. For example, `compare` is checked as visualization intent before decision intent, so “compare pricing options” can enter explore mode. Long-message fallback can misclassify normal questions as decisions. | Replace keyword-only routing with a visible skill choice plus a confidence-aware intent router and user confirmation for ambiguity. Keywords can remain a deterministic fast path, not the whole product. |
| Correction fields expose raw API names. | The current select uses display labels, but labels such as “Lever Controllability” and values such as `achieve_target` remain internal jargon. | Replace the contract-shaped correction form with conversational or task-shaped edits such as “Change goal,” “Change time period,” “Mark what we control,” and “Remove this mapping.” |

The UI audit is correct about discoverability, the misleading welcome actions, dense results pane, persistence loss, alarming warnings, and lack of user guidance. The functional audit is correct that Scenario Compare has no normal user trigger, `open_workspace` can read stale local history, graph follow-ups do not continue into Scenario Compare, inline chart previews are weak, and several older backend routes have no current frontend caller. Those findings remain in this plan, but at a different priority than the end-to-end failures below.

## Critical Missing Capabilities

### 1. AI Chat is not yet a dependable conversation

The frontend sends the last ten messages as `conversation_history`, but the current Decision Chat service does not read them. Stateful behavior is limited to selected session fields such as active mode, the draft workspace, and the last analytic context. This allows a few terse analytical follow-ups, but it does not support normal conversational reference, explanation, correction, or clarification.

A user should be able to say “use net margin instead,” “only for the Northeast,” “compare that with the prior quarter,” “why did you choose revenue,” or “turn the second finding into a chart.” The system should resolve the reference against the current analysis, show what it changed, and retain the revised state. Today, several of those turns will rebuild the workspace, fall into the wrong mode, or return a grounding status.

The repair should connect a constrained language-model orchestration layer to the existing deterministic tools. The language model should interpret intent, references, and clarifications; the existing services should remain responsible for calculations and source-backed artifacts. The UI must show the proposed interpretation before a destructive reset or materially different analysis.

### 2. The data the user sees is not reliably the data the chat uses

The `@dataset` mention flow finds a dataset name and marks the user message as grounded, but the Decision Chat payload still uses `cleanedData` first and `fullData` second. The backend does not use `resolved_datasets` to switch or resolve the mentioned source. A user can therefore mention one dataset while analysis runs on another.

The chat header also reports only generic “Data” and “Semantic” connection states. It does not show the active dataset name, row count, last refresh, applied filters, or whether the current decision result belongs to a different dataset version.

The repair must make the active analytical context explicit and enforce it. The composer should show the dataset name as a removable chip, allow the user to change it, and send an actual dataset reference or resolved rows for that choice. Each result should repeat the dataset, time range, filters, and freshness in compact form. Changing datasets should offer to start a new analysis or deliberately rebase the current decision; it must never silently preserve a stale result.

This work should coordinate with the active multiple-data-sources foundation rather than invent a second source-selection model inside AI Chat.

### 3. Mode routing is hidden and brittle

Users cannot see or change ask, explore, and decide modes. The router checks visualization phrases before decision phrases, and several broad words overlap. A prompt can therefore produce a chart when the user wanted an alternatives comparison, or a decision workspace when the user wanted a simple metric answer. Expanding keyword lists alone will make this less predictable.

The composer should expose a small skill control with `Auto`, `Ask data`, `Explore`, and `Decide`. Auto can use a hybrid classifier that returns an intent, confidence, and reason. High-confidence requests proceed. Ambiguous requests show a one-line confirmation such as “Do you want a chart comparison or a decision-options comparison?” The user can correct the choice without rewriting the prompt.

The active mode and its reason should be visible but quiet. The product should not make users learn trigger phrases.

### 4. Several visible actions are false affordances

`DecisionCommandCenter.jsx` renders Evidence Board next checks as enabled Material UI buttons without `onClick` handlers. Decision Map checks are styled as interactive pills but only display tooltips. The Command Center action bar builds click handlers for analysis, save, and export; other checks can remain enabled even when `clickHandler` is null, so clicking them does nothing. The graph action service plans actions such as `send_to_scenario_compare`, but the inspector stores only the planning response and does not continue the action back into AI Chat or a scenario surface.

This is a trust-breaking defect and should be repaired before adding new features. Every item that looks actionable must satisfy one of three states: it executes and returns a visible result, it is disabled with an inline reason and a recovery step, or it is rendered as non-interactive information. Tooltips are supplemental; they must not carry the only explanation.

The frontend needs one action dispatcher shared by chat chips, Evidence Board checks, Decision Map checks, Command Center actions, and graph actions. Backend action metadata must correspond to a real handler before the UI marks it enabled.

### 5. The result arrives as a framework, not a useful answer

On a decision prompt, the backend appends a workspace preview and a full decision output. The frontend auto-focuses the last rich artifact, which is normally the large Command Center. The user can be moved from one sentence to a dense multi-section review before confirming the objective, time horizon, metric bindings, levers, constraints, or breakdowns.

The first decision response should be a compact interpretation card. It should say, in plain language, “Here is what I think you are deciding,” show the active data, goal, options or levers, guardrails, time period, and missing information, then offer `Looks right`, `Change it`, and `Start analysis`. The full review should open after confirmation or on explicit request.

After analysis, the top of the result should answer four questions immediately: what was found, what evidence supports it, what remains uncertain, and what can the user do next. Readiness diagnostics and truth boundaries should remain accessible, but they should not dominate the primary reading path.

### 6. There is no real alternatives comparison

The current frame has an objective, levers, limits, and breakdowns. The Decision Map visualizes structure and evidence. Neither is a comparison of concrete choices. “Increase marketing,” “change pricing,” “focus on retention,” and “enter a new segment” are materially different alternatives, but the app has no place to define them, attach evidence, compare trade-offs, or record why one is preferred.

Decision Intelligence needs an Alternatives workspace. Users should be able to add options from chat or manually, choose evaluation criteria, identify hard guardrails, and compare evidence for each option. Criteria may have optional weights, but weights must remain user-controlled and visible. Unknown evidence should stay unknown rather than receiving invented scores. The system may summarize trade-offs and identify dominated or under-evidenced options; it should not pretend to make a final decision for the user.

The existing Decision Map can support this by showing how evidence relates to objectives and constraints, but the map is not a substitute for an options table.

### 7. Scenario Compare is not a user-owned comparison tool

The current scenario service applies direct percentage or absolute adjustments to observed baselines. That can be useful as a sensitivity calculator, but it does not model causal effects, interactions, time dynamics, feasibility, or uncertainty. The user has no normal input surface for metric targets and cannot compare several named scenarios.

The first honest feature should be called Sensitivity Compare. The user selects a metric, enters an absolute or percentage adjustment, names the case, and sees baseline, adjusted value, arithmetic delta, assumptions, and limitations. Users can place multiple cases side by side and attach each case to an alternative. If later phases add validated models, the UI can distinguish model-backed projections from direct adjustments; it should never use the same visual label for both.

Natural language such as “show revenue at plus five, ten, and fifteen percent” should populate the form, then ask for confirmation before execution.

### 8. Clarifications and corrections are not part of the conversation

The backend generates clarification hints and missing inputs, but the UI mainly lists them. The assistant may place the first hint in prose, while the next visible action often sends the user to blockers. Corrections are handled through a contract-shaped form in the review pane.

Missing information should become an answerable question. When the objective metric is unclear, show the top grounded candidates and let the user choose or type another. When the time period is missing, offer common periods. When a guardrail lacks a threshold, ask for the threshold. Each answer should visibly update the interpretation card and show a small undo action.

This converts “blocked” from a dead state into a guided completion step.

### 9. There is no user-owned decision record or follow-through loop

The system intentionally avoids making final recommendations, which is correct. However, it also gives the user no strong place to make and record their own choice. A saved DecisionAsset is an immutable observational snapshot, not a complete decision record.

After comparing alternatives, the user should be able to record `Selected option`, `Why`, `Decision owner`, `Decision date`, `Actions`, `Due dates`, `Success metric`, `Guardrails`, and `Review date`. The system can prefill a draft from the confirmed frame and evidence, but the user owns the commitment.

On return, the app should distinguish the original evidence snapshot from current data. It should offer `Review original`, `Rerun with current data`, and `Compare outcome to expectation`. This is the point where Decision Intelligence becomes a cycle rather than a one-time report.

### 10. Session and recovery behavior is incomplete

Refreshing the page or remounting AI Chat loses messages, session state, and the active artifact. There is no clear New Chat or Reset Decision control. The special-case `open_workspace` action searches local message history rather than asking the backend for the current draft, so it can open stale output or fail after history loss.

Short-term recovery should persist a bounded chat session, active mode, current dataset reference, draft workspace identifier or safe structured state, and active artifact metadata. It should not duplicate large raw datasets into browser storage. A visible New Chat action must clear the conversation and decision state intentionally. `open_workspace` should use the normal backend action path and current session state.

Longer-term login-based continuity belongs with the deferred context plan, but accidental refresh recovery should not wait for authentication.

### 11. Charting lacks recovery and transparent interpretation

Charts are rendered in the inspector, while inline chat shows only a generic visualization preview. When field mapping fails or produces an unexpected result, the user does not get a clear interpretation, alternative mapping, or guided repair.

Every chart result should show the metric, grouping, filters, time range, and chart type used. A “How this was built” disclosure should let the user verify or change those choices. When a chart cannot be built, the response should name the unresolved field and offer grounded alternatives from the active dataset. Compatible chart-type switching can be useful, but the UI must not offer chart types that require a different mapping without explaining the change.

### 12. The interface advertises unfinished destinations

The left rail shows Data Connections, Custom Workflows, and Agent Settings as future items that look like navigation. The welcome chip labeled Grounded Observational Analysis sends `/clean`, which launches data cleaning rather than analysis. These controls teach the wrong product model before the user asks a question.

Unimplemented rail destinations should be removed from the primary path or clearly rendered as non-interactive roadmap items. The `/clean` shortcut should be renamed for what it does and moved into data preparation. Welcome actions should represent tasks that complete successfully today.

## External Product and AI-UX Benchmarks

The strongest outside examples reinforce the same direction rather than suggesting more backend surfaces.

| Source | Relevant pattern | Application to AI_Tool |
| --- | --- | --- |
| [Power BI Copilot data questions](https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-ask-data-question) | Supports session follow-ups and exposes “How Copilot arrived at this,” including selected fields, measures, and filters. It also names unsupported question types. | Preserve conversational context, show how the prompt was interpreted, and separate supported analysis from unsupported forecasting without ending the user journey. |
| [Tableau Pulse Ask and Discover](https://help.tableau.com/current/online/en-us/pulse_ask_discover_qa.htm) | Keeps exploration grounded in a metric, offers suggested follow-up questions, supports time and dimension refinements, and proposes alternatives when no semantic match is found. | Generate contextual next questions from the current result, keep follow-ups scoped, and recover from no-match states with grounded choices. |
| [Google PAIR mental-model guidance](https://pair.withgoogle.com/guidebook-v2/chapter/mental-models/) | Recommends staged onboarding, accurate capability expectations, feedback control, and a non-AI fallback when confidence is low. | Expose modes and interpretation, let users correct the system, and provide manual selection instead of dead-end “blocked” messages. |
| [Google PAIR explainability and trust](https://pair.withgoogle.com/guidebook-v2/chapter/explainability-trust/) | Emphasizes explanations at decision points, confidence, data use, and safe user control after errors. | Put explanations beside the result and next action, not in repeated warning banners or hidden tooltips. |

The benchmark is not feature parity with large BI platforms. The useful lesson is that trustworthy analytical chat combines continuity, visible interpretation, grounded follow-ups, and recoverable failure.

## Recommended Product Shape

The visible AI Chat layout should have four stable regions rather than many unrelated surfaces.

The composer owns the question, skill choice, active data, and attached context. The conversation owns clarifications, explanations, and follow-up questions. The results pane owns the current answer and uses progressive disclosure through `Summary`, `Evidence`, `Options`, `Sensitivity`, and `Details`. The saved decision area owns snapshots, user choices, action plans, and outcome review.

The Command Center can remain as the detailed `Details` view. It should not be the first or only representation of a decision result.

## Repair Sequence

### Release 1 — Restore trust in the basic interaction

This release makes the current capabilities reliable before adding new decision features. It should repair dataset identity, mode selection, visible actions, session recovery, and stale-state behavior. The welcome experience should offer real tasks. The composer should show the active dataset. The user should be able to start a new chat. Ambiguous routing should ask for confirmation. Every enabled action should execute. `open_workspace` should use backend state. Refresh should restore the active session without persisting raw datasets.

Release acceptance is behavioral. Mentioning a dataset must analyze that dataset or refuse with a clear reason. “Compare pricing options” must not silently become a chart request. Every visible enabled action must produce a result. Refresh must restore the conversation and result. Changing datasets must visibly invalidate or rebase the active decision.

### Release 2 — Make analysis conversational and guided

This release should connect conversation history to a constrained orchestration layer, convert missing inputs into answerable clarification controls, and redesign the first result as a compact interpretation followed by a summary. Users should be able to refine the metric, segment, time period, filters, levers, and guardrails through normal language. The result should show what the system understood and which data it used.

Release acceptance should use multi-turn tasks, not isolated endpoint tests. A user can ask for revenue by region, say “only the Northeast,” then “make that a line chart,” and see the same grounded context evolve. A decision prompt asks only the necessary clarifications, lets the user confirm the frame, and does not open the full Command Center prematurely. Corrections can be undone.

### Release 3 — Compare choices honestly

This release should add the Alternatives workspace, user-controlled criteria and guardrails, evidence-linked trade-off comparison, and Sensitivity Compare. It should reconcile older signals, brief, recommendation, and pipeline code with the newer scoped workspace flow so there is one source-backed analysis path. Suggested investigations should become executable actions, not a separate collection of service buttons.

Release acceptance should prove that a user can define at least two alternatives, compare them against objective and guardrail criteria, see missing evidence without fabricated scores, run several direct-adjustment sensitivity cases, and trace each displayed claim to the active dataset and analysis. The interface must call the direct-adjustment feature a sensitivity comparison, not a forecast.

### Release 4 — Turn a result into a decision cycle

This release should let the user record their own choice and rationale, create an action plan, assign an owner and dates, define success and guardrail metrics, and schedule a review. Saved records should preserve the original snapshot while allowing a fresh rerun against current data. The saved library should make state obvious: draft analysis, decision recorded, in progress, review due, or closed.

Release acceptance should prove that a user can save a decision, close the application, reopen the record, distinguish original from current data, review planned actions, rerun analysis, and compare observed outcomes with the recorded success criteria. The system may summarize evidence and trade-offs, but the selected option and commitment remain explicitly user-owned.

### Release 5 — Polish discovery and charts

After the journey works, add contextual onboarding, a compact help surface, chart thumbnails, compatible chart controls, prompt examples based on the active dataset, and visual simplification of readiness details. This release should also remove duplicate or obsolete render paths and unused imports discovered during implementation.

Release acceptance should measure task completion rather than the presence of a help panel. A first-time user should be able to load data, ask a valid question, understand the result, recover from an unsupported request, and save useful work without knowing internal terms such as workspace, semantic readiness, artifact, or truth boundary.

## Implementation Boundaries That Protect User Value

The deterministic analytical services should remain the authority for calculations, field selection, source references, filters, and scenario arithmetic. A language model may classify intent, resolve conversational references, propose tool calls, ask clarifying questions, and summarize returned evidence. It must not invent metric values, silently change datasets, or turn observational associations into causal claims.

The UI should not expose service topology. Users should see tasks such as Analyze, Explain, Compare options, Test sensitivity, Save decision, and Review outcome. They should not need to understand whether a result came from the signal route, brief route, recommendation route, workspace service, or output composer.

The active multiple-data-source work and this AI Chat repair must share one dataset selection and provenance mechanism. Implementing a temporary AI Chat-only dataset chooser would create another source of confusion.

## Likely Implementation Areas

| Area | Likely files | Purpose |
| --- | --- | --- |
| Chat composer, session, results, and action dispatch | `frontend/frontend/src/features/ai/AIShell.jsx`, `AIShell.css`, focused extracted components | Active data chip, skill choice, new chat, persistence, interpretation card, shared action handling, results tabs. |
| Decision review | `DecisionOutputReview.jsx`, `DecisionCommandCenter.jsx`, `ScenarioPreview.jsx` | Progressive disclosure, real next-check execution, alternatives, sensitivity input, plain-language corrections, user decision record. |
| Graph continuation | `DecisionGraphWorkspace.jsx`, `InspectorPanel.jsx`, `decisionApi.js` | Decision-aware candidate ranking and executable graph-to-analysis follow-ups. |
| Intent and conversation orchestration | `backend/decision_engine/mode_detection.py`, `chat_service.py`, focused new orchestration modules | Confidence-aware routing, history use, clarification turns, structured action dispatch, state invalidation. |
| Scoped analysis consolidation | `decision_workspace_service.py`, `decision_output_service.py`, legacy signal/brief/recommendation/pipeline services | One scoped evidence flow; remove duplicated or misleading endpoint-first behavior. |
| Scenario and decision lifecycle | `scenario_service.py`, asset service and routes, focused new persistence fields or services | User-owned sensitivity cases, recorded choice, action plan, rerun and outcome review. |

Frontend ownership remains Gemini or Antigravity unless the user explicitly authorizes Codex frontend implementation in the implementation session. Codex owns backend truth, tests, architecture, documentation, review, and the phase gate.

## Acceptance Framework for the Entire Repair

The repair is complete only when the following representative journey works end to end.

A user selects a named dataset and sees its identity in AI Chat. They ask, “How should we reduce churn without increasing support cost?” The app confirms whether this is a decision question, shows its interpretation of churn, support cost, time period, candidate levers, and segments, and asks only for unresolved information. The user corrects one mapping in plain English and confirms the frame. The app runs scoped analysis, presents a concise answer with evidence and uncertainty, and offers executable follow-ups. The user creates at least two alternatives, compares them using visible criteria, runs bounded sensitivity cases, and records their own choice. They assign actions, a success metric, guardrails, and a review date. After refresh and later reopening, the decision remains available. When data changes, the app clearly separates the original snapshot from a rerun and shows whether the chosen outcome improved.

No visible enabled control may do nothing. No dataset mention may analyze a different dataset. No chart or decision mode may be selected silently when routing is ambiguous. No sensitivity result may be labeled as a forecast. No AI summary may contain values that are absent from the deterministic result. No saved decision may be presented as live without a rerun.

## Product Success Measures

Implementation checks are necessary but not sufficient. The team should establish a baseline on the current product, then measure the same task set after each release.

| Measure | What it proves | Required direction |
| --- | --- | --- |
| Grounding integrity | The dataset, filters, period, and fields shown to the user match the calculation request. | Zero silent context mismatches in the acceptance corpus. |
| Action integrity | Enabled controls have handlers and produce a visible result or safe transition. | Zero enabled no-op actions in source-contract tests and task testing. |
| Intent recovery | Ask, explore, and decide requests enter the intended path or receive one clear confirmation. | Ambiguous tasks recover without prompt rewriting; routing corrections decline release over release. |
| First useful result | The user reaches a relevant answer, chart, or confirmed decision frame. | Fewer turns and less elapsed time than the current baseline. |
| Clarification completion | Missing metric, period, segment, lever, or guardrail information can be supplied successfully. | More users complete a frame instead of abandoning at a blocker list. |
| Analysis-to-comparison conversion | Users who analyze a decision can create and compare alternatives. | A measurable share of decision sessions reach an alternatives comparison when the task requires one. |
| Save-and-resume success | Saved work can be reopened with its original context understood. | Users reopen without mistaking a snapshot for live data and can deliberately rerun when needed. |
| Decision follow-through | Recorded choices have actions, success measures, and a review path. | Decision records progress from selected to reviewable rather than ending as exported reports. |

The acceptance corpus should include ordinary language, ambiguous language, missing data, unsupported requests, dataset changes, refresh recovery, and stale saved work. It must not consist only of prompts written to match router keywords.

| Representative task | Expected behavior |
| --- | --- |
| “What were sales last quarter?” | Returns a grounded metric answer and exposes the period, measure, filters, and dataset used. |
| “Plot sales by region.” | Produces a chart with inspectable mapping and a repair path if a field is unresolved. |
| “Compare pricing options.” | Confirms decision comparison versus chart comparison when intent confidence is low. |
| “How should we reduce churn without increasing support cost?” | Builds a confirmable frame, asks only necessary clarifications, and offers scoped analysis. |
| “Use net margin instead, only for enterprise customers.” | Updates the existing conversation context, shows the change, and preserves the rest of the frame. |
| Mention a non-active dataset | Switches to that dataset through the real data-selection path or refuses clearly; it never analyzes the old dataset under the new label. |
| Click every enabled next check | Each action executes, navigates to a working surface, or becomes visibly disabled with recovery guidance. |
| Refresh during analysis | Restores safe structured session state and the active result without placing raw dataset rows in browser storage. |
| Change datasets after a result | Marks the result stale and offers a deliberate new analysis or rebase. |
| Save, reopen, and review later | Separates the original evidence snapshot from current data and offers rerun and outcome review. |

## What Should Not Be Prioritized First

A standalone help center should not precede fixing the broken journey. More keyword triggers should not precede visible mode control. A separate button for every dormant backend route should not precede consolidation into a scoped analysis. Chart-type toggles should not precede reliable mapping and error recovery. A richer Decision Graph should not precede alternatives and executable next checks. More readiness badges, contracts, or warning copy should not precede a clear answer and recovery step.

These ideas may remain useful, but they do not solve the current user failure on their own.

## Review Record

This document was reviewed in three deliberate passes before finalization. The source-accuracy pass checked both existing audits against current frontend call sites, backend action contracts, graph candidate behavior, scenario semantics, pipeline integration, and tests. The user-outcome pass removed priorities that only expose dormant endpoints and added the missing conversation, data identity, alternatives, choice, action, and outcome loop. The execution pass converted the findings into vertical releases with behavioral acceptance checks and explicit ownership boundaries.

## Final Recommendation

Approve Release 1 as the next AI Chat repair slice only after reconciling it with the current multiple-data-sources gate. Do not approve the existing audit priority order unchanged. Its UX fixes are useful, and several disconnected capabilities are real, but the first implementation must restore trustworthy data identity, routing, action behavior, and session recovery.

Once that foundation is stable, build the conversational clarification and alternatives workflow. That is the shortest path from a dense analytical demo to a product that helps a user make and carry through a real decision.
