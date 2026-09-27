"""SQLite persistence for immutable ML Studio experiments and durable runs."""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import sqlite3
import threading
from uuid import uuid4
from collections.abc import Callable, Mapping, Sequence
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Final

from .artifacts import ArtifactMetadata
from .contracts import (
    DatasetSnapshotIdentity,
    EvaluationResult,
    ExperimentSpecification,
    ReviewedCandidateReference,
    RunSpecification,
    StructuredError,
)


TERMINAL_RUN_STATES: Final = frozenset({"completed", "failed", "cancelled", "interrupted"})
VALID_RUN_STATES: Final = frozenset(
    {"queued", "running", "cancel_requested", "completed", "failed", "cancelled", "interrupted"}
)
_ALLOWED_TRANSITIONS: Final = {
    "queued": frozenset({"running", "cancelled", "interrupted"}),
    "running": frozenset({"cancel_requested", "completed", "failed", "interrupted"}),
    "cancel_requested": frozenset({"cancelled", "interrupted"}),
    "completed": frozenset(),
    "failed": frozenset(),
    "cancelled": frozenset(),
    "interrupted": frozenset(),
}
MAX_EXPERIMENT_JSON_BYTES: Final = 256 * 1024
MAX_RUN_JSON_BYTES: Final = 512 * 1024
MAX_EVALUATION_JSON_BYTES: Final = 4 * 1024 * 1024
MAX_EVENTS_PER_RUN: Final = 1000
MAX_DRAFT_JSON_BYTES: Final = 128 * 1024
_DRAFT_STAGES: Final = ("Data & Goal", "Prepare Data", "Configure", "Train", "Review Results", "Use & Share")
_DRAFT_TASKS: Final = frozenset({"regression", "classification", "forecasting", "clustering", "anomaly_detection"})
_DRAFT_FIELDS: Final = frozenset({
    "workspace_id", "name", "guidance_enabled", "active_stage", "snapshot_id", "task_type", "goal",
    "roles", "validation", "metric", "candidate", "resource",
})
_DRAFT_ROLE_FIELDS: Final = frozenset({"target", "numeric", "categorical", "ignored", "time", "group"})
_DRAFT_FORBIDDEN_KEYS: Final = frozenset({
    "rows", "raw_rows", "records", "uploaded_data", "full_data", "model_bytes",
    "data", "dataset", "file_path", "path", "storage_path", "readiness",
    "workflow_state", "run_status", "candidate_selection", "selection_id", "assessment_state",
})
_DRAFT_PATH = re.compile(r"(?:^[A-Za-z]:[\\/]|^[\\/]{2}|^/(?:home|users|var|tmp)/)", re.IGNORECASE)


def _validate_draft_value(value: Any, *, depth: int = 0) -> None:
    """Reject client-supplied data and paths even when hidden in settings."""
    if depth > 8:
        raise PersistenceError("draft_invalid", "The draft settings are too deeply nested.", "Use a bounded settings object.")
    if isinstance(value, dict):
        for key, child in value.items():
            if not isinstance(key, str) or key.casefold() in _DRAFT_FORBIDDEN_KEYS:
                raise PersistenceError("draft_invalid", "The draft contains an unsupported field.", "Remove raw data, paths, or server-owned state.")
            _validate_draft_value(child, depth=depth + 1)
    elif isinstance(value, list):
        for child in value:
            _validate_draft_value(child, depth=depth + 1)
    elif isinstance(value, str) and _DRAFT_PATH.search(value):
        raise PersistenceError("draft_invalid", "The draft contains a filesystem path.", "Use server-issued identities instead of paths.")


def _validated_draft_edit(edit: Mapping[str, Any], *, creating: bool) -> dict[str, Any]:
    if not isinstance(edit, dict) or set(edit) - _DRAFT_FIELDS or (not creating and "workspace_id" in edit):
        raise PersistenceError("draft_invalid", "The draft contains unsupported or immutable fields.", "Submit only editable draft fields.")
    if creating and (not isinstance(edit.get("workspace_id"), str) or not edit["workspace_id"].strip()):
        raise PersistenceError("draft_invalid", "A workspace identity is required.", "Select a governed workspace.")
    value = dict(edit)
    _validate_draft_value(value)
    for key in ("workspace_id", "name", "goal", "snapshot_id", "recipe_id"):
        if key in value and value[key] is not None and (not isinstance(value[key], str) or len(value[key]) > 500):
            raise PersistenceError("draft_invalid", f"The {key} field is invalid.", "Use a bounded text value or null where allowed.")
    if "guidance_enabled" in value and not isinstance(value["guidance_enabled"], bool):
        raise PersistenceError("draft_invalid", "Guidance must be a boolean.", "Use true or false.")
    if "active_stage" in value and value["active_stage"] not in _DRAFT_STAGES:
        raise PersistenceError("draft_invalid", "The active stage is unknown.", "Select one of the six workflow stages.")
    if "task_type" in value and value["task_type"] is not None and (not isinstance(value["task_type"], str) or value["task_type"] not in _DRAFT_TASKS):
        raise PersistenceError("draft_invalid", "The task type is unknown.", "Select a supported ML task.")
    if "recipe_version" in value and value["recipe_version"] is not None and (type(value["recipe_version"]) is not int or value["recipe_version"] < 1):
        raise PersistenceError("draft_invalid", "The recipe version is invalid.", "Use a positive recipe version.")
    for key in ("validation", "metric", "candidate", "resource"):
        if key in value and not isinstance(value[key], dict):
            raise PersistenceError("draft_invalid", f"The {key} settings must be an object.", "Submit a JSON object.")
    if "roles" in value:
        roles = value["roles"]
        if not isinstance(roles, dict) or set(roles) - _DRAFT_ROLE_FIELDS:
            raise PersistenceError("draft_invalid", "The column roles are invalid.", "Use the documented role names.")
        seen: set[str] = set()
        for role, columns in roles.items():
            items = [columns] if role == "target" and columns is not None else ([] if role == "target" else columns)
            if not isinstance(items, list) or any(not isinstance(item, str) or not item for item in items):
                raise PersistenceError("draft_invalid", "A column role has invalid members.", "Use column-name lists and a nullable target.")
            if len(items) != len(set(items)) or seen.intersection(items):
                raise PersistenceError("draft_roles_conflict", "A column has more than one role.", "Assign each column to only one role.")
            seen.update(items)
    _canonical_json(value, limit=MAX_DRAFT_JSON_BYTES, label="experiment draft")
    return value


class PersistenceError(ValueError):
    """A stable, safely reportable persistence boundary failure."""

    def __init__(self, code: str, message: str, remediation: str) -> None:
        super().__init__(message)
        self.error = StructuredError(code=code, message=message, remediation=remediation)

    @property
    def code(self) -> str:
        return self.error.code

    def to_dict(self) -> dict[str, Any]:
        return self.error.to_dict()


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _canonical_json(value: Mapping[str, Any], *, limit: int, label: str) -> str:
    try:
        encoded = json.dumps(value, allow_nan=False, sort_keys=True, separators=(",", ":"))
    except (TypeError, ValueError) as exc:
        raise PersistenceError(
            "persistence_payload_invalid",
            f"The {label} is not valid durable JSON.",
            "Submit a finite JSON-safe contract object.",
        ) from exc
    if len(encoded.encode("utf-8")) > limit:
        raise PersistenceError(
            "persistence_payload_too_large",
            f"The {label} exceeds its configured persistence limit.",
            "Reduce the bounded metadata before retrying.",
        )
    return encoded


def _payload_hash(encoded: str) -> str:
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def _idempotency_hash(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def _run_submission_fingerprint(payload: Mapping[str, Any]) -> str:
    """Hash caller-controlled run intent, excluding server identity and time."""
    intent = {
        key: value
        for key, value in payload.items()
        if key not in {"run_id", "submitted_at"}
    }
    return _payload_hash(
        _canonical_json(intent, limit=MAX_RUN_JSON_BYTES, label="run submission")
    )


class MLStudioRepository:
    """Framework-independent repository with transactionally validated state."""

    def __init__(self, database_path: str | os.PathLike[str]) -> None:
        self._database_path = Path(database_path)
        self._lock = threading.RLock()
        if self._database_path.exists() and self._database_path.is_dir():
            raise ValueError("database_path must identify a file")
        self._database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._database_path, timeout=30, isolation_level=None)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 30000")
        return connection

    @contextmanager
    def _connection(self):
        connection = self._connect()
        try:
            yield connection
        finally:
            connection.close()

    def _initialize(self) -> None:
        schema = """
        CREATE TABLE IF NOT EXISTS ml_experiment_specifications (
            experiment_id TEXT NOT NULL,
            specification_version INTEGER NOT NULL CHECK (specification_version > 0),
            specification_json TEXT NOT NULL,
            specification_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (experiment_id, specification_version)
        );
        CREATE TABLE IF NOT EXISTS ml_dataset_snapshots (
            snapshot_id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            workspace_version INTEGER NOT NULL CHECK (workspace_version > 0),
            snapshot_json TEXT NOT NULL,
            snapshot_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ml_runs (
            run_id TEXT PRIMARY KEY,
            experiment_id TEXT NOT NULL,
            specification_version INTEGER NOT NULL,
            snapshot_id TEXT NOT NULL,
            specification_json TEXT NOT NULL,
            submission_fingerprint TEXT NOT NULL,
            idempotency_key_hash TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL,
            progress_stage TEXT,
            submitted_at TEXT NOT NULL,
            started_at TEXT,
            finished_at TEXT,
            updated_at TEXT NOT NULL,
            evaluation_json TEXT,
            warnings_json TEXT NOT NULL,
            failure_json TEXT,
            FOREIGN KEY (experiment_id, specification_version)
              REFERENCES ml_experiment_specifications (experiment_id, specification_version)
        );
        CREATE TABLE IF NOT EXISTS ml_run_events (
            event_id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            status TEXT NOT NULL,
            progress_stage TEXT,
            occurred_at TEXT NOT NULL,
            FOREIGN KEY (run_id) REFERENCES ml_runs (run_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS ml_run_events_run_index
          ON ml_run_events (run_id, event_id);
        CREATE TABLE IF NOT EXISTS ml_artifacts (
            run_id TEXT NOT NULL,
            name TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
            media_type TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (run_id, name),
            FOREIGN KEY (run_id) REFERENCES ml_runs (run_id) ON DELETE RESTRICT
        );
        CREATE TABLE IF NOT EXISTS ml_reviewed_candidates (
            candidate_id TEXT PRIMARY KEY,
            run_id TEXT NOT NULL,
            candidate_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (run_id) REFERENCES ml_runs (run_id) ON DELETE RESTRICT
        );
        CREATE TABLE IF NOT EXISTS ml_experiment_drafts (
            experiment_id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            draft_revision INTEGER NOT NULL CHECK (draft_revision > 0),
            etag TEXT NOT NULL,
            draft_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ml_experiment_drafts_workspace_index
          ON ml_experiment_drafts (workspace_id, updated_at DESC, experiment_id);
        """
        with self._lock, self._connection() as connection:
            connection.execute("PRAGMA journal_mode = WAL")
            connection.executescript(schema)

    @staticmethod
    def _public_experiment(row: sqlite3.Row) -> dict[str, Any]:
        return json.loads(row["specification_json"])

    def create_draft(self, edit: dict[str, Any]) -> dict[str, Any]:
        fields = _validated_draft_edit(edit, creating=True)
        now = _now()
        draft = {
            "contract_version": "ml_studio_workflow_v1",
            "experiment_id": str(uuid4()),
            "draft_revision": 1,
            "etag": secrets.token_urlsafe(24),
            "name": "Untitled Experiment",
            "guidance_enabled": True,
            "active_stage": "Data & Goal",
            "workspace_id": fields["workspace_id"],
            "snapshot_id": None,
            "task_type": None,
            "goal": None,
            "recipe_id": None,
            "recipe_version": None,
            "roles": {"target": None, "numeric": [], "categorical": [], "ignored": [], "time": [], "group": []},
            "validation": {}, "metric": {}, "candidate": {}, "resource": {},
            "latest_assessment_id": None,
            "latest_assessment_fingerprint": None,
            "updated_at": now,
        }
        draft.update(fields)
        encoded = _canonical_json(draft, limit=MAX_DRAFT_JSON_BYTES, label="experiment draft")
        with self._lock, self._connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                "INSERT INTO ml_experiment_drafts VALUES (?, ?, ?, ?, ?, ?)",
                (draft["experiment_id"], draft["workspace_id"], 1, draft["etag"], encoded, now),
            )
            connection.commit()
        return draft

    def get_draft(self, experiment_id: str, workspace_id: str) -> dict[str, Any] | None:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT draft_json FROM ml_experiment_drafts WHERE experiment_id = ? AND workspace_id = ?",
                (experiment_id, workspace_id),
            ).fetchone()
        return None if row is None else json.loads(row["draft_json"])

    def list_drafts(self, workspace_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
        if not isinstance(workspace_id, str) or not workspace_id.strip() or type(limit) is not int or not 1 <= limit <= 100:
            raise PersistenceError("draft_invalid", "The draft query is invalid.", "Provide a workspace identity and a limit from 1 to 100.")
        with self._connection() as connection:
            rows = connection.execute(
                "SELECT draft_json FROM ml_experiment_drafts WHERE workspace_id = ? ORDER BY updated_at DESC, experiment_id LIMIT ?",
                (workspace_id, limit),
            ).fetchall()
        return [json.loads(row["draft_json"]) for row in rows]

    def update_draft(self, experiment_id: str, workspace_id: str, etag: str, edit: dict[str, Any]) -> dict[str, Any]:
        fields = _validated_draft_edit(edit, creating=False)
        if not isinstance(etag, str) or not etag:
            raise PersistenceError("draft_revision_conflict", "The draft revision is missing.", "Reload the draft and retry with its current ETag.")
        with self._lock, self._connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT draft_json, etag FROM ml_experiment_drafts WHERE experiment_id = ? AND workspace_id = ?",
                (experiment_id, workspace_id),
            ).fetchone()
            if row is None:
                raise PersistenceError("draft_not_found", "The draft is unavailable in this workspace.", "Select a draft from the current workspace.")
            if row["etag"] != etag:
                raise PersistenceError("draft_revision_conflict", "The draft changed since it was loaded.", "Reload or duplicate the draft to preserve local edits.")
            draft = json.loads(row["draft_json"])
            draft.update(fields)
            draft["draft_revision"] += 1
            draft["etag"] = secrets.token_urlsafe(24)
            draft["updated_at"] = _now()
            encoded = _canonical_json(draft, limit=MAX_DRAFT_JSON_BYTES, label="experiment draft")
            connection.execute(
                "UPDATE ml_experiment_drafts SET draft_revision = ?, etag = ?, draft_json = ?, updated_at = ? WHERE experiment_id = ? AND workspace_id = ?",
                (draft["draft_revision"], draft["etag"], encoded, draft["updated_at"], experiment_id, workspace_id),
            )
            connection.commit()
        return draft

    def duplicate_draft(self, experiment_id: str, workspace_id: str) -> dict[str, Any]:
        original = self.get_draft(experiment_id, workspace_id)
        if original is None:
            raise PersistenceError("draft_not_found", "The draft is unavailable in this workspace.", "Select a draft from the current workspace.")
        edit = {key: original[key] for key in _DRAFT_FIELDS if key in original}
        edit["name"] = f"Copy of {original['name']}"[:500]
        edit["active_stage"] = "Data & Goal"
        return self.create_draft(edit)

    @staticmethod
    def _public_run(row: sqlite3.Row) -> dict[str, Any]:
        value: dict[str, Any] = {
            "run_id": row["run_id"],
            "experiment_id": row["experiment_id"],
            "specification_version": row["specification_version"],
            "snapshot_id": row["snapshot_id"],
            "status": row["status"],
            "progress_stage": row["progress_stage"],
            "submitted_at": row["submitted_at"],
            "started_at": row["started_at"],
            "finished_at": row["finished_at"],
            "updated_at": row["updated_at"],
            "warnings": json.loads(row["warnings_json"]),
            "run_specification": json.loads(row["specification_json"]),
        }
        if row["evaluation_json"] is not None:
            value["evaluation_result"] = json.loads(row["evaluation_json"])
        if row["failure_json"] is not None:
            value["failure"] = json.loads(row["failure_json"])
        return value

    def create_experiment(self, specification: ExperimentSpecification) -> dict[str, Any]:
        if not isinstance(specification, ExperimentSpecification):
            raise TypeError("specification must be an ExperimentSpecification")
        payload = specification.to_dict()
        encoded = _canonical_json(payload, limit=MAX_EXPERIMENT_JSON_BYTES, label="experiment specification")
        created_at = _now()
        try:
            with self._lock, self._connection() as connection:
                connection.execute("BEGIN IMMEDIATE")
                latest = connection.execute(
                    "SELECT MAX(specification_version) AS version FROM ml_experiment_specifications WHERE experiment_id = ?",
                    (specification.experiment_id,),
                ).fetchone()["version"]
                expected = 1 if latest is None else int(latest) + 1
                if specification.specification_version != expected:
                    raise PersistenceError(
                        "experiment_version_conflict",
                        "The experiment specification version is not the next immutable version.",
                        "Reload the experiment and submit the next monotonically increasing version.",
                    )
                connection.execute(
                    "INSERT INTO ml_experiment_specifications VALUES (?, ?, ?, ?, ?)",
                    (
                        specification.experiment_id,
                        specification.specification_version,
                        encoded,
                        _payload_hash(encoded),
                        created_at,
                    ),
                )
                connection.commit()
        except PersistenceError:
            raise
        except sqlite3.Error as exc:
            raise PersistenceError(
                "experiment_persistence_failed",
                "The experiment specification could not be persisted.",
                "Retry the operation or inspect the server persistence health.",
            ) from exc
        return payload

    def create_snapshot(self, snapshot: DatasetSnapshotIdentity) -> dict[str, Any]:
        """Persist one immutable server-resolved dataset snapshot."""
        if not isinstance(snapshot, DatasetSnapshotIdentity):
            raise TypeError("snapshot must be a DatasetSnapshotIdentity")
        payload = snapshot.to_dict()
        encoded = _canonical_json(payload, limit=MAX_RUN_JSON_BYTES, label="dataset snapshot")
        try:
            with self._lock, self._connection() as connection:
                connection.execute("BEGIN IMMEDIATE")
                connection.execute(
                    "INSERT INTO ml_dataset_snapshots VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        snapshot.snapshot_id,
                        snapshot.workspace_id,
                        snapshot.workspace_version,
                        encoded,
                        _payload_hash(encoded),
                        snapshot.created_at.isoformat(),
                    ),
                )
                connection.commit()
        except sqlite3.IntegrityError as exc:
            raise PersistenceError(
                "snapshot_identity_conflict",
                "The dataset snapshot identity is already in use.",
                "Use the existing immutable snapshot or create a new server-issued identity.",
            ) from exc
        except sqlite3.Error as exc:
            raise PersistenceError(
                "snapshot_persistence_failed",
                "The dataset snapshot could not be persisted.",
                "Retry the operation or inspect the server persistence health.",
            ) from exc
        return payload

    def get_snapshot(self, snapshot_id: str) -> dict[str, Any] | None:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT snapshot_json FROM ml_dataset_snapshots WHERE snapshot_id = ?",
                (snapshot_id,),
            ).fetchone()
        return None if row is None else json.loads(row["snapshot_json"])

    def get_experiment(self, experiment_id: str, specification_version: int) -> dict[str, Any] | None:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT specification_json FROM ml_experiment_specifications WHERE experiment_id = ? AND specification_version = ?",
                (experiment_id, specification_version),
            ).fetchone()
        return None if row is None else self._public_experiment(row)

    def list_experiment_versions(self, experiment_id: str) -> list[dict[str, Any]]:
        with self._connection() as connection:
            rows = connection.execute(
                "SELECT specification_json FROM ml_experiment_specifications WHERE experiment_id = ? ORDER BY specification_version",
                (experiment_id,),
            ).fetchall()
        return [self._public_experiment(row) for row in rows]

    def submit_run(self, run: RunSpecification, *, idempotency_key: str) -> tuple[dict[str, Any], bool]:
        if not isinstance(run, RunSpecification):
            raise TypeError("run must be a RunSpecification")
        if not isinstance(idempotency_key, str) or not idempotency_key.strip() or len(idempotency_key) > 256:
            raise PersistenceError(
                "idempotency_key_invalid",
                "The idempotency key must be a non-empty string of at most 256 characters.",
                "Send one stable key for this exact run submission.",
            )
        key_hash = _idempotency_hash(idempotency_key.strip())
        payload = run.to_dict()
        encoded = _canonical_json(payload, limit=MAX_RUN_JSON_BYTES, label="run specification")
        fingerprint = _run_submission_fingerprint(payload)
        submitted_at = run.submitted_at.isoformat()
        now = _now()
        try:
            with self._lock, self._connection() as connection:
                connection.execute("BEGIN IMMEDIATE")
                existing = connection.execute(
                    "SELECT * FROM ml_runs WHERE idempotency_key_hash = ?",
                    (key_hash,),
                ).fetchone()
                if existing is not None:
                    if existing["submission_fingerprint"] != fingerprint:
                        raise PersistenceError(
                            "idempotency_key_conflict",
                            "The idempotency key is already bound to a different experiment, version, or snapshot.",
                            "Reuse the key only for the identical submission or create a new key.",
                        )
                    connection.commit()
                    return self._public_run(existing), False
                experiment = connection.execute(
                    "SELECT specification_json FROM ml_experiment_specifications WHERE experiment_id = ? AND specification_version = ?",
                    (run.experiment_id, run.specification_version),
                ).fetchone()
                if experiment is None:
                    raise PersistenceError(
                        "experiment_version_missing",
                        "The run references an experiment specification that does not exist.",
                        "Persist the exact immutable experiment specification before submitting the run.",
                    )
                if run.run_id != payload["run_id"]:
                    raise PersistenceError(
                        "run_identity_invalid",
                        "The run identity is inconsistent.",
                        "Use the server-issued run identity consistently.",
                    )
                connection.execute(
                    """INSERT INTO ml_runs (
                        run_id, experiment_id, specification_version, snapshot_id,
                        specification_json, submission_fingerprint, idempotency_key_hash,
                        status, progress_stage, submitted_at, started_at, finished_at,
                        updated_at, evaluation_json, warnings_json, failure_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', NULL, ?, NULL, NULL, ?, NULL, '[]', NULL)""",
                    (
                        run.run_id,
                        run.experiment_id,
                        run.specification_version,
                        run.dataset_snapshot.snapshot_id,
                        encoded,
                        fingerprint,
                        key_hash,
                        submitted_at,
                        now,
                    ),
                )
                connection.execute(
                    "INSERT INTO ml_run_events (run_id, event_type, status, progress_stage, occurred_at) VALUES (?, 'submitted', 'queued', NULL, ?)",
                    (run.run_id, now),
                )
                row = connection.execute("SELECT * FROM ml_runs WHERE run_id = ?", (run.run_id,)).fetchone()
                connection.commit()
        except PersistenceError:
            raise
        except sqlite3.IntegrityError as exc:
            raise PersistenceError(
                "run_identity_conflict",
                "The run identity is already in use.",
                "Use the existing run or submit with a new server-issued run identity.",
            ) from exc
        except sqlite3.Error as exc:
            raise PersistenceError(
                "run_persistence_failed",
                "The run could not be persisted.",
                "Retry the operation or inspect the server persistence health.",
            ) from exc
        return self._public_run(row), True

    def get_run(self, run_id: str) -> dict[str, Any] | None:
        with self._connection() as connection:
            row = connection.execute("SELECT * FROM ml_runs WHERE run_id = ?", (run_id,)).fetchone()
        return None if row is None else self._public_run(row)

    def list_runs(self, *, run_ids: Sequence[str] | None = None, limit: int = 100) -> list[dict[str, Any]]:
        safe_limit = min(max(int(limit), 1), 500)
        with self._connection() as connection:
            if run_ids is None:
                rows = connection.execute(
                    "SELECT * FROM ml_runs ORDER BY submitted_at DESC, run_id LIMIT ?",
                    (safe_limit,),
                ).fetchall()
            else:
                normalized = tuple(dict.fromkeys(str(item) for item in run_ids))
                if not normalized:
                    return []
                placeholders = ",".join("?" for _ in normalized)
                rows = connection.execute(
                    f"SELECT * FROM ml_runs WHERE run_id IN ({placeholders}) ORDER BY submitted_at, run_id",
                    normalized,
                ).fetchall()
        return [self._public_run(row) for row in rows]

    def transition_run(
        self,
        run_id: str,
        status: str,
        *,
        progress_stage: str | None = None,
        evaluation_result: EvaluationResult | None = None,
        warnings: Sequence[str] = (),
        failure: StructuredError | None = None,
        clock: Callable[[], str] = _now,
    ) -> dict[str, Any]:
        if status not in VALID_RUN_STATES:
            raise PersistenceError(
                "run_status_invalid",
                "The requested run status is invalid.",
                "Use a supported durable lifecycle state.",
            )
        if any(not isinstance(item, str) or not item or len(item) > 1000 for item in warnings):
            raise PersistenceError(
                "run_warning_invalid",
                "Run warnings must be bounded non-empty strings.",
                "Store only safe warning summaries.",
            )
        warning_json = _canonical_json({"warnings": list(warnings)}, limit=MAX_RUN_JSON_BYTES, label="run warnings")
        warning_json = json.dumps(json.loads(warning_json)["warnings"], separators=(",", ":"))
        evaluation_json = None
        if evaluation_result is not None:
            evaluation_json = _canonical_json(
                evaluation_result.to_dict(), limit=MAX_EVALUATION_JSON_BYTES, label="evaluation result"
            )
        failure_json = None if failure is None else _canonical_json(
            failure.to_dict(), limit=MAX_RUN_JSON_BYTES, label="structured failure"
        )
        if status == "completed" and evaluation_json is None:
            raise PersistenceError(
                "run_completion_invalid",
                "A completed run requires its immutable evaluation result.",
                "Persist validated evaluation evidence with the completion transition.",
            )
        if status == "failed" and failure_json is None:
            raise PersistenceError(
                "run_failure_invalid",
                "A failed run requires a structured failure.",
                "Persist a safe structured error with the failure transition.",
            )
        if status not in {"completed"} and evaluation_json is not None:
            raise PersistenceError(
                "run_evaluation_state_invalid",
                "Evaluation evidence may be attached only when completing a run.",
                "Complete the run atomically with its validated evaluation result.",
            )

        try:
            with self._lock, self._connection() as connection:
                connection.execute("BEGIN IMMEDIATE")
                current = connection.execute("SELECT * FROM ml_runs WHERE run_id = ?", (run_id,)).fetchone()
                if current is None:
                    raise PersistenceError(
                        "run_not_found", "The requested run does not exist.", "Reload the run list and retry."
                    )
                old_status = current["status"]
                if evaluation_result is not None and (
                    evaluation_result.run_id != current["run_id"]
                    or evaluation_result.experiment_id != current["experiment_id"]
                    or evaluation_result.specification_version != current["specification_version"]
                    or evaluation_result.dataset_snapshot.snapshot_id != current["snapshot_id"]
                ):
                    raise PersistenceError(
                        "run_evaluation_identity_mismatch",
                        "The evaluation result does not match the immutable run identity.",
                        "Complete the run with evidence from its exact experiment version and snapshot.",
                    )
                if status == old_status:
                    connection.commit()
                    return self._public_run(current)
                if status not in _ALLOWED_TRANSITIONS[old_status]:
                    raise PersistenceError(
                        "run_transition_conflict",
                        "The requested run lifecycle transition is not allowed.",
                        "Reload the run and transition from its current durable state.",
                    )
                timestamp = clock()
                started_at = timestamp if status == "running" and current["started_at"] is None else current["started_at"]
                finished_at = timestamp if status in TERMINAL_RUN_STATES else None
                connection.execute(
                    """UPDATE ml_runs SET status = ?, progress_stage = ?, started_at = ?,
                       finished_at = ?, updated_at = ?, evaluation_json = COALESCE(?, evaluation_json),
                       warnings_json = ?, failure_json = COALESCE(?, failure_json) WHERE run_id = ?""",
                    (
                        status,
                        progress_stage,
                        started_at,
                        finished_at,
                        timestamp,
                        evaluation_json,
                        warning_json,
                        failure_json,
                        run_id,
                    ),
                )
                connection.execute(
                    "INSERT INTO ml_run_events (run_id, event_type, status, progress_stage, occurred_at) VALUES (?, 'status_changed', ?, ?, ?)",
                    (run_id, status, progress_stage, timestamp),
                )
                row = connection.execute("SELECT * FROM ml_runs WHERE run_id = ?", (run_id,)).fetchone()
                connection.commit()
        except PersistenceError:
            raise
        except sqlite3.Error as exc:
            raise PersistenceError(
                "run_persistence_failed",
                "The run lifecycle update could not be persisted.",
                "Retry the operation or inspect the server persistence health.",
            ) from exc
        return self._public_run(row)

    def request_cancellation(self, run_id: str) -> dict[str, Any]:
        current = self.get_run(run_id)
        if current is None:
            raise PersistenceError("run_not_found", "The requested run does not exist.", "Reload the run list and retry.")
        if current["status"] in TERMINAL_RUN_STATES or current["status"] == "cancel_requested":
            return current
        target = "cancelled" if current["status"] == "queued" else "cancel_requested"
        return self.transition_run(run_id, target, progress_stage=current["progress_stage"])

    def update_run_progress(
        self,
        run_id: str,
        progress_stage: str,
        *,
        clock: Callable[[], str] = _now,
    ) -> dict[str, Any]:
        """Persist a bounded progress stage without inventing a lifecycle transition."""
        if not isinstance(progress_stage, str) or not progress_stage or len(progress_stage) > 100:
            raise PersistenceError(
                "run_progress_invalid",
                "The requested run progress stage is invalid.",
                "Use a bounded non-empty progress stage.",
            )
        try:
            with self._lock, self._connection() as connection:
                connection.execute("BEGIN IMMEDIATE")
                current = connection.execute("SELECT * FROM ml_runs WHERE run_id = ?", (run_id,)).fetchone()
                if current is None:
                    raise PersistenceError(
                        "run_not_found", "The requested run does not exist.", "Reload the run list and retry."
                    )
                if current["status"] != "running":
                    raise PersistenceError(
                        "run_progress_conflict",
                        "Progress can be updated only while a run is running.",
                        "Reload the run and update progress only for an active run.",
                    )
                timestamp = clock()
                connection.execute(
                    "UPDATE ml_runs SET progress_stage = ?, updated_at = ? WHERE run_id = ?",
                    (progress_stage, timestamp, run_id),
                )
                connection.execute(
                    "INSERT INTO ml_run_events (run_id, event_type, status, progress_stage, occurred_at) VALUES (?, 'progress_updated', 'running', ?, ?)",
                    (run_id, progress_stage, timestamp),
                )
                row = connection.execute("SELECT * FROM ml_runs WHERE run_id = ?", (run_id,)).fetchone()
                connection.commit()
        except PersistenceError:
            raise
        except sqlite3.Error as exc:
            raise PersistenceError(
                "run_persistence_failed",
                "The run progress update could not be persisted.",
                "Retry the operation or inspect the server persistence health.",
            ) from exc
        return self._public_run(row)

    def recover_incomplete_runs(self) -> list[str]:
        with self._connection() as connection:
            run_ids = [
                row["run_id"]
                for row in connection.execute(
                    "SELECT run_id FROM ml_runs WHERE status NOT IN ('completed', 'failed', 'cancelled', 'interrupted') ORDER BY submitted_at"
                ).fetchall()
            ]
        recovered: list[str] = []
        for run_id in run_ids:
            try:
                self.transition_run(run_id, "interrupted", progress_stage="restart_recovery")
                recovered.append(run_id)
            except PersistenceError as exc:
                if exc.code != "run_transition_conflict":
                    raise
        return recovered

    def list_events(self, run_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
        safe_limit = min(max(int(limit), 1), MAX_EVENTS_PER_RUN)
        with self._connection() as connection:
            rows = connection.execute(
                """SELECT event_type, status, progress_stage, occurred_at FROM ml_run_events
                   WHERE run_id = ? ORDER BY event_id DESC LIMIT ?""",
                (run_id, safe_limit),
            ).fetchall()
        return [dict(row) for row in reversed(rows)]

    def register_artifact(self, metadata: ArtifactMetadata) -> dict[str, Any]:
        if not isinstance(metadata, ArtifactMetadata):
            raise TypeError("metadata must be ArtifactMetadata")
        try:
            with self._lock, self._connection() as connection:
                connection.execute("BEGIN IMMEDIATE")
                run = connection.execute("SELECT status FROM ml_runs WHERE run_id = ?", (metadata.run_id,)).fetchone()
                if run is None:
                    raise PersistenceError(
                        "run_not_found", "The artifact run does not exist.", "Persist the run before its artifacts."
                    )
                connection.execute(
                    "INSERT INTO ml_artifacts (run_id, name, sha256, size_bytes, media_type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        metadata.run_id,
                        metadata.name,
                        metadata.sha256,
                        metadata.size_bytes,
                        metadata.media_type,
                        metadata.created_at,
                    ),
                )
                connection.commit()
        except PersistenceError:
            raise
        except sqlite3.IntegrityError as exc:
            raise PersistenceError(
                "artifact_metadata_immutable",
                "Artifact metadata already exists and cannot be overwritten.",
                "Use the existing immutable artifact reference.",
            ) from exc
        return metadata.to_dict()

    def list_artifacts(self, run_id: str) -> list[dict[str, Any]]:
        with self._connection() as connection:
            rows = connection.execute(
                "SELECT run_id, name, sha256, size_bytes, media_type, created_at FROM ml_artifacts WHERE run_id = ? ORDER BY name",
                (run_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def create_candidate(self, candidate: ReviewedCandidateReference) -> dict[str, Any]:
        """Persist one immutable review decision for a verified run artifact."""
        if not isinstance(candidate, ReviewedCandidateReference):
            raise TypeError("candidate must be a ReviewedCandidateReference")
        payload = candidate.to_dict()
        encoded = _canonical_json(payload, limit=MAX_RUN_JSON_BYTES, label="reviewed candidate")
        try:
            with self._lock, self._connection() as connection:
                connection.execute("BEGIN IMMEDIATE")
                connection.execute(
                    "INSERT INTO ml_reviewed_candidates VALUES (?, ?, ?, ?)",
                    (candidate.candidate_id, candidate.run_id, encoded, candidate.reviewed_at.isoformat()),
                )
                connection.commit()
        except sqlite3.IntegrityError as exc:
            raise PersistenceError(
                "candidate_identity_conflict",
                "The reviewed candidate identity is already in use.",
                "Use the existing immutable review record or a new server-issued identity.",
            ) from exc
        return payload

    def get_candidate(self, candidate_id: str) -> dict[str, Any] | None:
        with self._connection() as connection:
            row = connection.execute(
                "SELECT candidate_json FROM ml_reviewed_candidates WHERE candidate_id = ?",
                (candidate_id,),
            ).fetchone()
        return None if row is None else json.loads(row["candidate_json"])
