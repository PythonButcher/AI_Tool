# Codex Frontend Guardrail Read First

This file is a mandatory guardrail for Codex sessions on this project.

## Rule

For the UI overhaul and AI Chat BI pivot:

- Codex is **not authorized** to implement frontend or UI code unless the user explicitly says so in that session.
- Gemini or Antigravity owns frontend implementation.
- Codex owns backend logic, contracts, and review. For AI Chat, Codex receives handoff markdown from Antigravity to fulfill backend APIs.

## Operational Behavior For Codex

Before changing anything under `frontend/frontend/src/`:

1. re-read this file
2. re-read `project_docs/active/status/ai_chat_execution_status.md`
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
- backend validation for frontend-agent handoff
- markdown coordination inside `project_docs/active/`

## Codex Gatekeeping Checklist

Before Codex creates any Gemini or Antigravity frontend implementation handoff, Codex must verify and state the backend readiness level from source, not from assumptions:

- `backend_not_ready`: backend route, service, contract, or tests are missing. The frontend prompt must use explicit JSON mocks and say the real API is not ready.
- `backend_contract_ready`: backend contract and representative route/service behavior are implemented and verified. The frontend prompt must name exact endpoints, request fields, response fields, and acceptance checks.
- `frontend_repair_only`: backend is ready but frontend integration is incomplete or incorrect. The prompt must name the exact source blockers and avoid broad new scope.

Codex must not mark a frontend phase complete from another agent's claim alone. Completion requires targeted source review against the active contract, plus build or browser verification only when the review gate actually depends on it.

When active docs disagree, Codex must call out the conflict and treat source plus the active contract as the gate until the status file is corrected. The active status file must not be used as proof of completion when it is the item being audited.

Every substantial AI Tool wrap-up must state exactly whose turn is next: Codex, Gemini/Antigravity, user validation, or no one. For AI Chat, Antigravity dictates whose turn is next. If Gemini or Antigravity is next, Codex must put the `Goal:` prompt in the active handoff file and reference that file in the final response instead of pasting the full prompt into chat.

## Handoff Sizing

Codex is accountable for sending frontend agents bounded frontend tasks. Each handoff must cover one independently reviewable behavior, identify a limited file set, state the exact backend contract it consumes, and use a short acceptance list. When work contains separate UI, persistence, export, or regression concerns, Codex must sequence them as separate handoffs rather than issue one broad implementation request.

If Gemini or Antigravity reports that the requested scope is too large or ambiguous, Codex must reduce it into ordered slices before implementation continues. Do not use extra agents to conceal an oversized frontend handoff.

## Frontend-Agent Review Fast Path

When the user asks Codex to review Gemini or Antigravity frontend work, Codex should do an acceptance review, not a fresh implementation audit.

Default review budget:

- Read only `project_docs/INDEX.md`, `project_docs/active/README.md`, this guardrail, the active status file, and the active frontend-agent handoff.
- Inspect only the frontend files named by the handoff or Gemini summary.
- Prefer one targeted `rg` query and one focused diff over full-file reads.
- Do not run a frontend build if the frontend agent already reports a successful build and the review question is contract shape, documentation truth, or a small visual/rendering mismatch.
- Run `git diff --check` only when whitespace, generated diffs, or final acceptance is part of the question.
- Run `npm --prefix frontend\frontend run build` only when Codex finds a likely syntax/import error, Gemini did not report a build, or the user explicitly asks for build verification.

Stop when targeted source review proves the gate. A concrete contract, payload, state, or rendering blocker is enough to answer `Not complete`; do not run builds, browser automation, or broad scans after the blocker is already clear.

Escalate beyond the default budget only when the first pass cannot classify the gate from targeted evidence. If escalating, say why in one short sentence before running more tools.

Browser and E2E checks are not the default path for Gemini review. Use them only when the user explicitly asks for them, the gate depends on visible browser behavior, or no cheaper source/build evidence can answer the question. If browser tooling is unavailable or fails, report that limit instead of trying multiple alternate browser stacks unless the user asks for deeper verification.

For frontend review answers, start with one of these exact acceptance labels: `Complete`, `Not complete`, or `Complete except for documentation cleanup.` Then list only findings that change the next action. If Gemini or Antigravity needs to fix something, update the active handoff file with the next `Goal:` prompt and reference that file instead of pasting the prompt in chat.

## Why This Exists

This guardrail exists because frontend ownership for this initiative belongs to Gemini or Antigravity, and Codex should support that flow without invading the UI implementation lane.
