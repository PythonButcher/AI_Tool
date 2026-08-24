Goal: Add portable Document Studio domain contracts, managed local file storage, and SQLite metadata repositories with deterministic tests, then stop for Codex review.

## REPAIR REQUIRED

### Repair Blocker

`document_studio/backend/src/document_studio/domain/records.py` lines 237, 281, 319, and 390 only reject naive datetimes. They accept timezone-aware values with non-UTC offsets, even though the contract requires every `created_at` value to be UTC. A direct construction with `timezone(timedelta(hours=5))` succeeds and serializes as `2026-01-01T00:00:00+05:00`.

Add one shared domain validation helper that requires a timezone-aware datetime whose UTC offset is exactly zero, and apply it to `Document`, `DocumentVersion`, `ProcessingRun`, and `DocumentBlueprint`. Add focused tests proving that naive timestamps and nonzero offsets are rejected while `timezone.utc` timestamps remain valid and serialize with a UTC offset. Do not broaden the repair beyond this timestamp contract. Run the full handoff verification and stop for Codex re-review.

## Read First

Read `AGENTS.md`, `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/project_execution_status.md`, `project_docs/active/active_gate/README.md`, `project_docs/active/document_studio/README.md`, and `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`.

Inspect the current files under `document_studio/backend/` before editing. Do not infer requirements from archived handoffs.

## Target Files

Work only inside `document_studio/` and limit the implementation to these areas:

- `document_studio/README.md`
- `document_studio/backend/pyproject.toml` only if a package-local test or runtime dependency needs correction
- `document_studio/backend/src/document_studio/domain/`
- `document_studio/backend/src/document_studio/application/`
- `document_studio/backend/src/document_studio/infrastructure/`
- `document_studio/backend/tests/`

Do not change the health endpoint unless a test-only import adjustment is required. Do not add a document HTTP endpoint in this assignment.

## Domain Contract

Use frozen standard-library dataclasses and enums in `domain/`; do not import FastAPI, Flask, Pydantic, SQLAlchemy, or AI_Tool modules there.

Define portable records for a document, document version, processing run, extracted field, evidence location, confidence signal, review state, blueprint field definition, and document blueprint. Use UUID values for identities and timezone-aware UTC datetimes for timestamps.

A document records its content hash, original filename, media type, and creation time. A version records its parent document, positive version number, content hash, managed storage key, byte size, and creation time. A processing run records its document version, optional blueprint identity, processing status, extracted fields, and creation time.

An extracted field must preserve `field_name`, `raw_text`, `normalized_value`, `value_type`, evidence locations, separate confidence signals, and review state. Confidence signals must identify `ocr`, `extraction`, or `validation`, enforce a score from zero through one, name their source, and allow a plain reason.

Evidence must support page-based documents and spreadsheets. It may carry a positive page number, text-span start and end, a bounding polygon, a sheet name, and a cell range. Validation must reject an evidence record with no usable source location, invalid ranges, or an incomplete text span.

Blueprints are versioned and immutable. They contain a name, positive version number, field definitions, and creation time. Field definitions preserve a stable field name, value type, whether the field is required, and optional validation guidance.

Public serialization must produce JSON-compatible dictionaries with UUIDs and enums as strings, UTC timestamps in ISO 8601 form, tuples as arrays, and no unserializable Python objects.

## Application And Storage Boundaries

Define repository and file-store interfaces under `application/`. Application ports may import domain objects but must not import SQLite, filesystem implementations, FastAPI, Flask, or AI_Tool state.

Implement a managed local file store under `infrastructure/`. It accepts server-received bytes, calculates a lowercase SHA-256 content hash, writes beneath a configured storage root, and returns a storage key that cannot escape that root. The caller must not supply or control a destination path. Saving identical bytes must be idempotent.

Implement a SQLite metadata repository under `infrastructure/` using the Python standard library. The repository owns schema initialization and persists documents, versions, processing runs, and blueprints. It must reconstruct the domain records without losing types or nested evidence and confidence data.

Duplicate content registration must return the existing document instead of silently creating another document. Creating a new version uses the next positive version number for that document. Processing runs and blueprints are append-only records; creation must not overwrite an existing identity.

Use parameterized SQL, explicit transactions, foreign keys, and caller-supplied database and storage roots so tests never write to production or AI_Tool locations.

## Required Tests

Use temporary directories and focused `unittest` coverage. Prove domain validation, JSON-compatible serialization, content hashing, path containment, idempotent file storage, duplicate-document detection, sequential document versions, processing-run round trips, blueprint round trips, append-only identity conflicts, and repository restart persistence.

Retain the health-contract tests. Tests must not require network calls, model API keys, or the running server.

Update `document_studio/README.md` with the local record boundary and the correct clean-environment test installation command using the package's test extra.

## Forbidden Scope

Do not add uploads, parsing, OCR, handwriting processing, schema discovery, model providers, extraction orchestration, export destinations, batching, Context Ledger integration, or AI_Tool routes.

Do not create or edit `document_studio/web/`, `frontend/`, or the existing `backend/`. Do not create, edit, move, delete, or repair any `GEMINI.md` file. Do not commit, merge, or push.

## Verification And Control Return

Run `python -m pip install -e "document_studio/backend[test]"` and `python -m unittest discover -s document_studio/backend/tests -p "test_*.py"`.

Run `python -m py_compile` for every changed Python module, `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `git diff --name-only`.

Report the branch, every changed file, each command and result, domain or storage decisions that affect later chunks, and any environment caveat. Stop after the report. Codex owns the acceptance decision and must review this work before another assignment begins.
