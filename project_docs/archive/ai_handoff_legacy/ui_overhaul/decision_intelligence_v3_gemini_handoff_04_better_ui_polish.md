> ARCHIVED REFERENCE ONLY: This file is historical. Do not treat old wording below such as "active", "next", "source of truth", or "handoff" as current project truth.
# Decision Intelligence V3 Gemini Handoff 04

## Branch Context

Current branch in the repo:

- `decision-intelligence-v3-better-ui`

This handoff is for **Gemini only**.

## Scope

This is **not** a UI overhaul.

The overall tone, theme direction, and product identity are already much better than before and should be preserved.

The job now is to:

- improve visual discipline
- raise the app from hobby-project feeling to polished product feeling
- make controls feel smaller, smarter, cleaner, and more intentional
- keep the current visual direction, but refine it to a more professional level

Do **not** redesign the whole app.

Do **not** replace the current tone with a different visual identity.

Do **not** remove working features just to simplify visuals.

## Core Product Direction

The app now has a decent tone.

The problem is not the direction.

The problem is that many components still feel:

- oversized
- slightly too loud
- slightly too soft/rounded in a hobby-project way
- not yet at professional product-app quality

Target feeling:

- modern
- clean
- restrained
- confident
- high-signal
- premium desktop app

Think closer to:

- Microsoft-level polish
- professional internal platform
- serious product UI

Not:

- playful
- oversized
- puffy
- dramatic
- hobby dashboard

## Screenshot-Based Guidance

## 1. Menu Bar Commands

The current menu-bar command buttons are acceptable directionally, but still too large and too hobbyish.

Problems to solve:

- button blocks feel oversized
- icon + label stack feels too tall
- spacing reads more like a prototype than a production app
- command groups need tighter rhythm and stronger discipline

Desired result:

- smaller command surfaces
- more efficient vertical spacing
- cleaner label hierarchy
- more professional proportions
- sharper grouping rhythm
- better balance between icon weight, text weight, and padding

The buttons should still feel approachable, but much more refined.

## 2. Destination Home / Section Welcome States

The custom destination messages are good and should stay.

That concept is correct.

But they need to be dialed down slightly.

Problems to solve:

- hero messaging is a little too oversized
- the visual presentation is a little too soft and obvious
- CTA buttons still feel too consumer/prototype instead of product-grade

Desired result:

- keep the custom message per destination
- keep the feeling of orientation and guidance
- reduce visual loudness
- improve typography scale balance
- make the layout feel cleaner, calmer, and more premium
- make the buttons feel more product-app and less landing-page

The result should feel eye-opening because it is clear and elegant, not because it is large or flashy.

## 3. Decision Intake Primary Button

The main intake CTA is directionally strong, but still too heavy.

This button is important because it helps define the tone of the workflow.

Desired result:

- strong primary CTA
- cleaner geometry
- more disciplined spacing
- less toy-like
- less oversized
- more premium and professional

This button should become the reference tone for strong primary actions across the app.

## 4. AI Chat Surface

The AI chat visual direction is much better now.

That improvement should be preserved.

But the current presentation is structurally wrong for this app because the chat is stuck as a full destination surface.

The AI chat needs to live in a proper window so the user can:

- minimize it
- close it
- move it within the workspace model

The app already has a windowing system.

The AI chat should participate in that model instead of feeling pinned in place.

This is both a UX issue and a product-consistency issue.

## Button Language Standard

Across the application, button styling should move toward one shared tone:

- cleaner
- more modern
- more professional
- less oversized
- less bubbly
- less hobbyish

This applies to:

- menu bar commands
- destination home CTAs
- decision intake CTAs
- AI-related action chips and buttons
- other major primary and secondary action surfaces encountered during this pass

The goal is not sameness.

The goal is a shared visual language with better discipline.

Buttons can still vary by emphasis, but they should all feel like they belong to the same mature product.

## Constraints

- preserve the current tone and theme direction
- preserve working flows and feature access
- do not turn this into a redesign
- do not introduce a different aesthetic system
- do not make everything tiny or sterile
- improve polish without flattening personality

## Likely Target Areas

- `frontend/frontend/src/components/layout/MenuBar.jsx`
- `frontend/frontend/src/components/layout/MenuBar.css`
- `frontend/frontend/src/components/layout/DestinationHome.jsx`
- `frontend/frontend/src/components/layout/DestinationHome.css`
- `frontend/frontend/src/features/business/decision/DecisionIntakeFlow.jsx`
- `frontend/frontend/src/features/business/decision/DecisionWorkspace.css`
- `frontend/frontend/src/features/ai/AIShell.jsx`
- `frontend/frontend/src/features/ai/AIShell.css`
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`

Use judgment if a few nearby files also need small adjustments, but stay tightly scoped to this UI polish goal.

## AI Chat Structural Requirement

Gemini should evaluate the cleanest way to make AI chat work as a real windowed experience inside the existing workspace shell.

That likely means:

- preserving the improved AI shell design language
- reusing the existing window system where appropriate
- allowing minimize and close behavior
- avoiding a regressively cramped or awkward layout

Do not throw away the improved AI chat styling just to force it into a window.

The job is to make it window-native well.

## Deliverable Standard

When this pass is done, the user should feel:

- the app looks more serious
- the controls feel more intentional
- the welcome states feel smarter and cleaner
- the major CTAs feel professional
- AI chat finally behaves like part of the app instead of a pinned panel

## Short Summary For Gemini

Keep the current theme and tone.

Do not overhaul the product.

Refine the UI so it stops feeling oversized and hobbyish and starts feeling like a polished professional app.

Tighten the menu-bar commands.

Keep the custom destination welcome states, but make them cleaner, calmer, and more premium.

Use the decision-intake primary button as a model for strong action tone, but polish it.

Bring that same cleaner button language across the app.

Most importantly, make the AI chat a real windowed surface with minimize and close behavior instead of leaving it stuck as a pinned destination view.
