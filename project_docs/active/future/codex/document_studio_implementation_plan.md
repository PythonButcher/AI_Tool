# Document Studio Implementation Plan

## Status

This is a deferred plan for user review. It is not an active implementation gate and does not authorize Claude, Gemini, Codex, or another agent to begin implementation. After user approval, Codex will activate only the first backend chunk through the project active gate.

## Product Outcome

Build Document Studio as a separately runnable document-processing product inside the AI_Tool repository. Its backend must accept PDFs, Word documents, spreadsheets, and scanned documents; extract useful structured information; report honest confidence and processing trouble; and preserve simple evidence showing where each value came from.

The product must remain portable. AI_Tool, a future standalone desktop or web application, and future platforms must consume the same backend contracts without moving document logic into AI_Tool-specific global state.

## Architecture Boundary

The initial standalone backend belongs under `document_studio/`. It must not be placed inside `backend/` or `frontend/frontend/src/`, because those locations would couple it to the current AI_Tool application.

The intended backend structure is:

```text
document_studio/
  README.md
  backend/
    pyproject.toml
    src/
      document_studio/
        __init__.py
        api/
        application/
        domain/
        infrastructure/
    tests/
```

The future React application will live under `document_studio/web/`, but Claude must not create that directory or any frontend source. Gemini owns all frontend scaffolding and implementation after Codex verifies a stable backend contract.

The backend layers have simple responsibilities. `domain/` defines portable document and extraction objects. `application/` coordinates use cases without knowing Flask, FastAPI, SQLite, or a specific OCR vendor. `infrastructure/` contains file, database, parser, OCR, and model adapters. `api/` exposes the standalone HTTP contract.

## Ownership And Control Loop

Codex remains lead orchestrator, backend truth owner, contract owner, and reviewer. Claude is a bounded backend implementation delegate. Claude implements exactly one approved chunk, runs its checks, reports changed files and command evidence, and stops. Codex then reviews the source and verification evidence before accepting the chunk or issuing a narrow repair task.

Gemini is the exclusive frontend implementer. Gemini receives one bounded frontend handoff at a time only after Codex verifies the backend endpoint and payload contract needed by that UI behavior. Gemini stops after each handoff and returns source and build evidence to Codex. The user performs final browser acceptance only after Codex accepts the returned implementation.

Claude and Codex must never create, edit, move, delete, or repair a `GEMINI.md` file. Claude must not edit `frontend/frontend/src/` or create `document_studio/web/`. Gemini must not invent backend fields, persistence behavior, or extraction rules.

## Chunk 1 — Backend Scaffold And Permission Proof

The first assignment is intentionally limited to file structure, package setup, a health endpoint, and tests. It must not include document parsing, OCR, schema discovery, database work, AI integration, or frontend work.

Before creating anything, Claude must confirm the current branch, inspect `git status --short`, and verify that `document_studio/` does not already exist. Claude must then attempt to create only the approved backend directories inside `document_studio/`. Directory creation may use the environment's normal directory command, but every file must be created with `apply_patch`.

If directory or file creation is denied, Claude must stop immediately and report the exact failed path and error. Claude must not work around the restriction, write elsewhere, or modify the existing AI_Tool backend. The user will create the folders if necessary.

If creation succeeds, Claude adds the minimal package files, a framework application factory, `GET /health`, and focused tests proving that the package imports and the health endpoint returns a stable response. The API framework choice must remain isolated inside `api/`; domain and application modules must not import the framework.

Acceptance requires the expected directory tree to exist, a clean package import, a passing health test, no edits outside `document_studio/`, and a Claude report containing the branch name, changed-file list, verification commands, and results. Control then returns to Codex for review.

## Chunk 2 — Document Contracts And Local Records

Define the durable backend objects before adding parsers. The first contract set covers a document, document version, processing run, extracted field, evidence location, confidence details, review state, and reusable document blueprint.

Each extracted field must distinguish its raw text from its normalized value. Evidence must support a page number and either a text span or page coordinates. Confidence must retain its source instead of pretending that OCR confidence, extraction confidence, and validation confidence are the same number.

Add a repository interface and a local SQLite implementation for metadata. Original files remain in a managed local storage directory and are identified by a content hash. Tests must prove duplicate detection, version creation, immutable processing runs, and clean serialization of the public contract. No Context Ledger or production database connector belongs in this chunk.

## Chunk 3 — File Ingestion And Normalized Documents

Add format-specific ingestion adapters for digital PDFs, DOCX files, and XLSX files. These adapters convert different formats into one normalized document representation containing pages or sheets, text blocks, tables or cells, and available source locations.

Spreadsheets must be read as workbook structure rather than converted to images. Digital PDFs should use embedded text when available. A scanned PDF must be detected honestly and returned as requiring OCR until the next chunk is available.

Tests use small controlled fixtures and prove correct format detection, useful normalization, unsupported-file errors, safe filename handling, size limits, and no reliance on a client-supplied filesystem path.

## Chunk 4 — Scan And Handwriting Processing

Introduce an OCR provider interface and one local baseline adapter selected from evidence gathered during implementation. The adapter must return recognized text, page coordinates when available, provider confidence, and whether handwriting was detected or suspected.

Document quality checks should identify obvious problems such as an unreadable page, extreme rotation, or an empty OCR result. The API must return a structured `needs_help` result with a plain reason instead of silently inventing content or returning only a generic server error.

Tests must separate provider behavior from application behavior by using a deterministic fake OCR provider. At least one printer-scan fixture and one handwriting fixture should exercise the real adapter in an explicitly marked integration test.

## Chunk 5 — Schema Proposal And Evidence-Linked Extraction

Add a schema-proposal service for unfamiliar documents. The service suggests field names and types from the normalized document but does not save a reusable blueprint until a user approves it.

Extraction must return structured fields linked to source evidence. A model or provider adapter may propose results, but application code validates types, preserves raw values, rejects unsupported output, and marks uncertain fields for review. Automated tests use a fake provider so the suite remains repeatable and does not spend API credits.

This chunk is complete when an unfamiliar test document produces a proposed schema, evidence-linked fields, clear confidence details, and an honest review state through the standalone API.

## Chunk 6 — Corrections And Reusable Blueprints

Allow a reviewed schema and corrected fields to become a versioned document blueprint. A blueprint stores how a document family is recognized, its approved fields, validation rules, and extraction configuration. It must not modify the original document or overwrite the original processing result.

When a similar document is uploaded, the backend should select the matching blueprint or report that the match is uncertain. Tests must prove the teaching loop: process an unfamiliar document, approve or correct it, save the blueprint, then process a second similar document with the approved schema.

## Chunk 7 — Portable Exports And Destination Boundary

Add JSON and CSV export for reviewed results. Define a destination interface that can later support AI_Tool datasets, databases, webhooks, or the Context Ledger without placing those integrations in the core engine.

The exported result must retain document identity, blueprint version, normalized fields, confidence, review state, and evidence references. No Context Ledger write, database-specific mapping UI, batching, watched folder, or production deployment work belongs here.

## Chunk 8 — AI_Tool Backend Adapter

Only after the standalone backend and contracts pass Codex review, add a thin AI_Tool adapter. The adapter may expose Document Studio through the existing Flask application, but it must call the standalone application boundary rather than copy extraction logic into AI_Tool services or global state.

Claude may implement this backend adapter from a separate bounded assignment. Codex must first name the exact standalone endpoints or application services, request fields, response fields, compatibility rules, and affected AI_Tool files. Existing dataset upload behavior must remain unchanged.

## Gemini Frontend Sequence

Gemini begins only after the required backend behavior is verified. The frontend work will be split into separate handoffs rather than one large assignment.

The first handoff creates the standalone Document Studio React shell and upload experience under `document_studio/web/`, using AI_Tool's shared visual language without copying backend logic. The next handoff adds the document viewer, extracted-field panel, evidence highlighting, and the honest trouble message. A later handoff adds schema approval, corrections, blueprint reuse, and JSON or CSV export. AI_Tool window integration comes last and consumes the already verified adapter.

Each Gemini handoff names a limited file set and one visible behavior. Gemini runs the relevant build and returns control to Codex. Codex performs a targeted contract and source review before the next frontend handoff is issued.

## Verification After Every Claude Chunk

Claude must run the narrowest chunk-specific tests, Python compilation for changed modules, and `git diff --check`. Claude must also report `git diff --name-only` so Codex can verify that ownership and scope boundaries were respected.

Codex reviews every returned chunk before more work is assigned. A failing test, undocumented contract change, edit outside the approved files, frontend modification, hidden dependency on AI_Tool state, or unexplained generated file blocks acceptance. Repair work remains a bounded continuation of the same chunk.

Repository documentation checks are run when the active gate, status, navigation, contracts, or handoffs change. Frontend completion additionally requires the repository harness check and the relevant Gemini-reported build before Codex can accept it.

## Explicitly Deferred

The first delivery does not include batching, watched printer folders, production authentication, tenant isolation, cloud deployment, Context Ledger writes, arbitrary database delivery, custom model training, or a claim of universal document accuracy. These remain future capabilities after the single-document workflow is trustworthy.

## Promotion Rule

After the user approves this plan, Codex will use the repository gate-governance process to replace the idle active gate with one clean goal for Chunk 1 and update the current status. Claude will receive only that bounded scaffold assignment. No later chunk becomes active until Codex has reviewed and accepted the current chunk.
