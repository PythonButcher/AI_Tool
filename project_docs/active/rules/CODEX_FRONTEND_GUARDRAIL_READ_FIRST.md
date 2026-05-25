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
2. re-read `project_docs/active/status/decision_intelligence_execution_status.md`
3. confirm the user explicitly asked Codex to make frontend changes in the current session

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
- markdown coordination inside `project_docs/active/`

## Gemini Frontend Review Fast Path

When the user asks Codex to review Gemini frontend work, Codex should do an acceptance review, not a fresh implementation audit.

Default review budget:

- Read only `project_docs/INDEX.md`, `project_docs/active/README.md`, this guardrail, the active status file, and the active Gemini handoff.
- Inspect only the frontend files named by the handoff or Gemini summary.
- Prefer one targeted `rg` query and one focused diff over full-file reads.
- Do not run a frontend build if Gemini already reports a successful build and the review question is contract shape, documentation truth, or a small visual/rendering mismatch.
- Run `git diff --check` only when whitespace, generated diffs, or final acceptance is part of the question.
- Run `npm --prefix frontend\frontend run build` only when Codex finds a likely syntax/import error, Gemini did not report a build, or the user explicitly asks for build verification.

Escalate beyond that budget only when the first pass finds a concrete blocker that cannot be classified from the targeted evidence. If escalating, say why in one short sentence before running more tools.

For Gemini-review answers, start with one of these exact acceptance labels: `Complete`, `Not complete`, or `Complete except for documentation cleanup.` Then list only findings that change the next action. If Gemini needs to fix something, end with a short paste-ready Gemini prompt.

## Why This Exists

This guardrail exists because frontend ownership for this initiative belongs to Gemini, and Codex should support that flow without invading the UI implementation lane.
