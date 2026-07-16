# Completed Reference

Status: Completed dataset-identity frontend handoff. This file is retained for reference and is not an active prompt.

Goal: Make an AI Chat dataset mention select the exact dataset sent to Decision Chat, or show the backend refusal without analyzing unrelated active data.

Backend contract is ready. Read `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/decision_intelligence_execution_status.md`, `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`, `project_docs/active/decision_intelligence/active_gate/phase_1_ai_chat_trustworthy_interaction_plan.md`, and the `Decision Chat Trustworthy Interaction` plus `Dataset Trust` sections of `project_docs/active/contracts/decision_objects.md`.

Limit implementation to `frontend/frontend/src/features/ai/AIShell.jsx` and `frontend/frontend/src/utils/mentionUtils.jsx`. Use `frontend/frontend/src/context/DataContext.jsx` and `frontend/frontend/src/context/WarehouseContext.jsx` as read-only state references unless a concrete identity field cannot be obtained without a minimal context change; stop and report that blocker before broadening the file set. Do not change backend files, export behavior, session persistence, mode controls, action execution, or `GEMINI.md`.

For `POST /api/decision/chat/turns`, resolve at most one exact dataset mention. Send `resolved_datasets` with that dataset's canonical name and send matching `dataset_ref` fields `source`, `dataset_id`, and `dataset_name`. When the selected item is a Data Hub record, use `source: "datahub"` and do not send the unrelated global `dataset` or `semantic_model`; the backend will load the referenced record and its registered or inferred semantic model. When the mention identifies the currently loaded inline dataset, send the current rows and their semantic model with a truthful non-Data-Hub reference. Do not relabel global rows with another dataset's name. Preserve the no-mention path for the current active dataset.

Make mention parsing work with the dataset names that `MentionDropdown` can insert, including names containing spaces, hyphens, or punctuation. Treat zero matches as no mention and more than one unique dataset as a user-visible unsupported selection rather than silently choosing one. Render the backend HTTP 400 message for missing or mismatched `dataset_ref` in the existing AI Chat error surface.

Accept the slice when a named Data Hub dataset produces a request whose `resolved_datasets[0]` matches `dataset_ref.dataset_name`, the global inline dataset is not sent in its place, the returned `resolved_datasets[0]` and `dataset_trust.dataset` identify the same dataset, an unknown or ambiguous mention cannot run against active global data, and an ordinary prompt without a mention still uses the current active dataset.

Run `npm --prefix frontend/frontend run build`, `python .codex/hooks/agent_harness_check.py`, and `git diff --check`. Report changed files and verification results. The user must perform the browser check: send one no-mention prompt, one prompt mentioning a Data Hub dataset whose values differ from the active dataset, and one invalid mention; confirm the result identity and error behavior. Stop after this dataset-identity slice and return it for Codex review.
