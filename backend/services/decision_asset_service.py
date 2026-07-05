"""Immutable persistence for saved AI Chat decision reviews."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional
from uuid import uuid4

from backend.db.backend_db import get_db_connection
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
    def list_assets(cls, limit: Optional[Any] = None) -> Dict[str, List[Dict[str, Any]]]:
        normalized_limit = cls._normalize_limit(limit)
        conn = get_db_connection()
        try:
            rows = conn.execute(
                '''
                SELECT asset_id, title, created_at, dataset_label, readiness_state, truth_boundary
                FROM decision_assets
                ORDER BY created_at DESC, rowid DESC
                LIMIT ?
                ''',
                (normalized_limit,),
            ).fetchall()
        finally:
            conn.close()

        return {"assets": [dict(row) for row in rows]}

    @classmethod
    def get_asset(cls, asset_id: str) -> Optional[Dict[str, Any]]:
        if not isinstance(asset_id, str) or not asset_id.strip():
            return None

        conn = get_db_connection()
        try:
            row = conn.execute(
                '''
                SELECT asset_id, schema_version, title, created_at, decision_output_json, graph_state_json
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
        )

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
    ) -> Dict[str, Any]:
        asset = {
            "asset_id": asset_id,
            "schema_version": schema_version or cls.SCHEMA_VERSION,
            "title": title,
            "created_at": created_at,
            "decision_output": decision_output,
            "snapshot_notice": cls.SNAPSHOT_NOTICE,
        }
        if graph_state is not None:
            asset["graph_state"] = graph_state
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
