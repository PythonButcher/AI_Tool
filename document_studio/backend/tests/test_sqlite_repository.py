"""Unit tests for the SQLite document-metadata repository.

Covers duplicate-document detection, sequential version numbering,
processing-run round trips with nested evidence and confidence,
blueprint round trips with field definitions, append-only identity
conflicts, and restart persistence.  All tests use temporary
directories.
"""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from uuid import uuid4

from document_studio.domain.records import (
    BlueprintFieldDefinition,
    ConfidenceSignal,
    ConfidenceSource,
    EvidenceLocation,
    ExtractedField,
    ProcessingStatus,
    ReviewState,
    ValueType,
)
from document_studio.infrastructure.sqlite_repository import (
    SQLiteDocumentRepository,
)


class _RepoTestBase(unittest.TestCase):
    """Shared setup: fresh SQLite database in a temp directory."""

    def setUp(self) -> None:
        self._tmpdir = tempfile.mkdtemp()
        self._db_path = os.path.join(self._tmpdir, "test.db")
        self.repo = SQLiteDocumentRepository(self._db_path)

    def tearDown(self) -> None:
        self.repo.close()
        import shutil

        shutil.rmtree(self._tmpdir, ignore_errors=True)

    # Helper: register a document and create version 1 so processing
    # runs have a valid foreign-key target.
    def _make_doc_and_version(self):
        doc = self.repo.register_document(
            content_hash="deadbeef",
            original_filename="test.pdf",
            media_type="application/pdf",
        )
        ver = self.repo.create_version(
            document_id=doc.id,
            content_hash="deadbeef",
            storage_key="de/ad/deadbeef",
            byte_size=4096,
        )
        return doc, ver


# ---------------------------------------------------------------------------
# Document registration
# ---------------------------------------------------------------------------


class TestDocumentRegistration(_RepoTestBase):
    def test_register_new_document(self) -> None:
        doc = self.repo.register_document(
            content_hash="aaa",
            original_filename="a.pdf",
            media_type="application/pdf",
        )
        self.assertEqual(doc.content_hash, "aaa")
        self.assertEqual(doc.original_filename, "a.pdf")
        self.assertIsNotNone(doc.id)

    def test_duplicate_hash_returns_existing(self) -> None:
        """Duplicate content registration must return the existing
        document, not create another."""
        doc1 = self.repo.register_document(
            content_hash="same",
            original_filename="first.pdf",
            media_type="application/pdf",
        )
        doc2 = self.repo.register_document(
            content_hash="same",
            original_filename="second.pdf",
            media_type="application/pdf",
        )
        self.assertEqual(doc1.id, doc2.id)
        # The original filename is from the first registration.
        self.assertEqual(doc2.original_filename, "first.pdf")

    def test_get_document_by_id(self) -> None:
        doc = self.repo.register_document(
            content_hash="fetch",
            original_filename="f.pdf",
            media_type="application/pdf",
        )
        fetched = self.repo.get_document(doc.id)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.id, doc.id)

    def test_get_document_missing(self) -> None:
        self.assertIsNone(self.repo.get_document(uuid4()))

    def test_find_by_hash(self) -> None:
        doc = self.repo.register_document(
            content_hash="lookup",
            original_filename="l.pdf",
            media_type="application/pdf",
        )
        found = self.repo.find_document_by_hash("lookup")
        self.assertIsNotNone(found)
        self.assertEqual(found.id, doc.id)

    def test_find_by_hash_missing(self) -> None:
        self.assertIsNone(self.repo.find_document_by_hash("nope"))


# ---------------------------------------------------------------------------
# Version numbering
# ---------------------------------------------------------------------------


class TestVersionNumbering(_RepoTestBase):
    def test_first_version_is_one(self) -> None:
        doc = self.repo.register_document("v1", "d.pdf", "application/pdf")
        ver = self.repo.create_version(doc.id, "v1", "v1/key", 100)
        self.assertEqual(ver.version_number, 1)

    def test_sequential_versions(self) -> None:
        doc = self.repo.register_document("seq", "d.pdf", "application/pdf")
        v1 = self.repo.create_version(doc.id, "h1", "k1", 10)
        v2 = self.repo.create_version(doc.id, "h2", "k2", 20)
        v3 = self.repo.create_version(doc.id, "h3", "k3", 30)
        self.assertEqual(v1.version_number, 1)
        self.assertEqual(v2.version_number, 2)
        self.assertEqual(v3.version_number, 3)

    def test_get_versions_ordered(self) -> None:
        doc = self.repo.register_document("ord", "d.pdf", "application/pdf")
        self.repo.create_version(doc.id, "h1", "k1", 10)
        self.repo.create_version(doc.id, "h2", "k2", 20)
        versions = self.repo.get_versions(doc.id)
        self.assertEqual(len(versions), 2)
        self.assertEqual(versions[0].version_number, 1)
        self.assertEqual(versions[1].version_number, 2)

    def test_versions_independent_per_document(self) -> None:
        d1 = self.repo.register_document("d1h", "d1.pdf", "application/pdf")
        d2 = self.repo.register_document("d2h", "d2.pdf", "application/pdf")
        v1 = self.repo.create_version(d1.id, "h", "k", 10)
        v2 = self.repo.create_version(d2.id, "h", "k", 10)
        # Each document starts at version 1.
        self.assertEqual(v1.version_number, 1)
        self.assertEqual(v2.version_number, 1)


# ---------------------------------------------------------------------------
# Processing run round trips
# ---------------------------------------------------------------------------


class TestProcessingRunRoundTrip(_RepoTestBase):
    def test_simple_run_round_trip(self) -> None:
        _, ver = self._make_doc_and_version()
        run = self.repo.create_processing_run(
            version_id=ver.id,
            blueprint_id=None,
            status=ProcessingStatus.completed,
        )
        fetched = self.repo.get_processing_run(run.id)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.status, ProcessingStatus.completed)
        self.assertIsNone(fetched.blueprint_id)

    def test_run_with_extracted_fields(self) -> None:
        """Full round-trip: fields, evidence, and confidence survive."""
        _, ver = self._make_doc_and_version()

        evidence = EvidenceLocation(page_number=2, span_start=10, span_end=20)
        confidence = ConfidenceSignal(
            source=ConfidenceSource.extraction,
            score=0.92,
            source_name="model-x",
            reason="high match",
        )
        field = ExtractedField(
            field_name="total_amount",
            raw_text="$1,234.56",
            normalized_value="1234.56",
            value_type=ValueType.currency,
            evidence_locations=(evidence,),
            confidence_signals=(confidence,),
            review_state=ReviewState.accepted,
        )
        run = self.repo.create_processing_run(
            version_id=ver.id,
            blueprint_id=None,
            status=ProcessingStatus.completed,
            extracted_fields=(field,),
        )

        fetched = self.repo.get_processing_run(run.id)
        self.assertEqual(len(fetched.extracted_fields), 1)

        ef = fetched.extracted_fields[0]
        self.assertEqual(ef.field_name, "total_amount")
        self.assertEqual(ef.raw_text, "$1,234.56")
        self.assertEqual(ef.normalized_value, "1234.56")
        self.assertEqual(ef.value_type, ValueType.currency)
        self.assertEqual(ef.review_state, ReviewState.accepted)

        # Evidence round-trip
        self.assertEqual(len(ef.evidence_locations), 1)
        ev = ef.evidence_locations[0]
        self.assertEqual(ev.page_number, 2)
        self.assertEqual(ev.span_start, 10)
        self.assertEqual(ev.span_end, 20)

        # Confidence round-trip
        self.assertEqual(len(ef.confidence_signals), 1)
        cs = ef.confidence_signals[0]
        self.assertEqual(cs.source, ConfidenceSource.extraction)
        self.assertAlmostEqual(cs.score, 0.92)
        self.assertEqual(cs.source_name, "model-x")
        self.assertEqual(cs.reason, "high match")

    def test_run_with_spreadsheet_evidence(self) -> None:
        """Evidence supports sheet_name and cell_range for spreadsheets."""
        _, ver = self._make_doc_and_version()

        evidence = EvidenceLocation(sheet_name="Sales", cell_range="B2:C10")
        field = ExtractedField(
            field_name="revenue",
            raw_text="50000",
            normalized_value="50000",
            value_type=ValueType.integer,
            evidence_locations=(evidence,),
            confidence_signals=(),
            review_state=ReviewState.unreviewed,
        )
        run = self.repo.create_processing_run(
            version_id=ver.id,
            blueprint_id=None,
            status=ProcessingStatus.completed,
            extracted_fields=(field,),
        )

        fetched = self.repo.get_processing_run(run.id)
        ev = fetched.extracted_fields[0].evidence_locations[0]
        self.assertEqual(ev.sheet_name, "Sales")
        self.assertEqual(ev.cell_range, "B2:C10")
        self.assertIsNone(ev.page_number)

    def test_run_with_bounding_polygon(self) -> None:
        """Bounding polygon survives round-trip through JSON column."""
        _, ver = self._make_doc_and_version()

        poly = ((0.1, 0.2), (0.9, 0.2), (0.9, 0.8), (0.1, 0.8))
        evidence = EvidenceLocation(page_number=1, bounding_polygon=poly)
        field = ExtractedField(
            field_name="signature",
            raw_text="[signature]",
            normalized_value=None,
            value_type=ValueType.string,
            evidence_locations=(evidence,),
            confidence_signals=(),
        )
        run = self.repo.create_processing_run(
            version_id=ver.id,
            blueprint_id=None,
            status=ProcessingStatus.completed,
            extracted_fields=(field,),
        )

        fetched = self.repo.get_processing_run(run.id)
        fetched_poly = fetched.extracted_fields[0].evidence_locations[0].bounding_polygon
        self.assertEqual(len(fetched_poly), 4)
        for orig, restored in zip(poly, fetched_poly):
            self.assertAlmostEqual(orig[0], restored[0])
            self.assertAlmostEqual(orig[1], restored[1])

    def test_run_with_blueprint_id(self) -> None:
        """Processing run preserves optional blueprint identity."""
        _, ver = self._make_doc_and_version()
        bp_id = uuid4()
        run = self.repo.create_processing_run(
            version_id=ver.id,
            blueprint_id=bp_id,
            status=ProcessingStatus.pending,
        )
        fetched = self.repo.get_processing_run(run.id)
        self.assertEqual(fetched.blueprint_id, bp_id)

    def test_get_missing_run(self) -> None:
        self.assertIsNone(self.repo.get_processing_run(uuid4()))


# ---------------------------------------------------------------------------
# Blueprint round trips
# ---------------------------------------------------------------------------


class TestBlueprintRoundTrip(_RepoTestBase):
    def test_simple_blueprint(self) -> None:
        fd = BlueprintFieldDefinition(
            field_name="invoice_date",
            value_type=ValueType.date,
            required=True,
            validation_guidance="ISO 8601 date format",
        )
        bp = self.repo.create_blueprint(
            name="Invoice",
            version_number=1,
            field_definitions=(fd,),
        )
        fetched = self.repo.get_blueprint(bp.id)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.name, "Invoice")
        self.assertEqual(fetched.version_number, 1)
        self.assertEqual(len(fetched.field_definitions), 1)

        fdef = fetched.field_definitions[0]
        self.assertEqual(fdef.field_name, "invoice_date")
        self.assertEqual(fdef.value_type, ValueType.date)
        self.assertTrue(fdef.required)
        self.assertEqual(fdef.validation_guidance, "ISO 8601 date format")

    def test_blueprint_multiple_fields(self) -> None:
        defs = (
            BlueprintFieldDefinition("name", ValueType.string, True),
            BlueprintFieldDefinition("amount", ValueType.currency, True),
            BlueprintFieldDefinition("notes", ValueType.string, False, "free text"),
        )
        bp = self.repo.create_blueprint("Multi", 2, defs)
        fetched = self.repo.get_blueprint(bp.id)
        self.assertEqual(len(fetched.field_definitions), 3)
        names = [fd.field_name for fd in fetched.field_definitions]
        self.assertEqual(names, ["name", "amount", "notes"])

    def test_blueprint_optional_guidance_none(self) -> None:
        fd = BlueprintFieldDefinition("x", ValueType.string, False)
        bp = self.repo.create_blueprint("NoGuidance", 1, (fd,))
        fetched = self.repo.get_blueprint(bp.id)
        self.assertIsNone(fetched.field_definitions[0].validation_guidance)

    def test_get_missing_blueprint(self) -> None:
        self.assertIsNone(self.repo.get_blueprint(uuid4()))


# ---------------------------------------------------------------------------
# Append-only identity conflicts
# ---------------------------------------------------------------------------


class TestAppendOnlyConflicts(_RepoTestBase):
    def test_duplicate_processing_run_id_raises(self) -> None:
        """Creating a run with an existing ID must raise ValueError."""
        _, ver = self._make_doc_and_version()
        forced_id = uuid4()
        self.repo.create_processing_run(
            version_id=ver.id,
            blueprint_id=None,
            status=ProcessingStatus.pending,
            run_id=forced_id,
        )
        with self.assertRaises(ValueError):
            self.repo.create_processing_run(
                version_id=ver.id,
                blueprint_id=None,
                status=ProcessingStatus.running,
                run_id=forced_id,
            )

    def test_duplicate_blueprint_id_raises(self) -> None:
        """Creating a blueprint with an existing ID must raise ValueError."""
        forced_id = uuid4()
        self.repo.create_blueprint(
            name="A",
            version_number=1,
            field_definitions=(),
            blueprint_id=forced_id,
        )
        with self.assertRaises(ValueError):
            self.repo.create_blueprint(
                name="B",
                version_number=2,
                field_definitions=(),
                blueprint_id=forced_id,
            )


# ---------------------------------------------------------------------------
# Restart persistence
# ---------------------------------------------------------------------------


class TestRestartPersistence(_RepoTestBase):
    def test_data_survives_close_and_reopen(self) -> None:
        """Data persisted before close must be available after reopening."""
        doc = self.repo.register_document("persist", "p.pdf", "application/pdf")
        ver = self.repo.create_version(doc.id, "persist", "pe/rs/persist", 256)

        evidence = EvidenceLocation(page_number=1)
        confidence = ConfidenceSignal(
            source=ConfidenceSource.ocr,
            score=0.77,
            source_name="test-ocr",
        )
        field = ExtractedField(
            field_name="vendor",
            raw_text="Acme Corp",
            normalized_value="Acme Corp",
            value_type=ValueType.string,
            evidence_locations=(evidence,),
            confidence_signals=(confidence,),
        )
        run = self.repo.create_processing_run(
            version_id=ver.id,
            blueprint_id=None,
            status=ProcessingStatus.completed,
            extracted_fields=(field,),
        )

        bp = self.repo.create_blueprint(
            name="Vendor Invoice",
            version_number=1,
            field_definitions=(
                BlueprintFieldDefinition("vendor", ValueType.string, True),
            ),
        )

        # Close and reopen.
        self.repo.close()
        repo2 = SQLiteDocumentRepository(self._db_path)

        try:
            # Document survives.
            d = repo2.get_document(doc.id)
            self.assertIsNotNone(d)
            self.assertEqual(d.content_hash, "persist")

            # Version survives.
            versions = repo2.get_versions(doc.id)
            self.assertEqual(len(versions), 1)
            self.assertEqual(versions[0].version_number, 1)

            # Processing run and nested data survive.
            r = repo2.get_processing_run(run.id)
            self.assertIsNotNone(r)
            self.assertEqual(len(r.extracted_fields), 1)
            self.assertEqual(r.extracted_fields[0].field_name, "vendor")
            self.assertEqual(len(r.extracted_fields[0].evidence_locations), 1)
            self.assertEqual(len(r.extracted_fields[0].confidence_signals), 1)

            # Blueprint survives.
            b = repo2.get_blueprint(bp.id)
            self.assertIsNotNone(b)
            self.assertEqual(b.name, "Vendor Invoice")
            self.assertEqual(len(b.field_definitions), 1)
        finally:
            repo2.close()


if __name__ == "__main__":
    unittest.main()
