Goal: Add safe PDF, DOCX, and XLSX ingestion adapters that produce one portable normalized document contract, then stop for Codex review.

## Read First

Read `AGENTS.md`, `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/project_execution_status.md`, `project_docs/active/active_gate/README.md`, `project_docs/active/document_studio/README.md`, and `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`.

Inspect the current package and tests under `document_studio/backend/` before editing. Do not infer requirements from archived handoffs.

## Target Files

Work only under `document_studio/`. Limit implementation changes to `document_studio/README.md`, `document_studio/backend/pyproject.toml`, framework-independent modules under `document_studio/backend/src/document_studio/domain/`, `application/`, and `infrastructure/`, and focused tests under `document_studio/backend/tests/`.

Do not add or change document HTTP routes. Do not create frontend files.

## Normalized Contract

Define frozen, JSON-compatible domain records for a normalized document, page or sheet, text block, table, row or cell as needed, and source locations. The representation must preserve reading order and distinguish page-based locations from spreadsheet sheet-and-cell locations. Keep these contracts independent of parser libraries, FastAPI, Flask, SQLite, filesystem implementations, and AI_Tool state.

Return a structured ingestion result that distinguishes successful normalization from `requires_ocr`. A digital PDF uses useful embedded text. A scanned or image-only PDF with no useful embedded text returns `requires_ocr` with a plain reason; this assignment must not execute OCR or invent text.

## Ingestion Boundary

Define an application-layer ingestion port or service that accepts server-received bytes, an original filename used only as metadata, a declared media type, and a configurable maximum byte size. The caller must never supply a filesystem path. Reject empty input, unsafe filenames, oversized content, unsupported formats, and mismatches that would cause the wrong parser to handle the bytes.

Implement infrastructure adapters for digital PDF, DOCX, and XLSX. PDF normalization preserves page boundaries and embedded-text locations available from the selected parser. DOCX normalization preserves paragraphs and table structure. XLSX normalization reads workbook structure directly and preserves sheet names, cell coordinates, and useful cell values; do not render spreadsheets as images.

Third-party parser dependencies may be added to `pyproject.toml` when they are actively used and covered by tests. Keep parser imports inside infrastructure adapters.

## Required Tests

Use small deterministic fixtures owned by the test suite. Prove supported-format detection, digital PDF text extraction, DOCX paragraphs and tables, XLSX sheets and cells, useful source locations, JSON-compatible normalized serialization, safe filename validation, configurable size limits, unsupported-format errors, and a structured `requires_ocr` result for a scanned or image-only PDF.

Retain all health, domain, local-file-store, and SQLite repository tests. Tests must not require network calls, model keys, a running server, OCR software, or production paths.

## Forbidden Scope

Do not add OCR execution, handwriting detection, schema proposals, extracted-field inference, model providers, blueprint selection, exports, destination integrations, batching, watched folders, Context Ledger integration, AI_Tool routes, or production deployment behavior.

Do not create or edit `document_studio/web/`, `frontend/`, or the existing top-level `backend/`. Do not create, edit, move, delete, or repair any `GEMINI.md` file. Do not commit, merge, or push.

## Acceptance And Verification

Run `python -m pip install -e "document_studio/backend[test]"` and `python -m unittest discover -s document_studio/backend/tests -p "test_*.py"`.

Run `python -m py_compile` for every changed Python module, `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `git diff --name-only`.

Report the branch, every changed file, each command and result, parser and normalized-contract decisions that affect later chunks, and any environment caveat. Stop after the report. Codex owns the acceptance decision and must review this work before another assignment begins.
