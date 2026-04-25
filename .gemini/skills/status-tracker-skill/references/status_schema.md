# Status Tracker Schema & Conventions

This reference defines the expected format for status updates in `project_docs/active/status/decision_intelligence_execution_status.md`.

## Status Labels

Use the following bolded labels for Phase status:
- **PLANNING artifact** (Phase is defined but no code exists)
- **IMPLEMENTATION active** (Code is being written)
- **HARDENING active** (Code exists but needs bug fixes/refinement)
- **COMPLETE** (Phase objectives met, verified by tests)
- **CLOSED AS-IS** (Frozen historical baseline)

## Task Checkboxes

- `[ ]` : Not started
- `[~]` : In progress / Partially implemented
- `[x]` : Completed

## Summary Section Rules

When a task marked with `[x]` is a major UI component or feature, it should be summarized under the `## What Is Actually Implemented Today` section.
- Keep descriptions concise and technical.
- Use sub-bullets for technical details (e.g., "Updated dark theme with pure black middle `#000000`").
- Maintain the "Premium Neutral Aesthetic" tone in all summaries.

## File Header

Every status update must preserve the mandatory "Codex Guardrail" notice at the top of the file.
