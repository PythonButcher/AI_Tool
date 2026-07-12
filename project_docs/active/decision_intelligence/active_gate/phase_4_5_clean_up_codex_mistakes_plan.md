# Phase 4.5 - Clean Up Codex Mistakes Plan

## Purpose

Correct Codex-authored documentation, contract, and backend-truth mistakes before the next planned product phase begins. This is a bounded cleanup gate, not a new feature expansion.

## Current Gate

Status: active; Codex owns the cleanup and verification.

Planning source: explicit user direction on 2026-07-11.

Current goal: `codex_phase_4_5_clean_up_codex_mistakes_goal.md`.

Active frontend handoff: none.

## Cleanup Scope

Keep one unambiguous active gate and remove completed, rejected, or historical prompts from active paths.

Review the Advanced Readiness backend and contract for Codex-authored overclaims or unreachable states. A capability may be described as supported only when the live product path can supply trusted source evidence. Contract-only test fixtures must not be presented as live integration.

Keep Decision Output PDF and executive-export improvements outside this cleanup gate. Those belong to the next planned Product Truth Pruning And Executive Export Pack phase and must not be used to reopen or redefine completed work.

Do not edit frontend implementation files unless the user explicitly authorizes frontend changes in the session. Create no frontend handoff unless source review proves a bounded frontend defect that belongs to this cleanup scope.

## Acceptance Checks

Phase 4 records and its frontend handoff exist only as completed references.

Rejected audit material is archived and absent from active navigation.

The active status, active-gate README, current plan, and current Codex goal all name Phase 4.5 - Clean Up Codex Mistakes as the only active gate.

Advanced Readiness contract language and live backend behavior agree about which states are reachable and what source evidence supports them.

Focused backend tests cover any corrected contract or runtime behavior without enabling unsupported prediction, optimization, causal proof, or automated decisioning.

No PDF/export implementation is added to this cleanup phase.

## Verification

Run the focused backend tests touched by cleanup, `python C:/Users/18022/.codex/skills/project-doc-governance/scripts/audit_project_docs.py`, `python .codex/hooks/agent_harness_check.py`, and `git diff --check`.
