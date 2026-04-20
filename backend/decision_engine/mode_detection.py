"""Mode and intent helpers for the Phase 4 decision chat engine."""

from __future__ import annotations

from typing import Any, Dict


CHART_INTENT_KEYWORDS = (
    "plot",
    "chart",
    "graph",
    "visualize",
    "visualise",
    "show me",
    "breakdown",
    "trend",
    "over time",
    "compare",
    "versus",
    " vs ",
)

DECISION_INTENT_KEYWORDS = (
    "decision",
    "should we",
    "how should we",
    "what should we do",
    "what do we do",
    "optimize",
    "optimise",
    "improve",
    "grow",
    "reduce",
    "without hurting",
    "while protecting",
    "protect",
    "guardrail",
    "constraint",
    "trade-off",
    "tradeoff",
)

DECISION_FOLLOW_UP_KEYWORDS = (
    "workspace",
    "assumption",
    "blocker",
    "missing input",
    "open workspace",
    "analyze workspace",
    "analyse workspace",
)


def is_visualization_request(message: str) -> bool:
    """Detect chart-like requests using the same plain-language posture as the UI."""
    lower_message = str(message or "").strip().lower()
    return any(keyword in lower_message for keyword in CHART_INTENT_KEYWORDS)


def is_decision_request(message: str) -> bool:
    """Detect decision framing prompts that should move chat into decide mode."""
    lower_message = str(message or "").strip().lower()
    return any(keyword in lower_message for keyword in DECISION_INTENT_KEYWORDS)


def detect_chat_mode(message: str, session_state: Dict[str, Any] | None = None) -> str:
    """
    Pick the current chat mode.

    The engine keeps this intentionally simple for the first slice so the
    contract is stable before deeper orchestration logic arrives.
    """
    session_state = session_state if isinstance(session_state, dict) else {}
    lower_message = str(message or "").strip().lower()
    active_mode = str(session_state.get("active_mode") or "").strip().lower()

    if any(keyword in lower_message for keyword in DECISION_FOLLOW_UP_KEYWORDS):
        return "decide"
    if is_visualization_request(lower_message):
        return "explore"
    if is_decision_request(lower_message):
        return "decide"
    if active_mode in {"explore", "decide"} and lower_message:
        return active_mode
    return "ask"
