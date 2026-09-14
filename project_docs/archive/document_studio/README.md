# Retired Direction — Standalone Document Studio

Status: Retired from active AI Tool product scope on September 13, 2026.

## Decision

Document Studio will not continue as a standalone application inside AI Tool. Its planned ownership of document ingestion, persistence, processing, evidence, review, and reusable blueprints overlaps with Context Ledger, so continuing both directions would create competing architecture and product boundaries.

Stopping the standalone product does not reject the technical quality of the prototype. The preserved branch contains useful PDF, DOCX, and XLSX normalization, validation, and tests that may inform future work.

The prototype remains preserved on the `codex/standalone-ingestion-api` branch. This retirement made no changes to, and did not relocate, merge, delete, or continue implementing, anything under `document_studio/`.

Possible reuse by Context Ledger requires a separate future architecture decision. Such reuse is not authorized by this retirement task, and this record must not be treated as permission to integrate, copy, or continue the prototype.

## Preserved Planning Records

- `project_docs/archive/document_studio/standalone_product_roadmap_retired_2026_09_13.md`
- `project_docs/archive/document_studio/standalone_ingestion_api_gate_retired_2026_09_13.md`

