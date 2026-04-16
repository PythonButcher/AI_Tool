# Decision Intelligence 2.0 Contract V2 (Simulation & Trade-offs)

## Status Notice

This file is now a historical V2 contract draft.

Decision Intelligence V2 is closed as-is.

Do not treat this contract as the active project label for unfinished simulation or trade-off work.

Any future completion of this direction should now be framed as **V3** work, using this file only as reference context.

## Purpose

This contract extends DI 2.0 to support simulation execution and trade-off analysis within a scoped decision workspace.

It moves the system from "Workspace Definition" to "Path Exploration".

## Status

- **HISTORICAL V2 DRAFT**
- V2 is closed as-is
- carry forward into V3 only if and when this direction is reopened
- Extends `di_2_0_v1`
- Introduces simulation results and trade-off objects

## Contract Version

- `contract_version: "di_2_0_v2"`

## Primary Endpoints

- `POST /api/decision/workspaces/{workspace_id}/simulate`
- `GET /api/decision/workspaces/{workspace_id}/trade-offs` (Optional, may be bundled in simulate response)

## Simulation Request Shape

```json
{
  "simulation_preferences": {
    "strategy": "balanced",
    "sample_count": 500,
    "include_uncertainty": true
  },
  "lever_overrides": [
    {
      "lever_id": "price",
      "fixed_value": 45.0
    }
  ]
}
```

## Simulation Result Object

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `simulation_id` | `string` | Yes | Unique ID for this simulation run |
| `workspace_id` | `string` | Yes | Parent workspace |
| `objective_outcome` | `Outcome Summary` | Yes | Projected movement of the primary objective |
| `lever_settings` | `object` | Yes | Map of lever IDs to the values used in this simulation |
| `constraint_impacts` | `Constraint Impact[]` | Yes | How close the simulation came to violating guardrails |
| `confidence_score` | `number` | Yes | 0.0 to 1.0 confidence in the projection |
| `uncertainty_notes` | `string[]` | Yes | Why confidence is at this level |

## Trade-off Path Object

The Trade-off Engine should return 2-3 distinct "Paths".

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `path_id` | `string` | Yes | e.g. `path_aggressive_growth` |
| `label` | `string` | Yes | e.g. "Aggressive Growth" |
| `description` | `string` | Yes | Human-readable strategy summary |
| `primary_upside` | `string` | Yes | Main benefit |
| `primary_downside` | `string` | Yes | Main cost or risk |
| `simulation_ref` | `Simulation Result` | Yes | The underlying projection |
| `risk_profile` | `string` | Yes | `low`, `medium`, or `high` |

## Response Shape (`POST .../simulate`)

```json
{
  "status": "success",
  "contract_version": "di_2_0_v2",
  "workspace_id": "...",
  "simulation_results": [
    {
      "simulation_id": "sim_01",
      "label": "Baseline",
      "objective_outcome": {
        "metric_id": "metric_revenue",
        "baseline": 1200000,
        "projected": 1200000,
        "change_pct": 0.0
      }
      // ...
    },
    {
      "simulation_id": "sim_02",
      "label": "Aggressive Price Increase",
      "objective_outcome": {
        "metric_id": "metric_revenue",
        "baseline": 1200000,
        "projected": 1350000,
        "change_pct": 12.5
      }
      // ...
    }
  ],
  "trade_off_analysis": {
    "summary": "Increasing price drives revenue but risks a 5% drop in volume, potentially hitting the inventory floor.",
    "paths": [
      {
        "path_id": "balanced",
        "label": "Balanced Growth",
        "description": "Modest price increase with stable volume.",
        "primary_upside": "Protected margin",
        "primary_downside": "Slower growth than aggressive path",
        "risk_profile": "low"
      }
    ]
  }
}
```

## Logic Requirements for Codex

### 1. Sensitivity Analysis
Backend must evaluate how sensitive the objective is to each lever.

### 2. Constraint Proximity
Backend must detect if a simulation "brushes" against a hard constraint (e.g. 98% of budget used).

### 3. Path Generation
Codex must implement logic to select distinct paths:
- **Conservative**: Minimal lever movement, high confidence, low risk.
- **Aggressive**: High objective upside, higher risk of constraint violation.
- **Balanced**: Optimal trade-off between growth and guardrails.

### 4. Uncertainty Modeling
If `unknowns` from V1 block simulation, the backend must return a clear error or a "limited" simulation with high uncertainty.
