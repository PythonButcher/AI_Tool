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
        domain/                      ← portable document and extraction objects (framework-agnostic)
          __init__.py
        infrastructure/              ← file, database, parser, OCR, and model adapters (framework-agnostic)
          __init__.py
    tests/
      __init__.py
      test_health.py                 ← health endpoint contract test
```

### Layer Rules

| Layer            | May Import                        | Must Not Import                          |
| ---------------- | --------------------------------- | ---------------------------------------- |
| `api/`           | FastAPI, `application`, `domain`  | `infrastructure` internals directly      |
| `application/`   | `domain`                          | FastAPI, Flask, AI_Tool state             |
| `domain/`        | Python stdlib only                | FastAPI, Flask, AI_Tool state, SQLAlchemy |
| `infrastructure/`| `domain`, third-party adapters    | FastAPI, Flask, AI_Tool state             |

## Setup

```bash
# From the repository root
python -m pip install -e document_studio/backend
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
