# Completed Reference — Document Studio Backend Scaffold

This file records an accepted Claude backend assignment. It is historical evidence and is not an active implementation handoff.

Goal: Create the isolated Document Studio backend scaffold, prove directory and file creation permissions, expose the exact health contract, run focused verification, and stop for Codex review.

## Read First

Read `AGENTS.md`, `project_docs/INDEX.md`, `project_docs/active/README.md`, `project_docs/active/status/project_execution_status.md`, `project_docs/active/active_gate/README.md`, `project_docs/active/document_studio/README.md`, and `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`.

## Permission Proof And Stop Rule

Confirm the branch with `git branch --show-current`, inspect `git status --short`, and check whether `document_studio/` exists. Do not overwrite an unexpected existing directory or file.

Attempt to create only the approved directories under `document_studio/`. You may use the normal shell directory-creation command for directories. Use `apply_patch` for every file creation or edit.

If any approved directory or file cannot be created, stop immediately. Report the exact path, command or operation, and error. Do not create the scaffold elsewhere, modify permissions, use a workaround, or touch the existing AI_Tool backend or frontend. The user will create the folders if required.

## Target Files

Create only the minimal files needed within these paths:

- `document_studio/README.md`
- `document_studio/backend/pyproject.toml`
- `document_studio/backend/src/document_studio/__init__.py`
- `document_studio/backend/src/document_studio/api/`
- `document_studio/backend/src/document_studio/application/`
- `document_studio/backend/src/document_studio/domain/`
- `document_studio/backend/src/document_studio/infrastructure/`
- `document_studio/backend/tests/`

Use package `__init__.py` files where Python imports require them. Put the application factory and health route under `api/`. Add one focused health-contract test under `tests/`.

## Required Behavior

Use FastAPI as the standalone API boundary and isolate all FastAPI imports under `document_studio/backend/src/document_studio/api/`. `application/`, `domain/`, and `infrastructure/` are architectural boundaries only in this assignment and must not import FastAPI, Flask, AI_Tool services, or AI_Tool global state.

Expose `GET /health`. It returns HTTP 200 and this exact JSON shape: `{"service":"document-studio","status":"ok","version":"0.1.0"}`.

Make `document_studio/backend` independently installable through `pyproject.toml`. Keep runtime and test dependencies local to that package. Do not modify root or AI_Tool requirements files.

Document the standalone backend setup, test command, application factory, and local run command in `document_studio/README.md`. Keep code readable and add useful comments where architecture or behavior is not obvious.

## Forbidden Scope

Do not implement uploads, parsing, OCR, handwriting recognition, extraction, confidence calculations, persistence, schema discovery, blueprints, exports, Context Ledger integration, or AI_Tool routes.

Do not create `document_studio/web/`. Do not edit anything under `frontend/` or the existing `backend/`. Do not create, edit, move, delete, or repair any `GEMINI.md` file. Do not commit, merge, or push.

## Acceptance And Verification

Run `python -m pip install -e document_studio/backend`.

Run `python -m unittest discover -s document_studio/backend/tests -p "test_*.py"` and prove the health endpoint returns the exact required payload.

Run `python -m py_compile` for each created Python module, `python .codex/hooks/agent_harness_check.py`, `git diff --check`, and `git diff --name-only`.

Your completion report must state the branch, whether directory and file creation succeeded, every changed file, each verification command and result, and any dependency or environment caveat. Stop after the report. Codex performs the acceptance review and decides whether another task is authorized.
