"""Bounded dashboard composition over independently executed semantic results."""

import re

from backend.decision_engine.bi_intent import clarification, is_temporal, time_grain
from backend.services.decision_support import DecisionServiceError


def is_dashboard_request(message: str) -> bool:
    return bool(re.search(r"\bdashboard\b", message, re.I))


def build_dashboard_response(service, message, dataset, model, analytic_state):
    model = model if isinstance(model, dict) else {}
    metrics = model.get("metrics") or []
    matches = service._find_semantic_reference_matches(message, metrics)
    if not re.search(r"\bmetric:", message, re.I):
        named = [item for item in metrics if service._find_semantic_reference(message, [item])]
        if len(named) > 1:
            return clarification("This draft focuses on one metric. Which should I use?", named, message, "metric", analytic_state)
    if not matches and analytic_state.get("metric_id"):
        matches = [item for item in metrics if item.get("id") == analytic_state["metric_id"]]
    if not matches and len(metrics) == 1:
        matches = metrics
    if len(matches) != 1:
        return clarification("Which metric should this dashboard focus on?", matches or metrics,
                             message, "metric", analytic_state)
    metric = matches[0]
    dimensions = model.get("dimensions") or []
    temporal = [item for item in dimensions if is_temporal(item)]
    # Support common business wording only against an actual model dimension.
    dimension_query = re.sub(r"\bregional\b", "region", message, flags=re.I)
    groups = [item for item in dimensions if not is_temporal(item)
              and service._find_semantic_reference(dimension_query, [item])]
    group_matches = service._find_semantic_reference_matches(dimension_query, [item for item in dimensions if not is_temporal(item)])
    if len(group_matches) > 1:
        return clarification("Which field should define the dashboard breakdown?", group_matches, message, "dimension", analytic_state)
    if re.search(r"\bdimension:", message, re.I) and group_matches:
        groups = group_matches
    wants_trend = bool(time_grain(message) or re.search(r"\btrend\b", message, re.I))
    trend_dimension = service._find_semantic_reference(message, temporal)
    if wants_trend and not trend_dimension:
        if len(temporal) != 1:
            return clarification("Which date should define the dashboard trend?" if temporal else
                                 "A trend needs a date dimension. Request a metric total or categorical breakdown instead.",
                                 temporal, message, "dimension", analytic_state)
        trend_dimension = temporal[0]

    filters = service._build_semantic_filters(user_message=message, dataset=dataset,
                                              semantic_model=model, analytic_state=analytic_state)
    base_state = {
        "source": "semantic_metric", "metric_id": metric.get("id"),
        "metric_name": metric.get("label") or metric.get("name"),
        "filters": filters, "group_by": [], "output_preference": "answer",
        "aggregation_override": analytic_state.get("aggregation_override"),
    }
    metric_query = f"metric:{metric.get('id') or metric.get('field')}"
    requests = [("Metric total", metric_query)]
    if wants_trend:
        grain = time_grain(message) or "month"
        grain_word = {"day": "daily", "month": "monthly", "quarter": "quarterly", "year": "yearly"}[grain]
        requests.append((f"{grain.title()} trend", f"Show {grain_word} chart {metric_query} dimension:{trend_dimension.get('id') or trend_dimension['field']}"))
    for group in groups[:2]:
        label = group.get("label") or group.get("field")
        requests.append((f"By {label}", f"Show chart {metric_query} dimension:{group.get('id') or group['field']}"))

    artifacts, items = [], []
    latest_state = base_state
    for index, (label, query) in enumerate(requests[:4]):
        item = {"item_id": f"draft-item-{index + 1}", "label": label}
        try:
            result = service._build_semantic_metric_response(query, dataset, model, base_state)
            if not result or not result.get("artifacts") or result["artifacts"][0].get("content", {}).get("reason_code"):
                raise DecisionServiceError("This item needs a more specific analytical question.")
            artifact = result["artifacts"][0]
            content = artifact.get("content") or {}
            if (artifact["type"] == "chart" and not content.get("chartData", {}).get("labels")) or (
                artifact["type"] == "answer" and content.get("summary", {}).get("value") is None
            ):
                raise DecisionServiceError("No usable result for these filters. Adjust the question and try again.")
            artifact["title"] = f"{metric.get('label') or metric.get('name')} — {label}"
            artifact["_analytic_state"] = result["analytic_state"]
            item.update({"status": "ready", "artifact_index": len(artifacts)})
            artifacts.append(artifact)
            latest_state = result["analytic_state"]
        except DecisionServiceError as exc:
            item.update({"status": "unavailable", "message": str(exc)})
        items.append(item)
    count = len(artifacts)
    return {
        "assistant_message": f"Your dashboard draft has {count} verified result{'s' if count != 1 else ''}. Review the items and choose what to add.",
        "artifacts": artifacts, "analytic_state": latest_state, "suggested_actions": [],
        "dashboard_draft": {
            "schema_version": "ai_chat_dashboard_draft_v1", "items": items,
            "persistence": "local_snapshot", "max_items": 4,
            "note": "This draft focuses on one metric and up to two named breakdowns. Saved results retain these values and filters. Dashboard slicers do not recompute snapshots. Ask a new question to update them.",
        },
    }
