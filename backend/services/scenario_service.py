from __future__ import annotations

from typing import Any, Dict, List

from backend.services.decision_support import (
    DecisionServiceError,
    build_metric_ref,
    build_semantic_summary,
    iso_timestamp,
    make_identifier,
    matches_reference,
    normalize_filters,
    normalize_group_by,
    normalize_reference_list,
    resolve_decision_context,
    resolve_metric_result,
    rounded,
    safe_float,
    select_metrics,
)


def _normalize_metric_targets(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    metric_targets = payload.get("metric_targets")
    if metric_targets is None:
        metric_targets = payload.get("metricTargets")
    if metric_targets is None:
        metric_ids = normalize_reference_list(payload, "metric_ids", "metricIds")
        return [
            {
                "metric_id": metric_id,
                "adjustment_type": "percent",
                "adjustment_value": 0.0,
            }
            for metric_id in metric_ids
        ]
    if not isinstance(metric_targets, list):
        raise DecisionServiceError("metric_targets must be an array when provided.")

    normalized = []
    for item in metric_targets:
        if not isinstance(item, dict):
            raise DecisionServiceError("Each metric target must be an object.")
        metric_id = str(item.get("metric_id") or item.get("metricId") or item.get("metric_name") or item.get("metricName") or "").strip()
        if not metric_id:
            raise DecisionServiceError("Each metric target requires metric_id or metric_name.")
        adjustment_type = str(item.get("adjustment_type") or item.get("adjustmentType") or "percent").strip().lower()
        if adjustment_type not in {"percent", "absolute"}:
            raise DecisionServiceError("adjustment_type must be 'percent' or 'absolute'.")
        try:
            adjustment_value = float(item.get("adjustment_value") or item.get("adjustmentValue") or 0.0)
        except (TypeError, ValueError) as exc:
            raise DecisionServiceError("adjustment_value must be numeric.") from exc
        normalized.append(
            {
                "metric_id": metric_id,
                "adjustment_type": adjustment_type,
                "adjustment_value": adjustment_value,
            }
        )
    return normalized


def _apply_adjustment(baseline_value: float | None, adjustment_type: str, adjustment_value: float) -> float | None:
    if baseline_value is None:
        return None
    if adjustment_type == "percent":
        return baseline_value * (1.0 + adjustment_value)
    return baseline_value + adjustment_value


def evaluate_scenario(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = payload if isinstance(payload, dict) else {}
    context = resolve_decision_context(
        dataset=payload.get("dataset"),
        dataset_ref=payload.get("dataset_ref") or payload.get("datasetRef"),
        semantic_model=payload.get("semantic_model") or payload.get("semanticModel"),
        source="scenario",
    )
    filters = normalize_filters(payload)
    group_by = normalize_group_by(payload)
    metric_targets = _normalize_metric_targets(payload)

    if not metric_targets:
        raise DecisionServiceError("Scenario evaluation requires at least one metric target or metric_id.")

    target_references = [target["metric_id"] for target in metric_targets]
    selected_metrics = select_metrics(context, metric_ids=target_references, metric_names=[], max_metrics=len(target_references))

    baseline_metrics = []
    projected_metrics = []
    for target in metric_targets:
        metric = next((candidate for candidate in selected_metrics if matches_reference(candidate, target["metric_id"])), None)
        if metric is None:
            raise DecisionServiceError(f"Scenario target metric '{target['metric_id']}' was not found.")

        result = resolve_metric_result(context, metric, filters=filters, group_by=group_by)
        metric_ref = build_metric_ref(metric)
        baseline_value = safe_float(result.get("summary", {}).get("value"))
        projected_value = _apply_adjustment(baseline_value, target["adjustment_type"], target["adjustment_value"])

        baseline_metrics.append(
            {
                "metric_ref": metric_ref,
                "summary_value": result.get("summary", {}).get("value"),
                "rows": result.get("rows", []),
            }
        )
        projected_metrics.append(
            {
                "metric_ref": metric_ref,
                "adjustment": {
                    "type": target["adjustment_type"],
                    "value": rounded(target["adjustment_value"]),
                },
                "baseline_value": rounded(baseline_value),
                "projected_value": rounded(projected_value),
                "delta_value": rounded(projected_value - baseline_value) if projected_value is not None and baseline_value is not None else None,
            }
        )

    generated_at = iso_timestamp()
    scenario_name = str(payload.get("name") or payload.get("scenario_name") or payload.get("scenarioName") or "Scenario evaluation").strip()
    scenario = {
        "scenario_id": make_identifier("scenario", scenario_name, generated_at),
        "name": scenario_name,
        "status": "scaffolded",
        "summary": (
            f"Scenario scaffold evaluated {len(projected_metrics)} metric targets using simple direct adjustments "
            f"on semantic metric baselines."
        ),
        "dataset": context["dataset"],
        "parameters": {
            "filters": filters,
            "group_by": group_by,
            "metric_targets": metric_targets,
        },
        "baseline_metrics": baseline_metrics,
        "projected_metrics": projected_metrics,
        "assumptions": [
            "Phase 1 scenarios apply direct metric adjustments only.",
            "No causal or multi-step simulation is performed yet.",
        ],
        "generated_at": generated_at,
    }

    warnings = []
    if context["dataframe"].empty:
        warnings.append("The resolved dataset is empty. Scenario outputs contain scaffolded structures only.")

    return {
        "status": "success",
        "request": scenario["parameters"],
        "dataset": context["dataset"],
        "semantic_model": build_semantic_summary(context["semantic_model"]),
        "scenario": scenario,
        "meta": {
            "metric_target_count": len(metric_targets),
            "empty_dataset": context["dataframe"].empty,
            "generated_at": generated_at,
        },
        "warnings": warnings,
    }
