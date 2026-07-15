# Deferred Multiple Data Sources Foundation Discovery Plan

> DEFERRED: This discovery work did not begin. It is not the current gate and must not be implemented until promoted by the active status file.

## Purpose

Define a source-backed, bounded implementation plan for working with multiple data sources in one analytical workspace.

## Deferred Gate

Status: deferred; Codex owns source discovery, backend contract planning, migration-risk analysis, tests, and documentation when this work is promoted.

Planning source: `project_docs/active/future/codex/data_foundation_cycle_after_current_phases_plan.md`.

Current goal: `project_docs/active/future/codex/codex_multiple_data_sources_foundation_discovery_goal.md`.

Active frontend handoff: none. Frontend work remains out of scope until the backend contract and migration plan are verified from source.

## Scope

Inspect the current connection, upload, Data Hub or dataset registry, active-dataset, AI Chat context, decision-output, persistence, and governance paths. Record their true ownership, identify single-source assumptions, and propose a small staged backend contract and migration plan.

## Boundaries

Do not implement multi-source behavior in this gate. Do not change frontend files, routes, persistence schemas, data relationships, ML behavior, automation behavior, or any `GEMINI.md` file. Do not present relationship candidates as valid joins, causal evidence, or a unified live dataset.

## Acceptance

The discovery record identifies the current source-of-truth paths, explicit single-source assumptions, data-governance constraints, compatibility risks, and the smallest independently testable backend implementation slice. Any frontend handoff is issued only after a source-backed backend contract exists.

Run the project documentation audit, agent harness check, and `git diff --check` before closing the gate.
