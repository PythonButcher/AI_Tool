# Project Active Gate — Awaiting User Epic Goal

Goal: Hold AI_Tool in a clean, verified idle state until the user selects the next standalone product outcome.

## User Outcome

The user can choose the next product goal without inheriting stale implementation scope, an obsolete frontend assignment, or conflicting roadmap numbering.

## Scope

No implementation work is authorized by this gate. Preserve the current BI-first AI Chat, governed data workspace, Data Model, charts, dashboards, exports, and compatibility boundaries while the next epic is defined.

## Contracts

Current product and payload truth remains in `project_docs/active/contracts/`. Ownership remains governed by `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`.

## Acceptance

The user names one standalone product outcome. Codex then converts that outcome into one numbered roadmap phase or one bounded active gate, confirms the required backend and frontend boundaries from current source, and assigns exactly one current owner.

## Verification

Run `python .codex/hooks/agent_harness_check.py`, `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`, and `git diff --check` after establishing the next gate.

## Owner And Control Return

The user owns selection of the next epic goal. Control returns to Codex after that goal is stated so Codex can prepare the executable gate and determine the first implementation owner.
