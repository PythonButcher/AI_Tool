"""SQLite persistence for immutable ML Studio experiments and durable runs."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import threading
from collections.abc import Callable, Mapping, Sequence
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Final

from .artifacts import ArtifactMetadata
from .contracts import EvaluationResult, ExperimentSpecification, RunSpecification, StructuredError


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
        """
        with self._lock, self._connection() as connection:
            connection.execute("PRAGMA journal_mode = WAL")
            connection.executescript(schema)

    @staticmethod
    def _public_experiment(row: sqlite3.Row) -> dict[str, Any]:
        return json.loads(row["specification_json"])

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
        fingerprint = _payload_hash(encoded)
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
