Goal: Define versioned ML Studio preparation-assessment and transformation-recipe contracts that bind readiness to one exact dataset snapshot and experiment specification.

## User Outcome

Give ML Studio a trustworthy server-owned explanation of whether a selected dataset and experiment can proceed, which issues block progress, and which supported fixes may be sent to the existing Power Query cleaning workflow.

## Scope

**Phase Identity**: `phase-13-ml-studio-foundation`

**Roadmap Gate**: Gate 5 — Power Query Gateway And Guided Experiment Builder

**Current Step**: Step 1: Define preparation assessment and recipe lineage contracts

**Target Files**: `backend/ml_studio/contracts.py`, `backend/ml_studio/__init__.py` only if public exports are required, `tests/test_ml_studio_contracts.py`, `project_docs/active/contracts/ml_studio.md`, and the active status files authorized for this phase.

**Step Acceptance**: Codex defines immutable, finite-JSON contract objects for the server-issued preparation assessment, structured preparation issues, suggested fixes, and transformation-recipe lineage. Every assessment binds to the full `DatasetSnapshotIdentity` and one exact `ExperimentSpecification`; no browser rows, local readiness flag, path, or mutable Power Query state may establish readiness.

**Step Verification**: `python -m unittest tests.test_ml_studio_contracts`, `python -m py_compile backend/ml_studio/contracts.py tests/test_ml_studio_contracts.py`, and the repository documentation checks.

**Next Step**: Step 2: Implement the server assessment service and versioned API

**Continuation Rule**: `WAIT_FOR_USER` until the user explicitly starts this prepared gate. Once started, Codex owns the backend steps and uses `CONTINUE` until backend verification is complete or a concrete blocker is reached.

**Stop Condition**: Stop before source implementation without explicit start authorization; after start, stop for a contract conflict, required scope outside the authorization record, backend verification failure, frontend ownership handoff, user pause, or the gate acceptance boundary.

- [ ] **Step 1: Define preparation assessment and recipe lineage contracts** — [IN PROGRESS]
- [ ] **Step 2: Implement the server assessment service and versioned API** — [PENDING]
- [ ] **Step 3: Verify backend readiness and create one bounded frontend handoff** — [PENDING]
- [ ] **Step 4: Review the returned Power Query and guided-builder integration** — [PENDING]

Do not add training execution, run polling, comparison, candidate review, exports, deployment, Context Ledger behavior, or frontend code during the backend steps. Do not duplicate the cleaning engine or preserve the legacy browser-owned `ready` flag as contract truth.

## Contracts

Update `project_docs/active/contracts/ml_studio.md` as the durable authority. The contract step must define these exact boundaries:

- A preparation assessment has a server-issued identity, assessed time, state, full dataset snapshot identity, exact experiment specification, ordered issues, ordered suggested fixes, and an input fingerprint that changes when any bound snapshot, recipe, or specification identity changes.
- A preparation issue has a stable code, `blocking`, `warning`, or `info` severity, safe message, optional affected field, and safe remediation.
- A suggested fix has a stable fix identity, existing Power Query action type, ordered affected columns, finite JSON parameters, reason, and explicit `supported` or `unsupported` status with an explanation. Unsupported actions remain visible and cannot be silently applied.
- Transformation-recipe lineage identifies the workspace, base snapshot and recipe hash, recipe version, ordered cleaning steps, canonical recipe hash, creation time, and optional creating actor without storing raw dataset rows or client filesystem paths.
- Contract validation rejects unknown fields, contradictory identities, duplicate issue or fix identities, non-finite JSON, unsafe error text, unsupported severity or state values, and recipes whose canonical hash does not match their ordered content.

The existing `backend/routes/ml_prep.py` readiness response is compatibility evidence only. It accepts browser-supplied datasets and emits an ephemeral `ready` boolean, so it must not become the new ML Studio truth boundary. The existing `ManualCleaningEngine` remains the sole cleaning executor; Gate 5 contracts describe proposed steps but do not reimplement cleaning.

## Acceptance

- Preparation truth is immutable and server-issued for one exact snapshot/specification pair.
- Snapshot, experiment, recipe, and assessment identities are explicit and JSON-safe.
- Stale assessment detection is possible from the bound input fingerprint and exact identities.
- Suggested fixes distinguish supported from unsupported Power Query actions without silently discarding either.
- Recipe lineage preserves ordered steps and a deterministic canonical hash without raw rows or paths.
- Focused tests cover valid round trips, immutability, stale or contradictory identity, duplicate identifiers, unsupported fixes, unsafe content, and non-finite values.
- No route, service, persistence, frontend, training, or cleaning-engine behavior is added in Step 1.

## Verification

- `python -m unittest tests.test_ml_studio_contracts`
- `python -m py_compile backend/ml_studio/contracts.py tests/test_ml_studio_contracts.py`
- `python .codex/hooks/agent_harness_check.py`
- `python .codex/hooks/check_active_gate.py project_docs/active/active_gate .`
- `python C:/Users/18022/.codex/skills/active-gate-governance/scripts/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`
- `git diff --name-only`

## Owner And Control Return

The user owns the start decision for this prepared gate. After explicit start authorization, Codex owns the backend contract, service, API, tests, and documentation work. Antigravity may receive one bounded frontend handoff only after Codex verifies backend readiness. The user retains final browser acceptance.
