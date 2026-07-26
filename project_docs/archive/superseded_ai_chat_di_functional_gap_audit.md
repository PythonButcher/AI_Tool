# AI Chat & Decision Intelligence — Deep Audit: What Is Actually Broken vs. What Is Just Confusing

**Written:** 2026-07-13  
**Author:** Antigravity — full source audit including backend routes, frontend wiring, and component-level data flow  
**Scope:** Everything touching AI Chat and Decision Intelligence. This audit goes past the UI surface into actual functional gaps: routes that have no frontend caller, backend capabilities with no UI hook, components that receive no data, and placeholder sections the user sees that cannot do anything.

**Status:** Archived supporting analysis. Its combined execution plan was superseded by the BI-first AI Chat direction.

---

## What Was Audited (With Line Counts)

| File | Lines | Role |
|---|---|---|
| `AIShell.jsx` | 1,605 | Core shell — conversation, routing, artifact renderer, results pane |
| `AIShell.css` | 1,871 | All shell styles |
| `DecisionCommandCenter.jsx` | 846 | Command Center renderer driven by `doCommandCenter` prop |
| `DecisionOutputReview.jsx` | 778 | Maps artifact fields to Command Center props |
| `ScenarioPreview.jsx` | 140 | Scenario compare UI component |
| `DecisionGraphWorkspace.jsx` | 257 | Decision Graph canvas — uses XFlow |
| `decisionApi.js` | 218 | Frontend API client with all decision routes |
| `AiAutopilot.jsx` | 160 | Autopilot button wiring |
| `chat_service.py` | 2,234 | Full decision chat engine — mode detection, workspace, actions |
| `mode_detection.py` | 126 | Keyword-based mode router (ask / explore / decide) |
| `decision.py` (routes) | 339 | Flask blueprint — all /api/decision/* endpoints |
| `nlp_routes.py` | 125 | /api/nlp/chart endpoint |
| `scenario_service.py` | 231 | Scenario comparison backend service |

---

## Executive Finding

The system has two distinct categories of problems:

**Category A — Functional gaps.** Backend capabilities that are fully built but have zero frontend caller. Routes that exist but are never called. Components that are wired but receive no data. These are features the user cannot access even if they wanted to, because the frontend connection is simply missing.

**Category B — UX/clarity gaps.** Things that work but are presented in a way that makes them impossible for a user to navigate: confusing labels, missing guidance, narrow keyword matching, opaque error states.

The previous audit focused entirely on Category B. This document covers both, with Category A first because those are actual missing functionality, not just polish.

---

## CATEGORY A: Real Functional Gaps (What Cannot Be Done Yet)

### Gap A1 — Scenario Compare has no user-triggerable action

**Status: Backend complete, frontend read-only, no user trigger**

The scenario compare backend (`/api/decision/scenarios/evaluate`) is fully implemented in `scenario_service.py`. The `ScenarioPreview.jsx` component exists and renders correctly. `DecisionCommandCenter.jsx` passes `doScenario` to `ScenarioPreview` at line 330. `DecisionOutputReview.jsx` maps `artifact.scenario_compare` at line 71.

**The gap:** There is zero frontend code that calls `/api/decision/scenarios/evaluate`. The frontend API client (`decisionApi.js`) has no `evaluateScenario` function. The Command Center and chat actions have no button or action that triggers a scenario. The `doScenario` prop only ever renders if the backend already embedded a pre-computed scenario preview inside a decision_output artifact — which it currently does not do automatically for most questions.

**User experience:** The user sees an empty "Scenario Compare" section in every decision output they generate. There is no way to trigger it. The section appears with `ScenarioPreview.jsx`'s locked state ("Scenario Compare Unavailable") because `doScenario` is always `null`.

**What is needed:** A frontend action that calls `/api/decision/scenarios/evaluate` with `metric_targets` from the current workspace. Either a chat action button ("Compare Scenarios"), a Command Center button that opens a mini-form to specify adjustments, or an automatic call when the workspace is analyzed.

---

### Gap A2 — Decision Signals has no frontend caller

**Status: Backend complete, no frontend use**

`/api/decision/signals/generate` exists in `decision.py` at line 271. `decision_signal_service.py` is 18,753 bytes. There is no `generateDecisionSignals` function in `decisionApi.js`. No component in the frontend ever calls this route. The data it would return (signals, early warnings, metric movements) never reaches the user.

**What is needed:** Either a chat action that calls this and renders the result in the chat, or a section in the Command Center that shows auto-generated signals when a workspace exists.

---

### Gap A3 — Decision Brief has no frontend caller

**Status: Backend complete, no frontend use**

`/api/decision/brief/generate` exists at line 285. `decision_brief_service.py` is 8,779 bytes. There is no `generateDecisionBrief` in `decisionApi.js` and no component that calls it. The brief is a structured executive summary that could dramatically improve the Command Center's "Executive Brief" section.

**Current state:** The "executive_brief" section in the Command Center renders `doTitle` and `doSummary` directly from the artifact — which are generated by the workspace builder, not the brief service. The brief service (which could produce a much richer, AI-generated summary) is never invoked.

**What is needed:** Call this route when a workspace is analyzed or when the user requests a summary. Render the output in the `executive_brief` section of the Command Center.

---

### Gap A4 — Recommendations route has no frontend caller

**Status: Backend complete, no frontend use**

`/api/decision/recommendations/generate` exists at line 313. `recommendation_service.py` is 19,235 bytes. There is no frontend call. The `decision_map` section in the Command Center is populated from the artifact's `doMap` field, which comes from `DecisionOutputService.compose()`. But the dedicated recommendations route — which could generate richer, more structured recommendations tied to specific levers — is never called.

**What is needed:** A chat action or Command Center trigger that calls this route and renders the output in the `decision_map` section.

---

### Gap A5 — Scenario Compare cannot be user-configured from chat

**Status: There is no input surface for `metric_targets`**

Even if the frontend called `/api/decision/scenarios/evaluate`, the route requires `metric_targets` (which metrics to adjust and by how much). There is no UI for the user to specify these adjustments. The user cannot say "show me what happens if revenue increases by 10%" and have the system create the right `metric_targets` payload.

**What is needed:** Either (a) NLP parsing of phrases like "what if revenue increases 10%" in the chat handler to build `metric_targets`, or (b) a simple scenario form in the Command Center where the user picks a metric and adjustment value.

---

### Gap A6 — Decision Graph receives no data from Decision Output

**Status: Graph exists and works independently, but receives no context from Command Center**

The Decision Graph (`DecisionGraphWorkspace.jsx`) is fully implemented. It calls `/api/decision/graph/candidates` and `/api/decision/graph/build`. The "Launch Decision Graph" button in the Command Center passes `evidence_board` and `frame` from the current artifact.

**The gap:** When the graph launches with `initialContext.evidence_board` and `initialContext.frame`, the workspace calls `getDecisionGraphCandidates` using only `dataset` and `semantic_model`. The `evidence_board` and `frame` context is passed to `handleBuildGraph` only when building the graph, but `getDecisionGraphCandidates` does not receive it. This means the candidate list is generic and not pre-filtered to the decision's evidence context.

More critically: the graph node `InspectorPanel.jsx` has an action `send_to_scenario_compare` — the `planDecisionGraphAction` route at `/api/decision/graph/actions` exists — but clicking a graph node does not trigger scenario compare either (no state flows back from graph to chat).

**What is needed:** Pass `evidence_board` and `frame` into `getDecisionGraphCandidates` so candidates are contextually ranked. Create a callback from `DecisionGraphWorkspace` back to AI Chat that fires when the user clicks "send_to_scenario_compare" from a graph node.

---

### Gap A7 — `open_workspace` action routes to a local state read, not a fresh backend call

**Status: Works but silently degrades when no prior artifact exists**

In `AIShell.jsx` at lines 127-137, `handleActionClick('open_workspace')` does a local scan of `userMessages` to find the last `decision_output` artifact and calls `handleInspect` on it. It does not call `/api/decision/chat/actions` with `action: "open_workspace"`.

**The gap:** If the user clears their chat, switches datasets, or if the artifact is old, `open_workspace` shows whatever was last in memory rather than the current workspace state. The backend `open_workspace` action in `_execute_decision_action` (lines 1176-1195) always refreshes the workspace from `session_state.draft_workspace` — but that path is bypassed.

---

### Gap A8 — ScenarioPreview import in AIShell is unused

`AIShell.jsx` imports `ScenarioPreview` at line 22 but never renders it directly. `ScenarioPreview` is only used in `DecisionCommandCenter.jsx` and `DecisionOutputReview.jsx`. The import in AIShell is dead code (minor, but confirms scenario compare has no direct chat-level render path).

---

### Gap A9 — Chart rendering in inline view is silently suppressed

**Status: Charts only appear in the inspector pane, never inline**

In `renderArtifact` at lines 667-718, the `chart` case only renders content when `isInspector === true`. When `isInspector` is false (the inline chat thread view), the chart case returns an empty div. Charts are promoted to the results pane via the `inspectable + render_hint !== 'inline'` block at lines 611-638 which renders a clickable preview link. But the clickable preview link for charts does not include a thumbnail or sparkline — it just shows a `FaChartBar` icon and "Visualization". The user has no idea what the chart looks like until they open the results pane.

**What is needed:** A small chart thumbnail (mini-render using the same `AICharts` component at reduced height) inside the preview link card, or at minimum a visible first row of values.

---

### Gap A10 — Decision Output "Export Sections" are assembled but not rendered

**Status: Backend sends `export_sections`, frontend ignores them**

`DecisionOutputService.compose()` assembles `export_sections` in the artifact. `handleSaveAsset` at line 472 includes `export_sections` in the save payload. But `DecisionCommandCenter.jsx` and `DecisionOutputReview.jsx` never render `export_sections` in the UI. The data exists in the artifact but the user never sees it structured as exportable sections.

---

### Gap A11 — `resolveDatasetForNlp` is not passed to DecisionOutputReview

**Status: Causes undefined behavior in the correction panel**

`DecisionOutputReview` receives a `resolveDatasetForNlp` prop at line 55 in its signature. In `AIShell.jsx` at lines 1200-1222, `DecisionOutputReview` is rendered but `resolveDatasetForNlp` is passed directly at line 1221. However, `DecisionCommandCenter.jsx` receives `datasetContext` as a pre-resolved value (not the function), so the correction form can submit an outdated dataset snapshot. If the user changes datasets mid-session, the correction will submit against the old dataset.

---

## CATEGORY B: UX and Clarity Gaps (What Works But Confuses Users)

These are the 12 problems documented in the previous audit, summarized here for completeness:

1. **Mode detection misses natural business language** — 17 keywords too narrow, most business questions fail to trigger decide mode
2. **Welcome chips trigger wrong things** — `/clean` (data cleaning) and `@` (dataset mention), not DI
3. **Input placeholder gives no DI guidance** — no example prompts
4. **Action buttons are opaque** — no sub-labels or explanations
5. **"Blocked", "Limitation", "Unsupported Capabilities Detected"** everywhere with no next step
6. **Results pane is uncommunicative** — no connection to what was asked
7. **"Current Session Only" warning sounds alarming** — it is just a save reminder
8. **Correction panel shows raw API field names** — `lever_controllability`, `objective_metric`
9. **Chart prompts fail with no helpful fallback** — no guidance on how to rephrase
10. **Command Center has no onboarding** — dense layout with no "what is this"
11. **No session persistence** — page refresh wipes everything
12. **No help documentation anywhere user-facing** — no examples, no glossary

---

## Full Priority Matrix: Functional Gaps First, Then UX

| Priority | Item | Type | Effort | Impact |
|---|---|---|---|---|
| 1 | A1: Wire Scenario Compare to frontend | Functional Gap | Large | High |
| 2 | A5: Add scenario input surface (chat NLP or form) | Functional Gap | Medium | High |
| 3 | A2: Wire Decision Signals to frontend | Functional Gap | Medium | High |
| 4 | A3: Wire Decision Brief to Command Center | Functional Gap | Small | High |
| 5 | A4: Wire Recommendations to Command Center | Functional Gap | Medium | Medium |
| 6 | A6: Pass evidence context into graph candidates | Functional Gap | Small | Medium |
| 7 | A7: Fix `open_workspace` to use backend state | Functional Gap | Small | Medium |
| 8 | B1: Expand mode detection keywords | UX | Small | High |
| 9 | B2: Rewrite welcome chips | UX | Small | High |
| 10 | B4: Action button sub-labels | UX | Small | High |
| 11 | B5: Translate blocked/limitation labels | UX | Small | High |
| 12 | A9: Chart inline thumbnail | Functional Gap | Medium | Medium |
| 13 | B10: Command Center onboarding card | UX | Small | Medium |
| 14 | B3: Input placeholder update | UX | Trivial | Medium |
| 15 | B6: Results pane type label | UX | Trivial | Medium |
| 16 | B7: Save nudge instead of warning | UX | Trivial | Medium |
| 17 | B8: Correction panel field names | UX | Small | Medium |
| 18 | B9: Chart fail with reformat guidance | UX | Small | Medium |
| 19 | B11: Session storage persistence | UX | Medium | Medium |
| 20 | A10: Render export_sections in UI | Functional Gap | Medium | Low |
| 21 | B12: Help panel | UX | Large | Low |

---

## Detailed Implementation Notes for Category A

### A1 + A5 — Scenario Compare: What Needs to Be Built

**Backend:** Route exists and is complete at `/api/decision/scenarios/evaluate`.

**Frontend additions needed:**

1. Add `evaluateScenario` to `decisionApi.js`
2. Add a `compare_scenarios` action to `DECISION_ACTION_CONTRACTS` in `chat_service.py` so it appears as a suggested action after workspace analysis
3. Add handling in `handleActionClick` in AIShell for `compare_scenarios`:
   - Extract `metric_targets` from `session_state.draft_workspace.levers` (use lever metric_refs as targets)
   - Or parse user's chat message for percentage phrases ("10% increase", "reduce by 20%")
   - Call `/api/decision/scenarios/evaluate`
   - Return result as a `scenario_preview` and include it in the next decision_output render
4. Alternatively: Add a "Scenario" input row in the Command Center with metric picker and adjustment slider

The `ScenarioPreview` component is complete and just needs `preview` to be non-null.

---

### A2 — Decision Signals: What Needs to Be Built

**Backend:** Route exists at `/api/decision/signals/generate`.

**Frontend additions needed:**

1. Add `generateDecisionSignals` to `decisionApi.js`
2. Add a `generate_signals` suggested action in `chat_service.py` for decide mode
3. In `handleActionClick`, call this route when `actionId === 'generate_signals'`
4. Render the signal list inline in the chat as an `answer` artifact or in the Command Center as a new section

Signal data is rich: it includes metric movements, direction, strength, and business interpretation. It would make the Command Center significantly more valuable.

---

### A3 — Decision Brief: What Needs to Be Built

The `executive_brief` section currently renders `doTitle` + `doSummary` from the workspace builder. The brief service can generate a structured multi-part summary (context, key levers, data evidence, recommended focus). 

Call `/api/decision/brief/generate` when `analyze_workspace` completes and inject the brief output into the `executive_brief` section of the Command Center. No new backend work needed — just call it.

---

### A6 — Graph Context Passing

In `DecisionGraphWorkspace.jsx` at line 93, `getDecisionGraphCandidates({ dataset, semantic_model: semanticModel })` needs to also include `evidence_board` and `frame` from `initialContext` so candidates are ranked by decision relevance, not just by data type.

```js
// Current
const response = await getDecisionGraphCandidates({ dataset, semantic_model: semanticModel });

// Needs to be
const response = await getDecisionGraphCandidates({
  dataset,
  semantic_model: semanticModel,
  evidence_board: initialContext?.evidence_board,
  frame: initialContext?.frame,
});
```

The backend `DecisionGraphService.discover_candidates` already accepts these fields — it just never receives them from the frontend.

---

### A7 — Fix `open_workspace` to use backend state

In `handleActionClick` (AIShell.jsx line 127), replace the local `userMessages` scan with a backend call:

```js
// Instead of scanning userMessages, call the backend which will reconstruct
// from session_state.draft_workspace — which is always current
if (actionId === 'open_workspace') {
  // fall through to the normal setLoading + POST /api/decision/chat/actions
  // and let the backend return a fresh workspace_preview with the current state
}
```

Remove the special-case early return for `open_workspace` and let it flow through the normal `handleActionClick` POST path. The backend `_execute_decision_action` with `action="open_workspace"` already returns a correct preview from `session_state.draft_workspace`.

---

## Files Affected Summary

### Functional Gap Fixes

| File | Change |
|---|---|
| `decisionApi.js` | Add `evaluateScenario`, `generateDecisionSignals`, `generateDecisionBrief`, `generateRecommendations` |
| `AIShell.jsx` | Add handlers for `compare_scenarios`, `generate_signals`; fix `open_workspace`; add chart thumbnail to inline preview |
| `DecisionGraphWorkspace.jsx` | Pass `evidence_board` + `frame` into `getDecisionGraphCandidates` |
| `chat_service.py` | Add `compare_scenarios` and `generate_signals` to `DECISION_ACTION_CONTRACTS` and `_build_decision_actions` |
| `DecisionCommandCenter.jsx` | Add rendering for `export_sections`, signals, brief output |

### UX/Clarity Fixes

| File | Change |
|---|---|
| `AIShell.jsx` | Welcome chips, placeholder, action labels, results pane label, grounded tag, session storage |
| `AIShell.css` | Styling for new chips, sub-labels, info banners |
| `DecisionCommandCenter.jsx` | Save nudge, onboarding card, blocked label translations |
| `DecisionOutputReview.jsx` | Correction panel field names |
| `mode_detection.py` | Expanded keyword list + length fallback |
| New: `AIHelp.jsx` + `AIHelp.css` | DI prompt guide help panel |

---

## Acceptance Checks for Category A

**Scenario Compare**
- Typing "compare scenarios" or "what if revenue increases 10%" generates a scenario payload
- The Scenario Compare section in the Command Center shows real projection data
- `ScenarioPreview.jsx` renders with `status: "ready"`, not locked state

**Decision Signals**
- After workspace analysis, a "Generate Signals" action appears in suggested actions
- Clicking it calls the backend and renders a signal list in chat or Command Center

**Decision Brief**
- After workspace analysis, the Executive Brief section shows multi-part structured output from the brief service rather than the workspace builder's `summary` field

**Graph Context**
- "Launch Decision Graph" passes `evidence_board` and `frame` to candidate discovery
- Candidate list is ordered by decision relevance, not random data type order

**open_workspace**
- After chat reset or dataset change, clicking "Open Workspace" shows current draft state, not a stale message-history artifact

---

## What Codex Must Do First

Before any of the functional gap fixes can be implemented cleanly, the following backend additions are needed:

1. `compare_scenarios` must be added to `DECISION_ACTION_CONTRACTS` in `chat_service.py` and to `_build_decision_actions` so it appears as a suggested action
2. `generate_signals` must be similarly added
3. `_execute_decision_action` must handle both new action IDs

These are backend changes. Once in place, Antigravity implements the frontend API calls, action handlers, and rendering.

---

## What Antigravity Can Do Without Backend Changes

The following are frontend-only and can start immediately:

- Fix `open_workspace` to flow through the normal POST path (A7)
- Pass graph context into candidates (A6 — frontend-only change)
- All Category B UX fixes (B1-B12)
- Chart inline thumbnail using the existing `AICharts` component
- Add `evaluateScenario`, `generateDecisionSignals`, `generateDecisionBrief` to `decisionApi.js` (routes already exist)

---

## Summary

The previous audit treated this as a UX problem. It is partially that, but the deeper issue is that several complete backend capabilities — Scenario Compare, Decision Signals, Decision Brief, Recommendations — have never been wired to the frontend. The user sees placeholders (empty Scenario Compare section, no signals, sparse Executive Brief) not because the backend cannot do it, but because the frontend never asks. These are the highest-impact fixes because they turn existing backend work into visible product value without requiring new backend development.
