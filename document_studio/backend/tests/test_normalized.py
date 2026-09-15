"""Unit tests for normalized document contracts.

Covers frozen immutability, ``__post_init__`` validation, and
``to_dict`` JSON-compatible serialization for every normalized
record type: PageLocation, CellLocation, TextBlock, TableCell,
TableBlock, NormalizedPage, NormalizedSheet, NormalizedDocument,
and IngestionResult.
"""

from __future__ import annotations

import json
import unittest

from document_studio.domain.normalized import (
    CellLocation,
    ContentBlock,
    IngestionOutcome,
    IngestionResult,
    NormalizedDocument,
    NormalizedPage,
    NormalizedSheet,
    PageLocation,
    SourceKind,
    TableBlock,
    TableCell,
    TextBlock,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _page_text_block(
    text: str = "hello",
    page: int = 1,
    offset: int = 0,
) -> TextBlock:
    return TextBlock(
        text=text,
        location=PageLocation(
            page_number=page, char_offset=offset, char_length=len(text)
        ),
    )


def _cell_text_block(text: str = "data", sheet: str = "Sheet1") -> TextBlock:
    return TextBlock(
        text=text,
        location=CellLocation(sheet_name=sheet),
    )


def _make_table_block(page: int = 1) -> TableBlock:
    return TableBlock(
        cells=(
            TableCell(row=0, col=0, text="A"),
            TableCell(row=0, col=1, text="B"),
            TableCell(row=1, col=0, text="C"),
            TableCell(row=1, col=1, text="D"),
        ),
        row_count=2,
        col_count=2,
        location=PageLocation(page_number=page),
    )


def _make_page(page_number: int = 1) -> NormalizedPage:
    return NormalizedPage(
        page_number=page_number,
        blocks=(_page_text_block(page=page_number),),
    )


def _make_sheet(name: str = "Sheet1") -> NormalizedSheet:
    return NormalizedSheet(
        name=name,
        blocks=(
            TableBlock(
                cells=(TableCell(row=0, col=0, text="val"),),
                row_count=1,
                col_count=1,
                location=CellLocation(sheet_name=name),
            ),
        ),
    )


def _make_page_document() -> NormalizedDocument:
    return NormalizedDocument(
        media_type="application/pdf",
        original_filename="test.pdf",
        pages=(_make_page(),),
    )


def _make_sheet_document() -> NormalizedDocument:
    return NormalizedDocument(
        media_type=(
            "application/vnd.openxmlformats-officedocument"
            ".spreadsheetml.sheet"
        ),
        original_filename="data.xlsx",
        sheets=(_make_sheet(),),
    )


# ---------------------------------------------------------------------------
# PageLocation
# ---------------------------------------------------------------------------


class TestPageLocation(unittest.TestCase):
    def test_valid_minimal(self) -> None:
        loc = PageLocation(page_number=1)
        self.assertEqual(loc.page_number, 1)
        self.assertIsNone(loc.char_offset)

    def test_valid_with_span(self) -> None:
        loc = PageLocation(page_number=2, char_offset=10, char_length=5)
        self.assertEqual(loc.char_offset, 10)
        self.assertEqual(loc.char_length, 5)

    def test_zero_page_raises(self) -> None:
        with self.assertRaises(ValueError):
            PageLocation(page_number=0)

    def test_negative_page_raises(self) -> None:
        with self.assertRaises(ValueError):
            PageLocation(page_number=-1)

    def test_negative_offset_raises(self) -> None:
        with self.assertRaises(ValueError):
            PageLocation(page_number=1, char_offset=-1)

    def test_negative_length_raises(self) -> None:
        with self.assertRaises(ValueError):
            PageLocation(page_number=1, char_length=-1)

    def test_frozen(self) -> None:
        loc = PageLocation(page_number=1)
        with self.assertRaises(AttributeError):
            loc.page_number = 2  # type: ignore[misc]

    def test_to_dict_kind(self) -> None:
        d = PageLocation(page_number=3).to_dict()
        self.assertEqual(d["kind"], "page")
        self.assertEqual(d["page_number"], 3)


# ---------------------------------------------------------------------------
# CellLocation
# ---------------------------------------------------------------------------


class TestCellLocation(unittest.TestCase):
    def test_valid_sheet_only(self) -> None:
        loc = CellLocation(sheet_name="Revenue")
        self.assertEqual(loc.sheet_name, "Revenue")
        self.assertIsNone(loc.cell_ref)

    def test_valid_with_cell_ref(self) -> None:
        loc = CellLocation(sheet_name="Sales", cell_ref="B3")
        self.assertEqual(loc.cell_ref, "B3")

    def test_empty_sheet_raises(self) -> None:
        with self.assertRaises(ValueError):
            CellLocation(sheet_name="")

    def test_frozen(self) -> None:
        loc = CellLocation(sheet_name="X")
        with self.assertRaises(AttributeError):
            loc.sheet_name = "Y"  # type: ignore[misc]

    def test_to_dict_kind(self) -> None:
        d = CellLocation(sheet_name="Data", cell_ref="A1").to_dict()
        self.assertEqual(d["kind"], "cell")
        self.assertEqual(d["sheet_name"], "Data")
        self.assertEqual(d["cell_ref"], "A1")


# ---------------------------------------------------------------------------
# TextBlock
# ---------------------------------------------------------------------------


class TestTextBlock(unittest.TestCase):
    def test_to_dict_type(self) -> None:
        d = _page_text_block().to_dict()
        self.assertEqual(d["type"], "text")
        self.assertEqual(d["text"], "hello")
        self.assertIn("location", d)

    def test_frozen(self) -> None:
        tb = _page_text_block()
        with self.assertRaises(AttributeError):
            tb.text = "other"  # type: ignore[misc]


# ---------------------------------------------------------------------------
# TableCell
# ---------------------------------------------------------------------------


class TestTableCell(unittest.TestCase):
    def test_valid(self) -> None:
        c = TableCell(row=0, col=0, text="val")
        self.assertEqual(c.text, "val")

    def test_negative_row_raises(self) -> None:
        with self.assertRaises(ValueError):
            TableCell(row=-1, col=0, text="x")

    def test_negative_col_raises(self) -> None:
        with self.assertRaises(ValueError):
            TableCell(row=0, col=-1, text="x")

    def test_to_dict(self) -> None:
        d = TableCell(row=1, col=2, text="z").to_dict()
        self.assertEqual(d, {"row": 1, "col": 2, "text": "z"})


# ---------------------------------------------------------------------------
# TableBlock
# ---------------------------------------------------------------------------


class TestTableBlock(unittest.TestCase):
    def test_valid(self) -> None:
        tb = _make_table_block()
        self.assertEqual(tb.row_count, 2)
        self.assertEqual(tb.col_count, 2)
        self.assertEqual(len(tb.cells), 4)

    def test_negative_row_count_raises(self) -> None:
        with self.assertRaises(ValueError):
            TableBlock(
                cells=(),
                row_count=-1,
                col_count=0,
                location=PageLocation(page_number=1),
            )

    def test_negative_col_count_raises(self) -> None:
        with self.assertRaises(ValueError):
            TableBlock(
                cells=(),
                row_count=0,
                col_count=-1,
                location=PageLocation(page_number=1),
            )

    def test_to_dict_type(self) -> None:
        d = _make_table_block().to_dict()
        self.assertEqual(d["type"], "table")
        self.assertEqual(len(d["cells"]), 4)
        self.assertEqual(d["row_count"], 2)
        self.assertEqual(d["col_count"], 2)


# ---------------------------------------------------------------------------
# NormalizedPage
# ---------------------------------------------------------------------------


class TestNormalizedPage(unittest.TestCase):
    def test_valid(self) -> None:
        p = _make_page(1)
        self.assertEqual(p.page_number, 1)

    def test_zero_page_raises(self) -> None:
        with self.assertRaises(ValueError):
            NormalizedPage(page_number=0, blocks=())

    def test_to_dict(self) -> None:
        d = _make_page(2).to_dict()
        self.assertEqual(d["page_number"], 2)
        self.assertIsInstance(d["blocks"], list)


# ---------------------------------------------------------------------------
# NormalizedSheet
# ---------------------------------------------------------------------------


class TestNormalizedSheet(unittest.TestCase):
    def test_valid(self) -> None:
        s = _make_sheet("Revenue")
        self.assertEqual(s.name, "Revenue")

    def test_empty_name_raises(self) -> None:
        with self.assertRaises(ValueError):
            NormalizedSheet(name="", blocks=())

    def test_to_dict(self) -> None:
        d = _make_sheet("Q1").to_dict()
        self.assertEqual(d["name"], "Q1")


# ---------------------------------------------------------------------------
# NormalizedDocument
# ---------------------------------------------------------------------------


class TestNormalizedDocument(unittest.TestCase):
    def test_valid_page_document(self) -> None:
        doc = _make_page_document()
        self.assertEqual(doc.media_type, "application/pdf")
        self.assertEqual(len(doc.pages), 1)
        self.assertEqual(len(doc.sheets), 0)

    def test_valid_sheet_document(self) -> None:
        doc = _make_sheet_document()
        self.assertEqual(len(doc.sheets), 1)
        self.assertEqual(len(doc.pages), 0)

    def test_empty_media_type_raises(self) -> None:
        with self.assertRaises(ValueError):
            NormalizedDocument(
                media_type="",
                original_filename="test.pdf",
                pages=(_make_page(),),
            )

    def test_empty_filename_raises(self) -> None:
        with self.assertRaises(ValueError):
            NormalizedDocument(
                media_type="application/pdf",
                original_filename="",
                pages=(_make_page(),),
            )

    def test_both_pages_and_sheets_raises(self) -> None:
        with self.assertRaises(ValueError):
            NormalizedDocument(
                media_type="application/pdf",
                original_filename="test.pdf",
                pages=(_make_page(),),
                sheets=(_make_sheet(),),
            )

    def test_no_pages_or_sheets_raises(self) -> None:
        with self.assertRaises(ValueError):
            NormalizedDocument(
                media_type="application/pdf",
                original_filename="test.pdf",
            )

    def test_frozen(self) -> None:
        doc = _make_page_document()
        with self.assertRaises(AttributeError):
            doc.media_type = "other"  # type: ignore[misc]

    def test_to_dict_page_doc(self) -> None:
        d = _make_page_document().to_dict()
        self.assertIn("pages", d)
        self.assertNotIn("sheets", d)

    def test_to_dict_sheet_doc(self) -> None:
        d = _make_sheet_document().to_dict()
        self.assertIn("sheets", d)
        self.assertNotIn("pages", d)


# ---------------------------------------------------------------------------
# IngestionResult
# ---------------------------------------------------------------------------


class TestIngestionResult(unittest.TestCase):
    def test_success_valid(self) -> None:
        doc = _make_page_document()
        result = IngestionResult(
            outcome=IngestionOutcome.success, document=doc
        )
        self.assertEqual(result.outcome, IngestionOutcome.success)
        self.assertIsNotNone(result.document)

    def test_requires_ocr_valid(self) -> None:
        result = IngestionResult(
            outcome=IngestionOutcome.requires_ocr,
            requires_ocr_reason="No embedded text found.",
        )
        self.assertEqual(result.outcome, IngestionOutcome.requires_ocr)
        self.assertIsNone(result.document)
        self.assertEqual(result.requires_ocr_reason, "No embedded text found.")

    def test_success_without_document_raises(self) -> None:
        with self.assertRaises(ValueError):
            IngestionResult(outcome=IngestionOutcome.success)

    def test_success_with_reason_raises(self) -> None:
        with self.assertRaises(ValueError):
            IngestionResult(
                outcome=IngestionOutcome.success,
                document=_make_page_document(),
                requires_ocr_reason="should not be here",
            )

    def test_requires_ocr_with_document_raises(self) -> None:
        with self.assertRaises(ValueError):
            IngestionResult(
                outcome=IngestionOutcome.requires_ocr,
                document=_make_page_document(),
                requires_ocr_reason="reason",
            )

    def test_requires_ocr_without_reason_raises(self) -> None:
        with self.assertRaises(ValueError):
            IngestionResult(outcome=IngestionOutcome.requires_ocr)

    def test_requires_ocr_empty_reason_raises(self) -> None:
        with self.assertRaises(ValueError):
            IngestionResult(
                outcome=IngestionOutcome.requires_ocr,
                requires_ocr_reason="",
            )

    def test_to_dict_success(self) -> None:
        doc = _make_page_document()
        d = IngestionResult(
            outcome=IngestionOutcome.success, document=doc
        ).to_dict()
        self.assertEqual(d["outcome"], "success")
        self.assertIn("document", d)
        self.assertNotIn("requires_ocr_reason", d)

    def test_to_dict_requires_ocr(self) -> None:
        d = IngestionResult(
            outcome=IngestionOutcome.requires_ocr,
            requires_ocr_reason="scanned",
        ).to_dict()
        self.assertEqual(d["outcome"], "requires_ocr")
        self.assertNotIn("document", d)
        self.assertEqual(d["requires_ocr_reason"], "scanned")


# ---------------------------------------------------------------------------
# JSON round-trip compatibility
# ---------------------------------------------------------------------------


class TestNormalizedJsonRoundTrip(unittest.TestCase):
    """Verify ``to_dict`` produces JSON-serializable output."""

    def _assert_json(self, d: dict) -> None:
        raw = json.dumps(d)
        restored = json.loads(raw)
        self.assertEqual(d, restored)

    def test_page_location(self) -> None:
        self._assert_json(
            PageLocation(page_number=1, char_offset=0, char_length=5).to_dict()
        )

    def test_cell_location(self) -> None:
        self._assert_json(
            CellLocation(sheet_name="S", cell_ref="A1").to_dict()
        )

    def test_text_block(self) -> None:
        self._assert_json(_page_text_block().to_dict())

    def test_table_block(self) -> None:
        self._assert_json(_make_table_block().to_dict())

    def test_page_document(self) -> None:
        self._assert_json(_make_page_document().to_dict())

    def test_sheet_document(self) -> None:
        self._assert_json(_make_sheet_document().to_dict())

    def test_success_result(self) -> None:
        self._assert_json(
            IngestionResult(
                outcome=IngestionOutcome.success,
                document=_make_page_document(),
            ).to_dict()
        )

    def test_requires_ocr_result(self) -> None:
        self._assert_json(
            IngestionResult(
                outcome=IngestionOutcome.requires_ocr,
                requires_ocr_reason="No text",
            ).to_dict()
        )


if __name__ == "__main__":
    unittest.main()
