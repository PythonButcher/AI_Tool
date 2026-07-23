> COMPLETED REFERENCE ONLY: This record is not an active gate.

# Source Registry and Workspace Context Gate

## Goal

Create a durable backend source registry and workspace context that represents the current one-dataset experience as a one-source analytical workspace.

## User Outcome

A governed file upload receives a stable source identity and a durable workspace context that can be retrieved after the request finishes. Existing upload, AI Chat, semantic-model, and chart consumers continue to work while the backend gains the foundation for adding more sources.

## Scope

Extend `backend/db/backend_db.py` with source-registry metadata, `data_workspaces`, and `workspace_sources`. Add repository helpers, a workspace-context service, and bounded workspace routes. Modify `backend/routes/upload.py` so an accepted upload is stored under a server-managed locator, registered in `datahub_datasets`, attached to a default workspace, and returned with additive `source` and `analysis_context` objects.

Keep `backend/utils/global_state.py` as a compatibility adapter for current callers. Do not implement relationships, joined execution, AI Chat multi-source behavior, or frontend code in this gate. Do not edit any `GEMINI.md` file.

## Contracts

Use `project_docs/active/ai_chat/multiple_data_sources_implementation_plan.md`, `project_docs/active/contracts/data_catalog_lineage.md`, and `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`.

Finalize `project_docs/active/contracts/multiple_data_source_workspace.md` against verified implementation and tests. The current upload response is additive: retain `data_preview`, `full_data`, summaries, `semantic_model`, and `governance_readiness`.

## Acceptance

A successful upload has a server-generated source ID, a managed locator that is not supplied by the client, and a default workspace whose primary source points to that source. Source and workspace retrieval survive a new database connection. Governance policy, readiness, schema, and semantic metadata stay attached to the correct source. Legacy one-dataset resolution still behaves the same through the compatibility adapter. Missing storage, invalid workspace membership, and cross-workspace source access fail safely. Focused tests cover schema migration, upload registration, retrieval, isolation, and legacy compatibility.

## Verification

Run the focused new workspace and upload tests, the existing data-catalog and Decision Chat identity tests, `python .codex/hooks/agent_harness_check.py`, `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/ai_chat/active_gate .`, and `git diff --check`.

## Owner

Codex owns backend implementation, contracts, tests, and gate review. Control returns to Codex after verification to decide whether relationship-contract work is ready. Antigravity has no active implementation handoff in this gate.

Kickoff goal: `project_docs/active/ai_chat/active_gate/codex_source_registry_workspace_goal.md`.
