"""Immutable persistence for saved AI Chat decision reviews."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional, Sequence
from uuid import uuid4

from backend.db.backend_db import get_db_connection
from backend.services.decision_output_service import DecisionOutputService
from backend.services.decision_support import DecisionServiceError


class DecisionAssetService:
    """Store and retrieve bounded, observational Decision Output snapshots."""

    SCHEMA_VERSION = "di_decision_asset_v1"
    TRUTH_BOUNDARY = "observational_analysis_only"
    GRAPH_SCHEMA_VERSION = "di_phase7_3_decision_graph_v1"
    GRAPH_PERSISTENCE = "client_session_or_saved_decision_asset"
    DEFAULT_LIST_LIMIT = 25
    MAX_LIST_LIMIT = 50
    MAX_SNAPSHOT_BYTES = 512 * 1024
    MAX_TITLE_LENGTH = 200
    SNAPSHOT_NOTICE = (
        "Saved immutable observational snapshot. It does not refresh live data, "
        "produce a final recommendation, or make an autonomous decision."
    )
    COMPARISON_NOTICE = (
        "Historical saved DecisionAsset comparison only. It compares stored snapshots "
        "and does not refresh live data, infer causality, run a simulation, or choose a final decision."
    )

    _FORBIDDEN_KEYS = {
        "chattranscript",
        "chattranscripts",
        "conversationhistory",
        "chathistory",
        "chatmessages",
        "datarows",
        "datasetrows",
        "datasetrecords",
        "rawdata",
        "rawdataset",
        "rawdatasetrows",
        "rawrecords",
        "messages",
        "transcript",
    }
    _FORBIDDEN_PATH_KEYS = {"datahubpath", "datasetpath", "filepath", "storagepath"}
    _DECISION_OUTPUT_FIELDS = {
        "type",
        "render_hint",
        "inspectable",
        "default_view",
        "schema_version",
        "title",
        "summary",
        "dataset_trust",
        "frame",
        "readiness",
        "correction_state",
        "evidence_board",
        "decision_map",
        "scenario_compare",
        "advanced_readiness",
        "advanced_gates",
        "command_center",
        "export_sections",
        "source_refs",
        "truth_boundary",
    }
    _VALID_TRANSFORM_STATES = {"cleaned", "raw", "transformed", "unknown"}
    _VALID_STALE_STATES = {"current", "possibly_stale", "unknown", "not_applicable"}
    _VALID_GRAPH_MODES = {"evidence_coverage", "observed_association", "mixed"}

    @classmethod
    def create_asset(cls, payload: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(payload, dict):
            raise DecisionServiceError("Decision asset requests must be JSON objects.")

        decision_output = cls._validate_decision_output(payload.get("decision_output"))
        graph_state = cls._validate_graph_state(payload.get("graph_state"))
        title = cls._normalize_title(payload.get("title"), decision_output["title"])
        created_at = datetime.now(timezone.utc).isoformat()
        asset_id = f"decision_asset_{uuid4().hex}"
        decision_output_json = cls._serialize_snapshot(decision_output, "decision_output")
        graph_state_json = (
            cls._serialize_snapshot(graph_state, "graph_state") if graph_state is not None else None
        )
        dataset_label = cls._dataset_label(decision_output["dataset_trust"])
        readiness_state = str(
            (decision_output.get("readiness") or {}).get("readiness_state") or "unknown"
        )

        conn = get_db_connection()
        try:
            conn.execute(
                '''
                INSERT INTO decision_assets
                (asset_id, schema_version, title, created_at, decision_output_json,
                 graph_state_json, dataset_label, readiness_state, truth_boundary)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''',
                (
                    asset_id,
                    cls.SCHEMA_VERSION,
                    title,
                    created_at,
                    decision_output_json,
                    graph_state_json,
                    dataset_label,
                    readiness_state,
                    cls.TRUTH_BOUNDARY,
                ),
            )
            conn.commit()
        finally:
            conn.close()

        return cls._asset_response(
            asset_id=asset_id,
            title=title,
            created_at=created_at,
            decision_output=decision_output,
            graph_state=graph_state,
        )

    @classmethod
    def list_assets(
        cls,
        limit: Optional[Any] = None,
        filters: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, List[Dict[str, Any]]]:
        normalized_limit = cls._normalize_limit(limit)
        normalized_filters = cls._normalize_filters(filters)
        clauses = []
        parameters: List[Any] = []
        if normalized_filters.get("readiness_state"):
            clauses.append("readiness_state = ?")
            parameters.append(normalized_filters["readiness_state"])
        if normalized_filters.get("truth_boundary"):
            clauses.append("truth_boundary = ?")
            parameters.append(normalized_filters["truth_boundary"])
        if normalized_filters.get("dataset_label"):
            clauses.append("LOWER(dataset_label) LIKE ?")
            parameters.append(f"%{normalized_filters['dataset_label'].lower()}%")
        if normalized_filters.get("query"):
            clauses.append("(LOWER(title) LIKE ? OR LOWER(dataset_label) LIKE ?)")
            query_value = f"%{normalized_filters['query'].lower()}%"
            parameters.extend([query_value, query_value])
        if normalized_filters.get("has_graph_state") is not None:
            clauses.append(
                "graph_state_json IS NOT NULL"
                if normalized_filters["has_graph_state"]
                else "graph_state_json IS NULL"
            )
        if normalized_filters.get("created_from"):
            clauses.append("created_at >= ?")
            parameters.append(normalized_filters["created_from"])
        if normalized_filters.get("created_to"):
            clauses.append("created_at <= ?")
            parameters.append(normalized_filters["created_to"])
        archived_state = normalized_filters.get("archived_state") or "active"
        if archived_state == "active":
            clauses.append("archived_at IS NULL")
        elif archived_state == "archived":
            clauses.append("archived_at IS NOT NULL")

        where_clause = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        parameters.append(normalized_limit)
        conn = get_db_connection()
        try:
            rows = conn.execute(
                f'''
                SELECT asset_id, title, created_at, dataset_label, readiness_state, truth_boundary,
                       decision_output_json, graph_state_json, archived_at
                FROM decision_assets
                {where_clause}
                ORDER BY created_at DESC, rowid DESC
                LIMIT ?
                ''',
                parameters,
            ).fetchall()
        finally:
            conn.close()

        return {"assets": [cls._asset_summary_from_row(row) for row in rows]}

    @classmethod
    def get_asset(cls, asset_id: str) -> Optional[Dict[str, Any]]:
        if not isinstance(asset_id, str) or not asset_id.strip():
            return None

        conn = get_db_connection()
        try:
            row = conn.execute(
                '''
                SELECT asset_id, schema_version, title, created_at, decision_output_json, graph_state_json
                     , archived_at
                FROM decision_assets
                WHERE asset_id = ?
                ''',
                (asset_id,),
            ).fetchone()
        finally:
            conn.close()

        if row is None:
            return None
        return cls._asset_response(
            asset_id=row["asset_id"],
            title=row["title"],
            created_at=row["created_at"],
            decision_output=json.loads(row["decision_output_json"]),
            graph_state=json.loads(row["graph_state_json"]) if row["graph_state_json"] else None,
            schema_version=row["schema_version"],
            archived_at=row["archived_at"],
        )

    @classmethod
    def export_asset(cls, asset_id: str) -> Optional[Dict[str, Any]]:
        asset = cls.get_asset(asset_id)
        if asset is None:
            return None

        decision_output = asset["decision_output"]
        export_sections = cls._json_copy(
            {"sections": decision_output.get("export_sections") or []},
            "export_sections",
        )["sections"]
        return {
            "schema_version": "di_decision_asset_export_v1",
            "asset_id": asset["asset_id"],
            "title": asset["title"],
            "created_at": asset["created_at"],
            "snapshot_notice": cls.SNAPSHOT_NOTICE,
            "export_source": "saved_decision_asset_snapshot",
            "export_sections": export_sections,
            "dataset_trust": decision_output.get("dataset_trust"),
            "source_refs": decision_output.get("source_refs"),
            "truth_boundary": decision_output.get("truth_boundary"),
            "review_metadata": asset["review_metadata"],
            "provenance": asset["provenance"],
        }

    @classmethod
    def archive_asset(cls, asset_id: str) -> Optional[Dict[str, Any]]:
        if not isinstance(asset_id, str) or not asset_id.strip():
            return None
        archived_at = datetime.now(timezone.utc).isoformat()
        conn = get_db_connection()
        try:
            cursor = conn.execute(
                '''
                UPDATE decision_assets
                SET archived_at = ?
                WHERE asset_id = ?
                ''',
                (archived_at, asset_id),
            )
            conn.commit()
        finally:
            conn.close()
        if cursor.rowcount == 0:
            return None
        return cls.get_asset(asset_id)

    @classmethod
    def restore_asset(cls, asset_id: str) -> Optional[Dict[str, Any]]:
        if not isinstance(asset_id, str) or not asset_id.strip():
            return None
        conn = get_db_connection()
        try:
            cursor = conn.execute(
                '''
                UPDATE decision_assets
                SET archived_at = NULL
                WHERE asset_id = ?
                ''',
                (asset_id,),
            )
            conn.commit()
        finally:
            conn.close()
        if cursor.rowcount == 0:
            return None
        return cls.get_asset(asset_id)

    @classmethod
    def delete_asset(cls, asset_id: str) -> bool:
        if not isinstance(asset_id, str) or not asset_id.strip():
            return False
        conn = get_db_connection()
        try:
            cursor = conn.execute(
                '''
                DELETE FROM decision_assets
                WHERE asset_id = ?
                ''',
                (asset_id,),
            )
            conn.commit()
        finally:
            conn.close()
        return cursor.rowcount > 0

    @classmethod
    def compare_assets(cls, payload: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(payload, dict):
            raise DecisionServiceError("Decision asset comparison requests must be JSON objects.")
        asset_ids = cls._normalize_asset_ids(payload.get("asset_ids"))
        assets = []
        for asset_id in asset_ids:
            asset = cls.get_asset(asset_id)
            if asset is None:
                raise DecisionServiceError(f"Decision asset was not found: {asset_id}.")
            assets.append(asset)

        items = [cls._comparison_item(asset) for asset in assets]
        return {
            "schema_version": "di_decision_asset_comparison_v1",
            "comparison_kind": "historical_snapshot_comparison",
            "asset_ids": asset_ids,
            "snapshot_notice": cls.COMPARISON_NOTICE,
            "items": items,
            "differences": cls._comparison_differences(items),
            "truth_boundary": cls.TRUTH_BOUNDARY,
            "unsupported_capabilities": [
                "live_saved_asset_refresh",
                "simulation",
                "optimization",
                "autonomous_decisioning",
                "final_recommendation",
                "causal_proof",
            ],
        }

    @classmethod
    def _asset_response(
        cls,
        *,
        asset_id: str,
        title: str,
        created_at: str,
        decision_output: Dict[str, Any],
        graph_state: Optional[Dict[str, Any]],
        schema_version: Optional[str] = None,
        archived_at: Optional[str] = None,
    ) -> Dict[str, Any]:
        asset = {
            "asset_id": asset_id,
            "schema_version": schema_version or cls.SCHEMA_VERSION,
            "title": title,
            "created_at": created_at,
            "archived_at": archived_at,
            "lifecycle_state": "archived" if archived_at else "active",
            "decision_output": decision_output,
            "snapshot_notice": cls.SNAPSHOT_NOTICE,
        }
        if graph_state is not None:
            asset["graph_state"] = graph_state
        asset["review_metadata"] = cls._review_metadata(decision_output, graph_state)
        asset["provenance"] = cls._provenance(decision_output)
        asset["snapshot_export"] = cls._snapshot_export_metadata(decision_output)
        return asset

    @classmethod
    def _validate_decision_output(cls, value: Any) -> Dict[str, Any]:
        if not isinstance(value, dict):
            raise DecisionServiceError("decision_output is required and must be an object.")
        cls._reject_unsafe_content(value, "decision_output")
        unexpected_fields = sorted(set(value) - cls._DECISION_OUTPUT_FIELDS)
        if unexpected_fields:
            raise DecisionServiceError(
                "decision_output contains fields outside the current snapshot contract: "
                f"{', '.join(unexpected_fields)}."
            )
        if value.get("type") != "decision_output" or value.get("render_hint") != "decision_output":
            raise DecisionServiceError("decision_output must be the current decision_output artifact.")
        if value.get("schema_version") != "di_phase3_decision_output_v1":
            raise DecisionServiceError("decision_output has an unsupported schema_version.")
        if value.get("truth_boundary") != cls.TRUTH_BOUNDARY:
            raise DecisionServiceError(
                "decision_output.truth_boundary must be observational_analysis_only."
            )
        if not isinstance(value.get("title"), str) or not value["title"].strip():
            raise DecisionServiceError("decision_output.title is required.")
        if not isinstance(value.get("source_refs"), dict):
            raise DecisionServiceError("decision_output.source_refs is required.")
        if not isinstance(value.get("export_sections"), list):
            raise DecisionServiceError("decision_output.export_sections is required.")
        if not isinstance(value.get("dataset_trust"), dict):
            raise DecisionServiceError("decision_output.dataset_trust is required.")
        cls._validate_dataset_trust(value["dataset_trust"])
        return cls._json_copy(value, "decision_output")

    @classmethod
    def _validate_dataset_trust(cls, trust: Dict[str, Any]) -> None:
        required = {
            "source_label": str,
            "semantic_ready": bool,
            "transform_state": str,
            "stale_state": str,
        }
        for field, expected_type in required.items():
            if not isinstance(trust.get(field), expected_type):
                raise DecisionServiceError(f"decision_output.dataset_trust.{field} is invalid.")
        for field in ("row_count", "column_count"):
            value = trust.get(field)
            if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                raise DecisionServiceError(f"decision_output.dataset_trust.{field} is invalid.")
        if trust["transform_state"] not in cls._VALID_TRANSFORM_STATES:
            raise DecisionServiceError("decision_output.dataset_trust.transform_state is invalid.")
        if trust["stale_state"] not in cls._VALID_STALE_STATES:
            raise DecisionServiceError("decision_output.dataset_trust.stale_state is invalid.")
        warnings = trust.get("warnings")
        if not isinstance(warnings, list) or not all(isinstance(item, str) for item in warnings):
            raise DecisionServiceError("decision_output.dataset_trust.warnings must be a string array.")

        dataset = trust.get("dataset")
        if dataset is not None:
            if not isinstance(dataset, dict):
                raise DecisionServiceError("decision_output.dataset_trust.dataset is invalid.")
            if not isinstance(dataset.get("source"), str) or not isinstance(dataset.get("dataset_name"), str):
                raise DecisionServiceError("decision_output.dataset_trust.dataset is invalid.")
            if dataset.get("dataset_id") is not None and not isinstance(dataset.get("dataset_id"), str):
                raise DecisionServiceError("decision_output.dataset_trust.dataset.dataset_id is invalid.")
            for field in ("row_count", "column_count"):
                value = dataset.get(field)
                if isinstance(value, bool) or not isinstance(value, int) or value < 0:
                    raise DecisionServiceError(
                        f"decision_output.dataset_trust.dataset.{field} is invalid."
                    )

    @classmethod
    def _validate_graph_state(cls, value: Any) -> Optional[Dict[str, Any]]:
        if value is None:
            return None
        if not isinstance(value, dict):
            raise DecisionServiceError("graph_state must be an object when provided.")
        cls._reject_unsafe_content(value, "graph_state")
        if value.get("schema_version") != cls.GRAPH_SCHEMA_VERSION:
            raise DecisionServiceError("graph_state has an unsupported schema_version.")
        if value.get("state_kind") != "decision_graph_build_state":
            raise DecisionServiceError("graph_state.state_kind must be decision_graph_build_state.")
        if value.get("persistence") != cls.GRAPH_PERSISTENCE:
            raise DecisionServiceError("graph_state.persistence is invalid.")
        if value.get("graph_mode") not in cls._VALID_GRAPH_MODES:
            raise DecisionServiceError("graph_state.graph_mode is invalid.")
        if value.get("truth_boundary") != cls.TRUTH_BOUNDARY:
            raise DecisionServiceError("graph_state.truth_boundary must be observational_analysis_only.")

        selected_variables = value.get("selected_variables")
        if not isinstance(selected_variables, dict):
            raise DecisionServiceError("graph_state.selected_variables is required.")
        for field in ("metric_ids", "dimension_ids"):
            items = selected_variables.get(field)
            if not isinstance(items, list) or not all(isinstance(item, str) and item.strip() for item in items):
                raise DecisionServiceError(f"graph_state.selected_variables.{field} must be a string array.")
        for field in ("selected_evidence_ids", "user_hypotheses", "filters", "limitations"):
            if not isinstance(value.get(field), list):
                raise DecisionServiceError(f"graph_state.{field} must be an array.")
        if not all(isinstance(item, str) and item.strip() for item in value["selected_evidence_ids"]):
            raise DecisionServiceError("graph_state.selected_evidence_ids must be a string array.")
        if not all(isinstance(item, dict) for item in value["user_hypotheses"]):
            raise DecisionServiceError("graph_state.user_hypotheses must be an object array.")
        if not all(isinstance(item, dict) for item in value["filters"]):
            raise DecisionServiceError("graph_state.filters must be an object array.")
        if not all(isinstance(item, str) for item in value["limitations"]):
            raise DecisionServiceError("graph_state.limitations must be a string array.")
        return cls._json_copy(value, "graph_state")

    @classmethod
    def _normalize_title(cls, requested_title: Any, fallback_title: str) -> str:
        if requested_title is not None and not isinstance(requested_title, str):
            raise DecisionServiceError("title must be a string when provided.")
        candidate = requested_title if isinstance(requested_title, str) else fallback_title
        normalized = " ".join(candidate.split())
        if not normalized:
            normalized = " ".join(fallback_title.split())
        if not normalized:
            raise DecisionServiceError("title or decision_output.title is required.")
        if len(normalized) > cls.MAX_TITLE_LENGTH:
            raise DecisionServiceError(
                f"title must be {cls.MAX_TITLE_LENGTH} characters or fewer."
            )
        return normalized

    @classmethod
    def _normalize_limit(cls, value: Optional[Any]) -> int:
        if value is None or value == "":
            return cls.DEFAULT_LIST_LIMIT
        try:
            limit = int(value)
        except (TypeError, ValueError) as exc:
            raise DecisionServiceError("limit must be an integer.") from exc
        if limit < 1 or limit > cls.MAX_LIST_LIMIT:
            raise DecisionServiceError(
                f"limit must be between 1 and {cls.MAX_LIST_LIMIT}."
            )
        return limit

    @classmethod
    def _normalize_filters(cls, filters: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not filters:
            return {}
        normalized: Dict[str, Any] = {}
        for field in ("readiness_state", "truth_boundary", "dataset_label", "query", "created_from", "created_to"):
            value = filters.get(field)
            if isinstance(value, str) and value.strip():
                normalized[field] = value.strip()
        archived_state = filters.get("archived_state") or filters.get("archive_state")
        if isinstance(archived_state, str) and archived_state.strip():
            value = archived_state.strip().lower()
            if value not in {"active", "archived", "all"}:
                raise DecisionServiceError("archived_state must be active, archived, or all.")
            normalized["archived_state"] = value
        include_archived = filters.get("include_archived")
        if isinstance(include_archived, str) and include_archived.strip():
            if include_archived.lower() in {"true", "1", "yes"}:
                normalized["archived_state"] = "all"
            elif include_archived.lower() in {"false", "0", "no"}:
                normalized.setdefault("archived_state", "active")
            else:
                raise DecisionServiceError("include_archived must be true or false.")
        has_graph_state = filters.get("has_graph_state")
        if isinstance(has_graph_state, str) and has_graph_state.strip():
            if has_graph_state.lower() in {"true", "1", "yes"}:
                normalized["has_graph_state"] = True
            elif has_graph_state.lower() in {"false", "0", "no"}:
                normalized["has_graph_state"] = False
            else:
                raise DecisionServiceError("has_graph_state must be true or false.")
        return normalized

    @classmethod
    def _normalize_asset_ids(cls, value: Any) -> List[str]:
        if not isinstance(value, list):
            raise DecisionServiceError("asset_ids must be an array.")
        asset_ids = []
        for item in value:
            if not isinstance(item, str) or not item.strip():
                raise DecisionServiceError("asset_ids must contain non-empty strings.")
            asset_ids.append(item.strip())
        if len(asset_ids) < 2 or len(asset_ids) > 4:
            raise DecisionServiceError("asset_ids must contain between 2 and 4 saved assets.")
        if len(set(asset_ids)) != len(asset_ids):
            raise DecisionServiceError("asset_ids must not contain duplicates.")
        return asset_ids

    @classmethod
    def _serialize_snapshot(cls, value: Dict[str, Any], field_name: str) -> str:
        serialized = cls._json_dump(value, field_name)
        if len(serialized.encode("utf-8")) > cls.MAX_SNAPSHOT_BYTES:
            raise DecisionServiceError(
                f"{field_name} exceeds the {cls.MAX_SNAPSHOT_BYTES} byte snapshot limit."
            )
        return serialized

    @classmethod
    def _json_copy(cls, value: Dict[str, Any], field_name: str) -> Dict[str, Any]:
        return json.loads(cls._json_dump(value, field_name))

    @staticmethod
    def _json_dump(value: Any, field_name: str) -> str:
        try:
            return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        except (TypeError, ValueError) as exc:
            raise DecisionServiceError(f"{field_name} must contain only JSON values.") from exc

    @classmethod
    def _reject_unsafe_content(cls, value: Any, location: str) -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                normalized_key = "".join(character for character in str(key).lower() if character.isalnum())
                if normalized_key in cls._FORBIDDEN_KEYS:
                    raise DecisionServiceError(
                        f"{location} must not contain raw dataset rows or chat transcripts ({key})."
                    )
                if normalized_key in cls._FORBIDDEN_PATH_KEYS:
                    raise DecisionServiceError(
                        f"{location} must not contain Data Hub or file paths ({key})."
                    )
                if normalized_key in {"data", "dataset", "records"} and isinstance(child, list):
                    raise DecisionServiceError(
                        f"{location} must not contain raw dataset rows ({key})."
                    )
                if normalized_key == "path" and isinstance(child, str) and ("/" in child or "\\" in child):
                    raise DecisionServiceError(
                        f"{location} must not contain Data Hub or file paths ({key})."
                    )
                cls._reject_unsafe_content(child, f"{location}.{key}")
        elif isinstance(value, list):
            for index, child in enumerate(value):
                cls._reject_unsafe_content(child, f"{location}[{index}]")

    @staticmethod
    def _dataset_label(dataset_trust: Dict[str, Any]) -> str:
        dataset = dataset_trust.get("dataset")
        if isinstance(dataset, dict) and isinstance(dataset.get("dataset_name"), str):
            label = dataset["dataset_name"].strip()
            if label:
                return label
        source_label = str(dataset_trust.get("source_label") or "").strip()
        return source_label or "No dataset"

    @classmethod
    def _asset_summary_from_row(cls, row: Any) -> Dict[str, Any]:
        decision_output = json.loads(row["decision_output_json"])
        graph_state = json.loads(row["graph_state_json"]) if row["graph_state_json"] else None
        return {
            "asset_id": row["asset_id"],
            "title": row["title"],
            "created_at": row["created_at"],
            "dataset_label": row["dataset_label"],
            "readiness_state": row["readiness_state"],
            "truth_boundary": row["truth_boundary"],
            "archived_at": row["archived_at"],
            "lifecycle_state": "archived" if row["archived_at"] else "active",
            "snapshot_notice": cls.SNAPSHOT_NOTICE,
            "review_metadata": cls._review_metadata(decision_output, graph_state),
            "provenance": cls._provenance(decision_output),
            "snapshot_export": cls._snapshot_export_metadata(decision_output),
        }

    @classmethod
    def _review_metadata(
        cls,
        decision_output: Dict[str, Any],
        graph_state: Optional[Dict[str, Any]],
    ) -> Dict[str, Any]:
        dataset_trust = decision_output.get("dataset_trust") or {}
        readiness = decision_output.get("readiness") or {}
        evidence_board = decision_output.get("evidence_board") or {}
        scenario_compare = decision_output.get("scenario_compare") or {}
        export_sections = decision_output.get("export_sections") or []
        command_center = decision_output.get("command_center") or {}
        metadata = {
            "snapshot_kind": "saved_decision_asset",
            "dataset_label": cls._dataset_label(dataset_trust),
            "source_label": dataset_trust.get("source_label") or "No dataset",
            "row_count": dataset_trust.get("row_count", 0),
            "column_count": dataset_trust.get("column_count", 0),
            "readiness_state": readiness.get("readiness_state") or "unknown",
            "truth_boundary": decision_output.get("truth_boundary") or cls.TRUTH_BOUNDARY,
            "evidence_status": evidence_board.get("status") or "unknown",
            "evidence_item_count": len(evidence_board.get("items") or []),
            "scenario_status": scenario_compare.get("status") or "unknown",
            "export_section_count": len(export_sections),
            "export_section_ids": [
                section.get("section_id")
                for section in export_sections
                if isinstance(section, dict) and section.get("section_id")
            ],
            "command_center_status": command_center.get("status") or "unknown",
            "graph_state_summary": cls._graph_state_summary(graph_state),
        }
        return metadata

    @staticmethod
    def _graph_state_summary(graph_state: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not isinstance(graph_state, dict):
            return {"available": False}
        selected_variables = graph_state.get("selected_variables") or {}
        return {
            "available": True,
            "graph_mode": graph_state.get("graph_mode"),
            "selected_metric_count": len(selected_variables.get("metric_ids") or []),
            "selected_dimension_count": len(selected_variables.get("dimension_ids") or []),
            "selected_evidence_count": len(graph_state.get("selected_evidence_ids") or []),
            "user_hypothesis_count": len(graph_state.get("user_hypotheses") or []),
            "truth_boundary": graph_state.get("truth_boundary"),
        }

    @classmethod
    def _provenance(cls, decision_output: Dict[str, Any]) -> Dict[str, Any]:
        dataset_trust = decision_output.get("dataset_trust") or {}
        source_refs = decision_output.get("source_refs") or {}
        dataset = dataset_trust.get("dataset") if isinstance(dataset_trust, dict) else None
        return {
            "source": "saved_decision_output_snapshot",
            "source_refs": source_refs,
            "dataset": dataset if isinstance(dataset, dict) else None,
            "dataset_source_label": dataset_trust.get("source_label"),
            "truth_boundary": decision_output.get("truth_boundary") or cls.TRUTH_BOUNDARY,
        }

    @classmethod
    def _snapshot_export_metadata(cls, decision_output: Dict[str, Any]) -> Dict[str, Any]:
        export_sections = decision_output.get("export_sections") or []
        section_order = [
            section.get("section_id")
            for section in export_sections
            if isinstance(section, dict) and section.get("section_id")
        ]
        return {
            "ready": DecisionOutputService.export_sections_ready(export_sections),
            "source": "saved_decision_asset_snapshot",
            "section_count": len(export_sections),
            "section_order": section_order,
            "endpoint": "GET /api/decision/assets/<asset_id>/export",
        }

    @classmethod
    def _comparison_item(cls, asset: Dict[str, Any]) -> Dict[str, Any]:
        decision_output = asset["decision_output"]
        metadata = asset["review_metadata"]
        return {
            "asset_id": asset["asset_id"],
            "title": asset["title"],
            "created_at": asset["created_at"],
            "dataset_label": metadata["dataset_label"],
            "readiness_state": metadata["readiness_state"],
            "truth_boundary": metadata["truth_boundary"],
            "dataset_trust": decision_output.get("dataset_trust"),
            "source_refs": decision_output.get("source_refs"),
            "evidence_status": metadata["evidence_status"],
            "evidence_item_count": metadata["evidence_item_count"],
            "scenario_status": metadata["scenario_status"],
            "export_snapshot": asset["snapshot_export"],
            "graph_state_summary": metadata["graph_state_summary"],
            "snapshot_notice": cls.SNAPSHOT_NOTICE,
        }

    @staticmethod
    def _comparison_differences(items: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
        # These are descriptive differences between stored artifacts, not analytical conclusions.
        def unique_values(field: str) -> List[Any]:
            values = []
            for item in items:
                value = item.get(field)
                if value not in values:
                    values.append(value)
            return values

        created_values = sorted(item["created_at"] for item in items if item.get("created_at"))
        return {
            "dataset_labels": unique_values("dataset_label"),
            "readiness_states": unique_values("readiness_state"),
            "truth_boundaries": unique_values("truth_boundary"),
            "evidence_item_counts": {
                item["asset_id"]: item.get("evidence_item_count", 0)
                for item in items
            },
            "export_section_counts": {
                item["asset_id"]: (item.get("export_snapshot") or {}).get("section_count", 0)
                for item in items
            },
            "created_at_range": {
                "earliest": created_values[0] if created_values else None,
                "latest": created_values[-1] if created_values else None,
            },
        }
