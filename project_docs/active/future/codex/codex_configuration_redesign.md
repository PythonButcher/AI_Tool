Deferred proposal, preserved for reference. This is not an active assignment; the sole active gate controls implementation.

Goal: Redesign the ML Studio Configuration stage (Step 3) to improve clarity and user experience based on direct user feedback.

## User Outcome
The user found the current `ConfigurationStage.jsx` "clunky" and "confusing." Specifically, after assigning a target column, it was not immediately obvious what to do next or where to find the execution buttons to proceed. The layout needs to guide developers naturally from role assignment to assessment and training.

## Required Active Docs
- `project_docs/active/contracts/ml_studio.md` (Do not change backend contracts; this is purely a UI/UX layout improvement)
- `project_docs/active/ml_studio/README.md` (Step 5 requirements)

## Scope Boundaries
- **Target Files**: `frontend/frontend/src/features/ml_studio/ConfigurationStage.jsx` and its CSS.
- **Constraints**: 
  - Retain the strict role exclusivity and server assessment lock logic.
  - Make the call-to-action ("Save & assess" / "Continue to Train") much more prominent or sticky so users don't get lost.
  - Clarify the separation between the Column Roles table and the Evaluation Settings panel.

## Next Actions
Codex: Review this user feedback, propose a simplified UX/layout for `ConfigurationStage.jsx` in the active gate, and then authorize Antigravity to build the new UI.
