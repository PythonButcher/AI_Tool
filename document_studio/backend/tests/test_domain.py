"""Unit tests for Document Studio domain records.

Covers ``__post_init__`` validation, enum values, frozen immutability,
and ``to_dict`` JSON-compatible serialization for every record type.
"""

from __future__ import annotations

import json
import unittest
from datetime import datetime, timezone
from uuid import uuid4

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
    record_to_dict,
)

_NOW = datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_evidence(**overrides) -> EvidenceLocation:
    defaults = {"page_number": 1}
    defaults.update(overrides)
    return EvidenceLocation(**defaults)


def _make_confidence(**overrides) -> ConfidenceSignal:
    defaults = {
        "source": ConfidenceSource.extraction,
        "score": 0.95,
        "source_name": "test-model",
    }
    defaults.update(overrides)
    return ConfidenceSignal(**defaults)


def _make_field(**overrides) -> ExtractedField:
    defaults = {
        "field_name": "invoice_number",
        "raw_text": "INV-001",
        "normalized_value": "INV-001",
        "value_type": ValueType.string,
        "evidence_locations": (_make_evidence(),),
        "confidence_signals": (_make_confidence(),),
        "review_state": ReviewState.unreviewed,
    }
    defaults.update(overrides)
    return ExtractedField(**defaults)


# ---------------------------------------------------------------------------
# EvidenceLocation
# ---------------------------------------------------------------------------


class TestEvidenceLocation(unittest.TestCase):
    """Validation and serialization for EvidenceLocation."""

    def test_valid_page_only(self) -> None:
        ev = EvidenceLocation(page_number=3)
        self.assertEqual(ev.page_number, 3)

    def test_valid_sheet_only(self) -> None:
        ev = EvidenceLocation(sheet_name="Sheet1", cell_range="A1:B5")
        self.assertEqual(ev.sheet_name, "Sheet1")

    def test_valid_span_only(self) -> None:
        ev = EvidenceLocation(span_start=0, span_end=10)
        self.assertEqual(ev.span_start, 0)
        self.assertEqual(ev.span_end, 10)

    def test_valid_page_with_polygon(self) -> None:
        poly = ((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))
        ev = EvidenceLocation(page_number=1, bounding_polygon=poly)
        self.assertEqual(ev.bounding_polygon, poly)

    def test_no_location_raises(self) -> None:
        with self.assertRaises(ValueError):
            EvidenceLocation()

    def test_page_zero_raises(self) -> None:
        with self.assertRaises(ValueError):
            EvidenceLocation(page_number=0)

    def test_negative_page_raises(self) -> None:
        with self.assertRaises(ValueError):
            EvidenceLocation(page_number=-1)

    def test_incomplete_span_start_only_raises(self) -> None:
        with self.assertRaises(ValueError):
            EvidenceLocation(span_start=5)

    def test_incomplete_span_end_only_raises(self) -> None:
        with self.assertRaises(ValueError):
            EvidenceLocation(span_end=10)

    def test_span_start_equals_end_raises(self) -> None:
        with self.assertRaises(ValueError):
            EvidenceLocation(span_start=5, span_end=5)

    def test_span_start_greater_than_end_raises(self) -> None:
        with self.assertRaises(ValueError):
            EvidenceLocation(span_start=10, span_end=5)

    def test_negative_span_start_raises(self) -> None:
        with self.assertRaises(ValueError):
            EvidenceLocation(span_start=-1, span_end=5)

    def test_frozen(self) -> None:
        ev = EvidenceLocation(page_number=1)
        with self.assertRaises(AttributeError):
            ev.page_number = 2  # type: ignore[misc]

    def test_to_dict_all_fields_present(self) -> None:
        ev = EvidenceLocation(page_number=1, span_start=0, span_end=5)
        d = ev.to_dict()
        self.assertIn("page_number", d)
        self.assertIn("span_start", d)
        self.assertIn("span_end", d)
        self.assertIn("bounding_polygon", d)
        self.assertIn("sheet_name", d)
        self.assertIn("cell_range", d)

    def test_to_dict_polygon_as_lists(self) -> None:
        poly = ((1.0, 2.0), (3.0, 4.0))
        ev = EvidenceLocation(page_number=1, bounding_polygon=poly)
        d = ev.to_dict()
        self.assertEqual(d["bounding_polygon"], [[1.0, 2.0], [3.0, 4.0]])


# ---------------------------------------------------------------------------
# ConfidenceSignal
# ---------------------------------------------------------------------------


class TestConfidenceSignal(unittest.TestCase):
    """Validation and serialization for ConfidenceSignal."""

    def test_valid_signal(self) -> None:
        cs = ConfidenceSignal(
            source=ConfidenceSource.ocr,
            score=0.85,
            source_name="tesseract",
            reason="high contrast",
        )
        self.assertEqual(cs.score, 0.85)

    def test_score_zero_valid(self) -> None:
        cs = ConfidenceSignal(
            source=ConfidenceSource.validation,
            score=0.0,
            source_name="rule-engine",
        )
        self.assertEqual(cs.score, 0.0)

    def test_score_one_valid(self) -> None:
        cs = ConfidenceSignal(
            source=ConfidenceSource.extraction,
            score=1.0,
            source_name="gpt-4",
        )
        self.assertEqual(cs.score, 1.0)

    def test_score_below_zero_raises(self) -> None:
        with self.assertRaises(ValueError):
            ConfidenceSignal(
                source=ConfidenceSource.ocr,
                score=-0.1,
                source_name="tesseract",
            )

    def test_score_above_one_raises(self) -> None:
        with self.assertRaises(ValueError):
            ConfidenceSignal(
                source=ConfidenceSource.ocr,
                score=1.01,
                source_name="tesseract",
            )

    def test_empty_source_name_raises(self) -> None:
        with self.assertRaises(ValueError):
            ConfidenceSignal(
                source=ConfidenceSource.ocr,
                score=0.5,
                source_name="",
            )

    def test_to_dict_enum_as_string(self) -> None:
        cs = _make_confidence()
        d = cs.to_dict()
        self.assertIsInstance(d["source"], str)
        self.assertEqual(d["source"], "extraction")


# ---------------------------------------------------------------------------
# ExtractedField
# ---------------------------------------------------------------------------


class TestExtractedField(unittest.TestCase):
    """Validation and serialization for ExtractedField."""

    def test_valid_field(self) -> None:
        f = _make_field()
        self.assertEqual(f.field_name, "invoice_number")

    def test_empty_field_name_raises(self) -> None:
        with self.assertRaises(ValueError):
            _make_field(field_name="")

    def test_to_dict_nested_structures(self) -> None:
        f = _make_field()
        d = f.to_dict()
        self.assertIsInstance(d["evidence_locations"], list)
        self.assertIsInstance(d["confidence_signals"], list)
        self.assertEqual(d["value_type"], "string")
        self.assertEqual(d["review_state"], "unreviewed")


# ---------------------------------------------------------------------------
# Document
# ---------------------------------------------------------------------------


class TestDocument(unittest.TestCase):
    """Validation and serialization for Document."""

    def test_valid_document(self) -> None:
        doc = Document(
            id=uuid4(),
            content_hash="abc123",
            original_filename="invoice.pdf",
            media_type="application/pdf",
            created_at=_NOW,
        )
        self.assertEqual(doc.original_filename, "invoice.pdf")

    def test_empty_hash_raises(self) -> None:
        with self.assertRaises(ValueError):
            Document(
                id=uuid4(),
                content_hash="",
                original_filename="test.pdf",
                media_type="application/pdf",
                created_at=_NOW,
            )

    def test_empty_filename_raises(self) -> None:
        with self.assertRaises(ValueError):
            Document(
                id=uuid4(),
                content_hash="abc",
                original_filename="",
                media_type="application/pdf",
                created_at=_NOW,
            )

    def test_naive_datetime_raises(self) -> None:
        with self.assertRaises(ValueError):
            Document(
                id=uuid4(),
                content_hash="abc",
                original_filename="test.pdf",
                media_type="application/pdf",
                created_at=datetime(2025, 1, 1),
            )

    def test_to_dict_uuid_as_string(self) -> None:
        uid = uuid4()
        doc = Document(
            id=uid,
            content_hash="abc",
            original_filename="test.pdf",
            media_type="application/pdf",
            created_at=_NOW,
        )
        d = doc.to_dict()
        self.assertEqual(d["id"], str(uid))

    def test_to_dict_datetime_iso(self) -> None:
        doc = Document(
            id=uuid4(),
            content_hash="abc",
            original_filename="test.pdf",
            media_type="application/pdf",
            created_at=_NOW,
        )
        d = doc.to_dict()
        # Must be parsable ISO 8601
        parsed = datetime.fromisoformat(d["created_at"])
        self.assertIsNotNone(parsed.tzinfo)


# ---------------------------------------------------------------------------
# DocumentVersion
# ---------------------------------------------------------------------------


class TestDocumentVersion(unittest.TestCase):
    """Validation for DocumentVersion."""

    def test_valid_version(self) -> None:
        v = DocumentVersion(
            id=uuid4(),
            document_id=uuid4(),
            version_number=1,
            content_hash="hash",
            storage_key="ab/cd/hash",
            byte_size=1024,
            created_at=_NOW,
        )
        self.assertEqual(v.version_number, 1)

    def test_zero_version_raises(self) -> None:
        with self.assertRaises(ValueError):
            DocumentVersion(
                id=uuid4(),
                document_id=uuid4(),
                version_number=0,
                content_hash="hash",
                storage_key="key",
                byte_size=0,
                created_at=_NOW,
            )

    def test_negative_byte_size_raises(self) -> None:
        with self.assertRaises(ValueError):
            DocumentVersion(
                id=uuid4(),
                document_id=uuid4(),
                version_number=1,
                content_hash="hash",
                storage_key="key",
                byte_size=-1,
                created_at=_NOW,
            )

    def test_empty_storage_key_raises(self) -> None:
        with self.assertRaises(ValueError):
            DocumentVersion(
                id=uuid4(),
                document_id=uuid4(),
                version_number=1,
                content_hash="hash",
                storage_key="",
                byte_size=0,
                created_at=_NOW,
            )


# ---------------------------------------------------------------------------
# ProcessingRun
# ---------------------------------------------------------------------------


class TestProcessingRun(unittest.TestCase):
    """Validation for ProcessingRun."""

    def test_valid_run(self) -> None:
        run = ProcessingRun(
            id=uuid4(),
            version_id=uuid4(),
            blueprint_id=None,
            status=ProcessingStatus.pending,
            extracted_fields=(),
            created_at=_NOW,
        )
        self.assertEqual(run.status, ProcessingStatus.pending)

    def test_naive_datetime_raises(self) -> None:
        with self.assertRaises(ValueError):
            ProcessingRun(
                id=uuid4(),
                version_id=uuid4(),
                blueprint_id=None,
                status=ProcessingStatus.pending,
                extracted_fields=(),
                created_at=datetime(2025, 1, 1),
            )

    def test_to_dict_optional_blueprint_none(self) -> None:
        run = ProcessingRun(
            id=uuid4(),
            version_id=uuid4(),
            blueprint_id=None,
            status=ProcessingStatus.completed,
            extracted_fields=(),
            created_at=_NOW,
        )
        d = run.to_dict()
        self.assertIsNone(d["blueprint_id"])

    def test_to_dict_optional_blueprint_present(self) -> None:
        bp_id = uuid4()
        run = ProcessingRun(
            id=uuid4(),
            version_id=uuid4(),
            blueprint_id=bp_id,
            status=ProcessingStatus.completed,
            extracted_fields=(),
            created_at=_NOW,
        )
        d = run.to_dict()
        self.assertEqual(d["blueprint_id"], str(bp_id))


# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------


class TestBlueprintFieldDefinition(unittest.TestCase):
    """Validation for BlueprintFieldDefinition."""

    def test_valid_definition(self) -> None:
        fd = BlueprintFieldDefinition(
            field_name="total",
            value_type=ValueType.currency,
            required=True,
            validation_guidance="Must be positive",
        )
        self.assertTrue(fd.required)

    def test_empty_field_name_raises(self) -> None:
        with self.assertRaises(ValueError):
            BlueprintFieldDefinition(
                field_name="",
                value_type=ValueType.string,
                required=False,
            )


class TestDocumentBlueprint(unittest.TestCase):
    """Validation for DocumentBlueprint."""

    def test_valid_blueprint(self) -> None:
        bp = DocumentBlueprint(
            id=uuid4(),
            name="Invoice v1",
            version_number=1,
            field_definitions=(
                BlueprintFieldDefinition(
                    field_name="total",
                    value_type=ValueType.currency,
                    required=True,
                ),
            ),
            created_at=_NOW,
        )
        self.assertEqual(bp.name, "Invoice v1")

    def test_empty_name_raises(self) -> None:
        with self.assertRaises(ValueError):
            DocumentBlueprint(
                id=uuid4(),
                name="",
                version_number=1,
                field_definitions=(),
                created_at=_NOW,
            )

    def test_zero_version_raises(self) -> None:
        with self.assertRaises(ValueError):
            DocumentBlueprint(
                id=uuid4(),
                name="Test",
                version_number=0,
                field_definitions=(),
                created_at=_NOW,
            )

    def test_naive_datetime_raises(self) -> None:
        with self.assertRaises(ValueError):
            DocumentBlueprint(
                id=uuid4(),
                name="Test",
                version_number=1,
                field_definitions=(),
                created_at=datetime(2025, 1, 1),
            )


# ---------------------------------------------------------------------------
# Serialization — JSON compatibility
# ---------------------------------------------------------------------------


class TestJsonCompatibility(unittest.TestCase):
    """Verify that ``to_dict`` produces values that survive
    ``json.dumps`` → ``json.loads`` without custom encoders.
    """

    def _assert_json_round_trip(self, d: dict) -> None:
        """Ensure *d* survives JSON serialization with the default encoder."""
        raw = json.dumps(d)
        restored = json.loads(raw)
        self.assertEqual(d, restored)

    def test_evidence_location(self) -> None:
        self._assert_json_round_trip(
            EvidenceLocation(page_number=1, span_start=0, span_end=5).to_dict()
        )

    def test_confidence_signal(self) -> None:
        self._assert_json_round_trip(_make_confidence().to_dict())

    def test_extracted_field(self) -> None:
        self._assert_json_round_trip(_make_field().to_dict())

    def test_document(self) -> None:
        doc = Document(
            id=uuid4(),
            content_hash="abc",
            original_filename="f.pdf",
            media_type="application/pdf",
            created_at=_NOW,
        )
        self._assert_json_round_trip(doc.to_dict())

    def test_document_version(self) -> None:
        v = DocumentVersion(
            id=uuid4(),
            document_id=uuid4(),
            version_number=1,
            content_hash="hash",
            storage_key="ab/cd/hash",
            byte_size=100,
            created_at=_NOW,
        )
        self._assert_json_round_trip(v.to_dict())

    def test_processing_run(self) -> None:
        run = ProcessingRun(
            id=uuid4(),
            version_id=uuid4(),
            blueprint_id=uuid4(),
            status=ProcessingStatus.completed,
            extracted_fields=(_make_field(),),
            created_at=_NOW,
        )
        self._assert_json_round_trip(run.to_dict())

    def test_blueprint(self) -> None:
        bp = DocumentBlueprint(
            id=uuid4(),
            name="Test",
            version_number=1,
            field_definitions=(
                BlueprintFieldDefinition(
                    field_name="f",
                    value_type=ValueType.string,
                    required=True,
                    validation_guidance="hint",
                ),
            ),
            created_at=_NOW,
        )
        self._assert_json_round_trip(bp.to_dict())


# ---------------------------------------------------------------------------
# record_to_dict convenience
# ---------------------------------------------------------------------------


class TestRecordToDict(unittest.TestCase):
    def test_works_for_domain_record(self) -> None:
        ev = EvidenceLocation(page_number=1)
        d = record_to_dict(ev)
        self.assertIsInstance(d, dict)

    def test_raises_for_plain_object(self) -> None:
        with self.assertRaises(TypeError):
            record_to_dict("not a record")


if __name__ == "__main__":
    unittest.main()
