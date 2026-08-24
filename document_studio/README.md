# Document Studio

A standalone document-processing backend that accepts PDFs, Word documents,
spreadsheets, and scanned documents; extracts structured information; reports
honest confidence; and preserves evidence showing where each value came from.

## Architecture

```text
document_studio/
  README.md                          ← you are here
  backend/
    pyproject.toml                   ← package definition and dependencies
    src/
      document_studio/
        __init__.py                  ← package root with version constant
        api/                         ← HTTP contract (FastAPI); only layer that imports the framework
          __init__.py
          app.py                     ← application factory: create_app()
          health.py                  ← GET /health route
        application/                 ← use-case coordination (framework-agnostic)
          __init__.py
          ports.py                   ← FileStore and DocumentRepository ABCs
        domain/                      ← portable document and extraction objects (framework-agnostic)
          __init__.py
          records.py                 ← frozen dataclasses, enums, and serialization
        infrastructure/              ← file, database, parser, OCR, and model adapters (framework-agnostic)
          __init__.py
          local_file_store.py        ← SHA-256 managed local file storage
          sqlite_repository.py       ← SQLite metadata repository
    tests/
      __init__.py
      test_health.py                 ← health endpoint contract test
      test_domain.py                 ← domain validation and serialization tests
      test_local_file_store.py       ← file store hashing, containment, idempotency tests
      test_sqlite_repository.py      ← repository round-trip and persistence tests
```

### Layer Rules

| Layer            | May Import                        | Must Not Import                          |
| ---------------- | --------------------------------- | ---------------------------------------- |
| `api/`           | FastAPI, `application`, `domain`  | `infrastructure` internals directly      |
| `application/`   | `domain`                          | FastAPI, Flask, AI_Tool state             |
| `domain/`        | Python stdlib only                | FastAPI, Flask, AI_Tool state, SQLAlchemy |
| `infrastructure/`| `domain`, third-party adapters    | FastAPI, Flask, AI_Tool state             |

## Local Record Boundary

Document Studio uses portable domain contracts, managed local file storage, and
a SQLite metadata repository to track documents and extraction results.

**Domain contracts** (`domain/records.py`) define frozen standard-library
dataclasses for documents, document versions, processing runs, extracted fields,
evidence locations, confidence signals, review states, blueprints, and blueprint
field definitions.  All records use UUID identities, timezone-aware UTC
timestamps, and enums.  Each record provides a `to_dict()` method that produces
a JSON-compatible dictionary.

**Managed file storage** (`infrastructure/local_file_store.py`) accepts raw
bytes, computes a lowercase SHA-256 content hash, and writes under a configured
storage root with hash-based directory fan-out.  The caller never controls the
destination path.  Saving identical bytes is idempotent.

**SQLite metadata repository** (`infrastructure/sqlite_repository.py`) persists
documents, versions, processing runs (with nested evidence and confidence), and
blueprints using parameterized SQL, foreign keys, and explicit transactions.
Duplicate content registration returns the existing document.  Versions are
sequentially numbered per document.  Processing runs and blueprints are
append-only records.

## Setup

```bash
# From the repository root — includes test dependencies
python -m pip install -e "document_studio/backend[test]"
```

## Running Tests

```bash
python -m unittest discover -s document_studio/backend/tests -p "test_*.py"
```

## Running the Server Locally

```bash
uvicorn document_studio.api.app:create_app --factory --host 127.0.0.1 --port 8100
```

Then visit `http://127.0.0.1:8100/health` to confirm the service is alive.

## Health Contract

`GET /health` returns HTTP 200 with:

```json
{"service": "document-studio", "status": "ok", "version": "0.1.0"}
```
