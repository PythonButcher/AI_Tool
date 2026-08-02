# Project Active Gate — Automatic AI Chat Model Resolution

Goal: Make AI Chat automatically use the current workspace's active, validated Data Model relationships so an end user can ask cross-source questions without selecting sources or joins.

## User Outcome

Once relationships are validated and activated in Data Model, the user can open AI Chat and ask questions normally. AI Chat resolves and retains the governed multi-source context automatically.

## Scope

Extend the backend context boundary in `backend/services/workspace_context.py`, `backend/services/relationship_execution.py`, and `backend/decision_engine/chat_service.py`, with focused coverage in `tests/test_relationship_execution.py` and `tests/test_decision_chat_service.py`. Update `project_docs/active/contracts/multiple_data_source_workspace.md` and `project_docs/active/contracts/multiple_data_source_relationships.md` only with behavior proven by the implementation.

## Contracts

Treat Data Model activation as the deliberate modeling decision. Resolve only active, confirmed, freshly valid, executable relationships connected to the workspace primary source. Produce deterministic ordered `source_ids` and `relationship_ids`, then pass that canonical identity-only context through the existing bounded executor. Never activate, validate, repair, or guess a relationship during chat.

The request boundary may identify the current workspace, but it must not require an end user to choose tables, sources, relationship IDs, join fields, or paths. Suggested-action refinements retain the server-resolved canonical context. A workspace with no executable active relationship continues through unchanged one-source behavior. Do not add a setup or model-selection surface to AI Chat.

## Acceptance

A workspace with two sources connected by one active, confirmed, freshly valid relationship supports a cross-source AI Chat request without caller-selected source or relationship arrays. The response and session state contain the canonical resolved analysis context, and a suggested refinement retains it.

Inactive, invalid, stale, blocked, many-to-many, disconnected, cyclic, or ambiguous relationships are never executed or silently substituted. Errors identify the Data Model as the place to repair model configuration without asking the end user to configure a join. Existing single-source dataset, Data Hub mention, cleaning, table, chart, export, and refinement behavior remains unchanged.

## Verification

Run the focused relationship-execution and Decision Chat tests, `python .codex/hooks/agent_harness_check.py`, the active-gate validator, and `git diff --check`.

## Owner And Control Return

Codex owns the backend resolver, contract, tests, and readiness decision. After verification, Codex determines whether a bounded Antigravity integration handoff is required.
