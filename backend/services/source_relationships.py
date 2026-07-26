"""Profiling and trust validation for governed workspace relationships.

The service reads source data only to produce diagnostics. It never merges
dataframes, returns joined rows, or changes the existing single-source context.
"""

from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from itertools import combinations
import json
import re
from typing import Any, Dict, Iterable
from uuid import uuid4

import pandas as pd
from pandas.api.types import (
    is_bool_dtype,
    is_datetime64_any_dtype,
    is_numeric_dtype,
    is_string_dtype,
)

from backend.repositories.source_relationship_repository import (
    SourceRelationshipRepositoryError,
    create_relationship as persist_relationship,
    delete_relationship as delete_persisted_relationship,
    get_relationship as get_persisted_relationship,
    list_relationships as list_persisted_relationships,
    update_relationship as update_persisted_relationship,
)
from backend.repositories.source_workspace_repository import get_source, get_workspace
from backend.services.dataset_context import load_datahub_dataset


CARDINALITIES = {"one_to_one", "one_to_many", "many_to_one", "many_to_many"}
JOIN_BEHAVIORS = {"inner", "left", "right", "full"}
FILTER_DIRECTIONS = {"none", "left_to_right", "right_to_left", "both"}
ROW_MULTIPLICATION_WARNING = 2.0


class SourceRelationshipError(ValueError):
    """Stable service error suitable for route translation."""

    def __init__(self, code: str, message: str, diagnostics=None):
        super().__init__(message)
        self.code = code
        self.diagnostics = diagnostics or []


def _utc_now() -> str:
    """Return a timezone-aware timestamp in the project's public format."""
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _diagnostic(
    code: str,
    severity: str,
    message: str,
    next_action: str,
    **evidence,
) -> Dict[str, Any]:
    """Build deterministic, value-safe validation evidence."""
    item = {
        "code": code,
        "severity": severity,
        "message": message,
        "next_action": next_action,
    }
    if evidence:
        item["evidence"] = evidence
    return item


def _raise_repository_error(exc: SourceRelationshipRepositoryError):
    """Translate repository invariants without leaking SQL details."""
    raise SourceRelationshipError(exc.code, str(exc)) from exc


def _normalize_field_pairs(value: Any) -> list[Dict[str, str]]:
    """Validate ordered composite-key pairs and reject duplicate components."""
    if not isinstance(value, list) or not value:
        raise SourceRelationshipError(
            "invalid_field_pairs", "field_pairs must contain at least one ordered field pair."
        )
    normalized = []
    seen_left = set()
    seen_right = set()
    for position, item in enumerate(value):
        if not isinstance(item, dict):
            raise SourceRelationshipError(
                "invalid_field_pairs", f"field_pairs[{position}] must be an object."
            )
        left_field = str(item.get("left_field") or "").strip()
        right_field = str(item.get("right_field") or "").strip()
        if not left_field or not right_field:
            raise SourceRelationshipError(
                "invalid_field_pairs",
                f"field_pairs[{position}] requires left_field and right_field.",
            )
        if left_field in seen_left or right_field in seen_right:
            raise SourceRelationshipError(
                "invalid_field_pairs", "Composite relationship fields must not repeat."
            )
        seen_left.add(left_field)
        seen_right.add(right_field)
        normalized.append({"left_field": left_field, "right_field": right_field})
    return normalized


def _normalize_contract(payload: Dict[str, Any], *, require_sources: bool) -> Dict[str, Any]:
    """Normalize caller configuration before any durable write."""
    if not isinstance(payload, dict):
        raise SourceRelationshipError("invalid_relationship", "A JSON relationship object is required.")
    normalized: Dict[str, Any] = {}
    if require_sources or "left_source_id" in payload:
        normalized["left_source_id"] = str(payload.get("left_source_id") or "").strip()
    if require_sources or "right_source_id" in payload:
        normalized["right_source_id"] = str(payload.get("right_source_id") or "").strip()
    if require_sources and (not normalized["left_source_id"] or not normalized["right_source_id"]):
        raise SourceRelationshipError(
            "invalid_relationship", "left_source_id and right_source_id are required."
        )
    if (
        "left_source_id" in normalized
        and "right_source_id" in normalized
        and normalized["left_source_id"] == normalized["right_source_id"]
    ):
        raise SourceRelationshipError(
            "invalid_relationship", "A relationship must connect two different sources."
        )
    if require_sources or "field_pairs" in payload:
        normalized["field_pairs"] = _normalize_field_pairs(payload.get("field_pairs"))

    enum_fields = {
        "cardinality": (CARDINALITIES, "one_to_many"),
        "join_behavior": (JOIN_BEHAVIORS, "left"),
        "filter_direction": (FILTER_DIRECTIONS, "left_to_right"),
    }
    for field, (allowed, default) in enum_fields.items():
        if require_sources or field in payload:
            value = payload.get(field, default)
            if value not in allowed:
                raise SourceRelationshipError(
                    "invalid_relationship",
                    f"{field} must be one of {sorted(allowed)}.",
                )
            normalized[field] = value
    if "is_suggested" in payload:
        normalized["is_suggested"] = bool(payload["is_suggested"])
    if "is_confirmed" in payload:
        normalized["is_confirmed"] = bool(payload["is_confirmed"])
    return normalized


def _source_fingerprints(left_source: Dict[str, Any], right_source: Dict[str, Any]) -> Dict[str, Any]:
    """Capture both content and schema identities used during validation."""
    return {
        "left": {
            "source_id": left_source["source_id"],
            "content_fingerprint": left_source["content_fingerprint"],
            "schema_version": left_source["schema_version"],
        },
        "right": {
            "source_id": right_source["source_id"],
            "content_fingerprint": right_source["content_fingerprint"],
            "schema_version": right_source["schema_version"],
        },
    }


def _dtype_family(series: pd.Series) -> str:
    """Map implementation-specific pandas dtypes to compatibility families."""
    if is_bool_dtype(series.dtype):
        return "boolean"
    if is_numeric_dtype(series.dtype):
        return "numeric"
    if is_datetime64_any_dtype(series.dtype):
        return "datetime"
    if is_string_dtype(series.dtype) or series.dtype == object:
        return "string"
    return str(series.dtype)


def _key_series(frame: pd.DataFrame, fields: list[str]) -> pd.Series:
    """Build hashable composite keys while retaining null-bearing rows."""
    if len(fields) == 1:
        return frame[fields[0]].map(lambda value: (value,))
    return frame[fields].apply(lambda row: tuple(row.tolist()), axis=1)


def _non_null_keys(frame: pd.DataFrame, fields: list[str]) -> pd.Series:
    """Return key tuples only for rows with every composite component present."""
    complete = frame[fields].notna().all(axis=1)
    return _key_series(frame.loc[complete], fields)


def _profile_keys(
    left: pd.DataFrame,
    right: pd.DataFrame,
    left_fields: list[str],
    right_fields: list[str],
) -> Dict[str, Any]:
    """Compute aggregate trust evidence without exposing source values."""
    left_complete = left[left_fields].notna().all(axis=1)
    right_complete = right[right_fields].notna().all(axis=1)
    left_keys = _non_null_keys(left, left_fields)
    right_keys = _non_null_keys(right, right_fields)
    left_counts = left_keys.value_counts(dropna=False)
    right_counts = right_keys.value_counts(dropna=False)
    left_key_set = set(left_counts.index)
    right_key_set = set(right_counts.index)
    overlap = left_key_set & right_key_set
    estimated_rows = int(sum(int(left_counts[key]) * int(right_counts[key]) for key in overlap))
    left_rows = int(left.shape[0])
    right_rows = int(right.shape[0])
    return {
        "left_row_count": left_rows,
        "right_row_count": right_rows,
        "left_null_rate": round(1.0 - (float(left_complete.sum()) / max(left_rows, 1)), 6),
        "right_null_rate": round(1.0 - (float(right_complete.sum()) / max(right_rows, 1)), 6),
        "left_unique": bool(left_counts.empty or (left_counts <= 1).all()),
        "right_unique": bool(right_counts.empty or (right_counts <= 1).all()),
        "left_distinct_keys": int(len(left_key_set)),
        "right_distinct_keys": int(len(right_key_set)),
        "left_unmatched_key_count": int(len(left_key_set - right_key_set)),
        "right_unmatched_key_count": int(len(right_key_set - left_key_set)),
        "left_unmatched_rate": round(float(len(left_key_set - right_key_set)) / max(len(left_key_set), 1), 6),
        "right_unmatched_rate": round(float(len(right_key_set - left_key_set)) / max(len(right_key_set), 1), 6),
        "estimated_join_rows": estimated_rows,
        "estimated_row_multiplication": round(float(estimated_rows) / max(left_rows, 1), 6),
    }


def _declared_cardinality_matches(cardinality: str, profile: Dict[str, Any]) -> bool:
    """Compare observed key uniqueness with the declared relationship grain."""
    left_unique = profile["left_unique"]
    right_unique = profile["right_unique"]
    return {
        "one_to_one": left_unique and right_unique,
        "one_to_many": left_unique,
        "many_to_one": right_unique,
        "many_to_many": not left_unique and not right_unique,
    }[cardinality]


def _active_edges(workspace_id: str, excluded_id: str) -> list[tuple[str, str]]:
    """Return the active source graph without the relationship being validated."""
    return [
        (item["left_source_id"], item["right_source_id"])
        for item in list_persisted_relationships(workspace_id)
        if item["is_active"] and item["relationship_id"] != excluded_id
    ]


def _has_path(edges: Iterable[tuple[str, str]], start: str, target: str) -> bool:
    """Test undirected reachability for cycle and path-ambiguity diagnostics."""
    adjacency: Dict[str, set[str]] = {}
    for left, right in edges:
        adjacency.setdefault(left, set()).add(right)
        adjacency.setdefault(right, set()).add(left)
    pending = [start]
    visited = set()
    while pending:
        node = pending.pop()
        if node == target:
            return True
        if node in visited:
            continue
        visited.add(node)
        pending.extend(adjacency.get(node, set()) - visited)
    return False


def _topology_diagnostics(relationship: Dict[str, Any]) -> list[Dict[str, Any]]:
    """Explain whether activating this edge would create competing join paths."""
    edges = _active_edges(relationship["workspace_id"], relationship["relationship_id"])
    if not _has_path(edges, relationship["left_source_id"], relationship["right_source_id"]):
        return []
    return [
        _diagnostic(
            "relationship_cycle",
            "error",
            "Activating this relationship would create a cycle in the workspace source graph.",
            "Keep this relationship inactive or deactivate another edge in the cycle.",
        ),
        _diagnostic(
            "ambiguous_active_path",
            "error",
            "The sources would have more than one active relationship path.",
            "Leave exactly one active path between these sources before execution is introduced.",
        ),
    ]


def _load_validation_inputs(relationship: Dict[str, Any]):
    """Load member identities and source frames using existing source resolution."""
    workspace = get_workspace(relationship["workspace_id"])
    if workspace is None:
        raise SourceRelationshipError(
            "workspace_not_found", f"Workspace '{relationship['workspace_id']}' was not found."
        )
    member_ids = {item["source_id"] for item in workspace["sources"]}
    sources = []
    frames = []
    for source_id in (relationship["left_source_id"], relationship["right_source_id"]):
        source = get_source(source_id)
        if source is None:
            raise SourceRelationshipError("source_not_found", f"Source '{source_id}' was not found.")
        if source_id not in member_ids:
            raise SourceRelationshipError(
                "source_not_in_workspace",
                f"Source '{source_id}' is not a member of workspace '{relationship['workspace_id']}'.",
            )
        try:
            frame = load_datahub_dataset(source_id)["dataframe"]
        except Exception as exc:
            raise SourceRelationshipError(
                "source_unavailable", f"Source '{source_id}' could not be profiled."
            ) from exc
        sources.append(source)
        frames.append(frame)
    return sources[0], sources[1], frames[0], frames[1]


def _evaluate_relationship(relationship: Dict[str, Any]) -> Dict[str, Any]:
    """Produce a complete validation result without persisting joined data."""
    left_source, right_source, left, right = _load_validation_inputs(relationship)
    diagnostics: list[Dict[str, Any]] = []
    left_fields = [pair["left_field"] for pair in relationship["field_pairs"]]
    right_fields = [pair["right_field"] for pair in relationship["field_pairs"]]
    missing_left = [field for field in left_fields if field not in left.columns]
    missing_right = [field for field in right_fields if field not in right.columns]
    if missing_left or missing_right:
        diagnostics.append(
            _diagnostic(
                "relationship_field_missing",
                "error",
                "One or more configured relationship fields are absent from the current source schemas.",
                "Select fields that exist in both sources and validate again.",
                missing_left_fields=missing_left,
                missing_right_fields=missing_right,
            )
        )
        return {
            "validation_state": "invalid",
            "diagnostics": diagnostics,
            "source_fingerprints": _source_fingerprints(left_source, right_source),
        }

    incompatible = []
    for left_field, right_field in zip(left_fields, right_fields):
        left_family = _dtype_family(left[left_field])
        right_family = _dtype_family(right[right_field])
        if left_family != right_family:
            incompatible.append(
                {
                    "left_field": left_field,
                    "left_type": left_family,
                    "right_field": right_field,
                    "right_type": right_family,
                }
            )
    if incompatible:
        diagnostics.append(
            _diagnostic(
                "relationship_type_mismatch",
                "error",
                "Configured relationship fields have incompatible data types.",
                "Normalize the key types or choose compatible fields.",
                incompatible_pairs=incompatible,
            )
        )
        return {
            "validation_state": "invalid",
            "diagnostics": diagnostics,
            "source_fingerprints": _source_fingerprints(left_source, right_source),
        }

    profile = _profile_keys(left, right, left_fields, right_fields)
    diagnostics.append(
        _diagnostic(
            "relationship_key_profile",
            "info",
            "Relationship keys were profiled for uniqueness, nulls, and overlap.",
            "Review the aggregate evidence before confirming the relationship.",
            **profile,
        )
    )
    if profile["left_null_rate"] or profile["right_null_rate"]:
        diagnostics.append(
            _diagnostic(
                "relationship_key_nulls",
                "warning",
                "Some rows have null relationship-key components.",
                "Review whether null-key rows should remain unmatched.",
                left_null_rate=profile["left_null_rate"],
                right_null_rate=profile["right_null_rate"],
            )
        )
    if profile["left_unmatched_key_count"] or profile["right_unmatched_key_count"]:
        diagnostics.append(
            _diagnostic(
                "relationship_unmatched_keys",
                "warning",
                "Some distinct keys do not have a counterpart in the other source.",
                "Review unmatched-key rates and the configured join behavior.",
                left_unmatched_key_count=profile["left_unmatched_key_count"],
                right_unmatched_key_count=profile["right_unmatched_key_count"],
                left_unmatched_rate=profile["left_unmatched_rate"],
                right_unmatched_rate=profile["right_unmatched_rate"],
            )
        )
    if not _declared_cardinality_matches(relationship["cardinality"], profile):
        diagnostics.append(
            _diagnostic(
                "declared_cardinality_mismatch",
                "error",
                "Observed key uniqueness does not support the declared cardinality.",
                "Correct the cardinality or clean duplicate keys before confirmation.",
                declared_cardinality=relationship["cardinality"],
                left_unique=profile["left_unique"],
                right_unique=profile["right_unique"],
            )
        )
    if profile["estimated_row_multiplication"] > ROW_MULTIPLICATION_WARNING:
        diagnostics.append(
            _diagnostic(
                "estimated_row_multiplication",
                "warning",
                "The key profile indicates material row multiplication if execution is later enabled.",
                "Review duplicate keys and grain before joined execution is implemented.",
                estimated_join_rows=profile["estimated_join_rows"],
                estimated_row_multiplication=profile["estimated_row_multiplication"],
                warning_threshold=ROW_MULTIPLICATION_WARNING,
            )
        )
    diagnostics.extend(_topology_diagnostics(relationship))

    error_codes = {item["code"] for item in diagnostics if item["severity"] == "error"}
    if relationship["cardinality"] == "many_to_many":
        diagnostics.append(
            _diagnostic(
                "many_to_many_execution_unsupported",
                "error",
                "Many-to-many relationship execution is not supported.",
                "Keep the relationship inactive or remodel it through a governed bridge source.",
            )
        )
        validation_state = "blocked"
    elif {"relationship_cycle", "ambiguous_active_path"} & error_codes:
        validation_state = "blocked"
    elif error_codes:
        validation_state = "invalid"
    else:
        validation_state = "valid"
    return {
        "validation_state": validation_state,
        "diagnostics": diagnostics,
        "source_fingerprints": _source_fingerprints(left_source, right_source),
    }


def create_relationship(workspace_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Persist an explicit relationship as inactive and initially unvalidated."""
    contract = _normalize_contract(payload, require_sources=True)
    timestamp = _utc_now()
    record = {
        "relationship_id": f"rel_{uuid4().hex}",
        "workspace_id": workspace_id,
        **contract,
        "is_active": False,
        "is_suggested": bool(contract.get("is_suggested", False)),
        "is_confirmed": bool(contract.get("is_confirmed", False)),
        "validation_state": "unvalidated",
        "diagnostics": [],
        "source_fingerprints": {},
        "version": 1,
        "created_at": timestamp,
        "updated_at": timestamp,
        "validated_at": None,
    }
    try:
        return persist_relationship(record)
    except SourceRelationshipRepositoryError as exc:
        _raise_repository_error(exc)


def _is_stale(relationship: Dict[str, Any]) -> bool:
    """Compare current source identities with the last validation snapshot."""
    if not relationship["validated_at"] or not relationship["source_fingerprints"]:
        return False
    current_sources = [
        get_source(relationship["left_source_id"]),
        get_source(relationship["right_source_id"]),
    ]
    if any(source is None for source in current_sources):
        return True
    return _source_fingerprints(*current_sources) != relationship["source_fingerprints"]


def _reconcile_staleness(relationship: Dict[str, Any]) -> Dict[str, Any]:
    """Persist a one-time stale transition when source content or schema changed."""
    if relationship["validation_state"] == "stale" or not _is_stale(relationship):
        return relationship
    diagnostics = [
        _diagnostic(
            "relationship_source_stale",
            "error",
            "A source fingerprint or schema version changed after relationship validation.",
            "Validate the relationship against the current sources before activation.",
        )
    ]
    try:
        return update_persisted_relationship(
            relationship["workspace_id"],
            relationship["relationship_id"],
            {
                "is_active": False,
                "validation_state": "stale",
                "diagnostics": diagnostics,
                "updated_at": _utc_now(),
            },
            expected_version=relationship["version"],
        )
    except SourceRelationshipRepositoryError as exc:
        _raise_repository_error(exc)


def get_relationship(workspace_id: str, relationship_id: str) -> Dict[str, Any]:
    """Retrieve an isolated relationship and surface staleness immediately."""
    relationship = get_persisted_relationship(workspace_id, relationship_id)
    if relationship is None:
        # Avoid revealing whether the stable ID exists in a different workspace.
        raise SourceRelationshipError(
            "relationship_not_found",
            f"Relationship '{relationship_id}' was not found in workspace '{workspace_id}'.",
        )
    return _reconcile_staleness(relationship)


def list_relationships(workspace_id: str) -> list[Dict[str, Any]]:
    """Retrieve workspace relationships and reconcile every validation snapshot."""
    try:
        relationships = list_persisted_relationships(workspace_id)
    except SourceRelationshipRepositoryError as exc:
        _raise_repository_error(exc)
    return [_reconcile_staleness(item) for item in relationships]


def validate_relationship(workspace_id: str, relationship_id: str) -> Dict[str, Any]:
    """Re-profile a relationship and persist explainable trust diagnostics."""
    relationship = get_relationship(workspace_id, relationship_id)
    result = _evaluate_relationship(relationship)
    timestamp = _utc_now()
    try:
        return update_persisted_relationship(
            workspace_id,
            relationship_id,
            {
                # Any validation failure automatically removes an unsafe active edge.
                "is_active": relationship["is_active"] and result["validation_state"] == "valid",
                **result,
                "validated_at": timestamp,
                "updated_at": timestamp,
            },
            expected_version=relationship["version"],
        )
    except SourceRelationshipRepositoryError as exc:
        _raise_repository_error(exc)


def update_relationship(
    workspace_id: str, relationship_id: str, payload: Dict[str, Any]
) -> Dict[str, Any]:
    """Update configuration, invalidate old evidence, and guard activation."""
    relationship = get_relationship(workspace_id, relationship_id)
    expected_version = payload.get("version") if isinstance(payload, dict) else None
    requested_active = bool(payload.get("is_active")) if isinstance(payload, dict) and "is_active" in payload else None
    contract = _normalize_contract(payload, require_sources=False)
    configuration_fields = {
        "left_source_id", "right_source_id", "field_pairs", "cardinality",
        "join_behavior", "filter_direction",
    }
    changes = dict(contract)
    if configuration_fields & set(changes):
        changes.update(
            {
                "is_active": False,
                "validation_state": "unvalidated",
                "diagnostics": [],
                "source_fingerprints": {},
                "validated_at": None,
            }
        )
    if "is_confirmed" in payload:
        changes["is_confirmed"] = bool(payload["is_confirmed"])
    changes["updated_at"] = _utc_now()
    if changes.keys() == {"updated_at"} and requested_active is None:
        return relationship
    try:
        updated = update_persisted_relationship(
            workspace_id,
            relationship_id,
            changes,
            expected_version=expected_version,
        )
    except SourceRelationshipRepositoryError as exc:
        _raise_repository_error(exc)

    if requested_active is None or not requested_active:
        if requested_active is False and updated["is_active"]:
            try:
                updated = update_persisted_relationship(
                    workspace_id,
                    relationship_id,
                    {"is_active": False, "updated_at": _utc_now()},
                    expected_version=updated["version"],
                )
            except SourceRelationshipRepositoryError as exc:
                _raise_repository_error(exc)
        return updated

    if not updated["is_confirmed"]:
        raise SourceRelationshipError(
            "relationship_confirmation_required",
            "Explicit confirmation is required before a relationship can become active.",
        )
    validated = validate_relationship(workspace_id, relationship_id)
    if validated["validation_state"] != "valid":
        raise SourceRelationshipError(
            "relationship_not_activatable",
            "Only a freshly valid relationship can become active.",
            validated["diagnostics"],
        )
    try:
        return update_persisted_relationship(
            workspace_id,
            relationship_id,
            {"is_active": True, "updated_at": _utc_now()},
            expected_version=validated["version"],
        )
    except SourceRelationshipRepositoryError as exc:
        _raise_repository_error(exc)


def delete_relationship(workspace_id: str, relationship_id: str) -> None:
    """Delete one relationship without affecting either source record."""
    try:
        delete_persisted_relationship(workspace_id, relationship_id, updated_at=_utc_now())
    except SourceRelationshipRepositoryError as exc:
        _raise_repository_error(exc)


def _normalized_field_name(field: str) -> str:
    """Normalize names for conservative evidence-backed candidate matching."""
    return re.sub(r"[^a-z0-9]", "", field.lower())


def profile_candidates(workspace_id: str) -> list[Dict[str, Any]]:
    """Suggest inactive single-field candidates from compatible names and profiles."""
    workspace = get_workspace(workspace_id)
    if workspace is None:
        raise SourceRelationshipError(
            "workspace_not_found", f"Workspace '{workspace_id}' was not found."
        )
    candidates = []
    members = workspace["sources"]
    for left_member, right_member in combinations(members, 2):
        left_source = get_source(left_member["source_id"])
        right_source = get_source(right_member["source_id"])
        try:
            left = load_datahub_dataset(left_member["source_id"])["dataframe"]
            right = load_datahub_dataset(right_member["source_id"])["dataframe"]
        except Exception as exc:
            raise SourceRelationshipError(
                "source_unavailable", "A workspace source could not be profiled for candidates."
            ) from exc
        right_by_name = {_normalized_field_name(str(field)): str(field) for field in right.columns}
        for left_field in map(str, left.columns):
            right_field = right_by_name.get(_normalized_field_name(left_field))
            if not right_field or _dtype_family(left[left_field]) != _dtype_family(right[right_field]):
                continue
            profile = _profile_keys(left, right, [left_field], [right_field])
            overlap_count = min(profile["left_distinct_keys"], profile["right_distinct_keys"])
            matched_ratio = 1.0 - max(profile["left_unmatched_rate"], profile["right_unmatched_rate"])
            if overlap_count == 0 or matched_ratio <= 0:
                continue
            if profile["left_unique"] and profile["right_unique"]:
                cardinality = "one_to_one"
            elif profile["left_unique"]:
                cardinality = "one_to_many"
            elif profile["right_unique"]:
                cardinality = "many_to_one"
            else:
                cardinality = "many_to_many"
            identity = json.dumps(
                [workspace_id, left_source["source_id"], left_field, right_source["source_id"], right_field],
                separators=(",", ":"),
            )
            candidates.append(
                {
                    "candidate_id": f"cand_{sha256(identity.encode('utf-8')).hexdigest()[:24]}",
                    "workspace_id": workspace_id,
                    "left_source_id": left_source["source_id"],
                    "right_source_id": right_source["source_id"],
                    "field_pairs": [{"left_field": left_field, "right_field": right_field}],
                    "cardinality": cardinality,
                    "join_behavior": "left",
                    "filter_direction": "left_to_right",
                    "is_active": False,
                    "is_suggested": True,
                    "is_confirmed": False,
                    "confidence": round(max(0.0, min(1.0, 0.6 + (0.4 * matched_ratio))), 6),
                    "evidence": {
                        "field_name_match": True,
                        "type_family": _dtype_family(left[left_field]),
                        "matched_key_ratio": round(matched_ratio, 6),
                        "left_unique": profile["left_unique"],
                        "right_unique": profile["right_unique"],
                    },
                    "explanation": "Matching field names, compatible types, and overlapping profiled keys support this proposal but do not prove join correctness.",
                    "confirmation_required": True,
                }
            )
    return sorted(candidates, key=lambda item: (-item["confidence"], item["candidate_id"]))
