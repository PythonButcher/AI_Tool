Goal: Keep confirmed Business Object saves visible and let users recover from changed source choices.

## User Outcome

Users see a definition after saving it in Data Model. If a field or relationship changes while the form is open, they can refresh their choices and continue with the same draft.

## Scope

**Current Step**: Step 1: Repair Business Object save and refresh behavior

**Target Files**: The four Data Model files listed in the [Antigravity handoff](../ai_hand_off/business_object_definitions.md).

**Step Acceptance**: Keep a confirmed save visible when an older list response arrives. Refresh a conflicted draft's source and relationship choices without discarding the draft.

**Step Verification**: Run the focused test, build, and governed return in the handoff.

**Next Step**: Step 2: Review the Business Objects definition panel

**Continuation Rule**: Antigravity implements the bounded assignment and returns the evidence to Codex for integration review.

**Stop Condition**: Stop at the governed handoff return or a concrete implementation blocker.

- [ ] **Step 1: Repair Business Object save and refresh behavior** — [IN PROGRESS]
- [ ] **Step 2: Review the Business Objects definition panel** — [PENDING]

## Contracts

- [Business Object definition API](../business_objects/README.md#definition-api)
- [Antigravity handoff](../ai_hand_off/business_object_definitions.md)

## Acceptance

- A list request that started before a successful save preserves the new definition when it finishes.
- A stale-field or relationship conflict lets the user refresh valid choices in the same draft and retry explicitly.
- Focused tests prove pending submission, workspace isolation, and the existing canvas controls using the handoff scenarios.

## Verification

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand BusinessObjectsPanel.test.jsx`
- `npm --prefix frontend/frontend run build`
- `python .codex/hooks/ci_harness_check.py`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`

## Owner And Control Return

Antigravity owns the panel repair. Return changed files and verification to Codex for integration review. The user owns final browser acceptance.
