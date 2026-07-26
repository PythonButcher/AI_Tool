> COMPLETED REFERENCE ONLY: This record is not an executable current goal.

Goal: Implement a durable source registry and one-source workspace context for governed file uploads without breaking current single-dataset consumers.

Target `backend/db/backend_db.py`, `backend/routes/upload.py`, new bounded repository and workspace-context modules under `backend/`, focused tests under `tests/`, and finalize `project_docs/active/contracts/multiple_data_source_workspace.md` against verified behavior.

Read `AGENTS.md`, `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/ai_chat_execution_status.md`, `project_docs/active/ai_chat/active_gate/README.md`, `project_docs/active/ai_chat/multiple_data_sources_implementation_plan.md`, `project_docs/active/contracts/data_catalog_lineage.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, and `project_docs/active/codex_harness_engineering.md`.

Preserve `datahub_datasets` as the canonical source catalog. Add versioned source metadata plus durable `data_workspaces` and `workspace_sources` records. A successful `POST /api/upload` must preserve its current response fields and add a `source` object with stable identity, source kind, managed locator metadata, fingerprint, schema, semantic model, and governance state, plus an `analysis_context` object with workspace ID, primary source ID, selected source IDs, and no relationships. The managed locator must be created by the server and must not trust a client filesystem path.

Keep the process-global active dataframe and semantic model only as a compatibility adapter. Do not add relationship persistence, relationship inference, joined execution, multi-source AI Chat behavior, frontend code, or changes to any `GEMINI.md` file.

Acceptance requires restart-safe source and workspace retrieval, workspace isolation, correct source-bound governance and semantic metadata, safe missing-file and invalid-membership errors, additive upload compatibility, and focused tests for migration, upload registration, retrieval, isolation, and current Decision Chat dataset identity.

Run the focused new tests, `python -m unittest tests.test_data_catalog_lineage tests.test_decision_chat_service`, `python .codex/hooks/agent_harness_check.py`, `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/ai_chat/active_gate .`, and `git diff --check`. Stop after backend evidence and return control to Codex for contract and gate review.
