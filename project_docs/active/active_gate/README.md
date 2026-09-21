Goal: Review the complete ML Studio replacement plan before activating implementation.

## Start Here

**Current action: review the plan. Implementation has not started.** Read the [build order](../ml_studio/README.md#build-order), beginning with [Step 1 — Design the complete workflow](../ml_studio/README.md#step-1--design-the-complete-workflow). The roadmap explains the sequence; this file authorizes only the current action.

## User Outcome

Establish one clear whole-product plan for a guided or hands-on local ML workflow, covering all six stages and all five task types instead of only repairing Experiment Configuration.

## Scope

Review project_docs/active/ml_studio/README.md as the replacement product direction. Codex may correct planning, status, and navigation documents only. No backend or frontend implementation is activated by this review gate.

The plan must preserve seamless Guidance, developer-controlled data preparation, the Power Query round trip, resumable drafts, safe backward edits, locked forward stages, real local training, deliberate candidate selection, usable outputs, and the deferred Context Ledger/AI Chat boundary.

## Contracts

- project_docs/active/ml_studio/README.md — proposed product scope and delivery sequence.
- project_docs/active/contracts/ml_studio.md — existing contract, to be reconciled before implementation.
- project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md — ownership boundary.
- project_docs/active/status/phase_authorization.json — planning authority.

## Acceptance

The replacement plan covers the entire workspace and all product stages; separates confirmed choices from provisional defaults; identifies existing source and contract gaps; orders bounded backend and frontend work; and does not claim planned behavior is implemented.

The user reviews the product direction before a new implementation gate is activated. This is plan review, not a browser-acceptance assignment.

## Verification

- python .codex/hooks/agent_harness_check.py
- python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .
- git diff --check

## Owner And Control Return

Current owner: User for plan review; Codex for requested plan corrections. Frontend implementation is unassigned and no handoff is active.

Control return: WAIT_FOR_USER. Stop after presenting the replacement plan. Once approved, Codex activates Step 1 — Design the complete workflow — in this file. A frontend owner receives only a subsequent bounded, backend-ready assignment.
