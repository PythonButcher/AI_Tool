> DEFERRED: This goal is retained for future reference only. Do not execute it unless the active status file promotes the accompanying discovery plan.

Goal: Define a source-backed, bounded backend implementation plan for multiple data sources in one analytical workspace.

Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/decision_intelligence/active_gate/README.md`, `project_docs/active/future/codex/multiple_data_sources_foundation_discovery_plan.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, and `project_docs/active/contracts/data_catalog_lineage.md`.

Inspect the current backend connection, upload, Data Hub or dataset registry, active-dataset, AI Chat context, decision-output, persistence, and governance paths. Identify the exact source-of-truth objects, single-source assumptions, and compatibility constraints that a multiple-data-sources contract must preserve.

Create a concise discovery record that names the first bounded backend slice, its data contract, migration risks, focused tests, and any prerequisite documentation changes. Do not implement product behavior in this gate.

Do not edit frontend implementation files or any `GEMINI.md` file. Do not issue a frontend handoff until a backend contract and source review prove one is needed.

Finish with `python C:/Users/18022/.codex/skills/project-doc-governance/scripts/audit_project_docs.py`, `python .codex/hooks/agent_harness_check.py`, and `git diff --check`.
