"""Portable domain records for Document Studio.

All objects are frozen standard-library dataclasses with ``__post_init__``
validation.  No FastAPI, Flask, Pydantic, SQLAlchemy, or AI_Tool imports
are permitted in this module.

Public serialization (``to_dict``) produces JSON-compatible dictionaries:
UUIDs and enums as strings, UTC timestamps in ISO 8601 form, tuples as
arrays, and no unserializable Python objects.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any
from uuid import UUID


def _require_utc(dt: datetime, field_name: str) -> None:
    """Require *dt* to be timezone-aware with a UTC offset of exactly zero.

    Raises ``ValueError`` for naive datetimes and for timezone-aware
    datetimes whose UTC offset is not zero (e.g. ``+05:00``).
    """
    if dt.tzinfo is None or dt.utcoffset() is None:
        raise ValueError(f"{field_name} must be timezone-aware (UTC).")
    if dt.utcoffset() != timedelta(0):
        raise ValueError(
            f"{field_name} must have a UTC offset of zero, "
            f"got {dt.utcoffset()}."
        )

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class ProcessingStatus(Enum):
    """Lifecycle status of a document processing run."""

    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class ValueType(Enum):
    """Semantic type of an extracted or blueprint-defined field value."""

    string = "string"
    integer = "integer"
    decimal = "decimal"
    date = "date"
    boolean = "boolean"
    currency = "currency"
    address = "address"
    custom = "custom"


class ConfidenceSource(Enum):
    """Processing category that produced a confidence signal."""

    ocr = "ocr"
    extraction = "extraction"
    validation = "validation"


class ReviewState(Enum):
    """Human review state for an extracted field."""

    unreviewed = "unreviewed"
    accepted = "accepted"
    rejected = "rejected"
    corrected = "corrected"


# ---------------------------------------------------------------------------
# Evidence & Confidence
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class EvidenceLocation:
    """Source location evidence within a document.

    Supports page-based documents (PDF, Word) and spreadsheets.  At least
    one usable source location must be provided: a positive page number,
    a sheet name, or a complete text span (both ``span_start`` and
    ``span_end``).

    Validation rejects records with no usable source location, invalid
    ranges, or an incomplete text span.
    """

    page_number: int | None = None
    span_start: int | None = None
    span_end: int | None = None
    bounding_polygon: tuple[tuple[float, float], ...] | None = None
    sheet_name: str | None = None
    cell_range: str | None = None

    def __post_init__(self) -> None:
        has_page = self.page_number is not None
        has_sheet = self.sheet_name is not None
        has_span_part = self.span_start is not None or self.span_end is not None

        # At least one usable source location required.
        if not (has_page or has_sheet or has_span_part):
            raise ValueError(
                "EvidenceLocation must have at least one usable source "
                "location: page_number, sheet_name, or text span."
            )

        # Page number must be positive.
        if has_page and self.page_number <= 0:  # type: ignore[operator]
            raise ValueError(
                f"page_number must be positive, got {self.page_number}"
            )

        # Text span requires both endpoints with start < end.
        if has_span_part:
            if self.span_start is None or self.span_end is None:
                raise ValueError(
                    "Text span requires both span_start and span_end."
                )
            if self.span_start < 0:
                raise ValueError(
                    f"span_start must be non-negative, got {self.span_start}"
                )
            if self.span_start >= self.span_end:
                raise ValueError(
                    f"span_start ({self.span_start}) must be less than "
                    f"span_end ({self.span_end})."
                )

    def to_dict(self) -> dict[str, Any]:
        """JSON-compatible dictionary representation."""
        return {
            "page_number": self.page_number,
            "span_start": self.span_start,
            "span_end": self.span_end,
            "bounding_polygon": (
                [list(pt) for pt in self.bounding_polygon]
                if self.bounding_polygon is not None
                else None
            ),
            "sheet_name": self.sheet_name,
            "cell_range": self.cell_range,
        }


@dataclass(frozen=True)
class ConfidenceSignal:
    """A confidence measurement from a specific processing source.

    Score is bounded ``[0.0, 1.0]`` inclusive.  ``source`` identifies the
    processing category (ocr, extraction, validation).  ``source_name``
    names the concrete provider, and ``reason`` is an optional plain-text
    explanation.
    """

    source: ConfidenceSource
    score: float
    source_name: str
    reason: str | None = None

    def __post_init__(self) -> None:
        if not (0.0 <= self.score <= 1.0):
            raise ValueError(
                f"Confidence score must be between 0.0 and 1.0, "
                f"got {self.score}"
            )
        if not self.source_name:
            raise ValueError("source_name must not be empty.")

    def to_dict(self) -> dict[str, Any]:
        """JSON-compatible dictionary representation."""
        return {
            "source": self.source.value,
            "score": self.score,
            "source_name": self.source_name,
            "reason": self.reason,
        }


# ---------------------------------------------------------------------------
# Extracted Field
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ExtractedField:
    """A single field extracted from a document during processing.

    Preserves the raw text, an optional normalized value, the value type,
    source evidence locations, separate confidence signals, and review
    state.
    """

    field_name: str
    raw_text: str
    normalized_value: str | None
    value_type: ValueType
    evidence_locations: tuple[EvidenceLocation, ...]
    confidence_signals: tuple[ConfidenceSignal, ...]
    review_state: ReviewState = ReviewState.unreviewed

    def __post_init__(self) -> None:
        if not self.field_name:
            raise ValueError("field_name must not be empty.")

    def to_dict(self) -> dict[str, Any]:
        """JSON-compatible dictionary representation."""
        return {
            "field_name": self.field_name,
            "raw_text": self.raw_text,
            "normalized_value": self.normalized_value,
            "value_type": self.value_type.value,
            "evidence_locations": [e.to_dict() for e in self.evidence_locations],
            "confidence_signals": [c.to_dict() for c in self.confidence_signals],
            "review_state": self.review_state.value,
        }


# ---------------------------------------------------------------------------
# Document & Version
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Document:
    """A registered document identified by its content hash.

    Records the content hash, original filename, media type, and
    timezone-aware UTC creation time.
    """

    id: UUID
    content_hash: str
    original_filename: str
    media_type: str
    created_at: datetime

    def __post_init__(self) -> None:
        if not self.content_hash:
            raise ValueError("content_hash must not be empty.")
        if not self.original_filename:
            raise ValueError("original_filename must not be empty.")
        _require_utc(self.created_at, "created_at")

    def to_dict(self) -> dict[str, Any]:
        """JSON-compatible dictionary representation."""
        return {
            "id": str(self.id),
            "content_hash": self.content_hash,
            "original_filename": self.original_filename,
            "media_type": self.media_type,
            "created_at": self.created_at.isoformat(),
        }


@dataclass(frozen=True)
class DocumentVersion:
    """An immutable version of a document stored in managed file storage.

    Records its parent document identity, a positive version number,
    content hash, managed storage key, byte size, and timezone-aware
    UTC creation time.
    """

    id: UUID
    document_id: UUID
    version_number: int
    content_hash: str
    storage_key: str
    byte_size: int
    created_at: datetime

    def __post_init__(self) -> None:
        if self.version_number < 1:
            raise ValueError(
                f"version_number must be positive, got {self.version_number}"
            )
        if self.byte_size < 0:
            raise ValueError(
                f"byte_size must be non-negative, got {self.byte_size}"
            )
        if not self.content_hash:
            raise ValueError("content_hash must not be empty.")
        if not self.storage_key:
            raise ValueError("storage_key must not be empty.")
        _require_utc(self.created_at, "created_at")

    def to_dict(self) -> dict[str, Any]:
        """JSON-compatible dictionary representation."""
        return {
            "id": str(self.id),
            "document_id": str(self.document_id),
            "version_number": self.version_number,
            "content_hash": self.content_hash,
            "storage_key": self.storage_key,
            "byte_size": self.byte_size,
            "created_at": self.created_at.isoformat(),
        }


# ---------------------------------------------------------------------------
# Processing Run
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ProcessingRun:
    """A record of one processing attempt against a document version.

    Records the document version identity, an optional blueprint identity,
    processing status, extracted fields, and timezone-aware UTC creation
    time.
    """

    id: UUID
    version_id: UUID
    blueprint_id: UUID | None
    status: ProcessingStatus
    extracted_fields: tuple[ExtractedField, ...]
    created_at: datetime

    def __post_init__(self) -> None:
        _require_utc(self.created_at, "created_at")

    def to_dict(self) -> dict[str, Any]:
        """JSON-compatible dictionary representation."""
        return {
            "id": str(self.id),
            "version_id": str(self.version_id),
            "blueprint_id": (
                str(self.blueprint_id) if self.blueprint_id is not None else None
            ),
            "status": self.status.value,
            "extracted_fields": [f.to_dict() for f in self.extracted_fields],
            "created_at": self.created_at.isoformat(),
        }


# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class BlueprintFieldDefinition:
    """A single field definition within a document blueprint.

    Records a stable field name, value type, whether the field is
    required, and optional validation guidance.
    """

    field_name: str
    value_type: ValueType
    required: bool
    validation_guidance: str | None = None

    def __post_init__(self) -> None:
        if not self.field_name:
            raise ValueError("field_name must not be empty.")

    def to_dict(self) -> dict[str, Any]:
        """JSON-compatible dictionary representation."""
        return {
            "field_name": self.field_name,
            "value_type": self.value_type.value,
            "required": self.required,
            "validation_guidance": self.validation_guidance,
        }


@dataclass(frozen=True)
class DocumentBlueprint:
    """A versioned, immutable template for document extraction.

    Contains a name, a positive version number, field definitions, and
    a timezone-aware UTC creation time.  Blueprints are append-only
    records; once created, they are never modified.
    """

    id: UUID
    name: str
    version_number: int
    field_definitions: tuple[BlueprintFieldDefinition, ...]
    created_at: datetime

    def __post_init__(self) -> None:
        if not self.name:
            raise ValueError("name must not be empty.")
        if self.version_number < 1:
            raise ValueError(
                f"version_number must be positive, got {self.version_number}"
            )
        _require_utc(self.created_at, "created_at")

    def to_dict(self) -> dict[str, Any]:
        """JSON-compatible dictionary representation."""
        return {
            "id": str(self.id),
            "name": self.name,
            "version_number": self.version_number,
            "field_definitions": [
                fd.to_dict() for fd in self.field_definitions
            ],
            "created_at": self.created_at.isoformat(),
        }


# ---------------------------------------------------------------------------
# Convenience
# ---------------------------------------------------------------------------


def record_to_dict(obj: Any) -> dict[str, Any]:
    """Convert any domain record with a ``to_dict`` method to a
    JSON-compatible dictionary.

    Raises ``TypeError`` if the object does not support ``to_dict``.
    """
    if not hasattr(obj, "to_dict"):
        raise TypeError(
            f"{type(obj).__name__} does not support to_dict serialization."
        )
    return obj.to_dict()
