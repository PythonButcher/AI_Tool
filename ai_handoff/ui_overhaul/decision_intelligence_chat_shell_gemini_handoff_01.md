# Decision Intelligence Chat Shell Gemini Handoff 01

## Goal

Build the first version of the new AI destination shell.

This shell should move the product toward a chat-first Decision Intelligence experience while preserving the current working AI chat behavior.

This is the first frontend priority.

## Product Direction

We want the AI destination to feel closer to an analytics workspace than a floating assistant drawer.

The design should be inspired by the Analytics Agent layout from the referenced Meta article, but should stay aligned with this product's existing visual tone.

Do not make a close copy.

## What Matters Most In This Pass

The shell should:

- look like the future product direction
- preserve the current chat functionality
- create space for future concepts

The shell does **not** need to make future features real yet.

## Current Reality

Right now:

- `AIChat.jsx` contains the working chat behavior
- the current UI is still based on a floating icon and slide-out panel
- existing behavior includes:
  - normal AI chat messages
  - dataset mentions
  - natural-language chart requests
  - `/charts`
  - `/clean`

That behavior must continue to work in this pass.

## What Gemini Is Allowed To Change

Gemini may change:

- `frontend/frontend/src/features/ai/AIChat.jsx`
- `frontend/frontend/src/features/ai/AIChat.css`
- supporting new AI shell components and styles
- AI destination rendering as needed
- related layout wiring if required for the new shell

Gemini may add:

- new shell components
- placeholder tabs
- placeholder action buttons
- placeholder right-side context areas
- session / thread navigation UI

## What Gemini Must Preserve

Do not break:

- existing message send / receive flow
- existing `/charts` behavior
- existing `/clean` behavior
- natural-language chart behavior
- dataset mention behavior

If needed, wrap the existing logic in a better shell instead of rewriting the chat behavior from scratch.

## What Gemini Must Not Do

- do not invent backend features
- do not imply semantic grounding is fully implemented if it is not
- do not imply a real decision engine already exists in chat
- do not add fake simulation or optimization actions
- do not make the placeholders look fully operational if they are not

## Shell Structure

The new shell should likely have three regions.

### Left Rail

Purpose:

- conversation/session navigation
- future capability anchors

Suggested items:

- Chats
- Skills
- Recipes / Playbooks
- Context / Sources

These can be placeholders for now.

### Main Conversation Area

Purpose:

- current working AI chat flow
- primary interaction surface

This is the most important area to preserve behavior in.

### Right Context Pane

Purpose:

- reserve space for future analytics artifacts and workspace drafting

For now it can include placeholder sections such as:

- Current context
- Artifact preview
- Draft decision workspace

These should be visually real but behaviorally honest.

## Styling Direction

Aim for:

- a cleaner, flatter, more product-workspace feel
- visible structure between navigation, thread, and context
- strong readability
- subtle analytical tone

Do not:

- overuse decorative gradients
- make it look like a generic chatbot
- make it look like a direct clone of the article screenshot

## Truth Alignment

If you add placeholders, label them clearly.

Examples of acceptable placeholder language:

- "Skills coming soon"
- "Workspace drafting will appear here"
- "Context panel reserved for grounded analytics artifacts"

Avoid language that implies:

- the system already resolved intent
- the system already created a decision workspace
- the system already has live cookbook/recipe/skill logic

## Recommended Implementation Style

Safest implementation path:

1. keep the existing working AI chat logic
2. move or wrap it into a new layout
3. style the new shell around it
4. keep placeholders clearly secondary

## Verification Standard

This pass is complete when:

- the new AI shell is visibly in place
- the current AI chat still works
- existing chart and clean flows still work
- the UI has placeholders for future chat-first DI concepts
- the placeholders do not mislead the user

## Files To Read

- `C:/Users/18022/Desktop/AI_Tool/ai_handoff/phase_docs/decision_intelligence_chat_first_v2_execution_plan.md`
- `C:/Users/18022/Desktop/AI_Tool/ai_handoff/phase_docs/decision_intelligence_chat_first_consultant_handoff.md`
- `C:/Users/18022/Desktop/AI_Tool/ai_handoff/ui_overhaul/decision_intelligence_2_0_gemini_handoff_05_truth_alignment_before_v2.md`
- `C:/Users/18022/Desktop/AI_Tool/frontend/frontend/src/features/ai/AIChat.jsx`
- `C:/Users/18022/Desktop/AI_Tool/frontend/frontend/src/features/ai/AIChat.css`
