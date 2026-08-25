"""Application-layer ingestion port for Document Studio.

Defines the abstract ingestion service that accepts server-received bytes
and produces a normalized document or a structured requires-ocr result.

This module may import domain contracts but must not import parser
libraries, FastAPI, Flask, SQLite, filesystem paths, or AI_Tool state.
"""

from __future__ import annotations

import os
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

from document_studio.domain.normalized import IngestionResult


# ---------------------------------------------------------------------------
# Supported media types
# ---------------------------------------------------------------------------

SUPPORTED_MEDIA_TYPES: frozenset[str] = frozenset(
    {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
)

# Map file extensions (lowercase, with dot) to canonical media types.
_EXTENSION_TO_MEDIA_TYPE: dict[str, str] = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

# Default maximum bytes: 50 MiB.
DEFAULT_MAX_BYTE_SIZE: int = 50 * 1024 * 1024

# Characters that are never acceptable in a filename used as metadata.
_UNSAFE_FILENAME_PATTERN = re.compile(r"[/\\:\x00]")


# ---------------------------------------------------------------------------
# Validation errors
# ---------------------------------------------------------------------------


class IngestionError(Exception):
    """Raised when ingestion validation fails before parsing."""


class UnsupportedFormatError(IngestionError):
    """Raised for an unsupported or unrecognized document format."""


class FileSizeLimitError(IngestionError):
    """Raised when document bytes exceed the configured limit."""


class UnsafeFilenameError(IngestionError):
    """Raised when the supplied filename contains unsafe characters."""


class EmptyInputError(IngestionError):
    """Raised when document bytes are empty."""


class MediaTypeMismatchError(IngestionError):
    """Raised when the declared media type does not match the file extension."""


# ---------------------------------------------------------------------------
# Filename safety
# ---------------------------------------------------------------------------


def validate_filename(filename: str) -> None:
    """Validate that *filename* is safe for use as metadata.

    Rejects empty filenames, filenames containing path separators,
    null bytes, colons, or path traversal components.

    Raises ``UnsafeFilenameError`` if the filename is unsafe.
    """
    if not filename or not filename.strip():
        raise UnsafeFilenameError("Filename must not be empty.")

    # Reject path separators, null bytes, colons.
    if _UNSAFE_FILENAME_PATTERN.search(filename):
        raise UnsafeFilenameError(
            f"Filename contains unsafe characters: {filename!r}"
        )

    # Reject path-traversal components.
    basename = os.path.basename(filename)
    if basename != filename:
        raise UnsafeFilenameError(
            f"Filename must not contain directory components: {filename!r}"
        )
    if basename in (".", ".."):
        raise UnsafeFilenameError(
            f"Filename must not be a traversal component: {filename!r}"
        )


# ---------------------------------------------------------------------------
# Media type resolution
# ---------------------------------------------------------------------------


def resolve_media_type(filename: str, declared_media_type: str) -> str:
    """Resolve and validate the media type for ingestion.

    Uses the filename extension to determine the expected media type,
    then checks that the declared media type matches.  Returns the
    validated media type.

    Raises:
        UnsupportedFormatError: if the extension is unknown or the media
            type is not supported.
        MediaTypeMismatchError: if the declared type conflicts with the
            extension-derived type.
    """
    _, ext = os.path.splitext(filename)
    ext_lower = ext.lower()

    expected_type = _EXTENSION_TO_MEDIA_TYPE.get(ext_lower)

    if expected_type is None:
        raise UnsupportedFormatError(
            f"Unsupported file extension: {ext_lower!r}"
        )

    if declared_media_type not in SUPPORTED_MEDIA_TYPES:
        raise UnsupportedFormatError(
            f"Unsupported media type: {declared_media_type!r}"
        )

    if declared_media_type != expected_type:
        raise MediaTypeMismatchError(
            f"Declared media type {declared_media_type!r} does not match "
            f"file extension {ext_lower!r} (expected {expected_type!r})."
        )

    return declared_media_type


# ---------------------------------------------------------------------------
# Ingestion Port
# ---------------------------------------------------------------------------


class IngestionPort(ABC):
    """Abstract ingestion service.

    Accepts server-received bytes, an original filename (metadata only),
    a declared media type, and a configurable maximum byte size.

    The caller must never supply a filesystem path.  Concrete
    implementations live in the infrastructure layer and import parser
    libraries only within their own modules.
    """

    @abstractmethod
    def ingest(
        self,
        data: bytes,
        original_filename: str,
        declared_media_type: str,
        max_byte_size: int = DEFAULT_MAX_BYTE_SIZE,
    ) -> IngestionResult:
        """Ingest document bytes and return a normalized result.

        Implementations must:
        - Reject empty input (``EmptyInputError``)
        - Reject unsafe filenames (``UnsafeFilenameError``)
        - Reject oversized content (``FileSizeLimitError``)
        - Reject unsupported formats (``UnsupportedFormatError``)
        - Reject media type / extension mismatches (``MediaTypeMismatchError``)
        - Return ``IngestionResult`` with outcome ``success`` or
          ``requires_ocr``
        """
