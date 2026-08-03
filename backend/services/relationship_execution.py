"""Compile and execute an explicitly selected workspace relationship tree.

The service is intentionally pandas-backed and bounded.  Callers provide only
durable workspace/source/relationship identities; persisted catalog and
relationship truth is reloaded and revalidated on every execution.
"""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, Iterable

import pandas as pd

from backend.repositories.source_relationship_repository import (
    SourceRelationshipRepositoryError,
    list_relationships as list_persisted_relationships,
)
from backend.repositories.source_workspace_repository import get_source, get_workspace
from backend.services.data_catalog_lineage import evaluate_dataset_readiness
from backend.services.dataset_context import load_datahub_dataset
from backend.services.semantic_model import (
    build_namespaced_semantic_model,
    infer_semantic_model_from_dataframe,
)
from backend.services.source_relationships import SourceRelationshipError, get_relationship
from backend.services.workspace_context import build_analysis_context


LINEAGE_VERSION = "multi_source_analysis_lineage_v1"
MAX_ROW_EXPANSION_RATIO = 5.0
MAX_EXECUTION_ROWS = 250_000


class RelationshipExecutionError(ValueError):
    """Stable refusal raised before an unsafe or ambiguous join can execute."""

    def __init__(self, code: str, message: str, diagnostics: Any = None):
        super().__init__(message)
        self.code = code
        self.diagnostics = diagnostics or []


def _required_context(value: Any) -> Dict[str, Any]:
    """Normalize the identity-only request boundary without trusting row data."""
    if not isinstance(value, dict):
        raise RelationshipExecutionError(
            "analysis_context_required", "analysis_context must be a JSON object."
        )
    required = (
        "workspace_id",
        "workspace_version",
        "primary_source_id",
        "source_ids",
        "relationship_ids",
    )
    missing = [field for field in required if value.get(field) is None]
    if missing:
        raise RelationshipExecutionError(
            "analysis_context_invalid",
            f"analysis_context is missing required fields: {', '.join(missing)}.",
        )
    source_ids = value.get("source_ids")
    relationship_ids = value.get("relationship_ids")
    if not isinstance(source_ids, list) or not isinstance(relationship_ids, list):
        raise RelationshipExecutionError(
            "analysis_context_invalid", "source_ids and relationship_ids must be ordered arrays."
        )
    normalized_sources = [str(item).strip() for item in source_ids]
    normalized_relationships = [str(item).strip() for item in relationship_ids]
    if (
        not normalized_sources
        or any(not item for item in normalized_sources)
        or any(not item for item in normalized_relationships)
        or len(normalized_sources) != len(set(normalized_sources))
        or len(normalized_relationships) != len(set(normalized_relationships))
    ):
        raise RelationshipExecutionError(
            "analysis_context_invalid", "Selected source and relationship IDs must be non-empty and unique."
        )
    try:
        workspace_version = int(value.get("workspace_version"))
    except (TypeError, ValueError) as exc:
        raise RelationshipExecutionError(
            "analysis_context_invalid", "workspace_version must be an integer."
        ) from exc
    return {
        "contract_version": "multi_source_workspace_v1",
        "workspace_id": str(value.get("workspace_id") or "").strip(),
        "workspace_version": workspace_version,
        "primary_source_id": str(value.get("primary_source_id") or "").strip(),
        "source_ids": normalized_sources,
        "relationship_ids": normalized_relationships,
    }


def _relationship_error(exc: SourceRelationshipError) -> RelationshipExecutionError:
    """Translate persistence/trust failures to the execution refusal contract."""
    return RelationshipExecutionError(exc.code, str(exc), getattr(exc, "diagnostics", []))


def _source_aliases(workspace: Dict[str, Any]) -> Dict[str, str]:
    """Return the persisted, workspace-unique aliases used for field namespaces."""
    return {
        item["source_id"]: item["alias"]
        for item in workspace.get("sources") or []
        if item.get("source_id") and item.get("alias")
    }


def _preflight_relationship_bounds(
    relationship: Dict[str, Any],
    *,
    primary_rows: int,
) -> None:
    """Refuse a validated join estimate that already exceeds hard ceilings."""
    profile = next(
        (
            diagnostic.get("evidence") or {}
            for diagnostic in (relationship.get("diagnostics") or [])
            if isinstance(diagnostic, dict)
            and diagnostic.get("code") == "relationship_key_profile"
        ),
        {},
    )
    estimated_rows = profile.get("estimated_join_rows")
    if not isinstance(estimated_rows, (int, float)):
        return
    estimated_ratio = float(estimated_rows) / max(primary_rows, 1)
    if estimated_rows > MAX_EXECUTION_ROWS or estimated_ratio > MAX_ROW_EXPANSION_RATIO:
        raise RelationshipExecutionError(
            "row_expansion_limit_exceeded",
            "The selected relationship path exceeds the bounded row-expansion ceiling.",
            [{
                "relationship_id": relationship["relationship_id"],
                "estimated_rows": int(estimated_rows),
                "estimated_ratio": round(estimated_ratio, 6),
                "maximum_rows": MAX_EXECUTION_ROWS,
                "maximum_ratio": MAX_ROW_EXPANSION_RATIO,
                "preflight": True,
            }],
        )


def resolve_active_model_analysis_context(workspace_id: Any) -> Dict[str, Any]:
    """Resolve the executable active Data Model into canonical ordered IDs.

    The workspace identity is the only caller input. Relationship selection is
    derived exclusively from persisted active-model truth and never activates,
    validates, repairs, or guesses an edge during chat.
    """
    normalized_workspace_id = str(workspace_id or "").strip()
    if not normalized_workspace_id:
        raise RelationshipExecutionError(
            "workspace_id_required",
            "workspace_id is required to resolve the current Data Model.",
        )

    workspace = get_workspace(normalized_workspace_id)
    if workspace is None:
        raise RelationshipExecutionError(
            "workspace_not_found",
            f"Workspace '{normalized_workspace_id}' was not found.",
        )
    try:
        persisted_relationships = list_persisted_relationships(normalized_workspace_id)
    except SourceRelationshipRepositoryError as exc:
        raise RelationshipExecutionError(exc.code, str(exc)) from exc

    # Inactive relationships are modeling drafts, not analysis paths. When no
    # active edge exists, the primary source remains the compatibility path.
    active_candidates = [
        relationship
        for relationship in persisted_relationships
        if relationship.get("is_active")
    ]
    if not active_candidates:
        return build_analysis_context(
            workspace,
            [workspace["primary_source_id"]],
        )

    member_ids = {
        membership["source_id"]
        for membership in workspace.get("sources") or []
        if membership.get("source_id")
    }
    executable_relationships = []
    for candidate in active_candidates:
        try:
            # Reconciliation can deactivate a relationship whose validation
            # fingerprints became stale after it was activated.
            relationship = get_relationship(
                normalized_workspace_id,
                candidate["relationship_id"],
            )
        except SourceRelationshipError as exc:
            raise _relationship_error(exc) from exc

        if relationship["validation_state"] == "stale" or not relationship["is_active"]:
            raise RelationshipExecutionError(
                "active_data_model_stale",
                "The active Data Model contains a stale relationship. Revalidate and reactivate it in Data Model.",
                relationship.get("diagnostics"),
            )
        if (
            relationship["validation_state"] != "valid"
            or not relationship["is_confirmed"]
            or relationship["cardinality"] == "many_to_many"
        ):
            raise RelationshipExecutionError(
                "active_data_model_not_executable",
                "The active Data Model contains a relationship that cannot execute. Repair its validation, confirmation, or cardinality in Data Model.",
                relationship.get("diagnostics"),
            )
        if (
            relationship["left_source_id"] not in member_ids
            or relationship["right_source_id"] not in member_ids
        ):
            raise RelationshipExecutionError(
                "active_data_model_source_missing",
                "The active Data Model references a source outside this workspace. Repair the relationship in Data Model.",
            )
        executable_relationships.append(relationship)

    primary_source_id = workspace["primary_source_id"]
    selected_source_ids = {primary_source_id}
    adjacency: Dict[str, set[str]] = {}
    for relationship in executable_relationships:
        left_id = relationship["left_source_id"]
        right_id = relationship["right_source_id"]
        selected_source_ids.update((left_id, right_id))
        adjacency.setdefault(left_id, set()).add(right_id)
        adjacency.setdefault(right_id, set()).add(left_id)

    connected = set()
    pending = [primary_source_id]
    while pending:
        source_id = pending.pop()
        if source_id in connected:
            continue
        connected.add(source_id)
        pending.extend(adjacency.get(source_id, set()) - connected)
    if connected != selected_source_ids:
        raise RelationshipExecutionError(
            "active_data_model_disconnected",
            "The active Data Model is disconnected from the workspace primary source. Connect or deactivate the isolated relationships in Data Model.",
        )

    # Workspace membership order is persisted and deterministic. Supplying it
    # to the existing compiler also makes relationship traversal deterministic.
    ordered_source_ids = [
        membership["source_id"]
        for membership in workspace.get("sources") or []
        if membership.get("source_id") in selected_source_ids
    ]
    try:
        ordered_relationships = _validate_graph(
            ordered_source_ids,
            executable_relationships,
            primary_source_id,
        )
    except RelationshipExecutionError as exc:
        raise RelationshipExecutionError(
            "active_data_model_ambiguous",
            "The active Data Model contains a cyclic or ambiguous relationship path. Repair the active relationships in Data Model.",
            [{"code": exc.code, "message": str(exc)}],
        ) from exc

    return build_analysis_context(
        workspace,
        ordered_source_ids,
        [relationship["relationship_id"] for relationship in ordered_relationships],
    )


def _validate_graph(
    source_ids: list[str], relationships: list[Dict[str, Any]], primary_source_id: str
) -> list[Dict[str, Any]]:
    """Require one explicit connected acyclic tree and derive deterministic order."""
    if primary_source_id not in source_ids:
        raise RelationshipExecutionError(
            "primary_source_not_selected", "The workspace primary source must be selected."
        )
    if len(source_ids) == 1:
        if relationships:
            raise RelationshipExecutionError(
                "relationship_path_invalid", "A one-source context cannot select relationships."
            )
        return []
    if len(relationships) != len(source_ids) - 1:
        raise RelationshipExecutionError(
            "ambiguous_relationship_path",
            "Selected relationships must form exactly one connected path tree across the selected sources.",
        )

    selected = set(source_ids)
    parent = {source_id: source_id for source_id in source_ids}

    def find(source_id: str) -> str:
        while parent[source_id] != source_id:
            parent[source_id] = parent[parent[source_id]]
            source_id = parent[source_id]
        return source_id

    for relationship in relationships:
        left_id = relationship["left_source_id"]
        right_id = relationship["right_source_id"]
        if left_id not in selected or right_id not in selected:
            raise RelationshipExecutionError(
                "relationship_source_not_selected",
                "Every selected relationship endpoint must be an explicitly selected source.",
            )
        left_root, right_root = find(left_id), find(right_id)
        if left_root == right_root:
            raise RelationshipExecutionError(
                "cyclic_relationship_path", "The selected relationship path contains a cycle."
            )
        parent[right_root] = left_root
    if len({find(source_id) for source_id in source_ids}) != 1:
        raise RelationshipExecutionError(
            "relationship_path_disconnected", "Selected relationships do not connect every selected source."
        )

    # Source order is caller-explicit and stable.  Relationship ID is a final
    # tie-breaker, never a mechanism for silently selecting an unrequested path.
    source_position = {source_id: index for index, source_id in enumerate(source_ids)}
    joined = {primary_source_id}
    remaining = list(relationships)
    ordered = []
    while remaining:
        candidates = []
        for relationship in remaining:
            endpoints = {relationship["left_source_id"], relationship["right_source_id"]}
            if len(endpoints & joined) == 1:
                new_source = next(iter(endpoints - joined))
                candidates.append((source_position[new_source], relationship["relationship_id"], relationship))
        if not candidates:
            raise RelationshipExecutionError(
                "ambiguous_relationship_path", "The selected path cannot be ordered from the primary source."
            )
        _, _, chosen = min(candidates, key=lambda item: (item[0], item[1]))
        ordered.append(chosen)
        joined.update((chosen["left_source_id"], chosen["right_source_id"]))
        remaining.remove(chosen)
    return ordered


def _complete_key_set(frame: pd.DataFrame, fields: Iterable[str]) -> set[tuple[Any, ...]]:
    """Build aggregate-only key evidence; values never leave this service."""
    field_list = list(fields)
    complete = frame[field_list].dropna(how="any")
    return set(complete.itertuples(index=False, name=None))


def _unmatched_diagnostics(
    left: pd.DataFrame, right: pd.DataFrame, left_fields: list[str], right_fields: list[str]
) -> Dict[str, Any]:
    """Return safe observed unmatched-key counts and rates for one join step."""
    left_keys = _complete_key_set(left, left_fields)
    right_keys = _complete_key_set(right, right_fields)
    left_unmatched = len(left_keys - right_keys)
    right_unmatched = len(right_keys - left_keys)
    return {
        "left_distinct_key_count": len(left_keys),
        "right_distinct_key_count": len(right_keys),
        "left_unmatched_key_count": left_unmatched,
        "right_unmatched_key_count": right_unmatched,
        "left_unmatched_rate": round(left_unmatched / len(left_keys), 6) if left_keys else 0.0,
        "right_unmatched_rate": round(right_unmatched / len(right_keys), 6) if right_keys else 0.0,
    }


def _merge_how(join_behavior: str, current_is_left: bool) -> str:
    """Preserve configured relationship orientation while joining from primary."""
    if join_behavior == "full":
        return "outer"
    if join_behavior == "inner":
        return "inner"
    if current_is_left:
        return join_behavior
    return "right" if join_behavior == "left" else "left"


def _aggregate_governance(
    sources: list[Dict[str, Any]], frames: Dict[str, pd.DataFrame]
) -> Dict[str, Any]:
    """Re-evaluate and conservatively roll up governance for every source."""
    items = []
    status_rank = {"ready": 0, "warning": 1, "blocked": 2}
    overall = "ready"
    for source in sources:
        source_id = source["source_id"]
        readiness = evaluate_dataset_readiness(
            frames[source_id], source.get("governance_policy"), operation="multi_source_analysis"
        )
        overall = max((overall, readiness["status"]), key=lambda item: status_rank[item])
        items.append({"source_id": source_id, "readiness": readiness})
    blocking = next(
        (item["readiness"] for item in items if item["readiness"]["status"] == "blocked"),
        None,
    )
    return {
        "schema_version": "multi_source_governance_v1",
        "status": overall,
        "severity": "critical" if overall == "blocked" else "warning" if overall == "warning" else "none",
        "next_action": (
            blocking["next_action"]
            if blocking
            else "Review source-level warnings." if overall == "warning" else "All selected sources are ready."
        ),
        "sources": items,
    }


def execute_analysis_context(value: Any) -> Dict[str, Any]:
    """Resolve identities, compile an explicit path, and return one bounded bundle."""
    context = _required_context(value)
    workspace = get_workspace(context["workspace_id"])
    if workspace is None:
        raise RelationshipExecutionError(
            "workspace_not_found", f"Workspace '{context['workspace_id']}' was not found."
        )
    if workspace["version"] != context["workspace_version"]:
        raise RelationshipExecutionError(
            "workspace_version_stale",
            f"Workspace version {context['workspace_version']} is stale; current version is {workspace['version']}.",
        )
    if workspace["primary_source_id"] != context["primary_source_id"]:
        raise RelationshipExecutionError(
            "primary_source_mismatch", "analysis_context primary_source_id does not match workspace truth."
        )

    member_ids = {item["source_id"] for item in workspace.get("sources") or []}
    if any(source_id not in member_ids for source_id in context["source_ids"]):
        raise RelationshipExecutionError(
            "source_not_in_workspace", "Every selected source must belong to the requested workspace."
        )
    sources = []
    frames: Dict[str, pd.DataFrame] = {}
    models: Dict[str, Dict[str, Any]] = {}
    for source_id in context["source_ids"]:
        source = get_source(source_id)
        if source is None:
            raise RelationshipExecutionError("source_not_found", f"Source '{source_id}' was not found.")
        try:
            bundle = load_datahub_dataset(source_id)
        except Exception as exc:
            raise RelationshipExecutionError(
                "source_unavailable", f"Source '{source_id}' could not be loaded for analysis."
            ) from exc
        sources.append(source)
        frames[source_id] = bundle["dataframe"].copy()
        models[source_id] = bundle.get("semantic_model") or infer_semantic_model_from_dataframe(
            frames[source_id],
            dataset_name=source["name"],
            dataset_id=source_id,
            source="workspace_relationship_execution",
        )

    governance = _aggregate_governance(sources, frames)
    if governance["status"] == "blocked":
        raise RelationshipExecutionError(
            "multi_source_governance_blocked",
            "Governance blocked at least one selected source.",
            governance["sources"],
        )

    relationships = []
    for relationship_id in context["relationship_ids"]:
        try:
            relationship = get_relationship(context["workspace_id"], relationship_id)
        except SourceRelationshipError as exc:
            raise _relationship_error(exc) from exc
        if relationship["cardinality"] == "many_to_many":
            raise RelationshipExecutionError(
                "many_to_many_execution_unsupported", "Many-to-many relationship execution is not supported."
            )
        if relationship["validation_state"] != "valid":
            raise RelationshipExecutionError(
                "relationship_not_freshly_valid",
                "Every selected relationship must have fresh valid evidence.",
                relationship.get("diagnostics"),
            )
        if not relationship["is_active"] or not relationship["is_confirmed"]:
            raise RelationshipExecutionError(
                "relationship_not_active", "Every selected relationship must be active and explicitly confirmed."
            )
        relationships.append(relationship)

    ordered_relationships = _validate_graph(
        context["source_ids"], relationships, context["primary_source_id"]
    )
    if len(context["source_ids"]) == 1:
        source = sources[0]
        source_id = source["source_id"]
        return {
            "dataframe": frames[source_id],
            "semantic_model": models[source_id],
            "governance_policy": source.get("governance_policy"),
            "governance_readiness": governance,
            "dataset_ref": {
                "source": "datahub",
                "dataset_id": source_id,
                "dataset_name": source["name"],
            },
            "analysis_context": context,
            "analysis_lineage": None,
        }
    aliases = _source_aliases(workspace)
    field_origins: Dict[str, Dict[str, Any]] = {}
    namespaced_frames: Dict[str, pd.DataFrame] = {}
    for source_id in context["source_ids"]:
        alias = aliases[source_id]
        rename = {column: f"{alias}.{column}" for column in frames[source_id].columns}
        namespaced_frames[source_id] = frames[source_id].rename(columns=rename)
        for original, namespaced in rename.items():
            field_origins[namespaced] = {
                "source_id": source_id,
                "source_alias": alias,
                "source_field": str(original),
            }

    primary_id = context["primary_source_id"]
    result = namespaced_frames[primary_id].copy()
    result.insert(0, "__primary_row_id", range(len(result.index)))
    primary_rows = len(result.index)
    joined_sources = {primary_id}
    join_order = []
    for step, relationship in enumerate(ordered_relationships, start=1):
        _preflight_relationship_bounds(
            relationship,
            primary_rows=primary_rows,
        )
        left_id, right_id = relationship["left_source_id"], relationship["right_source_id"]
        current_is_left = left_id in joined_sources
        new_source_id = right_id if current_is_left else left_id
        new_frame = namespaced_frames[new_source_id]
        relationship_left_fields = [
            f"{aliases[left_id]}.{pair['left_field']}" for pair in relationship["field_pairs"]
        ]
        relationship_right_fields = [
            f"{aliases[right_id]}.{pair['right_field']}" for pair in relationship["field_pairs"]
        ]
        current_fields = relationship_left_fields if current_is_left else relationship_right_fields
        new_fields = relationship_right_fields if current_is_left else relationship_left_fields
        unmatched = _unmatched_diagnostics(result, new_frame, current_fields, new_fields)
        input_rows = len(result.index)
        result = result.merge(
            new_frame,
            how=_merge_how(relationship["join_behavior"], current_is_left),
            left_on=current_fields,
            right_on=new_fields,
            sort=False,
            copy=False,
        )
        output_rows = len(result.index)
        expansion_ratio = output_rows / max(primary_rows, 1)
        if output_rows > MAX_EXECUTION_ROWS or expansion_ratio > MAX_ROW_EXPANSION_RATIO:
            raise RelationshipExecutionError(
                "row_expansion_limit_exceeded",
                "The selected relationship path exceeds the bounded row-expansion ceiling.",
                [{
                    "relationship_id": relationship["relationship_id"],
                    "observed_rows": output_rows,
                    "observed_ratio": round(expansion_ratio, 6),
                    "maximum_rows": MAX_EXECUTION_ROWS,
                    "maximum_ratio": MAX_ROW_EXPANSION_RATIO,
                }],
            )
        join_order.append({
            "step": step,
            "relationship_id": relationship["relationship_id"],
            "from_source_id": left_id if current_is_left else right_id,
            "to_source_id": new_source_id,
            "join_behavior": relationship["join_behavior"],
            "left_fields": relationship_left_fields,
            "right_fields": relationship_right_fields,
            "input_row_count": input_rows,
            "output_row_count": output_rows,
            "observed_step_fanout": round(output_rows / max(input_rows, 1), 6),
            "unmatched_keys": unmatched,
        })
        joined_sources.add(new_source_id)

    primary_counts = result["__primary_row_id"].value_counts(dropna=True)
    observed_fanout = {
        "primary_source_row_count": primary_rows,
        "result_row_count": len(result.index),
        "row_expansion_ratio": round(len(result.index) / max(primary_rows, 1), 6),
        "maximum_observed_primary_fanout": int(primary_counts.max()) if not primary_counts.empty else 0,
        "non_primary_result_row_count": int(result["__primary_row_id"].isna().sum()),
        "ceiling": {
            "maximum_rows": MAX_EXECUTION_ROWS,
            "maximum_ratio": MAX_ROW_EXPANSION_RATIO,
        },
    }
    result = result.drop(columns=["__primary_row_id"])
    semantic_model = build_namespaced_semantic_model(
        sources=sources,
        semantic_models=models,
        aliases=aliases,
        workspace=workspace,
    )
    lineage = {
        "schema_version": LINEAGE_VERSION,
        "workspace_id": workspace["workspace_id"],
        "workspace_version": workspace["version"],
        "primary_source_id": primary_id,
        "source_ids": list(context["source_ids"]),
        "relationship_ids": list(context["relationship_ids"]),
        "sources": [
            {
                "source_id": source["source_id"],
                "source_alias": aliases[source["source_id"]],
                "source_name": source["name"],
                "content_fingerprint": source["content_fingerprint"],
                "schema_version": source["schema_version"],
            }
            for source in sources
        ],
        "relationships": [
            {
                "relationship_id": item["relationship_id"],
                "version": item["version"],
                "left_source_id": item["left_source_id"],
                "right_source_id": item["right_source_id"],
                "field_pairs": deepcopy(item["field_pairs"]),
                "cardinality": item["cardinality"],
                "join_behavior": item["join_behavior"],
                "source_fingerprints": deepcopy(item["source_fingerprints"]),
            }
            for item in ordered_relationships
        ],
        "field_origins": field_origins,
        "join_order": join_order,
        "observed_fanout": observed_fanout,
        "primary_grain": {
            "source_id": primary_id,
            "source_alias": aliases[primary_id],
            "anchored_join_order": True,
        },
    }
    return {
        "dataframe": result,
        "semantic_model": semantic_model,
        "governance_policy": None,
        "governance_readiness": governance,
        "dataset_ref": {
            "source": "workspace",
            "dataset_id": workspace["workspace_id"],
            "dataset_name": workspace["name"],
        },
        "analysis_context": context,
        "analysis_lineage": lineage,
    }
