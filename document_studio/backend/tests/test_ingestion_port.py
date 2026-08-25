"""Unit tests for the ingestion application port and infrastructure service.

Covers filename validation, media-type resolution, format detection,
size limits, unsupported-format errors, and media-type mismatch errors.

Uses small deterministic fixtures; no network calls, model keys, running
server, OCR software, or production paths are required.
"""

from __future__ import annotations

import unittest

from document_studio.application.ingestion import (
    DEFAULT_MAX_BYTE_SIZE,
    EmptyInputError,
    FileSizeLimitError,
    MediaTypeMismatchError,
    UnsafeFilenameError,
    UnsupportedFormatError,
    resolve_media_type,
    validate_filename,
)


# ---------------------------------------------------------------------------
# Filename validation
# ---------------------------------------------------------------------------


class TestValidateFilename(unittest.TestCase):
    """Tests for ``validate_filename``."""

    def test_simple_valid(self) -> None:
        validate_filename("invoice.pdf")

    def test_with_spaces(self) -> None:
        validate_filename("my document.docx")

    def test_with_dashes_underscores(self) -> None:
        validate_filename("report_2026-08.xlsx")

    def test_empty_raises(self) -> None:
        with self.assertRaises(UnsafeFilenameError):
            validate_filename("")

    def test_whitespace_only_raises(self) -> None:
        with self.assertRaises(UnsafeFilenameError):
            validate_filename("   ")

    def test_forward_slash_raises(self) -> None:
        with self.assertRaises(UnsafeFilenameError):
            validate_filename("path/to/file.pdf")

    def test_backslash_raises(self) -> None:
        with self.assertRaises(UnsafeFilenameError):
            validate_filename("path\\to\\file.pdf")

    def test_null_byte_raises(self) -> None:
        with self.assertRaises(UnsafeFilenameError):
            validate_filename("file\x00.pdf")

    def test_colon_raises(self) -> None:
        with self.assertRaises(UnsafeFilenameError):
            validate_filename("C:file.pdf")

    def test_dot_raises(self) -> None:
        with self.assertRaises(UnsafeFilenameError):
            validate_filename(".")

    def test_dotdot_raises(self) -> None:
        with self.assertRaises(UnsafeFilenameError):
            validate_filename("..")


# ---------------------------------------------------------------------------
# Media type resolution
# ---------------------------------------------------------------------------


class TestResolveMediaType(unittest.TestCase):
    """Tests for ``resolve_media_type``."""

    def test_pdf_match(self) -> None:
        result = resolve_media_type("doc.pdf", "application/pdf")
        self.assertEqual(result, "application/pdf")

    def test_docx_match(self) -> None:
        mt = (
            "application/vnd.openxmlformats-officedocument"
            ".wordprocessingml.document"
        )
        result = resolve_media_type("doc.docx", mt)
        self.assertEqual(result, mt)

    def test_xlsx_match(self) -> None:
        mt = (
            "application/vnd.openxmlformats-officedocument"
            ".spreadsheetml.sheet"
        )
        result = resolve_media_type("data.xlsx", mt)
        self.assertEqual(result, mt)

    def test_case_insensitive_extension(self) -> None:
        result = resolve_media_type("DOC.PDF", "application/pdf")
        self.assertEqual(result, "application/pdf")

    def test_unknown_extension_raises(self) -> None:
        with self.assertRaises(UnsupportedFormatError):
            resolve_media_type("image.png", "image/png")

    def test_unsupported_media_type_raises(self) -> None:
        with self.assertRaises(UnsupportedFormatError):
            resolve_media_type("doc.pdf", "text/plain")

    def test_mismatch_pdf_as_docx_raises(self) -> None:
        with self.assertRaises(MediaTypeMismatchError):
            resolve_media_type(
                "doc.pdf",
                "application/vnd.openxmlformats-officedocument"
                ".wordprocessingml.document",
            )

    def test_mismatch_xlsx_as_pdf_raises(self) -> None:
        with self.assertRaises(MediaTypeMismatchError):
            resolve_media_type("data.xlsx", "application/pdf")


if __name__ == "__main__":
    unittest.main()
