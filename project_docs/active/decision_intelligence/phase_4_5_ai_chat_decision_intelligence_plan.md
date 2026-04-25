# Phase 4.5 AI Chat Decision Intelligence Plan

## Why Phase 4.5 Exists

Phase 4 established the real backend contract for chat-first Decision Intelligence.

That was necessary, but it is not enough to make the feature feel finished. The product still has a gap between "the backend can do this" and "the user can trust, understand, and control this in chat without confusion."

Phase 4.5 closes that gap.

This phase is not about inventing a fake simulator, fake consultant, or fake autonomous agent layer. It is about making the existing grounded decision stack coherent enough that chat can become the default entry point for serious decision work.

## Phase Objective

Make AI chat the most trustworthy and understandable front door for Decision Intelligence by improving:

- mode clarity
- prompt-to-structure reliability
- action fidelity
- artifact quality
- workspace handoff quality
- evaluation coverage

## Product Truth For This Phase

By the end of Phase 4.5, a user should be able to start with a plain-English business question, see the system move into the right mode, inspect the emerging decision structure, use real actions, and open a clean workspace without feeling like the product is improvising.

## What This Phase Is Not

Not in scope:

- full simulation engine
- full trade-off engine
- goal-seeking optimizer
- fake recommendation theater
- fake file-ingestion intelligence
- autonomous agent behavior dressed up as deterministic product logic

If a capability is not real, the UI and backend must say so plainly.

## Core Problems To Fix

### 1. Mode ambiguity

The system can already operate in `ask`, `explore`, and `decide`, but the current experience still risks making those modes feel implicit or cosmetic.

Users need to understand:

- what kind of interaction they are in
- why the assistant changed modes
- what actions are now valid

### 2. Decision framing reliability

Prompt-first intake has improved, but real business prompts still stress the system.

Phase 4.5 must reduce failures where the assistant:

- confuses the objective with a lever
- collapses multiple levers into one vague metric
- misses a hard guardrail
- opens a workspace before the decision structure is stable enough

### 3. Action credibility

Suggested actions must feel like real tools, not decorative chips.

That means:

- actions should map to deterministic backend paths
- actions should appear only when state supports them
- action labels should explain the consequence of clicking them

### 4. Artifact readability

The assistant already returns artifacts, but artifact presentation still needs stronger product discipline.

Users should be able to distinguish:

- direct grounded answer
- chart artifact
- draft workspace preview
- analysis summary
- honest placeholder or not-yet-implemented capability

### 5. Workspace handoff quality

Opening the Decisions workspace should feel like a justified escalation, not a context reset.

The user should understand:

- what the workspace contains
- what is still missing
- what assumptions are being carried forward

## Phase 4.5 Build Slices

### Slice 1: Mode Legibility And State Discipline

Codex:

- normalize `session_state` so mode transitions, missing inputs, active objective draft, and action availability are explicit and stable
- ensure artifacts expose enough metadata for frontend rendering without fallback guesswork

Gemini:

- make `Ask`, `Explore`, and `Decide` visibly meaningful in the AI destination
- show why the current mode is active and what the user can do next
- remove any residual presentation that makes the mode controls feel decorative-only

Exit condition:

- users can tell what mode they are in and why
- the UI no longer implies unsupported actions for the current state

### Slice 2: Decision Framing And Prompt Reliability

Codex:

- harden prompt-first decision drafting for multi-clause prompts with objectives, levers, constraints, segments, and time horizon mixed together
- improve clarification logic so incomplete decision prompts receive targeted follow-up instead of broad generic questions
- add regression tests for high-risk business prompt patterns

Gemini:

- surface missing-input and clarification prompts in plain language
- keep the user oriented around objective, levers, guardrails, and unresolved questions
- make incomplete decision state feel guided instead of blocked

Exit condition:

- difficult prompts draft materially better structure
- unclear prompts lead to crisp missing-input prompts rather than loose chatter

### Slice 2.5: Decision-Readable Draft Responses

Why this slice exists:

Slice 2 made the backend parse decision prompts more correctly, but live testing showed that correct structure alone is not enough. The chat response can still feel like a debug summary: it says the workspace is `ready`, lists levers, and reports `Inputs Needed: 0`, but does not explain what the system understood, what `ready` actually means, or what the user should do next.

Problem example:

`How should we grow revenue next quarter using marketing spend by channel while protecting gross margin?`

The backend can now correctly draft:

- objective: `Revenue`
- lever: `Marketing Spend`
- segment lever: `Channel mix`
- guardrail: `Gross Margin %`
- time horizon: `Next quarter`

But the current user-facing output can still be confusing:

`This workspace is anchored on the objective 'grow revenue next quarter'. Candidate levers include Marketing Spend, Channel mix. Hard guardrails include Protect Gross Margin %.`

That is structurally true, but not decision-intelligent enough.

Codex:

- improve backend draft workspace preview messaging so AI chat explains the decision frame in plain business language
- distinguish `structurally ready for analysis` from `ready to recommend` or `ready to decide`
- expose clearer preview fields for objective metric, levers, segment dimensions, guardrails, missing inputs, readiness meaning, and recommended next action
- make the primary next step explicit, usually `Analyze workspace`, when the draft is structurally complete
- keep truthfulness clear: a draft workspace is not a recommendation, simulation, optimizer, or final decision
- add regressions for the main clean-dataset prompt examples so preview copy and artifact content are judged against expected user comprehension, not just parser structure

Gemini:

- render the richer draft preview fields so the UI no longer feels like a sparse debug card
- rename or visually clarify `Status ready` so users understand it means ready for structured analysis, not ready for final recommendation
- surface the recommended next action and truthfulness note near the draft preview

Exit condition:

- a user who asks a realistic decision prompt can understand what the system framed, what is still not known, and why the next action is analysis rather than a final recommendation
- `Status ready` no longer reads as if the system has completed the decision
- the draft preview feels like a guided decision kickoff, not a raw contract dump

### Slice 3: Real Action System

Codex:

- tighten backend action schemas so every action has a stable label, intent, and payload contract
- normalize the response shape for assumptions, blockers, workspace previews, and analysis summaries

Gemini:

- render actions as real product controls with consistent placement and disabled/loading states
- distinguish between primary actions, follow-up actions, and informational state
- avoid chip spam or duplicate action surfaces

Exit condition:

- actions appear only when supported
- the same decision state produces predictable visible controls

### Slice 4: Workspace Handoff And Return Loop

Codex:

- ensure draft previews carry enough structure for a clean workspace open action
- support a stronger return path from workspace analysis back into conversational context where feasible through `session_state`

Gemini:

- make the draft preview card explain what will be opened
- preserve narrative continuity when the user moves from chat into the Decisions destination
- keep analysis results understandable when they return to chat context

Exit condition:

- handoff to workspace feels additive, not disruptive
- users can see the continuity between chat framing and workspace structure

### Slice 5: Honest Context Surfaces

Codex:

- expose only real backend-backed decision context when available
- keep placeholder types explicit when functionality does not exist

Gemini:

- present assumptions, blockers, and context modules in a way that feels useful without pretending a document-ingestion pipeline exists
- keep "coming soon" surfaces clearly non-functional

Exit condition:

- the UI gains context clarity without overclaiming intelligence

### Slice 6: Evaluation And Acceptance Coverage

Codex:

- add tests for fallback honesty, clarification prompts, session-state carry-forward, and action gating
- define a small benchmark set of realistic decision prompts

Gemini:

- verify the main conversational flows manually against the benchmark prompts
- confirm that legacy data Q&A and chart requests still work

Exit condition:

- the feature can be judged against repeatable prompts instead of aesthetic impressions alone

## Codex Responsibilities

Codex owns:

- backend logic
- contracts
- action schemas
- `session_state` normalization
- deterministic grounding and drafting behavior
- tests
- active markdown coordination

Codex does not own frontend implementation in this phase unless the user explicitly authorizes it in the session.

## Gemini Responsibilities

Gemini owns:

- AI destination UI implementation
- mode presentation
- action rendering
- artifact presentation
- draft-workspace preview experience
- truthful UX copy
- execution-status updates after frontend work is completed

Gemini must preserve existing working AI/chat/chart capability while improving the decision experience.

## Recommended Build Order

1. stabilize mode legibility and action gating
2. harden prompt-to-structure reliability for real decision prompts
3. normalize artifact rendering and action payload presentation
4. improve workspace handoff and return-loop continuity
5. tighten context surfaces and placeholder honesty
6. finish with regression and acceptance coverage

## Acceptance Scenarios

The phase is not complete unless these scenarios work credibly:

- `What changed in revenue by region last quarter?`
  The system stays grounded, answers clearly, and can chart when useful.

- `How should we grow revenue next quarter using discount rate and marketing spend changes by region without hurting gross margin?`
  The system enters decision framing, separates objective, levers, and guardrail correctly, and offers real next actions.

- `Draft workspace`
  The preview is understandable and the open action feels justified.

- `Show blockers`
  The output is structured, specific, and tied to the current decision state.

- `Analyze workspace`
  The result stays observational and does not pretend simulation or optimization exists.

## One-Line Phase Truth

Phase 4.5 is where Decision Intelligence chat stops being merely connected and starts becoming dependable.
