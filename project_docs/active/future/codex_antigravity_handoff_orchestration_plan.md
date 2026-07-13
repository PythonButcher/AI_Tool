# Future Plan: Codex And Antigravity Handoff Orchestration

Created: 2026-07-07

This is a deferred harness plan, not an active implementation gate. It captures the idea that Codex and Antigravity should be able to carry a phase from backend start through frontend completion and Codex review with minimal user coordination. The user should normally return only when the phase is ready for final acceptance, especially visible browser acceptance that the current project rules reserve for the user.

## Idea To Preserve

The desired working model is straightforward: Codex starts a phase, implements or validates the backend and contract work, writes a clean Antigravity handoff for frontend work, reviews Antigravity's implementation, writes repair handoffs when needed, and repeats until the frontend gate is genuinely complete. Antigravity remains the frontend implementer. Codex remains the backend, contract, review, documentation, and orchestration owner. The user should not have to manually shuttle prompts back and forth after every intermediate step.

This should not merge Codex and Antigravity into one agent. The point is to preserve separate tools and ownership while giving them a shared, deterministic handoff queue and phase state protocol.

## Placement Decision

This should be a layer on top of the existing harness, not a replacement for the harness and not a parallel rule system that agents can ignore. The current harness already defines routing, ownership, validation checks, and handoff rules. The missing layer is an orchestration protocol that tells each agent what inbox to check, how to mark work state, how to request review, and how to continue the phase without waiting for the user to restate the next step.

The current `project_docs/active/ai_hand_off/` folder can remain the first shared handoff location because Antigravity already has an auto-handoff flow that reads `Goal:` prompts from that folder. If the automation grows, the repo can add a more formal phase-run folder, but it should still point back to the active handoff file as the executable prompt surface.

## Proposed Shape

The orchestration layer should introduce one phase manifest and one agent inbox convention per active phase. The manifest is the state machine. The handoff files are the work orders. The status file remains the project truth.

The manifest should live somewhere predictable, such as `project_docs/active/phase_runs/<phase_slug>/manifest.md`, or, if keeping the current structure is more important, as a clearly named file under `project_docs/active/ai_hand_off/`. The manifest should record the phase id, current owner, current state, backend readiness level, frontend readiness level, active handoff file, active review file, blocked reason, verification commands, and the user acceptance requirement.

The agent inbox convention should be simple. Codex starts every substantial session by reading the active status file, the frontend guardrail, the harness README, the AI handoff README, and the active phase manifest. Antigravity starts by reading the active handoff file named by the manifest, then updates that same handoff or a companion completion note with changed files, verification run, and remaining blockers. Codex then reviews from the manifest instead of asking the user which file to inspect.

## Phase State Model

The first useful state model can stay plain language:

`codex_backend_in_progress` means Codex owns backend implementation, contract truth, tests, and the first frontend handoff.

`frontend_ready` means Codex has verified enough backend truth to give Antigravity a bounded implementation prompt.

`antigravity_frontend_in_progress` means Antigravity owns React, CSS, frontend build, browser-visible behavior, and frontend status updates within the handoff scope.

`codex_review_requested` means Antigravity has reported completion and Codex should review the specific handoff against source, contract, and verification evidence.

`frontend_repair_required` means Codex found a blocker and wrote a narrowed repair handoff for Antigravity.

`user_acceptance_required` means Codex review and build/static gates are clean, and the remaining gate is the user-controlled browser acceptance or final product judgment.

`complete` means user acceptance is done or the active docs explicitly define the slice as not needing user browser acceptance.

This state model keeps the user out of the middle of backend-to-frontend-to-review loops while still respecting the current rule that Codex does not claim browser acceptance unless the user explicitly asks it to perform that browser action.

## Handoff File Protocol

Each active handoff should keep a small machine-readable header in plain Markdown near the top. It does not need to be YAML if that makes the files feel heavy, but the fields should be consistent enough for agents or a future scanner to parse.

Recommended fields are `Phase`, `State`, `Owner`, `Next Owner`, `Active Handoff`, `Backend Readiness`, `Frontend Readiness`, `Verification Required`, `Last Updated`, and `User Acceptance Required`.

Below that header, each executable agent prompt should still start with `Goal:` because the existing auto-handoff skill expects that shape. The prompt should remain forward-looking and should not recap previous phases, review history, or implementation diaries. The completion note should name changed files, verification performed, and blockers only.

## Constant Handoff Checking

There are two practical levels of "constantly looks for handoff files."

The first level is a session-start inbox check. Codex and Antigravity both follow a rule that before starting work they inspect the active phase manifest and the handoff folder for any file where they are the `Owner` or `Next Owner`. This is easy to implement as documentation and a small validation hook, and it works with the current separate-agent setup.

The second level is a watcher. A future local script or Codex automation can poll `project_docs/active/ai_hand_off/` and `project_docs/active/phase_runs/` for state changes, then wake or notify the correct agent when ownership changes. That watcher should not edit source code. Its first version should only report the next owner and target handoff file. A later version can open a new Codex thread or trigger the receiving agent if the local tooling supports that safely.

The watcher should treat the manifest as authoritative. It should not guess from file names alone. If two handoffs claim the same owner, or a handoff says `codex_review_requested` without naming changed files, the watcher should report a blocked orchestration state instead of inventing the next step.

## Codex Loop

When Codex starts a phase, it should create or update the manifest, implement backend or contract work, run the required backend verification, update the manifest to `frontend_ready`, and write one bounded Antigravity `Goal:` handoff.

When Codex sees `codex_review_requested`, it should run the lightweight review path first: read the active docs, read the handoff, inspect only the named frontend files, compare against backend truth, and run the narrowest verification needed. If the frontend is incomplete, Codex should update the same handoff or a repair handoff with `State: frontend_repair_required` and `Next Owner: Antigravity`. If the frontend is complete except for user browser acceptance, Codex should set `State: user_acceptance_required` and stop there.

Codex should not advance the phase to `complete` unless the acceptance rule is actually satisfied. That preserves the current project discipline and prevents the orchestration layer from turning into unchecked automation.

## Antigravity Loop

When Antigravity sees itself as owner, it should read the active status file, the active handoff, the relevant contract files, and the exact frontend files named by the handoff. It should implement only the requested frontend slice, run the specified build or browser checks, and then mark the handoff as `codex_review_requested` with changed files and verification evidence.

If Antigravity finds the handoff too broad, missing backend truth, or blocked by an API mismatch, it should mark the state as blocked and name the missing source of truth. It should not silently broaden the task, invent backend APIs, or start the next slice without Codex writing the next handoff.

## Human Role

The user should remain the acceptance authority, not the task router. In the future orchestration flow, the user normally sees only a concise final message that says the phase is ready for acceptance, names the files changed, names the verification that passed, and gives a manual browser checklist when needed.

The user still needs to intervene for product-direction changes, ambiguous scope, browser acceptance, permissions, account setup, or a blocked state that neither agent can resolve from repo context. The orchestration layer should reduce repetitive handoff management, not remove human control from product decisions.

## Minimum Future Implementation

The first implementation should be documentation-only and safe. Add a phase manifest template, add an inbox-check rule to the harness docs, and update active handoff conventions so every handoff declares `State`, `Owner`, and `Next Owner`.

The next implementation can add a read-only scanner script that prints the current owner, next action, active handoff file, and any blocked state. This script should be safe to run from either Codex or Antigravity and should fail closed when files conflict.

The next implementation can add a hook or command that runs the scanner at session start. This gives each agent a reliable "what do I do next?" check without requiring background automation.

Only after that should the project consider a true watcher that polls for ownership changes. The watcher should be read-only at first and should require explicit approval before creating threads, launching tools, or changing files.

## Non-Negotiable Constraints

Codex must still avoid frontend implementation unless the user explicitly authorizes it in the current session.

Antigravity must still avoid backend invention and should consume backend truth from contracts, routes, service behavior, tests, and Codex handoffs.

`GEMINI.md` files remain off limits for Codex.

The active status file remains the short current truth. The manifest can track workflow state, but it should not become an implementation diary.

Completed phase details should still move out of the active path when they are no longer the current gate.

The orchestration layer must fail closed. If ownership, status, or acceptance evidence is unclear, it should report the conflict and wait for Codex or the user rather than advancing the phase.

## Open Design Questions

Should the manifest live under `project_docs/active/phase_runs/` for cleaner state isolation, or inside `project_docs/active/ai_hand_off/` for maximum compatibility with the current Antigravity flow?

Should there be one handoff file that changes state through the phase, or separate files for backend goal, frontend implementation, frontend repair, and Codex review?

Should the first scanner be a Codex hook, a repo script, or a small command documented in the harness?

Should the watcher only notify the user, or should it be allowed to wake/create Codex and Antigravity work sessions when the local app supports that safely?

What exact evidence should be required before the manifest can move from `codex_review_requested` to `user_acceptance_required`?
