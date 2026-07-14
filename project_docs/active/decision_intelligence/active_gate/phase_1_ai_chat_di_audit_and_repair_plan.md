# AI Chat & Decision Intelligence — Audit and Repair Plan

**Written:** 2026-07-13  
**Author:** Antigravity (full codebase audit)  
**Scope:** Everything visible through AI Chat related to Decision Intelligence, charting, and the Command Center. Backend-only hidden contracts are out of scope here. This plan is about making what exists actually usable.

**Status:** Active execution plan. The user explicitly authorized Codex to implement the frontend and backend repairs in this plan on the `codex/ai-chat-usability-repair` branch.

---

## What Was Reviewed

| File | Size | Role |
|---|---|---|
| `frontend/frontend/src/features/ai/AIShell.jsx` | 1,605 lines | Master chat shell — conversation, routing, artifact rendering, results pane |
| `frontend/frontend/src/features/ai/AIShell.css` | 1,871 lines | All shell styles |
| `frontend/frontend/src/features/ai/DecisionCommandCenter.jsx` | 846 lines | Renders decision_output with Command Center layout |
| `frontend/frontend/src/features/ai/DecisionOutputReview.jsx` | 778 lines | Bridges artifact to DecisionCommandCenter |
| `backend/decision_engine/chat_service.py` | 2,234 lines | Core chat routing, mode detection, artifact assembly |
| `backend/decision_engine/mode_detection.py` | 126 lines | Keyword-based mode router (ask / explore / decide) |
| `backend/routes/decision.py` | 339 lines | Flask blueprint for all /api/decision/* routes |
| `backend/routes/nlp_routes.py` | 125 lines | /api/nlp/chart route |
| Project docs: README, status, active gate | — | Codex phase context |

---

## Executive Summary

The system has real backend power. The decision engine is structurally complete: mode detection, workspace drafting, observational analysis, correction state, evidence boards, scenario compare, Command Center, and PDF export are all working. The backend is doing its job. The problems are entirely on the usability and frontend surface:

1. Users have no idea how to trigger Decision Intelligence. The prompt input gives no guidance. The welcome chips are wrong. There are no examples.
2. The mode routing is fragile and invisible. A prompt must hit narrow keywords to enter `decide` mode. Users writing natural business questions miss it constantly.
3. The results pane (Inspection Workspace) is uncommunicative. It appears with zero context about what it shows or why.
4. "Blocked", "Limitation", and "Unsupported Capabilities Detected" appear constantly with no actionable path forward.
5. The welcome screen chips are misleading — they trigger data cleaning and dataset mentions, not Decision Intelligence.
6. The suggested action buttons in chat are opaque. Labels like "Analyze workspace", "Show blockers", "Draft workspace" have no context.
7. Charting prompts succeed inconsistently due to narrow keyword matching.
8. The Command Center is buried and unnamed to the user. When it renders, it has dense internal labels like "OBSERVATIONAL BOUNDARY", "TRUTH BOUNDARY", "STALE STATE" with no explanation.
9. No persistent state or session memory across page refreshes.
10. The correction panel uses raw API contract field names (lever_controllability, objective_metric, etc.) as UI labels.
11. "Current Session Only" warning appears for every live result and sounds alarming when it just means "you haven't saved yet."
12. Decision Intelligence prompts are not documented anywhere user-facing.

---

## Detailed Problem Inventory

### Problem 1 — Mode detection is too narrow

**Location:** `backend/decision_engine/mode_detection.py` lines 23-46

The decision keyword list has 17 phrases. Standard business language ("How can we grow revenue?", "What should our pricing strategy be?", "Where are we losing customers?") does not match because it lacks the exact trigger words. The user gets `ask` mode → a dead grounded-reply response → no workspace, no actions, no Command Center. Most natural Decision Intelligence questions silently fail.

### Problem 2 — Welcome screen gives no Decision Intelligence guidance

**Location:** `AIShell.jsx` lines 1480-1494

Three chips are shown:
- "Dataset Bridge" → types `@` (opens dataset mention dropdown)
- "Quick Visual" → types `Visualize ` (charting starter)
- "Grounded Observational Analysis" → sends `/clean` (data cleaning command, not DI)

None of these tell the user how to start a decision question.

### Problem 3 — Input placeholder gives no DI-specific guidance

**Location:** `AIShell.jsx` line 1554

Current placeholder: `"Ask a question, type @ for data..."`

No indication that the user can type decision questions here. No example phrasing. Users who want Decision Intelligence don't know what the right prompt looks like.

### Problem 4 — Suggested action buttons have no context

**Location:** `AIShell.jsx` lines 1512-1540

After a decision workspace is drafted, action buttons appear: "Analyze workspace", "Show blockers", "Show assumptions", "Draft workspace". These appear inline with zero explanation of what they produce. Users see them and either don't click them, or click and are confused by the result pane.

### Problem 5 — "Blocked" and "Limitation" labels are user-hostile

**Locations:**
- `DecisionCommandCenter.jsx` lines 392-403 (advanced_gates section)
- `DecisionCommandCenter.jsx` lines 341-380 (advanced_readiness capabilities with state=blocked)
- `AIShell.jsx` lines 957-967 (Unsupported Capabilities Detected banner)
- `AIShell.jsx` lines 637-641 (Missing Inputs blockers)

Users see "BLOCKED", "Unsupported Capabilities Detected", "Data Limited", "X Caveats" everywhere. None of these link to a next step. The system communicates what it cannot do but not what the user should do.

### Problem 6 — Results pane is uncommunicative

**Location:** `AIShell.jsx` lines 1561-1578

Labeled "Inspection Workspace" with an eye icon. When empty: terminal icon + "Query the agent on the left to generate active visualizations, path previews, or structured analysis results." When populated: shows the artifact but with no label connecting it to what the user asked.

### Problem 7 — "Current Session Only" warning sounds alarming

**Location:** `DecisionCommandCenter.jsx` lines 532-547

Every live (unsaved) decision output shows a yellow warning badge "Current Session Only" with an exclamation icon. This reads as a system error to most users. It is just a save reminder.

### Problem 8 — Correction panel uses raw API field names

**Location:** `AIShell.jsx` lines 77-88, correction form in `DecisionOutputReview.jsx`

Correction types shown in UI: `time_horizon`, `objective_direction`, `lever_controllability`, `objective_metric`. These are backend contract paths exposed to users with no translation.

### Problem 9 — Chart prompts fail inconsistently

**Location:** `backend/decision_engine/mode_detection.py` lines 8-21

The chart keyword list works for simple phrases. Compound or domain-specific phrases may fail field matching. When it fails, the user gets a generic `ask` mode reply with no chart and no guidance on how to rephrase.

### Problem 10 — No onboarding inside Command Center

**Location:** `DecisionCommandCenter.jsx` lines 441-619

The Command Center renders immediately with a dense layout. There is no "what is this?" text, no step-by-step progress indicator, no summary at the top saying "Your decision framework is being analyzed."

### Problem 11 — No persistent session across page refreshes

**Location:** `AIShell.jsx` lines 47-66

All state (`userMessages`, `sessionState`, `activeArtifact`) is in-memory React state. A page refresh destroys everything. Decision Intelligence sessions built up over minutes are gone.

### Problem 12 — Decision Intelligence prompts are not documented anywhere user-facing

There is no help panel, example gallery, or tooltip explaining what kinds of questions trigger Decision Intelligence. Users writing "What should we do about declining sales?" get a workspace draft. Users writing "Thoughts on our declining sales?" get an `ask` mode dead-end. No user would know this distinction exists.

---

## Proposed Repairs — Prioritized

### TIER 1 — Make DI discoverable and mode-reliable (highest impact, do first)

#### T1-A: Rewrite the welcome screen with real DI prompt examples

**Target file:** `AIShell.jsx` lines 1480-1494

Replace the three current chips with chips that represent real entry points:

| Chip label | Injected text |
|---|---|
| How should we grow revenue? | `How should we grow revenue while protecting margin?` |
| Plot sales by region | `Plot sales by region as a bar chart` |
| Where are we losing customers? | `Where are we losing customers and what are the key drivers?` |
| Top performing product? | `What is our top performing product by revenue?` |
| Reference a dataset | `@` (dataset bridge, kept) |

Update the hero subtitle to explain DI: "Ask a business question to start a Decision Intelligence analysis, or ask for a chart. Questions about improving, growing, reducing, or choosing between options will trigger the full Decision Framework."

#### T1-B: Expand the mode detection keyword set

**Target file:** `backend/decision_engine/mode_detection.py` lines 23-46

Add common business-language patterns:

```
"how do we", "how can we", "what would happen if",
"best way to", "strategy for", "plan to", "focus on",
"increase", "decrease", "maximize", "minimize",
"priority", "what's driving", "root cause", "why is",
"where are we losing", "where are we winning",
"what should", "what can we", "when should we",
"which market", "which segment", "which product",
"scenario", "what if", "if we", "option", "alternative",
"objective", "goal", "target", "measure"
```

Also add a length fallback: if the message is longer than 12 words and does not match explore or ask keywords, treat it as a `decide` candidate rather than dropping to `ask`.

#### T1-C: Update the input placeholder to signal DI

**Target file:** `AIShell.jsx` line 1554

Change to: `"Ask a question, frame a decision (e.g. 'How should we grow revenue?'), or type @ for data..."`

#### T1-D: Make suggested actions self-explanatory

**Target file:** `AIShell.jsx` lines 1526-1538

Add a one-line description below each action button. Rename the actions:

| Current label | New label | Sub-label |
|---|---|---|
| Analyze workspace | Run Analysis | See evidence and observational insights |
| Show blockers | What's Missing | Find gaps blocking deeper analysis |
| Show assumptions | View Assumptions | Review what the system is assuming |
| Draft workspace | Refresh Framework | Rebuild the decision framework |
| Review decision output | Open Decision Review | Full structured output with evidence |

---

### TIER 2 — Fix the confusion inside Command Center and results pane

#### T2-A: Replace "Current Session Only" warning with a save nudge

**Target file:** `DecisionCommandCenter.jsx` lines 532-547

Change the yellow warning badge to a neutral blue "Save to library" banner: "This result is in memory. Save it to keep it after closing." Remove the exclamation triangle icon.

#### T2-B: Add an onboarding header to Command Center on first appearance

**Target file:** `DecisionCommandCenter.jsx` lines 441-450

When `!artifact.asset_id` (live session, not saved), show a collapsible info card at the top:
"Your Decision Framework — AI Chat analyzed your question and built a structured decision output below. Review the Evidence Board for data-backed insights, use the action buttons to run deeper analysis, and save this output when you're done."

This card should be dismissible and remembered in localStorage.

#### T2-C: Translate "Blocked" and "Limitation" labels into action guidance

**Target files:** `DecisionCommandCenter.jsx` lines 341-403, `AIShell.jsx` lines 957-967

For blocked capabilities, replace the raw state badge with a human label:
- `blocked` → "Not available yet — requires more data or a different question format."
- `limited` → "Partial — available with some caveats."
- `unsupported` → "Not in scope — this analysis type is not supported."

For the "Unsupported Capabilities Detected" banner, replace with: "Some things you asked for aren't available yet. The analysis below covers what is supported."

#### T2-D: Add a "What is this?" label to the results pane header

**Target file:** `AIShell.jsx` lines 1563-1566

When an artifact is active, show its type next to "Inspection Workspace":
`"Inspection Workspace  ·  Decision Framework"` or `"Inspection Workspace  ·  Chart"`

When empty, replace the terminal icon with: "No active result. Ask a question in the chat to see data, charts, or a Decision Framework here."

#### T2-E: Translate correction panel field names

**Target:** Correction form dropdown in `DecisionOutputReview.jsx`

Human-readable map:

| Contract value | User-facing label |
|---|---|
| `time_horizon` | Time Period |
| `objective_direction` | Goal Direction (maximize / minimize) |
| `lever_controllability` | Can we control this? (yes / no) |
| `objective_metric` | Target Metric |
| `remove_mapping` | Remove a mapping |

#### T2-F: Make the "grounded" tag less alarming

**Target file:** `AIShell.jsx` line 1502

The shield icon + "Grounded" badge on every assistant message looks like a security warning. Rename to `Data-backed` or remove from non-DI messages.

---

### TIER 3 — Session persistence

#### T3-A: Persist chat history in sessionStorage

**Target file:** `AIShell.jsx`

On each `setUserMessages` call, write to sessionStorage keyed by a session ID. On mount, read from sessionStorage to restore the last conversation. This covers accidental page refresh during an active session. Cap at last 20 messages. Do not persist full dataset payloads — only message content, artifact metadata, and session_state.

#### T3-B: Persist active artifact across tab switches

**Target file:** `AIShell.jsx`

When the user switches away from AI Chat and back, the `activeArtifact` state is lost because the component unmounts. Store `activeArtifact` in sessionStorage and restore it on mount.

---

### TIER 4 — Chart quality improvements

#### T4-A: Add a "Chart not generated" fallback with suggestions

**Target file:** `AIShell.jsx` (explore mode chart fallback path)

When explore mode produces an `answer` artifact instead of a `chart` artifact, render a specific "Chart not built" message. Include:
- What was understood from the prompt
- A suggested rephrasing: "Try: 'Plot [field] by [category] as a bar chart'"
- A list of chart-friendly columns from the current dataset

#### T4-B: Add chart type selector to the chart artifact inspector

**Target file:** `AIShell.jsx` lines 667-717 (chart case in renderArtifact)

Add a small toggle above the rendered chart: "Bar | Line | Pie | Scatter". Clicking a different type re-renders with the same data. Entirely frontend — no new API call needed.

---

### TIER 5 — Decision Intelligence help panel

#### T5-A: Add a collapsible "How to use Decision Intelligence" panel

**Target:** New component `AIHelp.jsx`, accessible via a "?" button on the left rail or footer

Contents:
1. How to start a decision question — example prompts with explanations
2. What the Decision Framework shows — brief description of Evidence Board, Frame, Readiness
3. How charting works — example chart prompts
4. What "Observational Analysis" means — plain English explanation
5. How to save results — step-by-step

No backend changes needed.

---

## Files Affected

### Frontend
| File | Changes |
|---|---|
| `AIShell.jsx` | Welcome chips (T1-A), placeholder (T1-C), action labels (T1-D), results pane (T2-D), grounded tag (T2-F), session storage (T3-A, T3-B), chart fallback (T4-A), chart type toggle (T4-B) |
| `AIShell.css` | New styling for chips, action sub-labels, info banners |
| `DecisionCommandCenter.jsx` | Save badge → nudge (T2-A), onboarding header (T2-B), blocked labels (T2-C) |
| `DecisionOutputReview.jsx` | Correction panel field translations (T2-E) |
| New: `AIHelp.jsx` + `AIHelp.css` | DI prompt guide panel (T5-A) |

### Backend
| File | Changes |
|---|---|
| `backend/decision_engine/mode_detection.py` | Expanded keyword list (T1-B) |

---

## Acceptance Checks

**Tier 1 — Discoverability**
- Clicking a welcome chip injects a valid DI or chart prompt
- Typing "How should we grow revenue while protecting margin?" enters decide mode and produces a Decision Framework
- Typing "Plot sales by region" enters explore mode and produces a chart artifact
- The input placeholder communicates DI entry points

**Tier 2 — Command Center clarity**
- No yellow "Current Session Only" warning visible on first render
- Command Center shows a brief onboarding card on first render
- Blocked capabilities say what to do, not just that they are blocked
- Results pane header reflects the active artifact type
- Correction panel shows human-readable field labels

**Tier 3 — Persistence**
- Page refresh restores the last conversation
- Active artifact is visible in results pane after refresh
- Chat history does not grow without bound (cap at last 20 messages)

**Tier 4 — Charts**
- When chart fails, user sees a "Chart not built" message with reformat guidance
- Chart type toggle works without a new API call

**Tier 5 — Help panel**
- Help panel opens from left rail
- Shows example DI prompts and chart prompts
- Explains observational analysis in plain English

---

## Implementation Order Recommendation

1. T1-B — Expand mode detection keywords (backend, ~30 min)
2. T1-A — Rewrite welcome chips (frontend, ~1 hour)
3. T1-C — Update input placeholder (frontend, ~15 min)
4. T1-D — Action button labels and sub-labels (frontend, ~1 hour)
5. T2-A — Save badge to nudge (frontend, ~30 min)
6. T2-B — Onboarding header in Command Center (frontend, ~1 hour)
7. T2-C — Translate blocked labels (frontend, ~1 hour)
8. T2-D — Results pane header (frontend, ~30 min)
9. T2-E — Correction panel field names (frontend, ~30 min)
10. T2-F — Grounded tag rename (frontend, ~15 min)
11. T3-A + T3-B — Session storage persistence (frontend, ~2-3 hours)
12. T4-A + T4-B — Chart fallback and chart type toggle (frontend, ~2 hours)
13. T5-A — Help panel (frontend, ~3-4 hours)

**Total estimate:** ~15-18 hours of focused frontend work plus ~30 min backend keyword expansion.

---

## What Is Out of Scope Here

- Multi-data-source support (Codex active gate — separate)
- New decision pipeline phases (Codex future gate — separate)
- Full LLM-powered charting (requires new backend route, not a repair)
- Saved decisions window redesign (separate future slice)
- Decision Graph (already connected, low priority)
- Any new Markdown plan creation in active gate folders

---

## Summary

The backend for Decision Intelligence is substantially built. The user experience problem is that the frontend does not meet users where they are. It does not explain what to type, why mode detection worked or failed, what the Command Center is showing, or what to do when things are blocked. The fix is not more backend phases — it is translating the existing backend capability into language and affordances that real users can navigate.

All Tier 1 and Tier 2 repairs can be implemented without touching any backend contract, saved decision schema, or active phase gate.
