"""Small deterministic BI intent helpers; never generate numerical results."""

import re


def is_temporal(dimension):
    return dimension.get("semantic_kind") == "temporal" or dimension.get("data_type") in {"date", "datetime", "timestamp"}


def time_grain(message):
    for pattern, grain in ((r"\b(daily|day by day)\b", "day"), (r"\b(monthly|month by month)\b", "month"),
                           (r"\bquarterly\b", "quarter"), (r"\b(yearly|annually|annual)\b", "year")):
        if re.search(pattern, message, re.I):
            return grain
    return None


def clarification(message, definitions, original_question, kind, analytic_state):
    """Offer exact model references so a choice is revalidated on the next turn."""
    choices = [{
        "label": item.get("qualified_label") or item.get("label") or item.get("name") or item.get("id"),
        "user_message": f"{original_question} {kind}:{item.get('id') or item.get('field')}",
    } for item in definitions[:6]]
    return {
        "assistant_message": message,
        "artifacts": [{"type": "answer", "title": "Choose how to analyze", "content": {
            "message": message, "reason_code": "analytics_clarification_required", "choices": choices,
        }}],
        "analytic_state": analytic_state,
        "suggested_actions": [],
    }
