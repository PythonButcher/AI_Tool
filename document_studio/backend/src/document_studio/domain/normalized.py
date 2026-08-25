"""Portable normalized-document contracts for Document Studio.

All objects are frozen standard-library dataclasses with ``__post_init__``
validation.  No FastAPI, Flask, Pydantic, SQLAlchemy, parser libraries,
or AI_Tool imports are permitted in this module.

Public serialization (``to_dict``) produces JSON-compatible dictionaries:
enums as strings, tuples as arrays, and no unserializable Python objects.

The representation preserves reading order and distinguishes page-based
locations (PDF, Word) from spreadsheet sheet-and-cell locations (Excel).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class SourceKind(Enum):
    """Identifies whether a source location is page-based or cell-based."""

    page = "page"
    cell = "cell"


class IngestionOutcome(Enum):
    """Outcome of an ingestion attempt."""

    success = "success"
    requires_ocr = "requires_ocr"


# ---------------------------------------------------------------------------
# Source Locations
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PageLocation:
    """Source location within a page-based document (PDF, DOCX).

    ``page_number`` is 1-indexed and must be positive.
    ``char_offset`` and ``char_length`` are optional character-level spans
    within the page text.
    """

    page_number: int
    char_offset: int | None = None
    char_length: int | None = None

    def __post_init__(self) -> None:
        if self.page_number < 1:
            raise ValueError(
                f"page_number must be positive, got {self.page_number}"
            )
        if self.char_offset is not None and self.char_offset < 0:
            raise ValueError(
                f"char_offset must be non-negative, got {self.char_offset}"
            )
        if self.char_length is not None and self.char_length < 0:
            raise ValueError(
                f"char_length must be non-negative, got {self.char_length}"
            )

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": SourceKind.page.value,
            "page_number": self.page_number,
            "char_offset": self.char_offset,
            "char_length": self.char_length,
        }


@dataclass(frozen=True)
class CellLocation:
    """Source location within a spreadsheet.

    ``sheet_name`` identifies the worksheet.  ``cell_ref`` is an
    optional cell reference such as ``"B3"``.
    """

    sheet_name: str
    cell_ref: str | None = None

    def __post_init__(self) -> None:
        if not self.sheet_name:
            raise ValueError("sheet_name must not be empty.")

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": SourceKind.cell.value,
            "sheet_name": self.sheet_name,
            "cell_ref": self.cell_ref,
        }


# Union type for source locations.
SourceLocation = PageLocation | CellLocation


# ---------------------------------------------------------------------------
# Content Blocks (reading-order elements)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TextBlock:
    """A contiguous run of text within a document.

    Preserves the text content and its source location.
    """

    text: str
    location: SourceLocation

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": "text",
            "text": self.text,
            "location": self.location.to_dict(),
        }


@dataclass(frozen=True)
class TableCell:
    """A single cell within a normalized table.

    ``row`` and ``col`` are 0-indexed positions.
    """

    row: int
    col: int
    text: str

    def __post_init__(self) -> None:
        if self.row < 0:
            raise ValueError(f"row must be non-negative, got {self.row}")
        if self.col < 0:
            raise ValueError(f"col must be non-negative, got {self.col}")

    def to_dict(self) -> dict[str, Any]:
        return {
            "row": self.row,
            "col": self.col,
            "text": self.text,
        }


@dataclass(frozen=True)
class TableBlock:
    """A table extracted from a document, preserving structure and location.

    ``cells`` contains every non-empty cell in reading order.
    ``row_count`` and ``col_count`` record the table dimensions.
    """

    cells: tuple[TableCell, ...]
    row_count: int
    col_count: int
    location: SourceLocation

    def __post_init__(self) -> None:
        if self.row_count < 0:
            raise ValueError(
                f"row_count must be non-negative, got {self.row_count}"
            )
        if self.col_count < 0:
            raise ValueError(
                f"col_count must be non-negative, got {self.col_count}"
            )

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": "table",
            "cells": [c.to_dict() for c in self.cells],
            "row_count": self.row_count,
            "col_count": self.col_count,
            "location": self.location.to_dict(),
        }


# Union type for content blocks.
ContentBlock = TextBlock | TableBlock


# ---------------------------------------------------------------------------
# Normalized Page / Sheet
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class NormalizedPage:
    """A single page from a page-based document.

    ``page_number`` is 1-indexed.  ``blocks`` preserves reading order.
    """

    page_number: int
    blocks: tuple[ContentBlock, ...]

    def __post_init__(self) -> None:
        if self.page_number < 1:
            raise ValueError(
                f"page_number must be positive, got {self.page_number}"
            )

    def to_dict(self) -> dict[str, Any]:
        return {
            "page_number": self.page_number,
            "blocks": [b.to_dict() for b in self.blocks],
        }


@dataclass(frozen=True)
class NormalizedSheet:
    """A single worksheet from a spreadsheet.

    ``name`` is the sheet tab name.  ``blocks`` preserves reading order
    (typically one table block per sheet, but text blocks are allowed
    for headers/notes).
    """

    name: str
    blocks: tuple[ContentBlock, ...]

    def __post_init__(self) -> None:
        if not self.name:
            raise ValueError("Sheet name must not be empty.")

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "blocks": [b.to_dict() for b in self.blocks],
        }


# ---------------------------------------------------------------------------
# Normalized Document
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class NormalizedDocument:
    """Portable normalized representation of an ingested document.

    Contains either ``pages`` (for page-based formats like PDF and DOCX)
    or ``sheets`` (for spreadsheet formats like XLSX), never both.
    ``media_type`` records the detected format.
    ``original_filename`` is metadata only (never used as a path).
    """

    media_type: str
    original_filename: str
    pages: tuple[NormalizedPage, ...] = ()
    sheets: tuple[NormalizedSheet, ...] = ()

    def __post_init__(self) -> None:
        if not self.media_type:
            raise ValueError("media_type must not be empty.")
        if not self.original_filename:
            raise ValueError("original_filename must not be empty.")
        has_pages = len(self.pages) > 0
        has_sheets = len(self.sheets) > 0
        if has_pages and has_sheets:
            raise ValueError(
                "NormalizedDocument must have pages or sheets, not both."
            )
        if not has_pages and not has_sheets:
            raise ValueError(
                "NormalizedDocument must have at least one page or sheet."
            )

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "media_type": self.media_type,
            "original_filename": self.original_filename,
        }
        if self.pages:
            result["pages"] = [p.to_dict() for p in self.pages]
        if self.sheets:
            result["sheets"] = [s.to_dict() for s in self.sheets]
        return result


# ---------------------------------------------------------------------------
# Ingestion Result
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class IngestionResult:
    """Structured result of a document ingestion attempt.

    When ``outcome`` is ``success``, ``document`` contains the normalized
    representation and ``requires_ocr_reason`` is ``None``.

    When ``outcome`` is ``requires_ocr``, ``document`` is ``None`` and
    ``requires_ocr_reason`` explains why OCR is needed (e.g. the PDF
    contains only images with no usable embedded text).
    """

    outcome: IngestionOutcome
    document: NormalizedDocument | None = None
    requires_ocr_reason: str | None = None

    def __post_init__(self) -> None:
        if self.outcome == IngestionOutcome.success:
            if self.document is None:
                raise ValueError(
                    "A successful ingestion must include a document."
                )
            if self.requires_ocr_reason is not None:
                raise ValueError(
                    "A successful ingestion must not have a "
                    "requires_ocr_reason."
                )
        elif self.outcome == IngestionOutcome.requires_ocr:
            if self.document is not None:
                raise ValueError(
                    "A requires_ocr result must not include a document."
                )
            if not self.requires_ocr_reason:
                raise ValueError(
                    "A requires_ocr result must include a reason."
                )

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {"outcome": self.outcome.value}
        if self.document is not None:
            result["document"] = self.document.to_dict()
        if self.requires_ocr_reason is not None:
            result["requires_ocr_reason"] = self.requires_ocr_reason
        return result
