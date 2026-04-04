from __future__ import annotations

from typing import Any, Dict, List

from backend.services.decision_brief_service import build_decision_brief_artifacts
from backend.services.decision_signal_service import generate_decision_signals
from backend.services.decision_support import (
    build_semantic_summary,
    iso_timestamp,
    normalize_bool,
    normalize_positive_int,
    resolve_decision_context,
    rounded,
    select_metrics,
)
from backend.services.recommendation_service import build_recommendation_artifacts
from backend.services.scenario_service import evaluate_scenario


SCENARIO_PREVIEW_SEVERITY_STEP = {
    "critical": 0.12,
    "high": 0.08,
    "medium": 0.05,
    "low": 0.03,
}


def _normalize_warning_list(*warning_groups: List[str]) -> List[str]:
    ordered = []
    for warning_group in warning_groups:
        for warning in warning_group or []:
            if warning and warning not in ordered:
                ordered.append(warning)
    return ordered


def _pick_preview_group_by(recommendations: List[Dict[str, Any]]) -> List[str]:
    for recommendation in recommendations:
        for action in recommendation.get("actions") or []:
            payload = action.get("payload") if isinstance(action.get("payload"), dict) else {}
            group_by = payload.get("group_by")
            if isinstance(group_by, list) and group_by:
                return [str(item) for item in group_by if str(item).strip()]
    return []


def _preview_adjustment_from_signal(signal: Dict[str, Any] | None) -> Dict[str, Any]:
    if not isinstance(signal, dict):
        return {
            "adjustment_type": "percent",
            "adjustment_value": 0.03,
        }

    severity = str(signal.get("severity") or "low").strip().lower()
    signal_type = str(signal.get("signal_type") or "").strip().lower()
    direction = str(signal.get("direction") or "unknown").strip().lower()
    base_step = SCENARIO_PREVIEW_SEVERITY_STEP.get(severity, 0.03)

    if signal_type == "metric_delta":
        if direction == "down":
            adjustment_value = base_step
        elif direction == "up":
            adjustment_value = -base_step
        else:
            adjustment_value = 0.0
    elif signal_type == "dimension_concentration":
        adjustment_value = -max(0.03, base_step / 2.0)
    elif signal_type == "anomaly_rate":
        adjustment_value = -max(0.04, base_step / 2.0)
    elif signal_type == "data_quality":
        adjustment_value = -max(0.03, base_step / 2.5)
    else:
        adjustment_value = 0.03

    return {
        "adjustment_type": "percent",
        "adjustment_value": rounded(adjustment_value),
    }


def _build_scenario_preview(
    payload: Dict[str, Any],
    recommendations: List[Dict[str, Any]],
    include_scenario_preview: bool,
    max_preview_targets: int,
) -> tuple[Dict[str, Any], List[str]]:
    generated_at = iso_timestamp()
    filters = list(payload.get("filters") or [])
    suggested_inputs = {
        "name": "Decision pipeline preview",
        "filters": filters,
        "group_by": [],
        "metric_targets": [],
    }
    preview = {
        "status": "not_requested" if not include_scenario_preview else "not_applicable",
        "summary": (
            "Scenario preview generation was skipped for this run."
            if not include_scenario_preview
            else "No chart-compatible recommendations produced a scenario preview."
        ),
        "based_on_recommendation_ids": [],
        "based_on_signal_ids": [],
        "suggested_inputs": suggested_inputs,
        "projections": [],
        "assumptions": [],
        "generated_at": generated_at,
    }

    if not include_scenario_preview:
        return preview, []

    signal_lookup = {
        signal.get("signal_id"): signal
        for signal in payload.get("_pipeline_signals") or []
        if isinstance(signal, dict) and signal.get("signal_id")
    }
    metric_targets = []
    based_on_recommendation_ids = []
    based_on_signal_ids = []
    seen_metric_ids = set()

    for recommendation in recommendations:
        metric_ref = recommendation.get("metric_ref") if isinstance(recommendation.get("metric_ref"), dict) else {}
        metric_id = metric_ref.get("metric_id")
        if not metric_id or metric_id in seen_metric_ids:
            continue

        source_signal_ids = [signal_id for signal_id in recommendation.get("based_on_signal_ids") or [] if signal_id in signal_lookup]
        primary_signal = signal_lookup.get(source_signal_ids[0]) if source_signal_ids else None
        metric_targets.append(
            {
                "metric_id": metric_id,
                **_preview_adjustment_from_signal(primary_signal),
            }
        )
        seen_metric_ids.add(metric_id)
        based_on_recommendation_ids.append(recommendation["recommendation_id"])
        for signal_id in source_signal_ids:
            if signal_id not in based_on_signal_ids:
                based_on_signal_ids.append(signal_id)
        if len(metric_targets) >= max_preview_targets:
            break

    if not metric_targets:
        return preview, []

    suggested_inputs["group_by"] = _pick_preview_group_by(recommendations)
    suggested_inputs["metric_targets"] = metric_targets
    preview_payload = {
        "dataset": payload.get("dataset"),
        "dataset_ref": payload.get("dataset_ref") or payload.get("datasetRef"),
        "semantic_model": payload.get("semantic_model") or payload.get("semanticModel"),
        "name": suggested_inputs["name"],
        "filters": suggested_inputs["filters"],
        "group_by": suggested_inputs["group_by"],
        "metric_targets": suggested_inputs["metric_targets"],
    }
    scenario_response = evaluate_scenario(preview_payload)
    scenario = scenario_response.get("scenario") or {}

    return (
        {
            "status": "ready",
            "summary": (
                f"Prepared {len(metric_targets)} scenario preview target"
                f"{'s' if len(metric_targets) != 1 else ''} from the top chart-compatible recommendations."
            ),
            "based_on_recommendation_ids": based_on_recommendation_ids,
            "based_on_signal_ids": based_on_signal_ids,
            "suggested_inputs": suggested_inputs,
            "projections": [
                {
                    "metric_ref": projected_metric.get("metric_ref"),
                    "adjustment": projected_metric.get("adjustment"),
                    "baseline_value": projected_metric.get("baseline_value"),
                    "projected_value": projected_metric.get("projected_value"),
                    "delta_value": projected_metric.get("delta_value"),
                    "delta_pct": projected_metric.get("delta_pct"),
                    "comparison_summary": projected_metric.get("comparison_summary"),
                }
                for projected_metric in scenario.get("projected_metrics") or []
            ],
            "assumptions": scenario.get("assumptions") or [],
            "generated_at": scenario.get("generated_at") or generated_at,
        },
        list(scenario_response.get("warnings") or []),
    )


def run_decision_pipeline(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload = payload if isinstance(payload, dict) else {}
    context = resolve_decision_context(
        dataset=payload.get("dataset"),
        dataset_ref=payload.get("dataset_ref") or payload.get("datasetRef"),
        semantic_model=payload.get("semantic_model") or payload.get("semanticModel"),
        source="decision_pipeline",
    )
    max_signals = normalize_positive_int(payload.get("max_signals") or payload.get("maxSignals"), 8, "max_signals")
    max_recommendations = normalize_positive_int(
        payload.get("max_recommendations") or payload.get("maxRecommendations"),
        5,
        "max_recommendations",
    )
    include_scenario_preview = normalize_bool(
        payload.get("include_scenario_preview", payload.get("includeScenarioPreview")),
        default=True,
    )
    max_preview_targets = normalize_positive_int(
        payload.get("max_preview_targets") or payload.get("maxPreviewTargets"),
        2,
        "max_preview_targets",
        maximum=5,
    )

    signal_payload = dict(payload)
    signal_payload["max_signals"] = max_signals
    signal_response = generate_decision_signals(signal_payload)
    signals = list(signal_response.get("signals") or [])
    selected_metrics = select_metrics(
        context,
        metric_ids=signal_response["request"]["metric_ids"],
        metric_names=signal_response["request"]["metric_names"],
        max_metrics=max(max_signals, max_recommendations, 5),
    ) if not context["dataframe"].empty else []

    generated_at = iso_timestamp()
    brief_artifacts = build_decision_brief_artifacts(
        context=context,
        filters=signal_response["request"]["filters"],
        selected_metrics=selected_metrics,
        signals=signals,
        generated_at=generated_at,
    )
    recommendation_artifacts = build_recommendation_artifacts(
        context=context,
        signals=signals,
        selected_metrics=selected_metrics,
        max_recommendations=max_recommendations,
        generated_at=generated_at,
    )
    scenario_preview, scenario_warnings = _build_scenario_preview(
        payload={
            **payload,
            "filters": signal_response["request"]["filters"],
            "_pipeline_signals": signals,
        },
        recommendations=recommendation_artifacts["recommendations"],
        include_scenario_preview=include_scenario_preview,
        max_preview_targets=max_preview_targets,
    )

    return {
        "status": "success",
        "dataset": context["dataset"],
        "semantic_model": build_semantic_summary(context["semantic_model"]),
        "decision_bundle": {
            "signals": signals,
            "brief": brief_artifacts["brief"],
            "recommendations": recommendation_artifacts["recommendations"],
            "scenario_preview": scenario_preview,
        },
        "meta": {
            "signal_count": len(signals),
            "recommendation_count": len(recommendation_artifacts["recommendations"]),
            "scenario_preview_status": scenario_preview["status"],
            "empty_dataset": context["dataframe"].empty,
            "generated_at": generated_at,
        },
        "warnings": _normalize_warning_list(signal_response.get("warnings", []), scenario_warnings),
    }
