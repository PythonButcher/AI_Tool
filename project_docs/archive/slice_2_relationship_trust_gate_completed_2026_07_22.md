> COMPLETED REFERENCE ONLY: This backend gate was implemented and verified on 2026-07-22. Do not execute it as a current goal; use `project_docs/active/active_gate/README.md` for current work.

# Governed Relationship Contract and Trust

## Goal

Create a durable, explainable relationship contract for governed workspace sources without executing joins or changing current single-source consumers.

## Delivered Boundary

The backend stores workspace-isolated relationship contracts with stable identities, ordered single or composite field pairs, declared cardinality, future join and filter intent, activation and confirmation state, validation state, aggregate diagnostics, source fingerprints, timestamps, and monotonic versions. Candidate profiling returns inactive evidence-backed proposals. Validation checks membership, field existence, type compatibility, uniqueness, nulls, unmatched keys, declared cardinality, topology, estimated row multiplication, unsupported many-to-many intent, and source staleness.

The implementation remains configuration and trust metadata only. It does not execute joins, change current single-source consumers, add multi-source AI or chart behavior, or add frontend code.

## Verified Evidence

Focused relationship coverage passed for one-to-one, one-to-many, composite keys, missing fields, type mismatch, invalid membership, unmatched keys, null keys, row multiplication, many-to-many blocking, cycles, ambiguous paths, stale sources, workspace isolation, candidates, versioning, deletion, activation, and restart-safe retrieval.

The required source/workspace, governance, and Decision Chat identity regression suites passed. The final contract is `project_docs/active/contracts/multiple_data_source_relationships.md`.

## Original Kickoff Goal

Goal: Implement durable, explainable relationship persistence and validation for governed workspace sources without executing joins or changing current single-source behavior.

Target `backend/db/backend_db.py`, the bounded source/workspace repository and workspace-context modules under `backend/`, new relationship repository, validation service, and route modules under `backend/`, focused tests under `tests/`, and `project_docs/active/contracts/multiple_data_source_relationships.md`.

Persist relationships separately from source files. Each relationship must have a stable ID, workspace ID, left and right source IDs, one or more ordered field pairs, declared cardinality, join behavior, filter direction, active state, validation state, diagnostics, source fingerprints, version, and timestamps. Enforce that both sources belong to the same workspace. Candidate suggestions are evidence-backed proposals only and remain inactive until explicit confirmation.

Validation must check field existence, type compatibility, key uniqueness, null rates, unmatched keys, declared cardinality, cycles, ambiguous active paths, estimated row multiplication, and source fingerprint or schema staleness. Unsupported many-to-many execution must be marked blocked. Do not implement relationship execution, dataframe joins, multi-source AI or chart behavior, frontend code, or changes to any `GEMINI.md` file.
