# Analytics visual builder engineering review

Archived on November 27, 2026 after engineering review. User browser acceptance remains pending.

Codex verified that the shortcut assigns only to its expected role and preserves the query when that role rejects a field. The named regression checks the exact groups and measures sent when a text field is assigned twice. Analysis renders six quick visual choices and retains the full gallery, field controls, and workbench. Gemini reported 16 passing Analytics shell tests and a passing production build and harness.

## Returned assignment

Goal: Make field assignment in the Analytics builder clear and predictable.

REPAIR REQUIRED

## Repair Blocker

**Observed Source**: In AnalyticsBuilder.jsx, `quickAssign` falls back from its preferred role to any compatible role. Repeating the shortcut on an already-grouped text field can quietly add a distinct-count measure.

**Expected Contract**: The shortcut may assign a field to its expected role, or leave the query alone when that role is unavailable. Assigning the same field to a different role remains an explicit action. The existing query and storage contracts apply.

**Regression Test**: `frontend/frontend/src/features/analytics/AnalyticsShell.test.jsx` — `repeating quick assignment keeps a grouped field out of measures`; group a text field, repeat the shortcut, and verify the run still sends the original groups and measures.

**Return Evidence**: Return the named test, existing Analytics shell suite, production build, and the source lines for the assignment decision. Show what users can see on opening the builder and when assigning a field so Codex can review the visible change.

## User Value

People can see how to assign a field and trust that the same shortcut will never change a different part of their analysis.

## What Codex Verified

The builder is mounted in Analysis and offers descriptions, direct field menus, and a double-click shortcut. Dashboard still opens an Analysis draft for chart creation. The [roadmap](../active/analytics/README.md#improve-the-existing-analytics-workflow) covers that separate wiring.

## Current Assignment

- `frontend/frontend/src/features/analytics/AnalyticsBuilder.jsx`
- `frontend/frontend/src/features/analytics/AnalyticsBuilder.css`
- `frontend/frontend/src/features/analytics/AnalyticsVisualPicker.jsx`
- `frontend/frontend/src/features/analytics/AnalyticsShell.test.jsx`

**Maximum Diff Lines**: 380

**Inline Styles**: forbidden

**Async Mutation**: no

**Preserved Controls**: Keep all visual types, field assignment methods, query options, and adjustable workbench layout. Test: keep the direct selection, drag-and-drop, Scatter, and stale-result tests passing alongside the new regression.

Run `npm --prefix frontend/frontend test -- --watchAll=false --runInBand AnalyticsShell.test.jsx`, `npm --prefix frontend/frontend run build`, and `git diff --check`. Return through the [repository handoff process](../active/ai_hand_off/README.md).
