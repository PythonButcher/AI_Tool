# User Hypotheses And Graph-To-Action Handoff

## Backend Readiness

Backend contract is ready for frontend implementation. Do not invent or rename graph APIs.

Use `project_docs/active/contracts/decision_objects.md` as the source of truth for `decision_graph` schema version `di_phase7_3_decision_graph_v1`.

Verified backend endpoints:

| Endpoint | Purpose |
| --- | --- |
| `/api/decision/graph/candidates` | Returns graph-eligible semantic metrics and dimensions. |
| `/api/decision/graph/build` | Builds selected-variable graph data, including evidence coverage, observed association, and user hypothesis edges. |
| `/api/decision/graph/actions` | Plans a safe follow-up action from a selected node or edge. It returns request semantics only and does not execute causal validation, monitoring automation, or scenario evaluation. |

Backend verification passed with:

`PYTHONPATH=.codex_tmp_py\site-packages python -m unittest tests.test_decision_graph_service tests.test_decision_chat_service tests.test_decision_reliability_benchmark`

## Frontend Files To Inspect

Primary files:

`frontend/frontend/src/features/business/decision/graph/DecisionGraphWorkspace.jsx`

`frontend/frontend/src/features/business/decision/graph/DecisionGraphCanvas.jsx`

`frontend/frontend/src/features/business/decision/graph/InspectorPanel.jsx`

`frontend/frontend/src/features/business/decision/graph/VariableTray.jsx`

`frontend/frontend/src/features/business/decision/decisionApi.js`

Also inspect AI Chat launch context only if needed:

`frontend/frontend/src/features/ai/AIShell.jsx`

## Required Behavior

Let the user create or approve a directional hypothesis edge between two selected graph variables. Send those edges to `/api/decision/graph/build` as `user_hypotheses` items with `source_variable_id` and `target_variable_id`.

Use returned `graph_state` to carry selected variables, selected evidence, filters, and accepted user hypotheses in frontend session state or any saved decision asset flow. Do not assume `/api/decision/graph/build` persists graph state server-side.

Render returned user hypothesis edges separately from evidence coverage and observed association edges. The inspector must show:

`relationship_type: "user_hypothesis"`

`evidence_basis: "user_stated_hypothesis"`

`causal_status: "user_hypothesis_not_validated"`

`reliability_label: "user_hypothesis_unvalidated"`

Never render a user hypothesis as causal proof, an observed backend association, an optimized action, a final recommendation, a prediction, or a simulation.

Add selected-node and selected-edge action controls that call `/api/decision/graph/actions` with `action_id` values:

`breakdown`

`monitor`

`explain_evidence`

`explain_missing_data`

`send_to_scenario_compare`

Treat the action response as planning semantics. If `action_status` is not `ready`, show the backend reason and keep the action visibly blocked. Scenario Compare must stay blocked for unvalidated user hypothesis edges when the backend returns `needs_observed_metric_edge`.

## Acceptance Checks

The user can add or approve a directional hypothesis edge between selected variables.

User hypothesis edges look visually distinct from observed associations and evidence coverage.

The inspector clearly explains that user hypotheses are user-stated and not validated.

Graph actions call the backend planner and display safe next-step semantics without claiming the action has already run.

Scenario Compare is not enabled for unvalidated user hypothesis edges unless the backend marks it ready.

Existing graph candidate discovery, graph build, evidence coverage edges, observed association edges, AI Chat answer/chart behavior, and decision output rendering remain intact.

## Required Verification

Run:

`npm --prefix frontend\frontend run build`

Run:

`git diff --check`

Do one focused browser check that builds or mocks a graph with a user hypothesis edge, opens the inspector, and verifies graph actions preserve the non-causal reliability boundary.

After implementation, update `project_docs/active/status/decision_intelligence_execution_status.md` with only verified frontend facts and the remaining gate.
