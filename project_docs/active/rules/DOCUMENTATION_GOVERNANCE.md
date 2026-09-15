# Documentation Governance

## Authority Order

Repository-wide behavior starts in `AGENTS.md`. `project_docs/INDEX.md` and `project_docs/active/README.md` route readers. This document defines documentation boundaries. Execution status reports current truth. `project_docs/active/status/phase_authorization.json` records implementation authority. The sole active gate is the executable plan. Durable roadmaps and contracts support that gate. Handoffs authorize only bounded specialist work. Future and archive files never authorize current work.

If active documents disagree, stop implementation and repair the authority chain before continuing.

## Lifecycle And Authorization

The allowed lifecycle values are `NOT STARTED`, `IN PROGRESS`, `AWAITING USER ACCEPTANCE`, `BLOCKED`, and `COMPLETE`. The allowed authorization values are `REVIEW_ONLY` and `AUTHORIZED`.

A direct user instruction to begin, start, resume, or implement a named phase is implementation authorization for that phase. Codex records the instruction in the authorization record, aligns status and gate identity, and begins the first bounded step. Review-only work may inspect files and edit only the paths explicitly allowed by the authorization record.

Authorization is never inferred from a roadmap, proposed plan, handoff, source diff, or previous status. The authorization record must explicitly state whether Codex frontend edits are allowed.

## Current Work Boundary

`project_docs/active/active_gate/README.md` is the sole current-work plan and the only file permitted in that directory. Its Scope section names `Current Step`, `Target Files`, `Step Acceptance`, `Step Verification`, `Next Step`, `Continuation Rule`, and `Stop Condition`, followed by one ordered checklist for the complete phase.

Checklist numbering is consecutive. Exactly one item is `[IN PROGRESS]`. Earlier items are checked and `[COMPLETED]`; later items are unchecked and `[PENDING]`. `Current Step` and execution-status `Current Milestone` exactly match the in-progress item.

When Codex owns an authorized phase in progress, it must continue through executable bounded steps without waiting for the user to ask what comes next. Stop only for a concrete blocker, a recorded ownership handoff, a user-requested pause, or the phase acceptance boundary.

## Status Boundary

Execution status contains one current phase identity and the required lifecycle, state meaning, milestone, automatic continuation, ownership, readiness, required action, and completion rule. It does not preview a later phase; the roadmap owns future sequence.

Codex-owned work in progress uses `CONTINUE`. Antigravity-owned work uses `WAIT_FOR_AGENT`. User authorization or acceptance uses `WAIT_FOR_USER`. Blocked and complete states use `BLOCKED` and `COMPLETE` respectively.

## Handoff Boundary

Antigravity may own work only when Frontend Readiness is `backend_contract_ready` or `frontend_repair_only` and exactly one non-README Markdown handoff exists. A repair requires a visible `REPAIR REQUIRED` label and an evidence-backed blocker. No active implementation handoff remains when Codex or the user owns the next action unless status explicitly records it as returned for Codex review.

Codex owns backend work, contracts, architecture, documentation, orchestration, readiness, and review. Antigravity owns only the bounded React work named by an active handoff. The user owns product direction and final browser acceptance.

## Storage Boundary

Current truth belongs under `project_docs/active/`. Deferred proposals belong under `project_docs/active/future/`. Completed or superseded material belongs under `project_docs/archive/`. Never modify any `GEMINI.md` file.

## Verification

Run the repository-local harness validator, active-gate validator, hook tests, provider-neutral CI entrypoint, and `git diff --check` after changing authority, status, gate, hooks, skills, or handoffs. These checks report errors and never edit files.
