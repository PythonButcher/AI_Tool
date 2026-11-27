Engineering review complete on November 26, 2026. Nine focused panel tests and the production build passed. Headless Chrome fixtures at 320 and 1440 pixels verified a visible record name, a focusable result, and the full 512-character ID wrapping in detail without horizontal overflow. Final product acceptance remains in chat.

Goal: Keep record names and IDs readable and operable in the Business Objects browser when an ID is long.

REPAIR REQUIRED

## Repair Blocker

**Observed Source**: In BusinessObjectsPanel.css, the flex row `.bo-record-btn` gives the unwrapped `.bo-record-key` a nonshrinking width. A long ID can remove the visible label and overflow the results list. The `.bo-detail-id` inside `.bo-detail-header` also has no wrapping rule for a long uninterrupted ID.

**Expected Contract**: GET records returns `label` and `key.value` for each item in `records`. POST detail takes that exact typed key and returns `record.label` and `record.key.value`. A valid key can contain 512 characters. On a narrow or desktop panel, the search result keeps a visible name and the ID remains readable or accessible in full. The detail header stays within the panel. Error responses and unavailable relationship sections contain no record key.

**Regression Test**: `frontend/frontend/src/features/data-model/BusinessObjectsPanel.test.jsx` — `opens a labeled record with a 512-character ID`; serve an uninterrupted 512-character string key, assert the result label and ID render, select it, check the exact request key, and assert the detail label and ID. Verify the layout separately at 320 pixels with the same fixture.

**Return Evidence**: Include the CSS rules that keep both surfaces within the panel, focused test output, the production build result, and the observed layout at 320 pixels and desktop width.

## User Value

Users can identify and open a record by name even when its configured ID is long, and can read the ID in the detail view.

## Required Context

- [Active gate](../active/active_gate/README.md), [execution status](../active/status/project_execution_status.md), and [frontend guardrail](../active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md).
- [Record browsing API](../active/business_objects/README.md#record-browsing-api).

## Scope And Target Files

- `frontend/frontend/src/features/data-model/BusinessObjectsPanel.css` for result and detail layout.
- `frontend/frontend/src/features/data-model/BusinessObjectsPanel.test.jsx` for the focused regression.
- `frontend/frontend/src/features/data-model/BusinessObjectsPanel.jsx` remains in scope for the existing returned diff and any markup needed to expose the label or full value. Leave search, request identity, and selection logic intact.

**Required Change Coverage**: the stylesheet and focused tests.

**Maximum Diff Lines**: 540

**Inline Styles**: forbidden

**Async Mutation**: no

**Preserved Controls**: Keep definition save and refresh, Create Relationship, Add Source, panel close with focus return, search, and record selection. Test: retain the existing definition, canvas controls, and record browser tests.

Use the existing theme and maintain visible focus. The acceptance fixture is one labeled record with an unbroken 512-character key. Its result button stays operable and its name stays visible at both widths. Its detail ID is readable in full and does not cause panel-level horizontal scrolling. Keep Analytics, backend, contracts, and status outside the assignment.

## Verification And Stop Point

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand BusinessObjectsPanel.test.jsx`
- `npm --prefix frontend/frontend run build`
- `git diff --check`
- Return through `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff business_object_record_browser.md --summary "Long record ID layout repair and focused verification evidence"`.

Stop after returning evidence for Codex review. The user owns final browser acceptance.
