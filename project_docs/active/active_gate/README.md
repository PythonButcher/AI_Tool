Goal: Redesign field assignment in the existing Analytics visual builder so users can tell what to place where.

## User Outcome

A user can tell which fields a visual needs, assign or change them directly, and see when the visual is ready to run. The builder keeps its chart types, advanced controls, and customizable workbench.

## Scope

**Current Step**: Step 1: Redesign the field-assignment area

**Target Files**: AnalyticsBuilder.jsx, AnalyticsBuilder.css, AnalyticsVisualPicker.jsx, and AnalyticsShell.test.jsx, as listed in the [frontend handoff](../ai_hand_off/analytics_visual_builder.md).

**Step Acceptance**: Field assignment has a clear starting point. The visual's field roles, compatible choices, current assignments, and next action are understandable before and after placement.

**Step Verification**: Check direct selection and editing, keyboard and drag interaction, invalid placement, and query preservation in the focused Analytics suite. Run the production build.

**Next Step**: Step 2: Review the redesigned field-assignment experience

**Continuation Rule**: WAIT_FOR_AGENT. Antigravity owns frontend design and implementation.

**Stop Condition**: Return the changed files, verification results, and a brief description of the redesigned workflow to Codex.

- [ ] **Step 1: Redesign the field-assignment area** — [IN PROGRESS]
- [ ] **Step 2: Review the redesigned field-assignment experience** — [PENDING]

## Contracts

- [Analytics workflow roadmap](../analytics/README.md#improve-the-existing-analytics-workflow)
- [Analytics workspace](../contracts/analytics_workspace.md)

## Acceptance

The field-assignment area helps users understand the visual's inputs, choose where a field goes, and see what remains to do. Pointer and keyboard actions work at compact widths. Existing visual types, query behavior, and workbench controls remain usable.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand AnalyticsShell.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/agent_harness_check.py`
- `git diff --check`

## Owner And Control Return

Antigravity owns the redesign under the [frontend handoff](../ai_hand_off/analytics_visual_builder.md). Codex reviews the return. The user owns the browser decision in chat.
