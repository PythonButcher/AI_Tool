# Project Active Gate — Document Studio Scan And Handwriting Processing

Goal: Convert scanned PDF pages into evidence-linked normalized text while reporting handwriting and document-quality trouble honestly.

## User Outcome

Document Studio can process printer scans through a replaceable OCR boundary, preserve recognized text and page coordinates, surface provider confidence, and return a plain structured result when a page needs human help.

## Scope

Work only under `document_studio/`. Add an application-layer OCR provider port, deterministic orchestration, one local baseline OCR infrastructure adapter selected from implementation evidence, document-quality checks, and focused tests.

The OCR result must preserve page number, recognized text, available page coordinates, provider confidence, and whether handwriting was detected or suspected. Quality checks cover unreadable pages, extreme rotation, and empty OCR output. A processing failure that requires human action returns a structured `needs_help` result with a plain reason.

Do not add schema proposals, extracted-field inference, model providers, blueprint selection, exports, destination integrations, batching, watched folders, AI_Tool routes, production deployment behavior, or frontend files.

## Contracts

Use `project_docs/active/document_studio/README.md` for the roadmap, `document_studio/backend/src/document_studio/domain/normalized.py` for normalized documents and source locations, and `document_studio/backend/src/document_studio/application/ingestion.py` for the ingestion boundary.

Application code may depend on portable domain contracts and OCR ports but not a concrete OCR library, web framework, filesystem path supplied by a client, SQLite implementation, or AI_Tool state. Parser and OCR-library imports remain inside infrastructure adapters.

Use `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` for ownership boundaries.

## Acceptance

Deterministic unit tests use a fake OCR provider to prove application behavior without network access, model keys, production paths, or installed OCR executables.

At least one printer-scan fixture and one handwriting fixture exercise the selected local adapter in explicitly marked integration tests. Tests prove recognized text, available page coordinates, provider confidence, handwriting detection or suspicion, unreadable-page handling, extreme-rotation handling, empty-output handling, and the structured `needs_help` result.

Existing health, domain, file-store, repository, normalization, and ingestion tests remain stable. Every implementation change stays under `document_studio/`; no frontend or AI_Tool runtime file changes.

## Verification

Run `python -m pip install -e "document_studio/backend[test]"`, the focused OCR unit tests, explicitly marked local-adapter integration tests, and `python -m unittest discover -s document_studio/backend/tests -p "test_*.py"`.

Run `python -m py_compile` for every changed Python module, `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `git diff --name-only`.

## Owner And Control Return

Codex owns implementation, architecture, contracts, verification, and the acceptance decision. Gemini owns all Document Studio frontend work and has no active assignment in this gate.
