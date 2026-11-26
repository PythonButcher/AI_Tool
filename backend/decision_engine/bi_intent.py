"""Small deterministic BI intent helpers; never generate numerical results."""

import re
from datetime import datetime, timedelta, timezone

# Explicit periods already supported by the semantic filter parser: an ISO
# range, a quarter plus year, or a month name plus year.
_EXPLICIT_PERIOD = re.compile(
    r"\b(?:from\s+\d{4}-|q[1-4][ -]?20\d{2}|(?:january|february|march|april|may|june|july|august|"
    r"september|october|november|december)\s+20\d{2})",
    re.I,
)
# "last month" and "previous month" mean the previous complete calendar month.
# Broader synonyms ("prior month", "this month", "last quarter") are deliberately
# excluded until they are reviewed as a separate contract change.
_RELATIVE_MONTH = re.compile(r"\b(?:last|previous)\s+month\b", re.I)
# Comparison wording. Category resolution still requires grounded dataset values.
_COMPARISON = re.compile(r"\b(?:compare|compared|comparing|comparison|versus|vs)\b", re.I)


def utc_today():
    """Clock seam for relative periods: the current calendar date in UTC.

    Tests patch this module attribute; callers must reach it through
    ``previous_calendar_month`` so one patch controls every relative period.
    """
    return datetime.now(timezone.utc).date()


def mentions_explicit_period(message):
    return bool(_EXPLICIT_PERIOD.search(str(message or "")))


def relative_month_mentions(message):
    """Count relative-month phrases; more than one signals an unsupported period comparison."""
    return len(_RELATIVE_MONTH.findall(str(message or "")))


def previous_calendar_month(today=None):
    """Return inclusive ISO ``(start, end)`` dates for the previous complete UTC month."""
    current = today or utc_today()
    last_day = current.replace(day=1) - timedelta(days=1)
    return last_day.replace(day=1).isoformat(), last_day.isoformat()


def is_comparison_request(message):
    return bool(_COMPARISON.search(str(message or "")))


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
