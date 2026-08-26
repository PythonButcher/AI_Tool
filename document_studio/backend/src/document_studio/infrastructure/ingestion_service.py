"""Concrete ingestion service for Document Studio.

Dispatches to format-specific infrastructure adapters (PDF, DOCX, XLSX)
after validating input safety, size limits, and media-type consistency.

This is the single entry point for the application layer.  Parser
imports are delegated to individual adapter modules.
"""

from __future__ import annotations

from document_studio.application.ingestion import (
    DEFAULT_MAX_BYTE_SIZE,
    EmptyInputError,
    FileSizeLimitError,
    IngestionPort,
    UnsupportedFormatError,
    resolve_media_type,
    validate_filename,
    verify_content_signature,
)
from document_studio.domain.normalized import IngestionResult


class IngestionService(IngestionPort):
    """Concrete ingestion service that validates and dispatches.

    Accepts server-received bytes, validates input safety, and routes
    to the appropriate infrastructure adapter based on media type.
    """

    def ingest(
        self,
        data: bytes,
        original_filename: str,
        declared_media_type: str,
        max_byte_size: int = DEFAULT_MAX_BYTE_SIZE,
    ) -> IngestionResult:
        """Validate and ingest document bytes.

        Raises application-layer errors for empty input, unsafe
        filenames, oversized content, unsupported formats, and
        media-type mismatches.  Returns an ``IngestionResult`` with
        ``success`` or ``requires_ocr``.
        """
        # 1. Reject empty input.
        if not data:
            raise EmptyInputError("Document bytes must not be empty.")

        # 2. Validate filename safety.
        validate_filename(original_filename)

        # 3. Resolve and validate media type.
        media_type = resolve_media_type(original_filename, declared_media_type)

        # 4. Enforce size limit (before any content inspection).
        if len(data) > max_byte_size:
            raise FileSizeLimitError(
                f"Document size {len(data)} bytes exceeds the "
                f"maximum of {max_byte_size} bytes."
            )

        # 5. Verify actual byte content matches declared media type.
        verify_content_signature(data, media_type)

        # 6. Dispatch to format-specific adapter.
        if media_type == "application/pdf":
            from document_studio.infrastructure.pdf_adapter import ingest_pdf

            return ingest_pdf(data, original_filename)

        if media_type == (
            "application/vnd.openxmlformats-officedocument"
            ".wordprocessingml.document"
        ):
            from document_studio.infrastructure.docx_adapter import (
                ingest_docx,
            )

            return ingest_docx(data, original_filename)

        if media_type == (
            "application/vnd.openxmlformats-officedocument"
            ".spreadsheetml.sheet"
        ):
            from document_studio.infrastructure.xlsx_adapter import (
                ingest_xlsx,
            )

            return ingest_xlsx(data, original_filename)

        # Should not reach here due to resolve_media_type validation,
        # but guard defensively.
        raise UnsupportedFormatError(
            f"No adapter available for media type: {media_type!r}"
        )
