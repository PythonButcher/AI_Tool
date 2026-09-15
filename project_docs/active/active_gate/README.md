Goal: Persist immutable ML Studio experiments, restart-safe run state, and integrity-checked server-owned artifacts.

## User Outcome

A developer can create reproducible experiment versions, submit isolated runs safely, recover truthful lifecycle state after restart, cancel eligible work, and verify every managed artifact without relying on process memory or client filesystem paths.

## Scope

**Phase Identity**: `phase-13-ml-studio-foundation`

Implement only the durable experiment, run, and managed-artifact foundation described by Gate 2 in `project_docs/active/ml_studio/README.md`.

**Current Step**: Step 1: Define durable schemas and managed artifact boundaries

**Target Files**: `backend/ml_studio/repository.py`, `backend/ml_studio/artifacts.py`, `project_docs/active/contracts/ml_studio.md`, and `tests/test_ml_studio_persistence.py`

**Step Acceptance**: The storage design defines immutable experiment versions, idempotent run submission, valid lifecycle transitions, cancellation and restart recovery, atomic server-owned artifact writes, integrity hashes, bounded safe paths, and structured failure behavior before persistence implementation begins.

**Step Verification**: `python -m unittest tests.test_ml_studio_persistence`

**Next Step**: Step 2: Implement experiment and run persistence

**Continuation Rule**: Continue automatically while Codex remains the owner and the next step is executable.

**Stop Condition**: Stop only for a concrete blocker, a recorded ownership handoff, a user-requested pause, or the durable-experiments gate acceptance boundary.

- [ ] **Step 1: Define durable schemas and managed artifact boundaries** — [IN PROGRESS]
- [ ] **Step 2: Implement experiment and run persistence** — [PENDING]
- [ ] **Step 3: Implement atomic artifact storage and recovery** — [PENDING]
- [ ] **Step 4: Prove isolation, immutability, idempotency, and resource safety** — [PENDING]
- [ ] **Step 5: Run persistence and regression acceptance** — [PENDING]

Do not modify Flask routes, frontend files, legacy ML services, authentication, deployment, prediction serving, Context Ledger, or process-global model state. Do not deserialize client-supplied estimators or accept client-selected storage paths.

Use local SQLite metadata and one server-owned managed artifact root. Reuse established workflow-run lifecycle patterns where they fit, but keep the ML Studio repository and artifact interfaces framework-independent. Database and artifact mutations must be atomic at their respective boundaries, and cleanup must never escape the managed root.

## Contracts

Use `project_docs/active/contracts/ml_studio.md` for ML Studio identity, experiment, run, evaluation, reviewed-candidate, error, and durability semantics.

Use `project_docs/active/ml_studio/README.md` only for the Phase 13 Gate 2 architecture and acceptance boundary.

## Acceptance

- Experiment identities support immutable, monotonically versioned specifications.
- Run submissions are idempotent for one explicit submission key and cannot cross experiment or snapshot identity.
- Run state transitions are validated, timestamps are truthful, terminal records are immutable, and cancellation is explicit.
- Interrupted non-terminal runs recover to a stable restart state without claiming success.
- Concurrent experiments and runs do not share mutable process state or overwrite each other's metadata.
- Artifacts are written atomically beneath a server-owned root and store content hashes, sizes, media types, and creation metadata.
- Artifact names and resolved paths reject traversal, absolute paths, symlink escapes, and overwrite of immutable completed-run artifacts.
- Client uploads are never deserialized as estimators, and repository responses never expose filesystem paths or artifact bytes.
- Structured errors remain safe, stable, and free of tracebacks, secrets, paths, serialized objects, or raw dataset values.
- Existing ML Studio contract/evaluation and dataset-governance behavior remains stable.

Changed files stay inside `backend/ml_studio/`, focused ML Studio tests, `project_docs/active/contracts/ml_studio.md`, and required gate/status control files.

## Verification

- `python -m unittest tests.test_ml_studio_persistence`
- `python -m unittest tests.test_ml_studio_contracts tests.test_ml_studio_evaluation`
- `python -m unittest tests.test_data_catalog_lineage tests.test_advanced_readiness_service`
- `python -m py_compile` for every changed Python module
- `python .codex/hooks/agent_harness_check.py`
- `python .codex/hooks/check_active_gate.py project_docs/active/active_gate .`
- `git diff --check`
- `git diff --name-only`

## Owner And Control Return

Codex owns the persistence contract, backend architecture, implementation, tests, documentation, and acceptance decision. Antigravity remains blocked until the identity-first ML Studio API is verified and Codex creates one bounded frontend handoff. Control returns at this gate's backend acceptance boundary or on a concrete blocker.
