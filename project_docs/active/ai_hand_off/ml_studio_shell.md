# ML Studio Destination And Shell — Antigravity Frontend Handoff

Goal: Add ML Studio as a first-class application destination and render its non-training Experiment Workbench shell with truthful workspace identity and durable run-list states.

## Readiness Evidence

**Frontend Readiness**: `backend_contract_ready`

The identity-first API is registered at `/api/ml-studio/v1` in `backend/routes/ml_studio.py`. `tests/test_ml_studio_api.py` proves durable run submission, retrieval, cancellation, stable structured errors, and blueprint registration. The verified backend suite passed 56 ML Studio tests with one Windows symlink-permission skip on 2026-09-17. `project_docs/active/contracts/ml_studio.md` is the contract authority.

This shell may read the durable run collection. It must not create snapshots, experiments, runs, comparisons, evaluations, or candidates. Gate 5 will define the server-issued preparation assessment; this assignment must not invent that API or describe local UI state as server-approved training readiness.

## Required Context

- Active gate: `project_docs/active/active_gate/README.md`
- Execution status: `project_docs/active/status/project_execution_status.md`
- Authorization record: `project_docs/active/status/phase_authorization.json`
- Frontend guardrail: `project_docs/active/rules/CODEX_FRONTEND_GUARDRAIL_READ_FIRST.md`
- Contract: `project_docs/active/contracts/ml_studio.md`
- Roadmap shell boundary: `project_docs/active/ml_studio/README.md`, Gate 4 only
- Source evidence: `backend/routes/ml_studio.py`, `backend/ml_studio/repository.py`, `tests/test_ml_studio_api.py`, `frontend/frontend/src/context/DataContext.jsx`

Before changing source, run `python .gemini/skills/status-tracker-skill/scripts/update_status.py check`.

## Scope And Target Files

This handoff covers one visible behavior: selecting **ML Studio** from the existing rail opens a native, non-training Experiment Workbench shell. The shell has the Run Ribbon, Asset Rail, blank Experiment Canvas, Evidence Inspector, and Run Dock. Its only network boundary is the durable run-list read.

Target files:

- `frontend/frontend/src/components/layout/SideBar.jsx`
- `frontend/frontend/src/components/layout/CanvasContainer.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.jsx`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.css`
- `frontend/frontend/src/features/ml_studio/MLStudioShell.test.jsx`

Do not modify `App.jsx`; the existing destination selector accepts the rail's string identity and its default branch already closes unrelated destination workflow state. Do not change `SideBar.css`, `CanvasContainer.css`, `DestinationHome.jsx`, `DataContext.jsx`, or package files unless a concrete source blocker makes the authorized solution impossible. If that happens, stop and return the exact blocker to Codex.

Excluded files and behavior:

- Backend, contracts, authorization, active gate, execution status, readiness truth, persistence, and browser acceptance.
- Snapshot creation, preparation assessment, experiment forms, feature selection, validation controls, candidate controls, run submission, polling, cancellation, comparison, exports, deployment, or Context Ledger.
- The legacy `MachineLearningPanel`, ML Prep, AutoML, and training routes.
- Broad navigation, canvas, data-pane, or design-system refactors.

## Proven API Contract

The only allowed request is `GET /api/ml-studio/v1/runs?limit=20`. It has no request body or required header. The server accepts integer limits from 1 through 500 and returns newest runs first.

- Success: `200` with `{ "runs": MLStudioRun[] }`.
- Validation error: `400` with `{ "error": StructuredError }` when `limit` is invalid.
- Unexpected error: `500` with `{ "error": { "code": "ml_studio_internal_error", "message": "ML Studio could not complete the request.", "remediation": "Retry the request or inspect server health." } }`.

Use `process.env.REACT_APP_API_URL || 'http://localhost:5000'`, matching the existing frontend convention. Parse JSON when possible. On a non-OK response, show the safe server `message` and `remediation`; use a concise generic fallback if the response is not valid JSON. A user retry starts a fresh request. Guard against stale or post-unmount responses with a fetch sequence or equivalent cancellation mechanism.

Copy-ready types for this boundary:

```ts
type RunStatus = 'queued' | 'running' | 'cancel_requested' | 'completed' | 'failed' | 'cancelled' | 'interrupted';

interface StructuredError { code: string; message: string; remediation: string; }
interface SourceFingerprint { source_id: string; content_fingerprint: string; schema_version: number; }
interface ColumnProfile { name: string; logical_type: 'numeric' | 'categorical' | 'boolean' | 'datetime' | 'text'; null_count: number; distinct_count: number; }
interface DatasetSnapshotIdentity {
  contract_version: 'ml_studio_contract_v1'; snapshot_id: string; workspace_id: string;
  workspace_version: number; source_ids: string[]; relationship_ids: string[];
  source_fingerprints: SourceFingerprint[]; schema_version: number; semantic_model_version: string;
  governance_result: Record<string, unknown>; transformation_recipe_hash: string; row_count: number;
  column_profile: ColumnProfile[]; created_at: string; created_by: string | null;
}
interface RunSpecification {
  contract_version: 'ml_studio_contract_v1'; run_id: string; experiment_id: string;
  specification_version: number; dataset_snapshot: DatasetSnapshotIdentity; submitted_at: string;
  parameters: Record<string, unknown>; environment: Record<string, string>; code_revision: string;
}
interface MLStudioRun {
  run_id: string; experiment_id: string; specification_version: number; snapshot_id: string;
  status: RunStatus; progress_stage: string | null; submitted_at: string; started_at: string | null;
  finished_at: string | null; updated_at: string; warnings: string[]; run_specification: RunSpecification;
  evaluation_result?: Record<string, unknown>; failure?: StructuredError;
}
interface RunListSuccess { runs: MLStudioRun[]; }
interface ErrorResponse { error: StructuredError; }
```

The UI may display `run_id`, `experiment_id`, `specification_version`, `snapshot_id`, `status`, `progress_stage`, `submitted_at`, and safe `failure` text. It must not derive permissions, production status, deployment readiness, or training authorization from these fields.

## Representative JSON Fixtures

Populated success:

```json
{
  "runs": [{
    "run_id": "run-01jmlstudio001", "experiment_id": "experiment-churn", "specification_version": 1,
    "snapshot_id": "snapshot-workspace-3", "status": "completed", "progress_stage": "evaluation_complete",
    "submitted_at": "2026-09-17T14:20:00+00:00", "started_at": "2026-09-17T14:20:02+00:00",
    "finished_at": "2026-09-17T14:20:21+00:00", "updated_at": "2026-09-17T14:20:21+00:00", "warnings": [],
    "run_specification": {
      "contract_version": "ml_studio_contract_v1", "run_id": "run-01jmlstudio001",
      "experiment_id": "experiment-churn", "specification_version": 1,
      "dataset_snapshot": {
        "contract_version": "ml_studio_contract_v1", "snapshot_id": "snapshot-workspace-3",
        "workspace_id": "workspace-sales", "workspace_version": 3, "source_ids": ["source-customers"],
        "relationship_ids": [], "source_fingerprints": [{"source_id": "source-customers", "content_fingerprint": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "schema_version": 2}],
        "schema_version": 2, "semantic_model_version": "semantic-v4", "governance_result": {"status": "ready"},
        "transformation_recipe_hash": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "row_count": 1250, "column_profile": [{"name": "churned", "logical_type": "categorical", "null_count": 0, "distinct_count": 2}],
        "created_at": "2026-09-17T14:19:50+00:00", "created_by": null
      },
      "submitted_at": "2026-09-17T14:20:00+00:00", "parameters": {},
      "environment": {"python": "3.11", "scikit-learn": "1.5"}, "code_revision": "abcdef1234567"
    },
    "evaluation_result": {"truth_boundary": "evaluated_experiment"}
  }]
}
```

Empty success: `{"runs": []}`

Safe validation error: `{"error":{"code":"invalid_limit","message":"Run list limit is invalid.","remediation":"Use an integer from 1 to 500."}}`

Safe server error: `{"error":{"code":"ml_studio_internal_error","message":"ML Studio could not complete the request.","remediation":"Retry the request or inspect server health."}}`

## Required UI States

Use one full-canvas shell with five coordinated regions:

- Top: ordered Run Ribbon with `Data Snapshot`, `Goal`, `Features`, `Validation`, `Candidates`, `Evidence`, and `Candidate`. Only Data Snapshot may appear current; later stages are visibly inactive and not interactive.
- Left: Asset Rail showing the existing `activeWorkspace` name/ID, `analysisContext.workspace_version`, ordered `source_ids`, ordered `relationship_ids`, and active dataset row/column count. Do not fabricate snapshot IDs or server governance results.
- Center: blank Experiment Canvas explaining that experiment configuration is not part of this shell gate.
- Right: Evidence Inspector explaining the current truth boundary. It must never say Production, Deployed, approved, or ready to train.
- Bottom: Run Dock backed by `GET /api/ml-studio/v1/runs?limit=20`.

Required states:

- **No dataset:** active workspace, analysis context, required identity, source IDs, or active rows are absent. Explain that a governed workspace dataset must be selected. Keep the structural shell visible and provide no training action.
- **Blocked identity:** `workspaceVersionConflict` exists, `workspaceRefreshStatus === 'error'`, or workspace identity/version disagrees with `analysisContext`. Show the existing safe conflict or refresh message and explain that identity must be reconciled. Do not call the run-list endpoint.
- **Identity available:** workspace ID/version, at least one source ID, and active rows agree. Label this only as “Dataset identity available,” not training-ready or governance-approved.
- **Run-list loading:** show stable skeleton rows in the Run Dock and set `aria-busy="true"`; do not blank the shell.
- **Run-list empty:** explain that no durable runs exist and run creation arrives later. Do not present a create or train button.
- **Run-list error:** render an announced safe error with remediation and a keyboard-accessible Retry button. Keep identity regions usable.
- **Run-list populated:** show concise newest-first run rows with accessible status text. Rows are informational only; no select, cancel, compare, or open action belongs here.

Light and dark themes must use existing CSS variables. Respect `prefers-reduced-motion`. Preserve visible focus on the rail button and Retry control. At narrow widths, regions may stack or scroll without overlapping or losing semantic order.

## State Ownership

Server state is the read-only response for the conceptual query key `['ml-studio', 'runs', 20]`. Fetch once when the shell mounts in an identity-available state and again only on explicit Retry. Ignore stale or post-unmount responses and do not auto-poll.

Local state is limited to request phase (`idle`, `loading`, `success`, `error`) and a safe request error. Do not copy individual run records into editable state.

Read `activeWorkspace`, `analysisContext`, `workspaceRefreshStatus`, `workspaceRefreshError`, and `workspaceVersionConflict` from `DataContext`. Read active row/column counts through existing dataset helpers or equivalent non-mutating context access. These values establish display state; they do not replace server governance or snapshot validation.

URL state: none. Preserve the application's existing in-memory destination behavior. Asynchronous job state is display-only: the Run Dock renders server lifecycle fields but does not poll, cancel, or transition a run.

## Non-Negotiables

- Use the exact API contract, fixtures, state boundaries, and target files.
- Render every required state with accessible names, semantic regions, keyboard behavior, visible focus, stable loading layout, and announced errors.
- Never infer authorization, governance approval, identity, permissions, production status, or hidden records on the client.
- Do not modify backend, active docs, authorization, readiness, contracts, package files, or any `GEMINI.md` file.
- Preserve Workspace, Data Model, Explore, Dashboards, AI Suite, existing windows, and legacy ML behavior outside this destination.
- Do not add a training button or disabled control promising later-gate behavior.

## Creative Latitude

Antigravity may choose component composition inside `MLStudioShell.jsx`, spacing, typography, restrained status styling, accessible region labels, skeleton treatment, responsive layout, and concise copy within the existing design system. It may choose an appropriate existing `react-icons` icon for the rail item. The five-region hierarchy, truthful state labels, API boundary, exclusions, and accessibility requirements are fixed.

## Acceptance Checklist

- [ ] The rail exposes one keyboard-accessible **ML Studio** destination with correct active state.
- [ ] Selecting it renders the five-region shell and does not open legacy ML or another destination workflow.
- [ ] No-dataset, blocked identity, identity-available, run-list loading, empty, error/retry, and populated states have focused tests.
- [ ] Exact success and empty payloads render correctly; safe error message and remediation text are announced.
- [ ] Run records remain read-only and newest-first as returned by the server.
- [ ] Light/dark variables, reduced-motion preference, visible focus, and narrow-layout behavior are present.
- [ ] No excluded behavior, file, or undocumented backend assumption was added.

## Verification And Stop Point

Run:

- `npm --prefix frontend/frontend test -- --watchAll=false --runInBand MLStudioShell.test.jsx`
- `npm --prefix frontend/frontend run build`
- `git diff --check`
- `git diff --name-only`

Return the exact changed-file list, each command and exit result, a concise evidence summary, and any contract mismatch. Then run:

- `python .gemini/skills/status-tracker-skill/scripts/update_status.py return --handoff project_docs/active/ai_hand_off/ml_studio_shell.md --summary "ML Studio shell implemented; focused tests and build returned for Codex review."`

Stop for Codex review. Do not begin another ML Studio slice and do not claim browser acceptance.
