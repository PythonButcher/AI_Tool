"""Dataset governance policy and explainable readiness checks.

This module intentionally has no Flask dependency so every ingestion and
execution route can apply identical quality gates before creating artifacts.
"""

from __future__ import annotations

from datetime import datetime, timezone
import re
from typing import Any, Dict, Iterable, List, Optional

import pandas as pd


DEFAULT_NULL_THRESHOLD = 0.40
_KEY_PATTERN = re.compile(r"(^id$|(^|[_\s-])id$|key$)", re.IGNORECASE)
_PII_PATTERNS = {
    "email": re.compile(r"e[-_\s]?mail", re.IGNORECASE),
    "phone": re.compile(r"phone|mobile|telephone", re.IGNORECASE),
    "government_id": re.compile(r"ssn|social security|tax id|passport|national id", re.IGNORECASE),
    "payment": re.compile(r"credit.?card|card.?number|bank.?account|routing", re.IGNORECASE),
    "personal_name": re.compile(r"^(full )?name$|first.?name|last.?name", re.IGNORECASE),
    "address": re.compile(r"address|street|postal|zip.?code", re.IGNORECASE),
}


class GovernancePolicyError(ValueError):
    """Raised when a caller submits an invalid governance policy."""


def normalize_governance_policy(policy: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Return the compact, stable policy shape used by all quality gates."""
    raw = policy or {}
    if not isinstance(raw, dict):
        raise GovernancePolicyError("governance_policy must be a JSON object.")

    required_fields = _string_list(raw.get("required_fields") or raw.get("requiredFields"))
    duplicate_keys = _string_list(raw.get("duplicate_keys") or raw.get("duplicateKeys"))
    null_thresholds = _normalize_null_thresholds(raw.get("null_thresholds") or raw.get("nullThresholds"))
    value_ranges = _normalize_value_ranges(raw.get("value_ranges") or raw.get("valueRanges"))

    freshness = raw.get("freshness") or {}
    retention = raw.get("retention") or {}
    pii = raw.get("pii") or raw.get("pii_handling") or {}
    if not isinstance(freshness, dict) or not isinstance(retention, dict) or not isinstance(pii, dict):
        raise GovernancePolicyError("freshness, retention, and pii policy values must be JSON objects.")

    return {
        "required_fields": required_fields,
        "null_thresholds": null_thresholds,
        "duplicate_keys": duplicate_keys,
        "value_ranges": value_ranges,
        "freshness": dict(freshness),
        "pii": {"mode": str(pii.get("mode") or "warning").lower(), "enabled": pii.get("enabled", True)},
        "retention": dict(retention),
    }


def evaluate_dataset_readiness(
    dataframe: pd.DataFrame,
    policy: Optional[Dict[str, Any]] = None,
    *,
    operation: str = "analysis",
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Evaluate a dataframe without exposing values that may be sensitive.

    A policy can require fields and keys, tighten null limits, define numeric
    ranges, and opt into freshness, PII, and retention checks. Heuristic
    defaults produce visible warnings; only explicit policy violations and
    non-negotiable data failures block downstream work.
    """
    normalized_policy = normalize_governance_policy(policy)
    reasons: List[Dict[str, str]] = []
    if not isinstance(dataframe, pd.DataFrame):
        _add_reason(reasons, "invalid_dataset", "critical", "The dataset is not a tabular dataframe.", "Upload or send a valid table of row objects.")
        return _readiness_payload(reasons, normalized_policy, operation, row_count=0, column_count=0)

    row_count, column_count = len(dataframe.index), len(dataframe.columns)
    if row_count == 0 or column_count == 0:
        _add_reason(reasons, "empty_dataset", "critical", "The dataset has no usable rows or columns.", "Provide at least one row and one named column before running analysis.")
        return _readiness_payload(reasons, normalized_policy, operation, row_count=row_count, column_count=column_count)

    columns = {str(column): column for column in dataframe.columns}
    for field in normalized_policy["required_fields"]:
        if field not in columns:
            _add_reason(reasons, "required_field_missing", "critical", f"Required field '{field}' is missing.", f"Add '{field}' or change the required_fields policy.", field=field)

    thresholds = normalized_policy["null_thresholds"]
    for field_name, column in columns.items():
        threshold = thresholds["fields"].get(field_name, thresholds["default"])
        null_ratio = float(dataframe[column].isna().mean())
        if null_ratio > threshold:
            # A default null threshold is a quality signal, not an implicit
            # schema contract. Explicit policies retain blocking enforcement.
            severity = "critical" if thresholds["configured"] else "warning"
            _add_reason(
                reasons,
                "null_threshold_exceeded",
                severity,
                f"Field '{field_name}' is {null_ratio:.0%} null, above its {threshold:.0%} limit.",
                f"Fill, remove, or relax the null policy for '{field_name}'.",
                field=field_name,
            )

    configured_keys = normalized_policy["duplicate_keys"]
    inferred_keys = [field_name for field_name in columns if _KEY_PATTERN.search(field_name)]
    for key in _unique(configured_keys + inferred_keys):
        if key not in columns:
            if key in configured_keys:
                _add_reason(reasons, "duplicate_key_missing", "critical", f"Configured key '{key}' is missing.", f"Add '{key}' or remove it from duplicate_keys.", field=key)
            continue
        series = dataframe[columns[key]]
        duplicate_count = int(series.notna().sum() - series.dropna().nunique())
        if duplicate_count:
            # A field merely named "id" is only a likely key. It becomes a
            # blocking condition only when the caller explicitly declares it.
            severity = "critical" if key in configured_keys else "warning"
            _add_reason(
                reasons,
                "duplicate_key_values",
                severity,
                f"Key '{key}' contains {duplicate_count} duplicate non-null value(s).",
                f"Deduplicate '{key}' or select a composite key before continuing.",
                field=key,
            )

    for field, bounds in normalized_policy["value_ranges"].items():
        if field not in columns:
            _add_reason(reasons, "range_field_missing", "critical", f"Range policy references missing field '{field}'.", f"Add '{field}' or remove its value_ranges rule.", field=field)
            continue
        numeric = pd.to_numeric(dataframe[columns[field]], errors="coerce")
        invalid = pd.Series(False, index=numeric.index)
        if bounds["min"] is not None:
            invalid |= numeric < bounds["min"]
        if bounds["max"] is not None:
            invalid |= numeric > bounds["max"]
        if bool(invalid.fillna(False).any()):
            _add_reason(
                reasons,
                "value_range_violation",
                "critical",
                f"Field '{field}' contains values outside its allowed range.",
                f"Correct values in '{field}' or change its value_ranges rule.",
                field=field,
            )

    _evaluate_freshness(dataframe, columns, normalized_policy["freshness"], reasons, now)
    _evaluate_pii(columns, normalized_policy["pii"], reasons)
    _evaluate_retention(normalized_policy["retention"], reasons, now)
    return _readiness_payload(reasons, normalized_policy, operation, row_count=row_count, column_count=column_count)


def is_blocked(readiness: Dict[str, Any]) -> bool:
    """Centralize the blocking rule used by all routes."""
    return readiness.get("status") == "blocked"


def governance_error_payload(readiness: Dict[str, Any]) -> Dict[str, Any]:
    """Build a consistent HTTP error body without leaking raw dataset rows."""
    return {
        "error": "Dataset governance check blocked this operation.",
        "governance_readiness": readiness,
    }


def _normalize_null_thresholds(value: Any) -> Dict[str, Any]:
    if value is None:
        return {"default": DEFAULT_NULL_THRESHOLD, "fields": {}, "configured": False}
    if isinstance(value, (int, float)):
        return {"default": _ratio(value, "null_thresholds"), "fields": {}, "configured": True}
    if not isinstance(value, dict):
        raise GovernancePolicyError("null_thresholds must be a ratio or an object.")
    default = _ratio(value.get("default", DEFAULT_NULL_THRESHOLD), "null_thresholds.default")
    # Preserve an explicitly empty fields map when a normalized policy is
    # evaluated again at a later route boundary.
    fields = value["fields"] if "fields" in value else {
        key: item for key, item in value.items() if key not in {"default", "configured"}
    }
    if not isinstance(fields, dict):
        raise GovernancePolicyError("null_thresholds.fields must be an object.")
    return {
        "default": default,
        "fields": {str(key): _ratio(item, f"null_thresholds.{key}") for key, item in fields.items()},
        "configured": True,
    }


def _normalize_value_ranges(value: Any) -> Dict[str, Dict[str, Optional[float]]]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise GovernancePolicyError("value_ranges must be an object.")
    normalized: Dict[str, Dict[str, Optional[float]]] = {}
    for field, bounds in value.items():
        if not isinstance(bounds, dict):
            raise GovernancePolicyError(f"value_ranges.{field} must be an object.")
        lower, upper = bounds.get("min"), bounds.get("max")
        lower = float(lower) if lower is not None else None
        upper = float(upper) if upper is not None else None
        if lower is not None and upper is not None and lower > upper:
            raise GovernancePolicyError(f"value_ranges.{field}.min cannot exceed max.")
        normalized[str(field)] = {"min": lower, "max": upper}
    return normalized


def _evaluate_freshness(dataframe: pd.DataFrame, columns: Dict[str, Any], policy: Dict[str, Any], reasons: List[Dict[str, str]], now: Optional[datetime]) -> None:
    field = str(policy.get("field") or policy.get("column") or "").strip()
    if not field:
        return
    if field not in columns:
        severity = "critical" if policy.get("required") else "warning"
        _add_reason(reasons, "freshness_field_missing", severity, f"Freshness field '{field}' is missing.", f"Add a timestamp field '{field}' or update freshness policy.", field=field)
        return
    timestamps = pd.to_datetime(dataframe[columns[field]], errors="coerce", utc=True).dropna()
    if timestamps.empty:
        _add_reason(reasons, "freshness_unavailable", "critical", f"Freshness field '{field}' has no valid timestamps.", f"Provide parseable timestamps in '{field}'.", field=field)
        return
    max_age_days = policy.get("max_age_days", policy.get("maxAgeDays"))
    if max_age_days is None:
        return
    age_days = ((pd.Timestamp(now or datetime.now(timezone.utc)) - timestamps.max()).total_seconds() / 86400)
    if age_days > float(max_age_days):
        _add_reason(reasons, "dataset_stale", "critical", f"Latest '{field}' value is {age_days:.1f} days old, beyond the {float(max_age_days):.0f}-day limit.", "Refresh the dataset or relax the freshness policy.", field=field)


def _evaluate_pii(columns: Dict[str, Any], policy: Dict[str, Any], reasons: List[Dict[str, str]]) -> None:
    if policy.get("enabled", True) is False:
        return
    mode = str(policy.get("mode") or "warning").lower()
    severity = "critical" if mode == "block" else "warning"
    for field in columns:
        pii_type = next((label for label, pattern in _PII_PATTERNS.items() if pattern.search(field)), None)
        if pii_type:
            action = "continuing" if severity == "critical" else "sharing"
            _add_reason(
                reasons,
                "pii_detected",
                severity,
                f"Field '{field}' appears to contain {pii_type.replace('_', ' ')} data.",
                f"Remove, mask, or explicitly approve handling for '{field}' before {action}.",
                field=field,
            )


def _evaluate_retention(policy: Dict[str, Any], reasons: List[Dict[str, str]], now: Optional[datetime]) -> None:
    expires_at = policy.get("expires_at") or policy.get("expiresAt")
    if not expires_at:
        return
    try:
        expiry = pd.Timestamp(expires_at, tz="UTC")
    except (TypeError, ValueError):
        _add_reason(reasons, "retention_policy_invalid", "warning", "Retention expiry is not a valid timestamp.", "Set retention.expires_at to an ISO-8601 timestamp.")
        return
    if expiry <= pd.Timestamp(now or datetime.now(timezone.utc)):
        _add_reason(reasons, "retention_expired", "critical", "The dataset is past its retention expiry.", "Delete or refresh the dataset and obtain a new retention approval.")


def _readiness_payload(reasons: List[Dict[str, str]], policy: Dict[str, Any], operation: str, *, row_count: int, column_count: int) -> Dict[str, Any]:
    status = "blocked" if any(reason["severity"] == "critical" for reason in reasons) else "warning" if reasons else "ready"
    next_action = next((reason["next_action"] for reason in reasons if reason["severity"] == "critical"), None) or (reasons[0]["next_action"] if reasons else "Dataset is ready for this operation.")
    return {"status": status, "operation": operation, "reasons": reasons, "severity": "critical" if status == "blocked" else "warning" if status == "warning" else "none", "next_action": next_action, "row_count": row_count, "column_count": column_count, "policy": policy}


def _add_reason(reasons: List[Dict[str, str]], code: str, severity: str, message: str, next_action: str, *, field: Optional[str] = None) -> None:
    reason = {"code": code, "severity": severity, "message": message, "next_action": next_action}
    if field:
        reason["field"] = field
    reasons.append(reason)


def _ratio(value: Any, name: str) -> float:
    try:
        ratio = float(value)
    except (TypeError, ValueError) as exc:
        raise GovernancePolicyError(f"{name} must be a number from 0 to 1.") from exc
    if not 0 <= ratio <= 1:
        raise GovernancePolicyError(f"{name} must be a number from 0 to 1.")
    return ratio


def _string_list(value: Any) -> List[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise GovernancePolicyError("Policy field lists must be arrays of strings.")
    return [str(item).strip() for item in value if str(item).strip()]


def _unique(values: Iterable[str]) -> List[str]:
    return list(dict.fromkeys(values))
