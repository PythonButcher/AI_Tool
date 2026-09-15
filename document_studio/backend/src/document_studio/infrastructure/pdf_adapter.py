"""PDF ingestion adapter for Document Studio.

Uses ``pymupdf`` (PyMuPDF / ``fitz``) to extract embedded text from
digital PDFs.  Scanned or image-only PDFs with no usable embedded text
return a ``requires_ocr`` result.  This adapter never executes OCR.

Parser imports are kept inside this infrastructure module.
"""

from __future__ import annotations

import io

from document_studio.domain.normalized import (
    ContentBlock,
    IngestionOutcome,
    IngestionResult,
    NormalizedDocument,
    NormalizedPage,
    PageLocation,
    TextBlock,
)


def ingest_pdf(data: bytes, original_filename: str) -> IngestionResult:
    """Ingest a digital PDF from raw bytes.

    Returns a successful ``IngestionResult`` with page boundaries and
    embedded-text locations when the PDF contains useful text.  Returns
    ``requires_ocr`` when no usable text is found.
    """
    import fitz  # pymupdf — imported here to keep parser deps in infra

    doc = fitz.open(stream=data, filetype="pdf")
    try:
        pages: list[NormalizedPage] = []
        total_text_chars = 0

        for page_idx in range(len(doc)):
            page = doc[page_idx]
            page_number = page_idx + 1

            # Extract text blocks in reading order.
            # get_text("blocks") returns (x0, y0, x1, y1, text, block_no, block_type)
            # block_type 0 = text, 1 = image.
            raw_blocks = page.get_text("blocks")

            blocks: list[ContentBlock] = []
            char_offset = 0

            for block_data in raw_blocks:
                block_type = block_data[6]  # 0=text, 1=image
                if block_type != 0:
                    continue

                text = block_data[4]
                if isinstance(text, str):
                    text = text.strip()
                else:
                    continue

                if not text:
                    continue

                total_text_chars += len(text)
                blocks.append(
                    TextBlock(
                        text=text,
                        location=PageLocation(
                            page_number=page_number,
                            char_offset=char_offset,
                            char_length=len(text),
                        ),
                    )
                )
                char_offset += len(text)

            pages.append(
                NormalizedPage(
                    page_number=page_number,
                    blocks=tuple(blocks),
                )
            )

        # If no useful embedded text was found across all pages, the PDF
        # is scanned or image-only and requires OCR.
        if total_text_chars == 0:
            return IngestionResult(
                outcome=IngestionOutcome.requires_ocr,
                requires_ocr_reason=(
                    "PDF contains no usable embedded text.  "
                    "All pages appear to be scanned images."
                ),
            )

        return IngestionResult(
            outcome=IngestionOutcome.success,
            document=NormalizedDocument(
                media_type="application/pdf",
                original_filename=original_filename,
                pages=tuple(pages),
            ),
        )

    finally:
        doc.close()
