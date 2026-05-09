> ARCHIVED REFERENCE ONLY: This file is historical. Do not treat old wording below such as "active", "next", "source of truth", or "handoff" as current project truth.
# Intermission: Window Behavior and Right Pane Cleanup

## Audience

This file is written for Gemini as a focused implementation handoff between the completed shell-direction work and the later Phase 4 Decision Intelligence clarity work.

Use it as a one-off execution brief, not as a replacement for the numbered overhaul phases.

## Status

Planned / Ready for implementation

## Execution Standard For Gemini

Gemini should treat this intermission as a quality-first implementation pass.

This work should not be rushed.

Explicit instruction:

- stop trying to clear the task as fast as possible
- scan the affected surfaces carefully before changing them
- check behavior repeatedly while implementing
- verify drag behavior, layout density, and real in-app usability more than once before considering the work done
- prioritize quality over speed

Time is not the constraint here. Quality is the constraint.

## Why This Intermission Exists

This is not a new overhaul phase.

It is a one-off cleanup slice created because several day-to-day interaction problems are still hurting usability even though the destination-based shell direction is correct.

The current shell is better than the pre-overhaul version, but some of the most frequently touched interactions still feel physically frustrating:

- most populated windows do not expand or hold their size reliably
- the right-side pane is useful, but still visually bulky for something that needs to stay open often
- drag-and-drop from the field catalog works, but it does not communicate itself clearly enough
- the definitions and semantic-layer slideouts still consume too much space for too little signal
- semantic definitions are not behaving clearly enough as drag sources for semantic charts and semantic KPI flows
- the right-side Definitions / Semantic Layer portion still needs a real redesign, not a light touch-up

These issues are important enough to address before returning to the larger Decision Intelligence clarity work planned for Phase 4.

## Scope of This Intermission

This intermission covers three targeted implementation areas:

- window sizing, expansion, and resize stability across the shared canvas windows
- right-side pane density and visual refinement in both field-catalog and semantic-definition modes
- clearer drag-and-drop affordances for field and semantic objects

## What This Intermission Is Not

This intermission does not:

- replace Phase 4 Decision Intelligence redesign work
- reopen the destination-based information architecture
- introduce backend contract changes
- remove semantic-layer, dashboard, or drag-and-drop capability
- reduce the product into a simpler but weaker tool

The direction of the app remains the same. This is an execution cleanup to make the existing direction usable enough to continue.

## Active Constraints

Gemini should preserve all existing constraints from the overhaul set:

- keep the destination-based shell
- keep the current backend contracts
- keep `decision_bundle`
- keep semantic charting, KPI, dashboard, and filter workflows
- keep the expandable right-side pane behavior
- keep drag-and-drop plus quick-action shortcuts
- keep manual field-selection controls for chart and KPI setup
- keep these semantic workflows semantic-first for end users
- keep the current visual tone, while modernizing density and clarity

## Problem Area 1 - Populated Windows Do Not Hold Size Well

## Why This Needs Attention

Most windows feel acceptable only in their blank or initial state.

As soon as the user starts configuring real content, especially when metric selectors, `group_by` controls, summaries, or action rows appear, the windows often become cramped, clip their own controls, or require constant manual resizing.

The issue is not just visual polish. It creates friction in normal use.

The screenshot example shows the pattern clearly:

- the frame exists
- the content technically rendered
- but the usable interior height is not behaving like a real working surface

This makes the user fight the shell instead of using it.

## Observed Behavior

- Data Preview appears to tolerate expansion better than most other windows.
- Chart, dashboard-chart, KPI, and similar populated windows feel more fragile once controls and data summaries appear.
- Footer and action regions can become partially clipped.
- Manual resizing does not feel trustworthy or stable enough.
- A window that is usable while blank can become cramped once the user actually chooses values.
- Some recent changes have removed or hidden working field-selection dropdowns in chart setup states, which is a regression.

## Architectural Clue

The current shared window layer appears to rely too heavily on generic minimum sizing and generic fallback geometry.

Relevant files:

- `frontend/frontend/src/components/layout/WindowFrame.jsx`
- `frontend/frontend/src/hooks/useWindowInteraction.js`
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`
- `frontend/frontend/src/context/WindowContext.jsx`

Important current signal:

- `WindowFrame.jsx` and `useWindowInteraction.js` both use a generic `300 x 200` minimum
- `CanvasContainer.jsx` also provides broad fallback sizing rules

That is likely too generic for populated charting and dashboard surfaces.

## Required Direction

Gemini should treat window sizing as a behavior problem first, and a styling problem second.

Implementation direction:

- establish per-window-type default size and minimum size rules instead of relying on one global minimum
- ensure windows can grow or re-baseline when moving from blank state to configured/populated state
- reserve stable regions for header, toolbar, content body, and footer/action rows so controls do not get clipped out of frame
- preserve usable in-window controls such as metric and `group_by` selectors when a chart needs manual configuration
- prefer internal content scrolling only after the frame has reached a sensible working size
- make user resizing feel persistent and trustworthy rather than easy to lose
- use Data Preview as a reference case for a window that currently behaves better under real content

## Expected Outcome

After this intermission, a populated chart or dashboard-related window should feel like a usable workspace by default, not a miniature card that the user has to wrestle into shape.

## Problem Area 2 - The Right Pane Is Useful but Still Too Bulky

## Why This Needs Attention

The expandable right-side pane is directionally correct and should stay.

That part is a win.

The remaining problem is that the pane still carries too much visual weight for something that is supposed to remain open for long stretches of time, especially in semantic-definition mode.

The pane currently asks for too much space, too much vertical attention, and too much scrolling for routine use.

## Observed Behavior

- The field catalog is useful, but each item still feels larger and heavier than necessary.
- The semantic-definition view is especially bulky because cards, badges, helper copy, and actions all compete at once.
- The expanded semantic pane is helpful, but it still feels visually dense rather than intentionally efficient.
- The current tone is good enough to preserve, but the density needs refinement.
- Metric and dimension definition cards currently waste too much vertical space.
- The semantic-layer metrics UI is functional, but not polished enough for a primary product surface.
- The slideout structure is directionally right, but the visual execution is still not sleek enough.

## Implementation Anchors

Relevant files:

- `frontend/frontend/src/components/layout/DataPane.jsx`
- `frontend/frontend/src/components/layout/DataPane.css`
- `frontend/frontend/src/components/insights/FieldsPanel.jsx`
- `frontend/frontend/src/components/insights/FieldsPanel.css`
- `frontend/frontend/src/components/insights/SemanticModelPanel.jsx`
- `frontend/frontend/src/components/insights/SemanticModelPanel.css`

## Required Direction

Gemini should modernize the pane without turning it into a different product.

This needs to be treated as a must-redo area, not a small polish pass.

The Definitions and Semantic Layer slideouts should be reworked at a much higher quality level while still staying inside this application's established tone and theme.

Implementation direction:

- keep the expandable/collapsible behavior exactly as a core shell feature
- reduce default visual bulk in both raw-field and semantic-definition modes
- treat the Definitions and Semantic Layer slideouts as high-frequency product surfaces, not utility drawers
- do a genuine UI overhaul of this portion rather than a minimal spacing adjustment
- tighten card padding, vertical rhythm, pill sizing, and action-row spacing
- reduce repeated explanatory copy where the label hierarchy already communicates the point
- make section headers, item names, metadata, and actions easier to scan in one pass
- redesign semantic metric and dimension cards so they feel intentionally compact, sleek, and product-grade within the existing app tone
- make semantic-layer metrics feel cleaner and more premium, not like stretched placeholder cards
- keep semantic mode rich, but make it feel lighter and more operational
- maintain the current tone while making the pane more refined, more compact, and easier to live with

## Expected Outcome

The pane should still feel premium and capable, but no longer oversized for the amount of information it contains.

## Problem Area 3 - Drag-and-Drop Needs Better Teaching and Feedback

## Why This Needs Attention

Dragging from the field catalog is part of the product’s value, but it still depends too much on the user already understanding how the system works.

The current interactions are functional, but they do not advertise themselves clearly enough.

## Observed Behavior

- Many field and semantic rows still read more like static list items than obvious draggable building blocks.
- Valid drop targets are not clear enough until the user is already interacting.
- The relationship between dragged object type and downstream result is still too implicit.
- Quick actions help, but they do not fully solve the teachability problem of drag-and-drop.
- In dashboard flows, a user can create a semantic chart or semantic KPI and still not understand how to drag semantic definitions into it.
- Field Catalog rows read as draggable more clearly than Definitions rows, creating an inconsistent interaction model.
- Semantic definitions currently over-index on button actions and under-communicate drag behavior.
- semantic definitions currently fail at the most important expectation: they do not reliably drag out of the side panel into the working surface
- the current attempt at semantic drag-and-drop is not acceptable and should be treated as needing a complete redo
- some recent UI changes appear to have replaced usable selection controls with drag-only empty states, which is not acceptable

## Implementation Anchors

Relevant files:

- `frontend/frontend/src/components/insights/FieldsPanel.jsx`
- `frontend/frontend/src/components/insights/FieldsPanel.css`
- `frontend/frontend/src/features/charts/SmartChartWindow.jsx`
- `frontend/frontend/src/features/charts/SmartChartWindow.css`
- `frontend/frontend/src/features/charts/RolesPanel.jsx`
- `frontend/frontend/src/features/charts/RolesPanel.css`
- `frontend/frontend/src/utils/DropZone.jsx`
- `frontend/frontend/src/components/layout/CanvasContainer.css`
- `frontend/frontend/src/App.jsx`

## Required Direction

Gemini should make drag-and-drop more self-explanatory before, during, and after drag start.

Implementation direction:

- restore any removed chart/KPI selectors or equivalent manual semantic selectors that previously allowed users to choose values directly
- treat drag-and-drop as an enhancement to semantic configuration, not as a replacement for working semantic selectors
- do not introduce or re-emphasize raw data field selection in these semantic dashboard flows
- make draggable rows look intentionally draggable, not just clickable
- ensure semantic definitions in the Definitions / Semantic Layer slideouts are valid, obvious drag sources for semantic chart and semantic KPI workflows
- fix the core behavior first: semantic definitions must actually drag out of the side panel and into compatible chart / KPI targets
- if the current semantic drag implementation is brittle, redo it instead of layering cosmetic hints on top of broken behavior
- make the drag model consistent between Field Catalog and semantic-definition surfaces instead of teaching two different interaction languages
- improve hover and active states so users can tell what is interactive
- when dragging begins, highlight compatible drop zones more clearly
- show stronger feedback for valid versus invalid targets
- improve drag preview / overlay behavior so the user feels what they are moving
- use empty-state and drop-zone copy to explain what a drop will do
- keep quick actions like Chart, KPI, Filter, and View as accelerators, not replacements for drag-and-drop clarity

## Specific Semantic Workflow Requirement

Gemini should treat this as an explicit requirement for the intermission:

- if a user opens Dashboards and creates a semantic chart or semantic KPI, the Definitions / Semantic Layer pane must make it obvious how to continue from there
- blank semantic chart states should still provide working manual semantic selectors for users who want to choose definitions directly
- those selectors should point to semantic metrics and semantic dimensions, not raw data fields
- semantic metric and dimension items must be able to drag from the side panel into the destination surface in actual use, not just appear theoretically draggable
- semantic metric and dimension items should visually communicate whether they can be dragged into the active semantic chart or KPI surface
- semantic drag targets should explain what each drop will do, especially in blank semantic chart states
- the user should not have to guess whether semantic definitions are clickable only, draggable only, or both

Quick actions are still useful, but they are not enough by themselves. The drag-and-drop path must also feel real, visible, and teachable. Manual semantic selectors must remain available too.

## Semantic-First Rule For This Intermission

For this slice, Gemini should keep the user-facing experience focused on semantic definitions, not raw fields.

Explicitly:

- users should be choosing from semantic metrics and semantic dimensions in these dashboard semantic flows
- do not surface raw data fields as a parallel option in the semantic chart / semantic KPI setup for this intermission
- do not broaden the UI into a mixed raw-plus-semantic chooser for these flows right now

Future phases may revisit how internal or developer-oriented tooling can help convert raw data into semantic definitions, but that is outside the scope of this intermission.

## Expected Outcome

A new user should be able to understand that the field catalog is a drag source and that chart/drop targets are valid destinations without needing to infer the entire interaction model from trial and error.

## Priority Order

Gemini should implement this intermission in the following order:

1. window sizing and resize stability
2. right-pane density and scanability
3. drag-and-drop clarity and visual feedback

The first item is the most blocking because it affects whether the app feels workable at all once real content is present.

## Acceptance Criteria

This intermission should be considered successful when:

- populated windows no longer clip their own controls or footer actions at normal working sizes
- chart, dashboard, KPI, and similar working windows open at more appropriate default sizes
- resize behavior feels stable instead of fragile once content is configured
- the right-side pane still expands, but feels lighter and more compact in both field and semantic modes
- definition cards and semantic-layer metric cards no longer feel oversized or wasteful
- field and semantic rows communicate drag behavior more clearly
- valid drop targets become visually obvious during drag interactions
- semantic definitions clearly support drag-and-drop into semantic chart and semantic KPI workflows
- semantic definitions can actually be dragged from the side panel into the relevant semantic chart / KPI surface without breaking or stalling
- metric / group-by semantic selectors or equivalent manual semantic selectors are present and usable where users need direct configuration
- raw data fields are not reintroduced as a parallel user-facing option in these semantic dashboard flows
- no backend contract changes are required

## Relationship to Later Phase 4 Work

This intermission does not replace the later Decision Intelligence clarity work.

Phase 4 should still address:

- what Decision Intelligence operates on
- when users should use it
- how readiness/setup guidance should be framed
- how semantic definitions connect to charts, dashboards, and decisions

This intermission only removes interaction friction that would otherwise make that later work harder to evaluate cleanly.

## Final Guidance For Gemini

Do not treat this as a broad redesign.

Treat it as a focused cleanup pass on the current shell direction:

- make windows behave like dependable work surfaces
- completely redo the Definitions / Semantic Layer portion at a much higher quality level while preserving the app's tone
- make the right pane lighter without weakening it
- make semantic drag-and-drop actually work from the side panel into charts and KPI surfaces
- restore and preserve usable manual semantic selectors for chart / KPI setup instead of replacing them with drag-only empty states
- keep these flows centered on semantic intelligence rather than exposing raw-field choices right now
- make drag-and-drop more obvious and more teachable

This work should feel deliberate and checked, not rushed.

Keep the current architectural direction, but make it materially easier to use.
