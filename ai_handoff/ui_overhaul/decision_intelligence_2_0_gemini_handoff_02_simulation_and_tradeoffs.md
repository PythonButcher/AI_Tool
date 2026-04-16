# Decision Intelligence 2.0 Gemini Handoff 02

## Status Notice

This file is now a historical V2 planning handoff.

Decision Intelligence V2 is closed as-is.

Do not treat this blocked V2 simulation handoff as the active resume point.

Any future simulation/trade-off continuation should now be framed as **V3** work and resumed from:

- `ai_handoff/ui_overhaul/decision_intelligence_v3_resume_handoff.md`

## Status

This handoff is currently **blocked**.

Do not treat this as the active Gemini resume point until V1 scoped-workspace completion is honestly closed by Codex and the frontend follow-up in Handoff 03 is complete.

## 1. Goal

Extend the Decision Intelligence 2.0 workspace to support simulation triggering and trade-off visualization.

The user-facing outcome is:

- the user can trigger a "Run Simulation" action from a ready workspace
- the UI renders the multiple trade-off paths (e.g. Aggressive, Balanced, Conservative)
- the UI shows the projected impact on the success objective for each path
- the UI highlights risks and constraint proximity

## 2. What Is Already Decided

- the workspace must be `ready` and `can_run_simulation` must be `true` before triggering
- the contract for this phase is `ai_handoff/shared_contracts/decision_intelligence_2_0_contract_v2.md`
- the endpoint is `POST /api/decision/workspaces/{id}/simulate`
- the UI should not use a single "answer" model; it must present choices (trade-off paths)
- uncertainty and risk must remain first-class elements in the presentation

## 3. What Gemini Is Allowed To Change

- `DecisionWorkspaceView.jsx`: Add simulation trigger and results display
- `DecisionPanel.jsx`: Handle the transition from "Workspace View" to "Simulation Results"
- `decisionApi.js`: Add `runSimulation` call
- `App.jsx`: Manage simulation state and results
- New components for trade-off paths and projection charts (if needed)

## 4. What Gemini Must Not Change

- do not implement simulation logic in the frontend
- do not fake path outcomes
- do not ignore the `risk_profile` defined by the backend
- do not change the core workspace structure from V1

## 5. Backend Contract

Follow `decision_intelligence_2_0_contract_v2.md` for:

- `simulation_results`
- `trade_off_analysis.paths`
- `objective_outcome` (baseline vs projected)

## 6. UX Direction

The simulation result should feel like a bridge between the workspace structure and real-world actions.

- **Paths should be distinct cards** (e.g. a grid of 3 paths)
- **Objective impact should be highly visual** (e.g. "Revenue: +12% ($1.35M)")
- **Trade-offs should be explicit**: "Increases Growth (Pro) but hits Budget Limit (Con)"
- **Risk highlighting**: Use color and tone to indicate `low`, `medium`, and `high` risk profiles.

## 7. Verification Standard

- the simulation trigger only appears when the workspace is ready
- simulation results are rendered according to the V2 contract
- at least 2 distinct trade-off paths are shown
- baseline vs projected comparison is clear for the objective
- risk levels are visually communicated
