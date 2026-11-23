Goal: Let users create and view Business Object definitions in Data Model.

## User Outcome

Users can name an object in Data Model, select the source, key, optional record label field, and direct relationships, then see the saved definition in the workspace.

## Scope

**Current Step**: Step 1: Implement the Business Objects definition panel

**Target Files**: The four Data Model files listed in the [Antigravity handoff](../ai_hand_off/business_object_definitions.md).

**Step Acceptance**: Save and reopen a definition through the panel using verified workspace APIs. Show unavailable references on the saved entry and preserve the existing canvas controls.

**Step Verification**: Run the focused test, build, and governed return in the handoff.

**Next Step**: Step 2: Review the Business Objects definition panel

**Continuation Rule**: Antigravity implements the bounded assignment and returns the evidence to Codex for integration review.

**Stop Condition**: Stop at the governed handoff return or a concrete implementation blocker.

- [ ] **Step 1: Implement the Business Objects definition panel** — [IN PROGRESS]
- [ ] **Step 2: Review the Business Objects definition panel** — [PENDING]

## Contracts

- [Business Object definition API](../business_objects/README.md#definition-api)
- [Antigravity handoff](../ai_hand_off/business_object_definitions.md)

## Acceptance

- Two distinct object configurations use the same form and appear in the saved list after reopen.
- Invalid references and save failures preserve the draft and display a clear message. Existing canvas controls remain usable.
- Focused tests prove pending submission and workspace isolation using the handoff scenarios.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand BusinessObjectsPanel.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Antigravity owns the bounded definition panel. Return changed files and verification to Codex for integration review. The user owns final browser acceptance.
