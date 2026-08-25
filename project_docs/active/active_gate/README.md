# Project Active Gate — Document Studio File Ingestion And Normalization

Goal: Ingest supported document bytes into one portable normalized representation while identifying scanned PDFs that require OCR.

## User Outcome

Document Studio can safely interpret digital PDFs, Word documents, and Excel workbooks without trusting a client-supplied filesystem path, while reporting when a PDF has no usable embedded text and requires OCR.

## Scope

Claude executes `project_docs/active/ai_hand_off/document_studio_claude_file_ingestion_normalization.md` and changes only approved paths under `document_studio/`.

Add framework-independent normalized-document contracts plus format-specific ingestion adapters for digital PDF, DOCX, and XLSX bytes. Preserve pages or sheets, text blocks, tables or cells, and available source locations. Detect a scanned or image-only PDF honestly and return a structured result indicating that OCR is required.

Do not add OCR execution, handwriting processing, schema discovery, model providers, extraction orchestration, document API routes, AI_Tool integration, or frontend files.

## Contracts

Normalized domain records remain portable, immutable, and JSON serializable. Application orchestration may depend on domain contracts and ingestion ports but not concrete parser libraries, web frameworks, SQLite, filesystem paths supplied by clients, or AI_Tool state.

Infrastructure adapters accept server-received bytes plus safe metadata, enforce supported media types, filename safety, and configurable size limits, and preserve format-specific structure instead of flattening spreadsheets into images.

Use `project_docs/active/document_studio/README.md` for the roadmap and `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` for ownership boundaries.

## Acceptance

Tests use small controlled fixtures and prove digital PDF text extraction, DOCX paragraph and table normalization, XLSX workbook structure, useful source locations, format detection, safe filename handling, configurable size limits, unsupported-format errors, and a structured `requires_ocr` result for scanned or image-only PDFs.

The existing health, domain, file-store, and repository contracts remain stable. Every changed implementation file is under `document_studio/`, and no frontend or AI_Tool runtime file changes.

Claude reports the branch, changed files, commands, results, design decisions, and any environment caveat, then stops for Codex review.

## Verification

Run `python -m pip install -e "document_studio/backend[test]"`, `python -m unittest discover -s document_studio/backend/tests -p "test_*.py"`, and `python -m py_compile` for each changed Python module.

Run `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `git diff --name-only`.

## Owner And Control Return

Codex owns the gate, architecture, contracts, and acceptance decision. Claude is the bounded backend implementation delegate. Control returns to Codex immediately after Claude reports its evidence. Gemini owns all Document Studio frontend work and has no active assignment in this gate.
