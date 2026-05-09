> COMPLETED REFERENCE ONLY: This file is not part of the default active scan path. Any old wording below such as "active", "next", "required", or "handoff" is historical unless the current status or active execution plan explicitly points here.
# Decision Intelligence V3 Phase 4 Chat Engine Execution Plan

## Status

This was the Phase 4 chat engine plan after the small workspace-analysis frontend cleanup was finished.

Plain English:

- finish the small Decisions workspace cleanup
- then move hard into chat-first Decision Intelligence
- build real decision tools inside AI chat
- use the decision workspace as a handoff target, not the only starting point

## Why Phase 4 Matters

For this application, AI chat is the important Decision Intelligence feature.

The user should be able to:

- talk through a business decision in chat
- pick from real decision tools
- generate a draft decision workspace from chat when useful
- keep working either in chat or in the full workspace

The product should not force users to start in the workspace every time.

## What Good Products Are Doing

The strongest products in this space are not winning by having a prettier chatbot.

They are winning by combining a few practical patterns:

- natural-language questions over a governed semantic layer
- follow-up questions that keep context instead of restarting every turn
- fast chart generation directly from the conversation
- clear explanation of what fields, filters, and logic were used
- a clean handoff from quick question to deeper structured analysis

Current examples:

- ChatGPT data analysis focuses on uploading data, asking plain-language questions, and generating charts and summaries quickly
- Power BI Copilot focuses on asking questions against a semantic model and returning visuals using known measures, columns, and filters
- ThoughtSpot Spotter focuses on governed search, semantic modeling, transparency, and explainable answers
- Hex focuses on conversational exploration plus deeper analysis workflows in the same working environment

The shared lesson is simple:

- chat works best when it is grounded in trusted fields and metrics
- users need fast answers first
- users also need a way to turn a vague question into a durable artifact when the problem becomes more serious

## Phase 4 Outcome

Phase 4 is successful when the product can do all of this in a believable way:

- AI chat helps frame a decision
- AI chat offers real decision actions and tool choices
- AI chat can draft a scoped decision workspace
- the user can open that workspace and continue
- the UI stays honest about what is observational versus what is real engine logic

## Immediate Order Of Work

### Step 1: Close The Nice-To-Have Cleanup

Gemini finishes the small frontend cleanup from V3 Handoff 01:

- render `workspace_analysis.scoped_diagnostics` correctly
- keep legacy evidence secondary
- stop claiming completion too early

This should be treated as a short cleanup step, not a new major phase.

### Step 2: Start Chat-First Decision Intelligence

Once Step 1 is done, move straight to the AI destination.

The next real product push is:

- AI chat as the front door for Decision Intelligence

## Product Rules For Phase 4

- keep language simple
- no fake intelligence
- no fake simulation
- no fake trade-off results
- no fake autonomous agent behavior
- every tool or action should have a real backend path or be clearly labeled as coming soon

## What AI Chat Should Be Able To Do

### Core Decision Framing

- capture the decision question
- identify objective
- identify levers
- identify constraints
- identify missing inputs
- suggest next questions

### Conversational Analytics

- answer plain-language questions about the active dataset
- understand field names and semantic metric names
- understand filters, time windows, and breakdowns
- carry follow-up context across turns
- generate a chart in chat when the user asks for one or when a chart clearly helps
- explain what data was used to answer

### Real User Actions In Chat

- start a decision
- refine a decision
- ask for missing inputs
- draft a workspace
- open the drafted workspace
- request scoped analysis
- generate chart
- refine chart
- pin chart or send chart to the workspace

### Real Tool Choices In Chat

The chat UI should expose concrete actions such as:

- Draft workspace
- Analyze current workspace
- Show assumptions
- Show blockers
- Compare objective vs guardrails
- Ask follow-up questions

These should feel like real product tools, not decorative chips.

## How We Should Use This In Our App

We should treat AI chat as the front door for three kinds of work:

### 1. Fast Answers

The user asks:

- what is low stock right now?
- which categories have the highest average price?
- show me discount-eligible items with low inventory

The system answers quickly and can generate a chart when useful.

### 2. Guided Decision Framing

The user asks:

- how should we reduce stockout risk?
- where should we focus restocking first?
- should we discount slow-moving inventory?

The system should then:

- identify the likely objective
- suggest relevant levers
- suggest likely constraints
- show what information is missing

### 3. Structured Handoff

When the problem becomes real decision work, chat should offer:

- Draft workspace
- Analyze workspace
- Show blockers
- Show assumptions
- Open in Decisions

Chat should not dump the user into a separate flow without explaining why.

It should feel like a smooth escalation from question to decision.

## Recommended Product Shape

The AI destination should have three layers of capability:

### Layer 1: Ask

- ask a question
- get an answer
- get a chart if useful

### Layer 2: Explore

- follow up
- change filters
- compare segments
- explain the answer

### Layer 3: Decide

- frame the decision
- draft workspace
- inspect missing inputs
- move into structured decision mode

This keeps the experience simple while still letting power users go deeper.

## Backend Track For Codex

Codex should plan and own:

- chat-to-decision contract
- decision intent detection
- conversational analytics contract for:
  - question answering
  - chart requests
  - follow-up context
  - field and semantic reference resolution
- structured draft workspace generation from chat inputs
- chat-side tool actions for:
  - draft workspace
  - inspect missing inputs
  - request workspace analysis
- chart generation requests that can reuse the existing chart system when possible
- eventual bridge into real engine work after chat framing is stable

## Frontend Track For Gemini

Gemini should own:

- AI chat UI for decision framing
- AI chat UI for conversational analytics answers
- chart cards inside the conversation flow
- clean tool/action presentation inside AI chat
- draft-workspace preview card or panel
- open-in-workspace transition
- honest state labels and UX copy

## What We Are Not Doing Yet

Not in this phase:

- full simulation engine
- full trade-off engine
- goal-seeking optimizer
- fake consultant theater

Those come after the chat-first framing and tool flow are real.

## Recommended Phase 4 Build Order

### Phase 4A: Conversational Analytics

Build the ability to:

- ask questions about fields and metrics
- reference semantic values and dimensions
- request charts in chat
- support follow-up questions

### Phase 4B: Decision Framing In Chat

Build the ability to:

- detect when the user is moving from analysis into a decision
- propose objective / levers / constraints
- ask for missing inputs in plain English

### Phase 4C: Draft Workspace Handoff

Build the ability to:

- generate a draft workspace from the chat state
- let the user inspect it before opening it
- open it in the Decisions destination cleanly

### Phase 4D: Real Decision Tools

Only after the above is stable:

- deeper analysis tools
- stronger comparison tools
- eventually real engine execution when backend logic exists

## Testing Plan

We need a strong fake dataset for this phase.

The dataset should support:

- business objectives
- controllable levers
- hard and soft constraints
- time-based comparisons
- segment breakdowns
- obvious trade-offs
- realistic missing-input conversations

The best test datasets for this phase should make chat useful in both ways:

- quick analytics questions
- deeper decision framing

## Resume Files

For the next active Phase 4 work, read:

1. `project_docs/INDEX.md`
2. `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
3. `project_docs/active/status/decision_intelligence_execution_status.md`
4. `project_docs/active/status/decision_intelligence_execution_status.md`
5. `project_docs/active/decision_intelligence/completed/decision_intelligence_v3_gemini_handoff_02_chat_decision_bridge.md`
6. `project_docs/active/decision_intelligence/completed/phase_4_5_ai_chat_decision_intelligence_plan.md`
7. `project_docs/active/decision_intelligence/completed/decision_intelligence_v3_phase_4_chat_engine_execution_plan.md`

## One-Line Phase Truth

Phase 4 is where Decision Intelligence stops being mostly a workspace screen and starts becoming a real chat-first decision product.
