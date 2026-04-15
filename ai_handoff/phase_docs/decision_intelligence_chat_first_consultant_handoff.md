# Decision Intelligence Chat-First Consultant Handoff

## Goal

We want to refine the DI roadmap without throwing away the earlier architecture work.

The new idea is:

- AI chat should become the main user entry point
- the semantic layer should ground what the chat is allowed to mean
- structured decision workspaces should still exist, but more as generated artifacts than the only starting point
- the real simulation and trade-off engine still matters, but it should sit behind this conversational layer

## What Changed

Our earlier DI 2.0 work leaned too heavily on a form-first workspace experience.

We now think the product should feel more like:

- a user talks to an intelligent business analyst
- the system resolves that request against the semantic model
- the system answers, clarifies, or proposes a decision scope
- a workspace is created when the conversation becomes a real decision

Example requests:

- "Show me Revenue for this Location last quarter"
- "Why did margin drop in the West region?"
- "Should we expand into Canada?"
- "What levers do I have if I want growth without hurting gross margin?"

## What Still Stands From The Earlier Advice

We do **not** want to discard the previous guidance.

The following still feels right:

- we still need a unified intelligence model
- we still need a real simulation engine
- we still need trade-off paths instead of one magic answer
- we still want goal-seeking later

So this is not:

- chat instead of architecture

It is:

- chat as the front door
- unified intelligence as the backend foundation
- simulation/trade-offs as later decision capabilities

## What We Think The Product Should Do

### 1. Support semantic-grounded conversational analytics

The system should resolve user language into:

- metric
- dimension
- filter
- time period
- intent

It should answer with grounded analytics, not vague chat text.

### 2. Distinguish analytics from decision requests

Not every request is a decision.

We think the system should treat these differently:

- descriptive: "Show me revenue by region last quarter"
- diagnostic: "Why did gross margin fall?"
- prescriptive: "Should we lower price in the Southeast to hit growth targets?"

### 3. Generate a decision workspace from conversation

When the user is clearly asking for a decision, the system should be able to:

- infer a likely objective
- infer possible levers
- infer likely constraints
- surface missing inputs
- create a draft decision workspace

## What We Want Your Advice On

Please help us refine this direction in a practical way.

We mainly want your recommendation on:

1. whether this chat-first direction is the right product move
2. how to structure the backend around it without losing the earlier DI goals
3. what the next implementation phase should be for Codex

## What Would Be Most Helpful In Your Response

Please keep the response focused.

The most useful output would be:

- a revised high-level architecture direction
- the main backend pieces we should separate or combine
- the best next step to build first

## Current Internal View

Our current belief is:

- the workspace work was still useful
- but it should become supporting infrastructure, not the whole product
- the app should feel conversational first
- the decision engine still needs to be real, not just chat polish
