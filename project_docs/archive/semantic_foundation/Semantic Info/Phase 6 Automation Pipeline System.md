# Phase 6 Automation Pipeline System

## Summary of implementation changes

Phase 6 evolves the existing AI workflow lab into a reusable automation and orchestration layer for business users.

The implementation adds:

- backend workflow persistence with JSON-backed storage
- reusable workflow templates for common AI operations
- a backend pipeline orchestration service that executes workflow graphs in dependency order
- a run-state model with queued, running, completed, failed, and skipped step states
- frontend workflow catalog management for save, load, duplicate, import, export, and template-based creation
- polling-based execution state updates in the React workflow canvas
- node-level business guidance fields so workflows can be configured without exposing low-level technical details
- compatibility with the existing AI command surface by routing workflow steps through the same AI command execution logic

## Files created or modified

### Backend

Created:

- `backend/services/ai_command_executor.py`
- `backend/services/workflow_storage.py`
- `backend/services/workflow_executor.py`
- `backend/routes/workflows.py`

Modified:

- `backend/app.py`
- `backend/routes/autopilot.py`
- `backend/services/ai_logic.py`

Generated at runtime or seeded by the new storage layer:

- `backend/storage/workflows/*.json`

### Frontend

Created:

- `frontend/frontend/src/features/workflow/workflowApi.js`
- `frontend/frontend/src/features/workflow/workflowGraph.js`

Modified:

- `frontend/frontend/src/features/workflow/AiWorkflowLab.jsx`
- `frontend/frontend/src/features/workflow/AiWorkflowLab.css`
- `frontend/frontend/src/features/workflow/AIPipeline.jsx`
- `frontend/frontend/src/features/workflow/AiCommandBlock.jsx`
- `frontend/frontend/src/features/workflow/AiWorkLabNodeSizer.jsx`
- `frontend/frontend/src/features/workflow/CleanSuggestionsModal.jsx`
- `frontend/frontend/src/features/ai/AiAutopilot.jsx`
- `frontend/frontend/src/utils/workflow_output_router.jsx`
- `frontend/frontend/src/App.jsx`

## Architectural explanation of the pipeline system

### 1. Workflow definition model

Each workflow is now treated as a structured definition with:

- workflow metadata: `id`, `name`, `description`, `category`, template/source metadata, error handling policy
- graph nodes: step ids, types, commands, descriptions, parameters, positions
- graph edges: source/target dependencies
- execution order: computed from graph topology and persisted with the workflow

This allows the builder UI, persistence layer, and executor to use the same canonical workflow payload.

### 2. Backend storage layer

The backend stores workflows as individual JSON documents under `backend/storage/workflows`.

Key behaviors:

- default business templates are seeded automatically on first access
- saved workflows and templates are listed separately
- workflows can be created, updated, duplicated, and instantiated from templates
- the persisted shape includes graph structure and computed execution order

This keeps persistence simple for the current phase while leaving a clean migration path to SQLite or another database later.

### 3. Shared AI command execution service

`backend/services/ai_command_executor.py` centralizes AI command handling.

Instead of keeping command behavior locked inside the Flask route, the route now delegates to the shared executor. That same executor is also used by the workflow orchestration service.

Benefits:

- no duplication between `/ai_cmd` and pipeline execution
- existing AI commands remain operational
- workflow nodes and direct AI command usage now share the same underlying behavior
- node parameters such as business focus, goals, and cleaning instructions can influence prompts consistently

### 4. Backend orchestration layer

`backend/services/workflow_executor.py` is the core orchestration service.

Responsibilities:

- normalize the submitted workflow definition
- initialize a workflow run record with per-node state
- execute nodes in dependency order using the persisted graph execution order
- pass upstream outputs into execution context
- propagate cleaned datasets to downstream nodes after `/clean`
- collect node outputs into a consolidated `ai_report`
- track events, progress counters, timestamps, and failure states
- mark downstream steps as `skipped` when execution stops after a failure

Runs are kept in memory for this phase and exposed through polling endpoints.

### 5. Frontend workflow manager

The React side keeps the workflow builder intact but upgrades it into a business automation surface.

`AiWorkflowLab.jsx` now manages:

- workflow metadata editing
- workflow catalog and template creation flows
- import/export to JSON
- save/update/duplicate/new workflow actions
- execution progress display
- business-oriented node library groupings
- step configuration panel for business guidance and cleaning instructions

`AIPipeline.jsx` is now a workflow run controller instead of a local node loop.

It:

- prepares cleaning instructions when needed
- starts the backend workflow run
- polls run state from the backend
- maps run status into the existing `pipelineResults` structure
- updates cleaned data when a cleaning node finishes

## How workflows are stored and executed

### Storage

Workflows are stored as JSON files, one file per workflow.

Each stored workflow contains:

- metadata for business-facing identification and reuse
- node layout and connections for the React Flow canvas
- node command parameters and descriptions
- computed execution order

This satisfies the persistence requirement while avoiding the overhead of introducing a relational schema in the same phase.

### Execution

Execution flow is:

1. The frontend builds a normalized workflow definition from the current canvas state.
2. The frontend posts the workflow plus dataset to `/api/workflows/execute`.
3. The backend creates a run record and starts a background thread.
4. The executor walks the workflow graph in order, executes each node, and records status transitions.
5. The frontend polls `/api/workflows/runs/<run_id>`.
6. Polled run state is converted into `pipelineResults` so existing output windows continue to work.
7. The consolidated AI report is routed through the existing workflow output router.

## How the UI represents workflow state

The UI now surfaces workflow state in several ways:

- each node displays `idle`, `running`, `completed`, or `failed`
- downstream nodes can also become `skipped` at the run-state level when a pipeline stops after a failure
- the workflow side panel shows run totals for completed, running, and failed steps
- execution order is visible in the builder
- workflow metadata and saved/template workflows are surfaced directly in the lab
- node configuration is exposed as business guidance instead of developer-only parameter editing

This makes the workflow canvas behave more like a business automation builder and less like a raw developer graph editor.

## Suggestions for the next phase

1. Replace in-memory run tracking with durable execution records in SQLite so runs survive backend restarts.
2. Add server-sent events or WebSocket streaming so node state updates appear instantly instead of through polling.
3. Introduce richer node configuration forms for dataset analysis, chart selection, and visualization preferences.
4. Add workflow version history and restore points so business users can safely iterate on automations.
5. Add per-step input and output previews in the UI for easier debugging and auditability.
6. Add role-based governance features such as publish, archive, and template approval states.
7. Migrate the JSON storage layer to a database-backed workflow catalog if multi-user support becomes a near-term requirement.
8. Add automated backend tests for workflow storage, graph ordering, failure handling, and report assembly.
