from __future__ import annotations

from typing import Any, Dict, List

from backend.services.decision_brief_service import build_decision_brief_artifacts
from backend.services.decision_signal_service import generate_decision_signals
from backend.services.decision_support import (
    DecisionServiceError,
    build_semantic_summary,
    iso_timestamp,
    normalize_bool,
    normalize_reference_list,
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


def _empty_dataset_summary(dataset_name: str = "Active Dataset", source: str = "active") -> Dict[str, Any]:
    return {
        "source": source,
        "dataset_id": None,
        "dataset_name": dataset_name,
        "row_count": 0,
        "column_count": 0,
    }


def _empty_scenario_preview(summary: str, generated_at: str, status: str = "not_applicable") -> Dict[str, Any]:
    return {
        "status": status,
        "summary": summary,
        "based_on_recommendation_ids": [],
        "based_on_signal_ids": [],
        "suggested_inputs": {
            "name": "Decision pipeline preview",
            "filters": [],
            "group_by": [],
            "metric_targets": [],
        },
        "projections": [],
        "assumptions": [],
        "generated_at": generated_at,
    }


def _empty_decision_bundle(
    dataset_summary: Dict[str, Any],
    generated_at: str,
    brief_title: str,
    brief_summary: str,
    scenario_summary: str,
) -> Dict[str, Any]:
    return {
        "signals": [],
        "brief": {
            "brief_id": None,
            "title": brief_title,
            "summary": brief_summary,
            "dataset": dataset_summary,
            "time_context": None,
            "headline_signal_ids": [],
            "key_metrics": [],
            "themes": [],
            "confidence": 0.6,
            "generated_at": generated_at,
        },
        "recommendations": [],
        "scenario_preview": _empty_scenario_preview(
            summary=scenario_summary,
            generated_at=generated_at,
        ),
    }


def _build_readiness(
    dataset_loaded: bool,
    semantic_ready: bool,
    metrics_ready: bool,
) -> Dict[str, Any]:
    missing_requirements = []
    if not dataset_loaded:
        missing_requirements.append("dataset")
    if not semantic_ready:
        missing_requirements.append("semantic_model")
    if not metrics_ready:
        missing_requirements.append("metrics")

    return {
        "dataset_loaded": dataset_loaded,
        "semantic_ready": semantic_ready,
        "decision_ready": dataset_loaded and semantic_ready,
        "missing_requirements": missing_requirements,
    }


def _normalize_pipeline_warning(warning: str) -> str:
    warning_text = str(warning or "").strip()
    if not warning_text:
        return ""

    if warning_text == "The resolved dataset is empty. No decision signals were generated.":
        return "The current dataset has no rows to analyze."
    if warning_text == "The resolved dataset is empty. Scenario outputs contain scaffolded structures only.":
        return "Scenario preview could not be generated because the current dataset has no rows."
    return warning_text


def _build_non_ready_response(
    dataset_summary: Dict[str, Any],
    semantic_summary: Dict[str, Any],
    readiness: Dict[str, Any],
    warnings: List[str],
    generated_at: str,
    brief_title: str,
    brief_summary: str,
    scenario_summary: str,
) -> Dict[str, Any]:
    bundle = _empty_decision_bundle(
        dataset_summary=dataset_summary,
        generated_at=generated_at,
        brief_title=brief_title,
        brief_summary=brief_summary,
        scenario_summary=scenario_summary,
    )
    return {
        "status": "success",
        "dataset": dataset_summary,
        "semantic_model": semantic_summary,
        "decision_bundle": bundle,
        "readiness": readiness,
        "meta": {
            "signal_count": 0,
            "recommendation_count": 0,
            "scenario_preview_status": bundle["scenario_preview"]["status"],
            "empty_dataset": dataset_summary.get("row_count", 0) == 0,
            "generated_at": generated_at,
        },
        "warnings": _normalize_warning_list([_normalize_pipeline_warning(warning) for warning in warnings]),
    }


def _resolve_pipeline_payload_models(payload: Dict[str, Any]) -> tuple[Any, Any]:
    dataset = payload.get("dataset")
    semantic_model = payload.get("semantic_model") or payload.get("semanticModel")
    return dataset, semantic_model


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
    dataset, semantic_model = _resolve_pipeline_payload_models(payload)
    dataset_ref = payload.get("dataset_ref") or payload.get("datasetRef")
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
    metric_ids = normalize_reference_list(payload, "metric_ids", "metricIds")
    metric_names = normalize_reference_list(payload, "metric_names", "metricNames")

    try:
        context = resolve_decision_context(
            dataset=dataset,
            dataset_ref=dataset_ref,
            semantic_model=semantic_model,
            source="decision_pipeline",
        )
    except DecisionServiceError as exc:
        error_message = str(exc)
        if error_message not in {"No active dataset is available.", "A valid dataset is required."}:
            raise

        generated_at = iso_timestamp()
        readiness = _build_readiness(
            dataset_loaded=False,
            semantic_ready=False,
            metrics_ready=False,
        )
        requested_source = dataset_ref.get("source") if isinstance(dataset_ref, dict) else None
        dataset_summary = _empty_dataset_summary(source=requested_source or "active")
        return _build_non_ready_response(
            dataset_summary=dataset_summary,
            semantic_summary=build_semantic_summary(semantic_model if isinstance(semantic_model, dict) else {}),
            readiness=readiness,
            warnings=[
                "No dataset is currently loaded.",
                "Load a dataset to enable Decision Intelligence.",
            ],
            generated_at=generated_at,
            brief_title="Decision Intelligence is waiting for a dataset",
            brief_summary="Load a dataset before running Decision Intelligence.",
            scenario_summary="Scenario preview is unavailable until a dataset is loaded.",
        )

    semantic_summary = build_semantic_summary(context["semantic_model"])
    selected_metrics = select_metrics(
        context,
        metric_ids=metric_ids,
        metric_names=metric_names,
        max_metrics=max(max_signals, max_recommendations, 5),
    ) if not context["dataframe"].empty else []
    readiness = _build_readiness(
        dataset_loaded=True,
        semantic_ready=True,
        metrics_ready=bool(selected_metrics),
    )

    if not selected_metrics:
        generated_at = iso_timestamp()
        warnings = []
        if not semantic_summary.get("summary", {}).get("metric_count"):
            warnings.append("No semantic metrics are defined.")
        else:
            warnings.append("No compatible semantic metrics are currently available.")
        warnings.append("Decision Intelligence requires at least one metric.")
        return _build_non_ready_response(
            dataset_summary=context["dataset"],
            semantic_summary=semantic_summary,
            readiness=readiness,
            warnings=warnings,
            generated_at=generated_at,
            brief_title="Decision Intelligence needs at least one metric",
            brief_summary="Define or resolve at least one semantic metric before running Decision Intelligence.",
            scenario_summary="Scenario preview is unavailable until at least one semantic metric is available.",
        )

    signal_payload = dict(payload)
    signal_payload["max_signals"] = max_signals
    signal_response = generate_decision_signals(signal_payload)
    signals = list(signal_response.get("signals") or [])

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
        "semantic_model": semantic_summary,
        "decision_bundle": {
            "signals": signals,
            "brief": brief_artifacts["brief"],
            "recommendations": recommendation_artifacts["recommendations"],
            "scenario_preview": scenario_preview,
        },
        "readiness": readiness,
        "meta": {
            "signal_count": len(signals),
            "recommendation_count": len(recommendation_artifacts["recommendations"]),
            "scenario_preview_status": scenario_preview["status"],
            "empty_dataset": context["dataframe"].empty,
            "generated_at": generated_at,
        },
        "warnings": _normalize_warning_list(
            [_normalize_pipeline_warning(warning) for warning in signal_response.get("warnings", [])],
            [_normalize_pipeline_warning(warning) for warning in scenario_warnings],
        ),
    }
