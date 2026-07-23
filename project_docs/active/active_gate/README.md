# Project Active Gate — Slice 3: Safe Multi-Source Analytics

## Goal

Execute explicitly selected, validated workspace relationships safely in AI Chat and chart analysis while preserving unchanged one-source behavior.

## User Outcome

A user can select governed sources and relationship paths in one analysis context, ask a cross-source question, and receive a deterministic answer, table, or chart with complete source and relationship lineage and honest fanout diagnostics.

## Scope

Add a bounded relationship execution service and integrate selected relationship IDs from `analysis_context` with dataset resolution, Decision Chat, semantic resolution, and chart construction. Execution must use only active, confirmed, freshly valid relationships in the requested workspace, require an explicit acyclic path, namespace multi-source fields, preserve the primary-source grain, enforce row-expansion limits, and return lineage and fanout diagnostics.

Do not add relationship-canvas UI, frontend code, automatic relationship activation, unsupported many-to-many execution, or changes to any `GEMINI.md` file.

## Contracts

Use `project_docs/active/data_sources/multiple_data_sources_implementation_plan.md`, `project_docs/active/contracts/multiple_data_source_workspace.md`, `project_docs/active/contracts/multiple_data_source_relationships.md`, `project_docs/active/contracts/data_catalog_lineage.md`, `project_docs/active/contracts/decision_objects.md`, and `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`.

## Acceptance

Execution refuses missing, inactive, unconfirmed, invalid, stale, blocked, cross-workspace, cyclic, ambiguous, or many-to-many relationship paths. Valid one-to-one, one-to-many, many-to-one, and composite-key paths produce deterministic namespaced columns while enforcing a documented row-expansion ceiling and preserving primary-source grain semantics. Every multi-source result returns participating source IDs, relationship IDs and versions, source fingerprints, field lineage, join order, unmatched-key evidence, and observed fanout.

Focused tests cover direct and multi-hop paths, composite keys, ambiguous paths, stale relationships, many-to-many refusal, row-expansion refusal, namespaced field collisions, governance aggregation, lineage, conversational context retention, charts, and unchanged legacy one-source requests.

## Verification

Run the focused relationship-execution, Decision Chat, semantic, and chart tests, the existing source/workspace and governance regressions, `python .codex/hooks/agent_harness_check.py`, `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`, and `git diff --check`.

## Owner

Codex owns backend implementation, contract updates, tests, and acceptance review. Codex performs its own gate review before creating any frontend handoff. The user has no action during this backend gate.

Kickoff goal: `project_docs/active/active_gate/codex_safe_multi_source_analytics_goal.md`.
