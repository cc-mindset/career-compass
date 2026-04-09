"""
Stage 1: PDF Parser
- Reads PDF from a temp local path
- Detects headings via font size analysis
- Extracts tables via pdfplumber
- Outputs a structured ParsedDocument dict

Output schema (saved to S3 parsed/):
{
  "fileName": "wef-future-of-jobs-2025.pdf",
  "metadata": { name, publisher, year, region, topic },
  "totalPages": 42,
  "autoExtracted": true/false,   # was metadata from sidecar or auto?
  "sections": [
    {
      "sectionIndex": 0,
      "heading": "Executive Summary",
      "level": 1,                 # 1 = top-level, 2 = sub, 3 = sub-sub
      "pageStart": 1,
      "content": "full text...",
      "tables": [                 # tables found within this section
        {
          "tableIndex": 0,
          "markdown": "| col1 | col2 |\n|------|------|\n| ... |"
        }
      ]
    },
    ...
  ]
}
"""

import os
import re
from collections import Counter
from typing import Optional

import fitz          # PyMuPDF
import pdfplumber


# ── Constants ──────────────────────────────────────────────────────────────────

# Font size thresholds — calibrated for professional reports (WEF, McKinsey etc.)
# We derive these dynamically per document, but these are fallback mins
MIN_HEADING_FONT_SIZE = 11.0
BODY_FONT_SIZE_PERCENTILE = 50   # median font size = body text baseline


# ── Main entry point ───────────────────────────────────────────────────────────

def parse_pdf(local_path: str, file_name: str,
              sidecar_metadata: Optional[dict] = None) -> dict:
    """
    Parse a PDF into a structured document dict.

    Args:
        local_path:        Path to the locally downloaded PDF
        file_name:         Original filename (for output record)
        sidecar_metadata:  Pre-supplied metadata dict (from .json sidecar)

    Returns:
        ParsedDocument dict ready to be saved to S3 parsed/
    """
    doc_fitz = fitz.open(local_path)

    # Step 1: Analyze font sizes across the whole doc to calibrate thresholds
    font_profile = _build_font_profile(doc_fitz)

    # Step 2: Extract all blocks with their roles (heading/body/footer)
    blocks = _extract_blocks(doc_fitz, font_profile)

    # Step 3: Extract tables using pdfplumber (more accurate for tables)
    tables_by_page = _extract_tables(local_path)

    # Step 4: Assemble into sections
    sections = _assemble_sections(blocks, tables_by_page)

    # Step 5: Resolve metadata (sidecar takes priority, auto-extract as fallback)
    metadata, auto_extracted = _resolve_metadata(
        doc_fitz, file_name, sidecar_metadata, sections
    )

    doc_fitz.close()

    return {
        "fileName":      file_name,
        "metadata":      metadata,
        "totalPages":    len(doc_fitz),  # fitz keeps page count after close
        "autoExtracted": auto_extracted,
        "sections":      sections,
    }


# ── Font profile ───────────────────────────────────────────────────────────────

def _build_font_profile(doc: fitz.Document) -> dict:
    """
    Sample font sizes across the document to find:
    - body_size: the dominant (most common) font size → body text
    - heading_sizes: font sizes meaningfully larger than body
    """
    size_counts: Counter = Counter()

    for page in doc:
        for block in page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]:
            if block["type"] != 0:  # type 0 = text
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    size = round(span["size"], 1)
                    size_counts[size] += len(span["text"].strip())

    if not size_counts:
        return {"body": 10.0, "h1_min": 16.0, "h2_min": 13.0, "h3_min": 11.5}

    # Body = most common font size by character count
    body_size = size_counts.most_common(1)[0][0]

    return {
        "body":    body_size,
        "h1_min":  body_size * 1.6,   # e.g. body=10 → h1 threshold=16
        "h2_min":  body_size * 1.3,   # → h2 threshold=13
        "h3_min":  body_size * 1.15,  # → h3 threshold=11.5
    }


# ── Block extraction ───────────────────────────────────────────────────────────

def _extract_blocks(doc: fitz.Document, font_profile: dict) -> list[dict]:
    """
    Extract text blocks from every page, tagging each as:
    heading_1 / heading_2 / heading_3 / body / footer / ignore
    """
    blocks = []

    for page_num, page in enumerate(doc, start=1):
        page_height = page.rect.height
        raw_blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]

        for block in raw_blocks:
            if block["type"] != 0:
                continue

            text, max_size, is_bold = _extract_span_info(block)
            text = text.strip()

            if not text or len(text) < 2:
                continue

            # Skip headers/footers (top/bottom 7% of page)
            y_pos = block["bbox"][1] / page_height
            if y_pos < 0.07 or y_pos > 0.93:
                continue

            role = _classify_block(text, max_size, is_bold, font_profile)

            if role == "ignore":
                continue

            blocks.append({
                "page":   page_num,
                "role":   role,
                "text":   text,
                "size":   max_size,
                "bold":   is_bold,
                "y":      block["bbox"][1],
            })

    return blocks


def _extract_span_info(block: dict) -> tuple[str, float, bool]:
    """Get concatenated text, max font size, and bold flag from a block."""
    texts, sizes, bold_flags = [], [], []

    for line in block.get("lines", []):
        for span in line.get("spans", []):
            t = span["text"]
            if t.strip():
                texts.append(t)
                sizes.append(span["size"])
                # Bold flag: fitz flags bit 4 = bold, or "Bold" in font name
                bold_flags.append(
                    bool(span["flags"] & 2**4) or
                    "bold" in span["font"].lower()
                )

    text = " ".join(texts)
    max_size = max(sizes) if sizes else 0.0
    is_bold = any(bold_flags)
    return text, max_size, is_bold


def _classify_block(text: str, size: float, bold: bool,
                    fp: dict) -> str:
    """Return the role of a text block based on its font profile."""

    # Very short ALL CAPS lines are often section labels or noise
    if len(text) < 4 and text.isupper():
        return "ignore"

    # Page numbers
    if re.match(r"^\d{1,3}$", text.strip()):
        return "ignore"

    if size >= fp["h1_min"]:
        return "heading_1"
    if size >= fp["h2_min"] or (bold and size >= fp["h3_min"]):
        return "heading_2"
    if size >= fp["h3_min"] and bold:
        return "heading_3"

    return "body"


# ── Table extraction ───────────────────────────────────────────────────────────

def _extract_tables(local_path: str) -> dict[int, list[str]]:
    """
    Use pdfplumber to extract tables, convert to markdown strings.
    Returns dict of {page_number: [markdown_table, ...]}
    """
    tables_by_page: dict[int, list[str]] = {}

    with pdfplumber.open(local_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()
            if not tables:
                continue

            md_tables = []
            for table in tables:
                md = _table_to_markdown(table)
                if md:
                    md_tables.append(md)

            if md_tables:
                tables_by_page[page_num] = md_tables

    return tables_by_page


def _table_to_markdown(table: list[list]) -> str:
    """Convert a pdfplumber table (list of lists) to a markdown string."""
    if not table or not table[0]:
        return ""

    # Clean cells
    def clean(cell):
        return str(cell).replace("\n", " ").strip() if cell else ""

    rows = [[clean(c) for c in row] for row in table]
    header = rows[0]
    separator = ["---"] * len(header)
    body = rows[1:]

    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(separator) + " |",
    ]
    for row in body:
        # Pad row if fewer cells than header
        padded = row + [""] * (len(header) - len(row))
        lines.append("| " + " | ".join(padded[:len(header)]) + " |")

    return "\n".join(lines)


# ── Section assembly ───────────────────────────────────────────────────────────

def _assemble_sections(blocks: list[dict],
                        tables_by_page: dict[int, list[str]]) -> list[dict]:
    """
    Walk through classified blocks and assemble into sections.
    Each heading_1 or heading_2 block starts a new section.
    Body text accumulates into the current section's content.
    Tables on the same page get attached to the current section.
    """
    sections = []
    current_section = None
    table_cursor: dict[int, int] = {}   # page → index of next unused table

    for block in blocks:
        role = block["role"]

        if role in ("heading_1", "heading_2", "heading_3"):
            # Save previous section if it has content
            if current_section and current_section["content"].strip():
                sections.append(current_section)

            level = int(role[-1])  # heading_1 → 1, etc.
            current_section = {
                "sectionIndex": len(sections),
                "heading":      block["text"],
                "level":        level,
                "pageStart":    block["page"],
                "content":      "",
                "tables":       [],
            }

        elif role == "body" and current_section is not None:
            # Attach any tables from this page that haven't been used yet
            page = block["page"]
            page_tables = tables_by_page.get(page, [])
            next_idx = table_cursor.get(page, 0)
            for tbl in page_tables[next_idx:]:
                current_section["tables"].append({
                    "tableIndex": len(current_section["tables"]),
                    "markdown":   tbl,
                })
                table_cursor[page] = table_cursor.get(page, 0) + 1

            current_section["content"] += block["text"] + "\n"

    # Don't forget the last section
    if current_section and current_section["content"].strip():
        sections.append(current_section)

    # Re-index sections
    for i, s in enumerate(sections):
        s["sectionIndex"] = i

    return sections


# ── Metadata resolution ────────────────────────────────────────────────────────

def _resolve_metadata(doc: fitz.Document, file_name: str,
                       sidecar: Optional[dict],
                       sections: list[dict]) -> tuple[dict, bool]:
    """
    Build final metadata dict.
    Sidecar JSON is the source of truth if present.
    Falls back to PDF metadata + cover page heuristics.
    Returns (metadata_dict, auto_extracted_bool)
    """
    if sidecar:
        return {
            "name":      sidecar.get("name", _stem(file_name)),
            "publisher": sidecar.get("publisher", ""),
            "year":      sidecar.get("year", _extract_year(doc, sections)),
            "region":    sidecar.get("region", ""),
            "topic":     sidecar.get("topic", ""),
        }, False

    # Auto-extract fallback
    pdf_meta = doc.metadata or {}
    year = _extract_year(doc, sections)

    return {
        "name":      pdf_meta.get("title") or _stem(file_name),
        "publisher": pdf_meta.get("author") or "",
        "year":      year,
        "region":    "",
        "topic":     "",
    }, True


def _extract_year(doc: fitz.Document, sections: list[dict]) -> Optional[int]:
    """Try to find a 4-digit year in the first page or first section."""
    sources = []

    # Check PDF creation date metadata
    creation = (doc.metadata or {}).get("creationDate", "")
    sources.append(creation)

    # Check first section headings and content
    for s in sections[:3]:
        sources.append(s.get("heading", ""))
        sources.append(s.get("content", "")[:300])

    for text in sources:
        match = re.search(r"(20\d{2})", text)
        if match:
            return int(match.group(1))

    return None


def _stem(file_name: str) -> str:
    """Remove extension from filename for use as fallback title."""
    return os.path.splitext(file_name)[0].replace("-", " ").replace("_", " ").title()