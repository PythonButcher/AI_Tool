# Project Active Gate — Document Studio Contracts And Local Records

Goal: Establish portable document contracts, managed local file storage, and durable SQLite metadata records for Document Studio.

## User Outcome

Document Studio can identify and version locally stored source files, preserve extraction and evidence records through stable domain objects, and reopen those records without losing their meaning.

## Scope

Claude executes `project_docs/active/ai_hand_off/document_studio_claude_contracts_local_records.md` and changes only approved paths under `document_studio/`.

Add framework-independent domain records, JSON-compatible serialization, application repository ports, a content-addressed local file store, a SQLite metadata repository, and focused temporary-directory tests.

Do not add document parsing, OCR, schema discovery, model providers, document API routes, AI_Tool integration, or frontend files.

## Contracts

Domain records use frozen standard-library dataclasses, UUID identities, timezone-aware UTC timestamps, explicit enums, validated evidence locations, separate confidence signals, and JSON-compatible public serialization.

Application ports do not import storage implementations or web frameworks. Infrastructure implementations keep all managed files under a configured root, use lowercase SHA-256 hashes, use parameterized SQLite operations with foreign keys and transactions, and reconstruct domain records without losing nested data.

Use `project_docs/active/document_studio/README.md` for the roadmap and `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` for ownership boundaries.

## Acceptance

Tests prove domain validation and serialization, managed-path containment, idempotent byte storage, duplicate-content handling, sequential versions, append-only identities, processing-run and blueprint round trips, and persistence after reopening the repository.

The existing health contract remains stable. Every changed implementation file is under `document_studio/`, and no frontend or AI_Tool runtime file changes.

Claude reports the branch, changed files, commands, results, design decisions, and any environment caveat, then stops for Codex review.

## Verification

Run `python -m pip install -e "document_studio/backend[test]"`, `python -m unittest discover -s document_studio/backend/tests -p "test_*.py"`, and `python -m py_compile` for each changed Python module.

Run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `git diff --name-only`.

## Owner And Control Return

Codex owns the gate, architecture, contracts, and acceptance decision. Claude is the bounded backend implementation delegate. Control returns to Codex immediately after Claude reports its evidence. Gemini owns all Document Studio frontend work and has no active assignment in this gate.
