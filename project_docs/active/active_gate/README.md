# Project Active Gate — Slice 4: Read-Only Source Model Canvas

## Goal

Render the current governed workspace as a read-only source-model canvas from live backend source, workspace, and relationship contracts.

## User Outcome

A user can open a dedicated source-model destination, see the current workspace sources and their aliases, inspect relationship paths and trust states, and understand when no workspace or relationship evidence is available.

## Scope

Persist the upload response's `source`, `workspace`, and `analysis_context` in frontend application state, add one original source-model destination, and load the current workspace and relationship records through verified read endpoints. Render source nodes, relationship connectors, trust status, and accessible empty, loading, and error states. Keep this surface read-only.

Do not add relationship creation or editing, membership mutation, AI Chat multi-source payloads, backend code, automatic relationship activation, or changes to any `GEMINI.md` file.

## Contracts

Use `project_docs/active/ai_hand_off/antigravity_source_model_canvas_goal.md`, `project_docs/active/contracts/multiple_data_source_workspace.md`, `project_docs/active/contracts/multiple_data_source_relationships.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, and `project_docs/active/data_sources/multiple_data_sources_implementation_plan.md`.

## Acceptance

The destination uses the live current workspace identity, renders every returned membership once with its persisted alias and role, renders every returned relationship once with its endpoints and trust state, and never implies that suggested, inactive, unconfirmed, invalid, stale, blocked, or many-to-many relationships are executable. Empty, loading, unavailable, and API-error states are visible and accessible. Existing upload, Workspace, Explore, Dashboards, and AI destinations remain functional.

## Verification

Run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `npm --prefix frontend\frontend run build`, then return exact changed files and evidence to Codex. Codex supplies a concise manual browser checklist after source acceptance; the user owns browser verification.

## Owner

Antigravity owns the bounded frontend implementation in `project_docs/active/ai_hand_off/antigravity_source_model_canvas_goal.md`, then stops and returns control to Codex for source and contract review. The user performs browser acceptance only after Codex accepts the implementation.

Kickoff goal: `project_docs/active/active_gate/antigravity_source_model_canvas_goal.md`.
