Goal: Redesign the part of the Analytics visual builder where people choose and drop fields.

## User Value

When someone opens a visual, they can tell which fields to use, where each one goes, and what to do next. Once a field is placed, they can see the assignment and easily change it.

## What Codex Checked

The current builder puts assignment under **Data roles** in `AnalyticsBuilder.jsx`. It supports choosing fields, clicking from the field list, and dropping into a role. The user says this section is still hard to understand and wants the field-assignment layout and interaction redesigned. The chart picker and shortcut fix are usable starting points. The [existing Analytics contract](../contracts/analytics_workspace.md) covers the query and saved configuration.

## What Needs to Work

A first-time user can look at the assignment area and tell what the selected visual needs, which fields fit, and how to start. They can complete the setup by clicking or using the keyboard, or drag with clear feedback about where a field will go. After an assignment, they can see the field's role and any aggregation, change or remove it, and tell what still needs attention before running. Keep the existing chart types, query options, and saved analyses usable.

Gemini owns the design. The [active gate](../active_gate/README.md) covers the field-assignment experience. The [roadmap](../analytics/README.md#improve-the-existing-analytics-workflow) covers navigation, Dashboard authoring, and Publishing.

## Current Assignment

Use the current builder's `config.view`, `config.query`, and `onChange(nextConfig)` boundary. Keep the source identity and query semantics, including field compatibility, defaults, and the shortcut's role isolation.

- `frontend/frontend/src/features/analytics/AnalyticsBuilder.jsx`
- `frontend/frontend/src/features/analytics/AnalyticsBuilder.css`
- `frontend/frontend/src/features/analytics/AnalyticsVisualPicker.jsx`
- `frontend/frontend/src/features/analytics/AnalyticsShell.test.jsx`

**Maximum Diff Lines**: 1000

**Inline Styles**: forbidden

**Async Mutation**: no

**Preserved Controls**: Keep the visual picker, field search, click and drag assignment, measure settings, query options, and adjustable workbench layout. Test: verify a user can assign and revise fields from the redesigned area and keep the shortcut, drag, and stale-result regressions passing.

Run `npm --prefix frontend/frontend test -- --watchAll=false --runInBand AnalyticsShell.test.jsx`, `npm --prefix frontend/frontend run build`, and `git diff --check`. Return the results and a brief description of what the user sees before and after placing a field. A screenshot is welcome if available. Return through the [repository handoff process](README.md).
