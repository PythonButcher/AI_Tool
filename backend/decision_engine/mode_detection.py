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
    "simulation",
    "simulate",
    "autonomous",
    "final recommendation",
    "recommendation",
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


def normalize_requested_mode(requested_mode: Any) -> str | None:
    """Normalize the user-controlled mode selector without guessing intent."""
    normalized = str(requested_mode or "").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "auto": "auto",
        "ask": "ask",
        "ask_data": "ask",
        "explore": "explore",
        "decide": "decide",
    }
    return aliases.get(normalized)


def detect_chat_mode(
    message: str,
    session_state: Dict[str, Any] | None = None,
    requested_mode: Any = None,
) -> str:
    """
    Pick the current chat mode.

    The engine keeps this intentionally simple for the first slice so the
    contract is stable before deeper orchestration logic arrives.
    """
    return detect_chat_mode_details(message, session_state, requested_mode=requested_mode)["mode"]


def detect_chat_mode_details(
    message: str,
    session_state: Dict[str, Any] | None = None,
    requested_mode: Any = None,
) -> Dict[str, Any]:
    """
    Return both the selected mode and the plain-language reason for that choice.

    Slice 1 needs the frontend to understand why a mode is active, not just the
    mode value itself.
    """
    session_state = session_state if isinstance(session_state, dict) else {}
    lower_message = str(message or "").strip().lower()
    active_mode = str(session_state.get("active_mode") or "").strip().lower()
    normalized_requested_mode = normalize_requested_mode(requested_mode)

    # A mode chosen by the user is authoritative. ``auto`` deliberately falls
    # through to backend routing so prior inferred state cannot masquerade as
    # an explicit choice.
    if normalized_requested_mode in {"ask", "explore", "decide"}:
        labels = {"ask": "Ask data", "explore": "Explore", "decide": "Decide"}
        return {
            "mode": normalized_requested_mode,
            "reason_code": "explicit_mode_override",
            "reason": f"The user explicitly selected {labels[normalized_requested_mode]} mode.",
            "selection_source": "explicit",
            "requires_confirmation": False,
        }

    visualization_request = is_visualization_request(lower_message)
    decision_request = is_decision_request(lower_message)

    # Auto mode must not silently choose charting or decision framing when the
    # same prompt contains strong cues for both workflows.
    if visualization_request and decision_request:
        return {
            "mode": "ask",
            "reason_code": "ambiguous_chart_decision_comparison",
            "reason": (
                "The prompt could mean a descriptive chart comparison or a decision trade-off, "
                "so the user must choose which workflow to run."
            ),
            "selection_source": "auto",
            "requires_confirmation": True,
            "confirmation_modes": ["explore", "decide"],
        }

    if any(keyword in lower_message for keyword in DECISION_FOLLOW_UP_KEYWORDS):
        return {
            "mode": "decide",
            "reason_code": "decision_follow_up",
            "reason": "The message refers to decision-workspace follow-up steps, so decide mode stays active.",
        }
    if visualization_request:
        return {
            "mode": "explore",
            "reason_code": "visualization_request",
            "reason": "The message explicitly asks for a chart, comparison, or visual breakdown, so explore mode is active.",
        }
    if decision_request:
        return {
            "mode": "decide",
            "reason_code": "decision_request",
            "reason": "The message reads like decision framing or trade-off language, so decide mode is active.",
        }
    if active_mode in {"explore", "decide"} and lower_message:
        continuation_reason = (
            "The message continues the current analytical thread, so explore mode remains active."
            if active_mode == "explore"
            else "The message continues the current decision thread, so decide mode remains active."
        )
        return {
            "mode": active_mode,
            "reason_code": "continue_active_mode",
            "reason": continuation_reason,
        }
    return {
        "mode": "ask",
        "reason_code": "default_question",
        "reason": "No stronger analytic or decision cue was detected, so ask mode is active.",
    }
