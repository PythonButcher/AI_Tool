> ARCHIVED REFERENCE ONLY: This file is historical. Do not treat old wording below such as "active", "next", "source of truth", or "handoff" as current project truth.
# Decision Intelligence V3 Gemini Handoff 05

## Status

This handoff is active.

The current AI workspace is visually closer to the intended product direction, but the implementation is still failing an important product test:

- the conversation surface and the inspection surface are not yet clearly separated
- simple results are duplicated across both panes
- chart rendering inside the inspection flow can grow vertically out of control

This is now a structural correction pass, not a cosmetic polish pass.

## Product Truth

The user feedback is clear:

- the split layout is getting closer
- the current simple-answer experience does not justify showing the same answer in both the chat area and the right-side result area
- the current chart experience can go visually haywire and extend downward instead of behaving like a bounded inspection artifact

Gemini should treat those observations as grounded acceptance feedback, not optional taste feedback.

## What Is Wrong Right Now

### 1. Result duplication is weakening the product

The current shell renders the same outcome in too many places.

Today the flow effectively becomes:

- assistant response in chat
- artifact rendered again inline in chat
- active artifact rendered again in the right inspection pane

For simple answers, this creates two competing truth surfaces instead of one coherent workflow.

The product should read as:

- converse on the left
- inspect on the right

It should **not** read as:

- see the same answer repeated in multiple places with slightly different framing

### 2. The right pane is not yet a true inspector

The current right pane behaves more like a mirror of the latest artifact than a focused inspection workspace.

If the user cannot clearly understand why a result belongs on the right, then the pane is still too passive and too duplicative.

The right pane needs stronger behavioral ownership:

- it should focus on inspectable artifacts
- it should not be required for plain-text replies
- it should support intentional artifact focus rather than only "latest artifact wins"

### 3. Chart layout is unstable

The current AI chart rendering path is not constrained tightly enough.

The visible result in the screenshot is a classic containment failure:

- the chart does not live inside a clearly bounded frame
- the viewer does not enforce a reliable chart region
- percentage-based sizing is being asked to solve a layout that needs explicit height discipline

The result is a chart surface that can stretch vertically and destabilize the whole workspace.

This is a real product bug, not a styling preference.

## Required Implementation Direction

Gemini should preserve the overall shell direction and visual language.

Do not redesign the AI workspace from scratch.

Do not collapse the split layout back into a single-pane chat.

Do not remove artifact rendering entirely.

Instead, correct the ownership of each region.

### Left pane ownership

The left pane should own:

- user messages
- assistant replies
- compact inline artifact previews when useful
- action controls tied to the thread

For simple answers, the left pane should be the primary and often sufficient surface.

### Right pane ownership

The right pane should own:

- chart inspection
- workspace preview inspection
- workspace analysis inspection
- focused detail viewing for structured outputs

The right pane should not automatically echo every simple text result just because an artifact exists.

If a reply is essentially conversational text, keep it on the left.

If a reply creates a genuinely inspectable artifact, the right pane should become the focused surface for that artifact.

## Concrete Requirements

### Requirement 1: Stop the simple-result duplication

Gemini should remove the current feeling that the same answer is being presented twice.

Expected behavior:

- plain conversational or summary replies stay primarily in the thread
- the right pane should not feel obligated to mirror those replies
- if an inline artifact preview exists for a simple answer, it should be compact and should not create a second full reading experience

Important:

This does **not** mean hiding structured artifacts from the thread entirely.

It means the thread artifact and the inspector artifact should have different jobs.

The thread version is a preview in context.
The right-pane version is the focused inspection surface.

If both surfaces look like full versions of the same thing, the requirement is not satisfied.

### Requirement 2: Make the right pane a real inspector

Gemini should convert the right pane from "latest artifact mirror" into a true inspection workspace.

Expected behavior:

- clicking or selecting an inline artifact should focus it in the right pane
- the active inspector state should be intentional and legible
- the pane should feel justified by structured outputs, not by plain text duplication

Good examples of artifacts that belong in the right pane:

- charts
- workspace previews
- analysis summaries

Weak examples that should usually remain thread-owned:

- a simple one-paragraph grounded answer
- short status text that does not benefit from visual inspection

### Requirement 3: Hard-bound chart rendering

Gemini must stabilize the AI chart rendering path so a chart cannot keep expanding vertically and breaking the layout.

This should be treated as mandatory.

Implementation direction:

- give AI charts an explicit bounded chart frame
- do not rely on loose percentage sizing for the main render container
- ensure the viewer region has a controlled height strategy
- ensure the chart canvas lives inside a `min-height: 0` style flex region or equivalent bounded container pattern
- allow scrolling around the viewer if needed, but do not let the chart canvas itself drive runaway page height

The existing non-AI chart component already follows a more disciplined pattern than the current AI chart path.
Gemini should use that as reference direction rather than preserving the current loose AI chart sizing.

### Requirement 4: Keep inline artifacts, but downgrade them to previews when appropriate

The in-thread artifact experience is still valuable.

Do not remove it.

But the in-thread version should feel like:

- context
- preview
- continuation of the conversation

Not:

- a second competing result canvas

For charts especially, the thread view can be more compact while the right pane holds the stronger inspection version.

### Requirement 5: Preserve truthful mode behavior

While correcting the layout, Gemini must not regress the existing Phase 4 contract work.

The following still need to remain true:

- mode selection remains behaviorally honest
- `session_state` continues to round-trip
- chart-like prompts continue to go through the Phase 4 chat contract path
- suggested actions remain real backend actions

This pass is about fixing presentation and inspection behavior, not backing out contract correctness.

## Recommended File Focus

Primary likely targets:

- `frontend/frontend/src/features/ai/AIShell.jsx`
- `frontend/frontend/src/features/ai/AIShell.css`
- `frontend/frontend/src/features/ai/AICharts.jsx`
- `frontend/frontend/src/features/charts/ChartComponentAI.jsx`

If Gemini needs one or two small supporting components for cleaner artifact ownership, that is acceptable.

Gemini should prefer a clean structural fix over adding more conditional visual patches inside one large file.

## Acceptance Standard

Do not call this complete unless all of the following are true:

- a simple grounded answer no longer feels duplicated across both panes
- the left pane clearly reads as the conversation surface
- the right pane clearly reads as the inspection surface
- the right pane feels most justified when the output is a chart, workspace preview, or structured analysis artifact
- inline artifacts still exist, but they no longer compete with the right pane as equal full-size render targets
- selecting or focusing an artifact makes the right pane feel intentional rather than automatic-only
- an AI-generated chart remains visually bounded inside the workspace
- requesting a simple chart no longer causes the output area to extend downward in a broken way
- no regression is introduced to Phase 4 backend contract behavior

## What Gemini Should Avoid

Do not solve this by:

- removing the right pane
- removing inline artifacts entirely
- making everything text-only
- hiding artifacts just to suppress duplication
- keeping the same mirrored behavior but changing spacing
- applying only CSS tweaks while leaving the ownership problem intact

This needs a real interaction-model correction.

## One-Line Product Truth

The fix is not "make the UI prettier"; the fix is to make the left side own conversation, the right side own inspection, and the chart surface behave like a bounded product component instead of a runaway canvas.
