"""SQLite metadata repository for Document Studio.

Uses the Python standard-library ``sqlite3`` module with parameterized
SQL, explicit transactions, and foreign-key enforcement.  Accepts a
caller-supplied database path so tests never touch production data.

Schema initialization is owned by the repository; tables are created
on first connection via ``CREATE TABLE IF NOT EXISTS``.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

from document_studio.application.ports import DocumentRepository
from document_studio.domain.records import (
    BlueprintFieldDefinition,
    ConfidenceSignal,
    ConfidenceSource,
    Document,
    DocumentBlueprint,
    DocumentVersion,
    EvidenceLocation,
    ExtractedField,
    ProcessingRun,
    ProcessingStatus,
    ReviewState,
    ValueType,
)


# ---------------------------------------------------------------------------
# SQL schema
# ---------------------------------------------------------------------------

_SCHEMA_SQL = """\
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
    id            TEXT PRIMARY KEY,
    content_hash  TEXT NOT NULL UNIQUE,
    original_filename TEXT NOT NULL,
    media_type    TEXT NOT NULL,
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_versions (
    id             TEXT PRIMARY KEY,
    document_id    TEXT NOT NULL REFERENCES documents(id),
    version_number INTEGER NOT NULL,
    content_hash   TEXT NOT NULL,
    storage_key    TEXT NOT NULL,
    byte_size      INTEGER NOT NULL,
    created_at     TEXT NOT NULL,
    UNIQUE(document_id, version_number)
);

CREATE TABLE IF NOT EXISTS processing_runs (
    id           TEXT PRIMARY KEY,
    version_id   TEXT NOT NULL REFERENCES document_versions(id),
    blueprint_id TEXT,
    status       TEXT NOT NULL,
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS extracted_fields (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id           TEXT NOT NULL REFERENCES processing_runs(id),
    field_name       TEXT NOT NULL,
    raw_text         TEXT NOT NULL,
    normalized_value TEXT,
    value_type       TEXT NOT NULL,
    review_state     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_locations (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    field_id         INTEGER NOT NULL REFERENCES extracted_fields(id),
    page_number      INTEGER,
    span_start       INTEGER,
    span_end         INTEGER,
    bounding_polygon TEXT,
    sheet_name       TEXT,
    cell_range       TEXT
);

CREATE TABLE IF NOT EXISTS confidence_signals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    field_id    INTEGER NOT NULL REFERENCES extracted_fields(id),
    source      TEXT NOT NULL,
    score       REAL NOT NULL,
    source_name TEXT NOT NULL,
    reason      TEXT
);

CREATE TABLE IF NOT EXISTS blueprints (
    id             TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blueprint_field_definitions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    blueprint_id        TEXT NOT NULL REFERENCES blueprints(id),
    field_name          TEXT NOT NULL,
    value_type          TEXT NOT NULL,
    required            INTEGER NOT NULL,
    validation_guidance TEXT
);
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _utc_now() -> datetime:
    """Return the current UTC datetime with timezone info."""
    return datetime.now(timezone.utc)


def _dt_to_iso(dt: datetime) -> str:
    """Serialize a datetime to ISO 8601 with timezone."""
    return dt.isoformat()


def _iso_to_dt(iso: str) -> datetime:
    """Deserialize an ISO 8601 string to a timezone-aware datetime."""
    dt = datetime.fromisoformat(iso)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _polygon_to_json(
    polygon: tuple[tuple[float, float], ...] | None,
) -> str | None:
    """Serialize a bounding polygon to a JSON string, or ``None``."""
    if polygon is None:
        return None
    return json.dumps([list(pt) for pt in polygon])


def _json_to_polygon(
    raw: str | None,
) -> tuple[tuple[float, float], ...] | None:
    """Deserialize a JSON string back to a bounding polygon tuple."""
    if raw is None:
        return None
    return tuple(tuple(pt) for pt in json.loads(raw))


# ---------------------------------------------------------------------------
# Repository
# ---------------------------------------------------------------------------


class SQLiteDocumentRepository(DocumentRepository):
    """Concrete document-metadata repository backed by SQLite.

    Parameters
    ----------
    db_path:
        Path to the SQLite database file.  Created automatically if it
        does not exist.  Use ``:memory:`` or a temp-directory path for
        tests.
    """

    def __init__(self, db_path: str | Path) -> None:
        self._db_path = str(db_path)
        self._conn = sqlite3.connect(self._db_path)
        self._conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        """Create tables if they do not already exist."""
        self._conn.executescript(_SCHEMA_SQL)

    def close(self) -> None:
        """Close the underlying database connection."""
        self._conn.close()

    # ---- internal helpers ------------------------------------------------

    def _row_to_document(self, row: sqlite3.Row) -> Document:
        return Document(
            id=UUID(row["id"]),
            content_hash=row["content_hash"],
            original_filename=row["original_filename"],
            media_type=row["media_type"],
            created_at=_iso_to_dt(row["created_at"]),
        )

    def _row_to_version(self, row: sqlite3.Row) -> DocumentVersion:
        return DocumentVersion(
            id=UUID(row["id"]),
            document_id=UUID(row["document_id"]),
            version_number=row["version_number"],
            content_hash=row["content_hash"],
            storage_key=row["storage_key"],
            byte_size=row["byte_size"],
            created_at=_iso_to_dt(row["created_at"]),
        )

    def _load_evidence(self, field_id: int) -> tuple[EvidenceLocation, ...]:
        cur = self._conn.execute(
            "SELECT * FROM evidence_locations WHERE field_id = ?",
            (field_id,),
        )
        locations: list[EvidenceLocation] = []
        for r in cur.fetchall():
            locations.append(
                EvidenceLocation(
                    page_number=r["page_number"],
                    span_start=r["span_start"],
                    span_end=r["span_end"],
                    bounding_polygon=_json_to_polygon(r["bounding_polygon"]),
                    sheet_name=r["sheet_name"],
                    cell_range=r["cell_range"],
                )
            )
        return tuple(locations)

    def _load_confidence(self, field_id: int) -> tuple[ConfidenceSignal, ...]:
        cur = self._conn.execute(
            "SELECT * FROM confidence_signals WHERE field_id = ?",
            (field_id,),
        )
        signals: list[ConfidenceSignal] = []
        for r in cur.fetchall():
            signals.append(
                ConfidenceSignal(
                    source=ConfidenceSource(r["source"]),
                    score=r["score"],
                    source_name=r["source_name"],
                    reason=r["reason"],
                )
            )
        return tuple(signals)

    def _load_extracted_fields(
        self, run_id: str
    ) -> tuple[ExtractedField, ...]:
        cur = self._conn.execute(
            "SELECT * FROM extracted_fields WHERE run_id = ?",
            (run_id,),
        )
        fields: list[ExtractedField] = []
        for r in cur.fetchall():
            fid = r["id"]
            fields.append(
                ExtractedField(
                    field_name=r["field_name"],
                    raw_text=r["raw_text"],
                    normalized_value=r["normalized_value"],
                    value_type=ValueType(r["value_type"]),
                    evidence_locations=self._load_evidence(fid),
                    confidence_signals=self._load_confidence(fid),
                    review_state=ReviewState(r["review_state"]),
                )
            )
        return tuple(fields)

    def _save_extracted_fields(
        self,
        run_id: str,
        fields: tuple[ExtractedField, ...],
    ) -> None:
        for ef in fields:
            cur = self._conn.execute(
                """INSERT INTO extracted_fields
                   (run_id, field_name, raw_text, normalized_value,
                    value_type, review_state)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    run_id,
                    ef.field_name,
                    ef.raw_text,
                    ef.normalized_value,
                    ef.value_type.value,
                    ef.review_state.value,
                ),
            )
            field_id = cur.lastrowid

            for ev in ef.evidence_locations:
                self._conn.execute(
                    """INSERT INTO evidence_locations
                       (field_id, page_number, span_start, span_end,
                        bounding_polygon, sheet_name, cell_range)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        field_id,
                        ev.page_number,
                        ev.span_start,
                        ev.span_end,
                        _polygon_to_json(ev.bounding_polygon),
                        ev.sheet_name,
                        ev.cell_range,
                    ),
                )

            for cs in ef.confidence_signals:
                self._conn.execute(
                    """INSERT INTO confidence_signals
                       (field_id, source, score, source_name, reason)
                       VALUES (?, ?, ?, ?, ?)""",
                    (
                        field_id,
                        cs.source.value,
                        cs.score,
                        cs.source_name,
                        cs.reason,
                    ),
                )

    # ---- Documents -------------------------------------------------------

    def register_document(
        self,
        content_hash: str,
        original_filename: str,
        media_type: str,
    ) -> Document:
        # Check for existing document with the same content hash.
        existing = self.find_document_by_hash(content_hash)
        if existing is not None:
            return existing

        doc_id = str(uuid4())
        now = _dt_to_iso(_utc_now())
        self._conn.execute(
            """INSERT INTO documents
               (id, content_hash, original_filename, media_type, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (doc_id, content_hash, original_filename, media_type, now),
        )
        self._conn.commit()
        return Document(
            id=UUID(doc_id),
            content_hash=content_hash,
            original_filename=original_filename,
            media_type=media_type,
            created_at=_iso_to_dt(now),
        )

    def get_document(self, document_id: UUID) -> Document | None:
        cur = self._conn.execute(
            "SELECT * FROM documents WHERE id = ?",
            (str(document_id),),
        )
        row = cur.fetchone()
        return self._row_to_document(row) if row else None

    def find_document_by_hash(self, content_hash: str) -> Document | None:
        cur = self._conn.execute(
            "SELECT * FROM documents WHERE content_hash = ?",
            (content_hash,),
        )
        row = cur.fetchone()
        return self._row_to_document(row) if row else None

    # ---- Versions --------------------------------------------------------

    def create_version(
        self,
        document_id: UUID,
        content_hash: str,
        storage_key: str,
        byte_size: int,
    ) -> DocumentVersion:
        doc_id_str = str(document_id)

        # Determine next version number.
        cur = self._conn.execute(
            "SELECT COALESCE(MAX(version_number), 0) AS max_ver "
            "FROM document_versions WHERE document_id = ?",
            (doc_id_str,),
        )
        next_ver = cur.fetchone()["max_ver"] + 1

        ver_id = str(uuid4())
        now = _dt_to_iso(_utc_now())
        self._conn.execute(
            """INSERT INTO document_versions
               (id, document_id, version_number, content_hash,
                storage_key, byte_size, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                ver_id,
                doc_id_str,
                next_ver,
                content_hash,
                storage_key,
                byte_size,
                now,
            ),
        )
        self._conn.commit()
        return DocumentVersion(
            id=UUID(ver_id),
            document_id=document_id,
            version_number=next_ver,
            content_hash=content_hash,
            storage_key=storage_key,
            byte_size=byte_size,
            created_at=_iso_to_dt(now),
        )

    def get_versions(self, document_id: UUID) -> list[DocumentVersion]:
        cur = self._conn.execute(
            "SELECT * FROM document_versions "
            "WHERE document_id = ? ORDER BY version_number",
            (str(document_id),),
        )
        return [self._row_to_version(row) for row in cur.fetchall()]

    # ---- Processing Runs -------------------------------------------------

    def create_processing_run(
        self,
        version_id: UUID,
        blueprint_id: UUID | None,
        status: ProcessingStatus,
        extracted_fields: tuple[ExtractedField, ...] = (),
        *,
        run_id: UUID | None = None,
    ) -> ProcessingRun:
        rid = str(run_id) if run_id is not None else str(uuid4())

        # Append-only: reject duplicate identity.
        existing = self._conn.execute(
            "SELECT id FROM processing_runs WHERE id = ?", (rid,)
        ).fetchone()
        if existing is not None:
            raise ValueError(
                f"Processing run with id {rid} already exists. "
                "Runs are append-only records."
            )

        now = _dt_to_iso(_utc_now())
        bp_str = str(blueprint_id) if blueprint_id is not None else None
        self._conn.execute(
            """INSERT INTO processing_runs
               (id, version_id, blueprint_id, status, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (rid, str(version_id), bp_str, status.value, now),
        )
        self._save_extracted_fields(rid, extracted_fields)
        self._conn.commit()

        return ProcessingRun(
            id=UUID(rid),
            version_id=version_id,
            blueprint_id=blueprint_id,
            status=status,
            extracted_fields=extracted_fields,
            created_at=_iso_to_dt(now),
        )

    def get_processing_run(self, run_id: UUID) -> ProcessingRun | None:
        rid = str(run_id)
        cur = self._conn.execute(
            "SELECT * FROM processing_runs WHERE id = ?", (rid,)
        )
        row = cur.fetchone()
        if row is None:
            return None

        return ProcessingRun(
            id=UUID(row["id"]),
            version_id=UUID(row["version_id"]),
            blueprint_id=(
                UUID(row["blueprint_id"])
                if row["blueprint_id"] is not None
                else None
            ),
            status=ProcessingStatus(row["status"]),
            extracted_fields=self._load_extracted_fields(rid),
            created_at=_iso_to_dt(row["created_at"]),
        )

    # ---- Blueprints ------------------------------------------------------

    def create_blueprint(
        self,
        name: str,
        version_number: int,
        field_definitions: tuple[BlueprintFieldDefinition, ...],
        *,
        blueprint_id: UUID | None = None,
    ) -> DocumentBlueprint:
        bid = str(blueprint_id) if blueprint_id is not None else str(uuid4())

        # Append-only: reject duplicate identity.
        existing = self._conn.execute(
            "SELECT id FROM blueprints WHERE id = ?", (bid,)
        ).fetchone()
        if existing is not None:
            raise ValueError(
                f"Blueprint with id {bid} already exists. "
                "Blueprints are append-only records."
            )

        now = _dt_to_iso(_utc_now())
        self._conn.execute(
            """INSERT INTO blueprints
               (id, name, version_number, created_at)
               VALUES (?, ?, ?, ?)""",
            (bid, name, version_number, now),
        )
        for fd in field_definitions:
            self._conn.execute(
                """INSERT INTO blueprint_field_definitions
                   (blueprint_id, field_name, value_type, required,
                    validation_guidance)
                   VALUES (?, ?, ?, ?, ?)""",
                (
                    bid,
                    fd.field_name,
                    fd.value_type.value,
                    1 if fd.required else 0,
                    fd.validation_guidance,
                ),
            )
        self._conn.commit()

        return DocumentBlueprint(
            id=UUID(bid),
            name=name,
            version_number=version_number,
            field_definitions=field_definitions,
            created_at=_iso_to_dt(now),
        )

    def get_blueprint(self, blueprint_id: UUID) -> DocumentBlueprint | None:
        bid = str(blueprint_id)
        cur = self._conn.execute(
            "SELECT * FROM blueprints WHERE id = ?", (bid,)
        )
        row = cur.fetchone()
        if row is None:
            return None

        fd_cur = self._conn.execute(
            "SELECT * FROM blueprint_field_definitions WHERE blueprint_id = ?",
            (bid,),
        )
        defs = tuple(
            BlueprintFieldDefinition(
                field_name=r["field_name"],
                value_type=ValueType(r["value_type"]),
                required=bool(r["required"]),
                validation_guidance=r["validation_guidance"],
            )
            for r in fd_cur.fetchall()
        )

        return DocumentBlueprint(
            id=UUID(row["id"]),
            name=row["name"],
            version_number=row["version_number"],
            field_definitions=defs,
            created_at=_iso_to_dt(row["created_at"]),
        )
