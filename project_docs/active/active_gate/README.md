# Project Active Gate — Slice 2: Governed Relationship Contract and Trust

## Goal

Create a durable, explainable relationship contract for governed workspace sources without executing joins or changing current single-source consumers.

## User Outcome

A workspace can store and retrieve explicitly configured source relationships, validate whether their fields and cardinality claims are trustworthy, and explain why a relationship is valid, stale, or blocked.

## Scope

Extend the backend database and bounded repository, service, and route modules with relationship persistence, candidate profiling, validation diagnostics, and CRUD behavior. Relationships must remain scoped to one workspace and must reference sources that are members of that workspace.

Do not implement joined execution, multi-source AI behavior, chart integration, relationship-canvas UI, frontend code, or changes to any `GEMINI.md` file.

## Contracts

Use `project_docs/active/data_sources/multiple_data_sources_implementation_plan.md`, `project_docs/active/contracts/multiple_data_source_workspace.md`, `project_docs/active/contracts/data_catalog_lineage.md`, and `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`.

Create and finalize `project_docs/active/contracts/multiple_data_source_relationships.md` against verified backend behavior.

## Acceptance

Relationship records have stable identities, workspace isolation, explicit source and field pairs, cardinality, join behavior, filter direction, validation state, diagnostics, source fingerprints, timestamps, and a monotonic version. Validation checks source membership, field existence, type compatibility, key uniqueness, null rates, unmatched keys, declared cardinality, cycles, ambiguous active paths, and estimated row multiplication. Suggested candidates remain inactive until explicit confirmation. Unsupported many-to-many execution is marked blocked, and source fingerprint or schema changes make affected validation stale.

Focused tests cover one-to-one, one-to-many, composite keys, missing fields, type mismatch, invalid membership, unmatched keys, cycles, ambiguous paths, stale sources, workspace isolation, and restart-safe retrieval. Existing source/workspace, governance, and Decision Chat identity behavior remains unchanged.

## Verification

Run the focused relationship tests, `python -m unittest tests.test_source_workspace_context tests.test_data_catalog_lineage tests.test_decision_chat_service`, `python .codex/hooks/agent_harness_check.py`, `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`, and `git diff --check`.

## Owner

Codex owns backend implementation, contract finalization, tests, and acceptance review. Codex performs its own gate review before transitioning the project or creating any frontend handoff. The user has no action during this backend gate.

Kickoff goal: `project_docs/active/active_gate/codex_relationship_trust_goal.md`.
