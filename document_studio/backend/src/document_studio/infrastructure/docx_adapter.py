"""DOCX ingestion adapter for Document Studio.

Uses ``python-docx`` to extract paragraphs and tables from Word
documents, preserving document structure and reading order.

Parser imports are kept inside this infrastructure module.
"""

from __future__ import annotations

from document_studio.domain.normalized import (
    ContentBlock,
    IngestionOutcome,
    IngestionResult,
    NormalizedDocument,
    NormalizedPage,
    PageLocation,
    TableBlock,
    TableCell,
    TextBlock,
)


def ingest_docx(data: bytes, original_filename: str) -> IngestionResult:
    """Ingest a DOCX document from raw bytes.

    Returns a successful ``IngestionResult`` with paragraphs and tables
    preserved.  DOCX files are modelled as a single page since Word
    documents do not have fixed page boundaries at the file level.
    """
    import io

    import docx  # python-docx — imported here to keep parser deps in infra

    document = docx.Document(io.BytesIO(data))

    blocks: list[ContentBlock] = []
    char_offset = 0
    page_number = 1  # DOCX is modelled as one logical page.

    # python-docx body.iter_inner_content() yields paragraphs and tables
    # in reading order.  Use the body element's children to iterate
    # through both element types in document order.
    body = document.element.body

    for child in body:
        tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag

        if tag == "p":
            # Paragraph element — extract text.
            text = child.text or ""
            # Collect all text from runs within the paragraph.
            # child.text only gives direct text; we need itertext.
            text_parts = []
            for node in child.iter():
                # Only take text from <w:t> elements.
                node_tag = (
                    node.tag.split("}")[-1] if "}" in node.tag else node.tag
                )
                if node_tag == "t" and node.text:
                    text_parts.append(node.text)

            text = "".join(text_parts).strip()
            if not text:
                continue

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

        elif tag == "tbl":
            # Table element — extract cells preserving structure.
            from docx.table import Table as DocxTable

            table = DocxTable(child, document)
            cells: list[TableCell] = []
            row_count = len(table.rows)
            col_count = len(table.columns) if table.rows else 0

            for r_idx, row in enumerate(table.rows):
                for c_idx, cell in enumerate(row.cells):
                    cell_text = cell.text.strip()
                    if cell_text:
                        cells.append(
                            TableCell(row=r_idx, col=c_idx, text=cell_text)
                        )

            blocks.append(
                TableBlock(
                    cells=tuple(cells),
                    row_count=row_count,
                    col_count=col_count,
                    location=PageLocation(
                        page_number=page_number,
                        char_offset=char_offset,
                    ),
                )
            )

    # A DOCX always produces at least one page (even if empty of blocks).
    # But NormalizedDocument requires at least one page with the contract.
    # If no blocks were found, we still return a page with zero blocks
    # since the file itself is valid.
    page = NormalizedPage(
        page_number=page_number,
        blocks=tuple(blocks),
    )

    return IngestionResult(
        outcome=IngestionOutcome.success,
        document=NormalizedDocument(
            media_type=(
                "application/vnd.openxmlformats-officedocument"
                ".wordprocessingml.document"
            ),
            original_filename=original_filename,
            pages=(page,),
        ),
    )
