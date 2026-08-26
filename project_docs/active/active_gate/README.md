# Project Active Gate — Document Studio Standalone Ingestion API

Goal: Expose verified PDF, DOCX, and XLSX byte ingestion through one stable standalone HTTP endpoint that Gemini can use for the upload experience.

## User Outcome

A user can upload a supported document to the standalone Document Studio backend and receive either normalized preview content or a clear `requires_ocr` result without supplying a filesystem path.

## Scope

Work only under `document_studio/`. Add `POST /documents/ingest` to the standalone FastAPI application. Accept one multipart file whose bytes, original filename, and declared media type are passed to the existing `IngestionService`. The server owns the configurable maximum upload size.

Return the existing JSON-compatible `IngestionResult.to_dict()` contract unchanged. A successful digital document returns `outcome: "success"` with `document`; an image-only PDF returns `outcome: "requires_ocr"` with `requires_ocr_reason`.

Map empty input, unsafe filename, unsupported format, and media-type mismatch errors to stable client-error responses. Map an oversized upload to HTTP 413. Do not expose parser tracebacks or accept a client-supplied filesystem path.

Do not add OCR execution, handwriting processing, schema discovery, extracted-field inference, persistence orchestration, AI_Tool routes, authentication, production deployment behavior, or frontend files.

## Contracts

Use `document_studio/backend/src/document_studio/application/ingestion.py` for validation errors and the ingestion port, `document_studio/backend/src/document_studio/infrastructure/ingestion_service.py` for byte normalization, and `document_studio/backend/src/document_studio/domain/normalized.py` for the response contract.

Keep FastAPI, multipart, and HTTP error mapping inside `document_studio/backend/src/document_studio/api/`. Domain and application modules must not import web-framework types.

Use `project_docs/active/document_studio/README.md` for sequencing and `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md` for ownership boundaries.

## Acceptance

Focused API tests prove successful PDF, DOCX, and XLSX upload responses, normalized preview structure, the scanned-PDF `requires_ocr` response, filename and media-type validation, unsupported content, empty uploads, configurable size enforcement with HTTP 413, and absence of filesystem-path input.

The application factory registers the route without changing `GET /health`. Existing health, domain, file-store, repository, normalization, and ingestion tests remain stable. Every implementation change stays under `document_studio/`; no frontend or AI_Tool runtime file changes.

## Verification

Run `python -m pip install -e "document_studio/backend[test]"`, the focused ingestion API tests, and `python -m unittest discover -s document_studio/backend/tests -p "test_*.py"`.

Run `python -m py_compile` for every changed Python module, `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `git diff --name-only`.

## Owner And Control Return

Codex owns implementation, architecture, the HTTP contract, verification, and the acceptance decision. After Codex accepts this gate, Gemini receives one bounded handoff for the standalone React shell and upload experience. Gemini does not begin before that handoff exists.
