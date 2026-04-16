# Codex Frontend Guardrail Read First

This file is a mandatory guardrail for Codex sessions on this project.

## Rule

For the UI overhaul and Decision Intelligence initiative:

- Codex is **not authorized** to implement frontend or UI code unless the user explicitly says so in that session.
- Gemini owns frontend implementation.
- Codex owns backend logic, contracts, architecture, review, and handoff markdown.

## Operational Behavior For Codex

Before changing anything under `frontend/frontend/src/`:

1. re-read this file
2. re-read `ai_handoff/ui_overhaul/ui_overhaul_execution_status.md`
3. re-read `ai_handoff/ui_overhaul/decision_intelligence_v3_resume_handoff.md` if the task touches Decision Intelligence
4. confirm the user explicitly asked Codex to make frontend changes in the current session

If that explicit permission is missing:

- do not edit frontend files
- do not restyle shells or layouts
- do not modify React components or CSS
- do backend support work for Gemini instead
- update handoff docs and contracts only if needed

## Default Codex Scope

Codex should default to:

- backend work
- contract corrections
- endpoint design
- backend validation for Gemini handoff
- markdown coordination inside `ai_handoff/`

## Why This Exists

This guardrail exists because frontend ownership for this initiative belongs to Gemini, and Codex should support that flow without invading the UI implementation lane.
