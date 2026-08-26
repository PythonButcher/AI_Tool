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
# Content-signature verification
# ---------------------------------------------------------------------------

# Magic-byte prefixes for supported formats.
_PDF_SIGNATURE = b"%PDF-"
_ZIP_SIGNATURE = b"PK\x03\x04"

# Exact main-document content types inside OOXML [Content_Types].xml.
# These identify the standard (non-macro-enabled) document formats.
# Macro-enabled variants (DOCM, XLSM) use different content types:
#   DOCM: application/vnd.ms-word.document.macroEnabled.main+xml
#   XLSM: application/vnd.ms-excel.sheet.macroEnabled.main+xml
# Those must NOT match — they are unsupported formats.
_DOCX_MAIN_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument"
    ".wordprocessingml.document.main+xml"
)
_XLSX_MAIN_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument"
    ".spreadsheetml.sheet.main+xml"
)

# Macro-enabled content types (used only for explicit rejection messages).
_DOCM_MAIN_CONTENT_TYPE = (
    "application/vnd.ms-word.document.macroEnabled.main+xml"
)
_XLSM_MAIN_CONTENT_TYPE = (
    "application/vnd.ms-excel.sheet.macroEnabled.main+xml"
)

# A normal OOXML content-type manifest is small. Checking the declared
# uncompressed size before reading it prevents a compressed manifest from
# consuming arbitrary memory during format detection.
_MAX_CONTENT_TYPES_BYTES = 1024 * 1024

_DOCX_MAIN_PART = "/word/document.xml"
_XLSX_MAIN_PART = "/xl/workbook.xml"

# Canonical OOXML media types for error messages.
_MEDIA_TYPE_DOCX = (
    "application/vnd.openxmlformats-officedocument"
    ".wordprocessingml.document"
)
_MEDIA_TYPE_XLSX = (
    "application/vnd.openxmlformats-officedocument"
    ".spreadsheetml.sheet"
)


def _detect_ooxml_media_type(data: bytes) -> str | None:
    """Inspect a ZIP archive's ``[Content_Types].xml`` to determine
    whether the package is a standard DOCX or XLSX.

    Returns the canonical media type string, or ``None`` if the package
    cannot be identified as a supported non-macro-enabled format.

    Validates **both** the exact main-document content type attribute
    value in ``[Content_Types].xml`` **and** the existence of the
    corresponding main-part path in the archive:

    - DOCX: ``word/document.xml`` with content type
      ``...wordprocessingml.document.main+xml``
    - XLSX: ``xl/workbook.xml`` with content type
      ``...spreadsheetml.sheet.main+xml``

    Macro-enabled variants (DOCM, XLSM) are explicitly rejected as
    unsupported rather than silently accepted.

    Uses only the standard library ``zipfile`` module (no parser libs).
    """
    import io
    import zipfile
    from xml.etree import ElementTree

    try:
        with zipfile.ZipFile(io.BytesIO(data), "r") as zf:
            entries = frozenset(zf.namelist())

            if "[Content_Types].xml" not in entries:
                return None
            manifest_info = zf.getinfo("[Content_Types].xml")
            if manifest_info.file_size > _MAX_CONTENT_TYPES_BYTES:
                return None
            content_types = zf.read("[Content_Types].xml")
    except (zipfile.BadZipFile, KeyError, OSError, RuntimeError, ValueError):
        return None

    try:
        root = ElementTree.fromstring(content_types)
    except ElementTree.ParseError:
        return None

    overrides: set[tuple[str, str]] = set()
    for element in root.iter():
        if element.tag.rsplit("}", 1)[-1] != "Override":
            continue
        part_name = element.attrib.get("PartName")
        content_type = element.attrib.get("ContentType")
        if part_name and content_type:
            overrides.add((part_name, content_type))

    declared_content_types = {content_type for _, content_type in overrides}

    # Reject macro-enabled packages explicitly.
    if (
        _DOCM_MAIN_CONTENT_TYPE in declared_content_types
        or _XLSM_MAIN_CONTENT_TYPE in declared_content_types
    ):
        raise UnsupportedFormatError(
            "Macro-enabled OOXML packages (DOCM/XLSM) are not supported."
        )

    has_docx_main = (
        (_DOCX_MAIN_PART, _DOCX_MAIN_CONTENT_TYPE) in overrides
        and _DOCX_MAIN_PART.lstrip("/") in entries
    )
    has_xlsx_main = (
        (_XLSX_MAIN_PART, _XLSX_MAIN_CONTENT_TYPE) in overrides
        and _XLSX_MAIN_PART.lstrip("/") in entries
    )

    if has_docx_main and not has_xlsx_main:
        return _MEDIA_TYPE_DOCX
    if has_xlsx_main and not has_docx_main:
        return _MEDIA_TYPE_XLSX
    # Ambiguous or unrecognized OOXML package.
    return None


def verify_content_signature(data: bytes, declared_media_type: str) -> None:
    """Verify that the actual bytes match the declared media type.

    Checks PDF magic bytes (``%PDF-``) for PDF files and ZIP package
    structure plus ``[Content_Types].xml`` for OOXML files (DOCX/XLSX).

    Raises:
        MediaTypeMismatchError: if the bytes belong to a *different*
            supported format than declared (e.g. DOCX bytes declared
            as XLSX).
        UnsupportedFormatError: if the bytes do not match any
            recognized content signature for the declared format.
    """
    if declared_media_type == "application/pdf":
        # PDF must start with %PDF-.
        if data[:5] == _PDF_SIGNATURE:
            return  # Valid PDF bytes.
        # Check if bytes are actually a ZIP (OOXML) mislabeled as PDF.
        if data[:4] == _ZIP_SIGNATURE:
            actual = _detect_ooxml_media_type(data)
            if actual is not None:
                raise MediaTypeMismatchError(
                    f"Content is {actual!r} but was declared as "
                    f"{declared_media_type!r}."
                )
        raise UnsupportedFormatError(
            "Content does not have a valid PDF signature."
        )

    if declared_media_type in (_MEDIA_TYPE_DOCX, _MEDIA_TYPE_XLSX):
        # OOXML formats are ZIP archives.
        if data[:4] != _ZIP_SIGNATURE:
            # Check if it's actually a PDF mislabeled as OOXML.
            if data[:5] == _PDF_SIGNATURE:
                raise MediaTypeMismatchError(
                    f"Content is 'application/pdf' but was declared as "
                    f"{declared_media_type!r}."
                )
            raise UnsupportedFormatError(
                "Content does not have a valid ZIP/OOXML signature."
            )
        # Distinguish DOCX from XLSX by package contents.
        actual = _detect_ooxml_media_type(data)
        if actual is None:
            raise UnsupportedFormatError(
                "Content is a ZIP archive but does not contain "
                "recognizable OOXML package contents."
            )
        if actual != declared_media_type:
            raise MediaTypeMismatchError(
                f"Content is {actual!r} but was declared as "
                f"{declared_media_type!r}."
            )
        return  # Valid OOXML bytes matching declared type.


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
