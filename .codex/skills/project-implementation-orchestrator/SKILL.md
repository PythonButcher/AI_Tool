---
name: project-implementation-orchestrator
description: Turn a substantial product goal or deferred proposal into a source-backed implementation roadmap with ordered backend and frontend work, one active gate, bounded agent handoffs, a forward-looking kickoff Goal prompt, and explicit validation and control-return states. Use when starting a multi-phase project, promoting a future plan, deciding backend/frontend ownership, activating the next phase, or preparing reusable Codex-to-frontend-agent coordination.
---

# Project Implementation Orchestrator

Build a concise execution system around a product outcome. Keep product-specific architecture in the roadmap and reuse only the orchestration structure.

## Workflow

1. Read repository instructions, the documentation index, current status, active gate, ownership rules, and only the proposal, contract, and source files relevant to the request. Run required documentation or harness checks before changing the gate.
2. Verify source truth. Identify current entrypoints, persistence, state ownership, contracts, tests, single-object assumptions, migration risks, and the smallest compatibility-preserving change. Do not plan from deferred documentation alone.
3. Write one active roadmap in plain project language. Give each phase one user-visible purpose, one primary owner, prerequisites, bounded backend and frontend scope, acceptance evidence, and a control-return condition. Put persistence and backend contracts before UI integration when the UI depends on them.
4. Keep frontend scope light and independently reviewable. Separate shell/navigation, editing or interaction, and downstream integration when each can be verified alone. State non-negotiable contracts and acceptance behavior while leaving component composition, accessible interaction, styling, motion, and concise copy to the frontend owner.
5. Activate only the first executable phase. Replace the active-gate router with a numbered, forward-looking goal containing User Outcome, Scope, Contracts, Acceptance, Verification, and Owner. Update status and navigation so every active path names the same gate and next owner.
6. Always create a kickoff file whose first text is `Goal:`. Make it standalone and forward-looking. Name target files, current docs to read, exact contract fields or source objects, acceptance checks, verification commands, forbidden scope, and where control returns. Do not recap completed work or refer to an earlier phase inside the kickoff goal.
7. Create a frontend-agent handoff only after source review or explicit user direction proves a real frontend gap. If backend work is not ready, record the planned handoff sequence in the roadmap and keep the active handoff empty. Once ready, issue one bounded handoff with exact endpoints and fields, one visible behavior, a limited file set, build evidence, and a stop-and-return instruction.
8. Validate the active gate, documentation links, skill metadata when changed, repository harness, and whitespace. Treat failures as blockers unless the failing validator demonstrably targets obsolete project paths; in that case record the mismatch and run the repository's current equivalent without weakening the gate.

## Required Outcome

Finish substantial planning work by stating the current gate, readiness level, next owner, next file to read, and what evidence will transfer control. Never make the user infer whether backend implementation, frontend implementation, integration review, or browser acceptance comes next.

