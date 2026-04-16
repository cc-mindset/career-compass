"""
Stage 1: PDF Parser (v2)
Critical fixes applied:
  1. Strip color != 0 (removes UI chrome, running headers, labels)
  2. Strip cover/divider pages (size > body * 3.5)
  3. Clean \n inside spans (fixes fragmented text)
  4. Strip running header pattern "| text" and page numbers
"""

import os
import re
import unicodedata
from collections import Counter
from typing import Optional

import fitz
import pdfplumber


# ── Main entry point ───────────────────────────────────────────────────────────

def parse_pdf(local_path: str, file_name: str,
              sidecar_metadata: Optional[dict] = None) -> dict:

    doc_fitz = fitz.open(local_path)

    # Step 1: Build font profile (dynamic per document)
    font_profile = _build_font_profile(doc_fitz)

    # Step 2: Detect and skip non-content pages (cover, dividers, TOC)
    skip_pages = _detect_skip_pages(doc_fitz, font_profile)

    # Step 3: Extract clean spans
    blocks = _extract_blocks(doc_fitz, font_profile, skip_pages)

    # Step 4: Extract tables (only from content pages)
    tables_by_page = _extract_tables(local_path, skip_pages)

    # Step 5: Assemble into sections
    sections = _assemble_sections(blocks, tables_by_page)

    # Step 6: Resolve metadata
    metadata, auto_extracted = _resolve_metadata(
        doc_fitz, file_name, sidecar_metadata, sections
    )

    total_pages = len(doc_fitz)
    doc_fitz.close()

    return {
        "fileName":      file_name,
        "metadata":      metadata,
        "totalPages":    total_pages,
        "skippedPages":  sorted(list(skip_pages)),
        "autoExtracted": auto_extracted,
        "fontProfile":   font_profile,   # useful for debugging
        "sections":      sections,
    }


# ── Font profile ───────────────────────────────────────────────────────────────

def _build_font_profile(doc: fitz.Document) -> dict:
    """
    Dynamically calibrate font thresholds from the document itself.
    Uses character-weighted frequency so body text (most chars) wins.
    Only samples black text (color=0) to avoid UI chrome skewing results.
    """
    size_counts: Counter = Counter()

    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    # FIX 1: Only count black text for calibration
                    if span["color"] != 0:
                        continue
                    text = span["text"].strip()
                    if text:
                        size = round(span["size"], 1)
                        size_counts[size] += len(text)

    if not size_counts:
        return {"body": 10.0, "h1_min": 16.0, "h2_min": 13.0,
                "noise_small": 9.0, "noise_large": 35.0}

    body_size = size_counts.most_common(1)[0][0]

    return {
        "body":        body_size,
        "h1_min":      body_size * 1.8,   # e.g. 11 * 1.8 = 19.8
        "h2_min":      body_size * 1.3,   # e.g. 11 * 1.3 = 14.3
        "h3_min":      body_size * 1.1,   # e.g. 11 * 1.1 = 12.1
        "noise_small": body_size * 0.95,  # anything smaller = noise
        "noise_large": body_size * 3.5,   # anything larger = cover/divider
    }


# ── Skip page detection ────────────────────────────────────────────────────────

def _detect_skip_pages(doc: fitz.Document, fp: dict) -> set:
    """
    Detect pages that are purely structural/decorative and should be skipped:
    - Cover pages (only giant text, no body)
    - Section divider pages (one big heading, nothing else)
    - Pages with no black text at all
    """
    skip = set()

    for page_num, page in enumerate(doc, start=1):
        black_text_sizes = []

        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    if span["color"] == 0 and span["text"].strip():
                        black_text_sizes.append(round(span["size"], 1))

        if not black_text_sizes:
            skip.add(page_num)
            continue

        # If ALL black text is above noise_large threshold → divider page
        if all(s >= fp["noise_large"] for s in black_text_sizes):
            skip.add(page_num)

    return skip


# ── Block extraction ───────────────────────────────────────────────────────────

def _extract_blocks(doc: fitz.Document, fp: dict,
                    skip_pages: set) -> list[dict]:
    blocks = []
    seen_hashes = set()   # for dedup

    for page_num, page in enumerate(doc, start=1):
        if page_num in skip_pages:
            continue

        page_height = page.rect.height
        raw_blocks = page.get_text("dict")["blocks"]

        for block in raw_blocks:
            if block["type"] != 0:
                continue

            spans = _collect_spans(block)
            if not spans:
                continue

            # FIX 1: Skip any block where dominant color is not black
            black_spans = [s for s in spans if s["color"] == 0]
            if not black_spans:
                continue

            text, max_size, is_bold, font = _merge_spans(black_spans)
            text = _clean_text(text)

            if not text or len(text) < 3:
                continue

            # FIX 4: Skip running headers ("| Section Name" pattern)
            if text.startswith("|") or re.match(r"^\|", text):
                continue

            # FIX 4: Skip page numbers (pure digits, short)
            if re.match(r"^\d{1,3}$", text.strip()):
                continue

            # Skip tiny or giant text
            if max_size <= fp["noise_small"] or max_size >= fp["noise_large"]:
                continue

            # Skip top/bottom margins (headers/footers)
            y_pos = block["bbox"][1] / page_height
            if y_pos < 0.06 or y_pos > 0.94:
                continue

            # Dedup: skip exact repeated blocks (running headers that slipped through)
            text_hash = hash(text.lower().strip())
            if text_hash in seen_hashes and len(text) < 100:
                continue
            seen_hashes.add(text_hash)

            role = _classify_block(text, max_size, is_bold, font, fp)

            blocks.append({
                "page":  page_num,
                "role":  role,
                "text":  text,
                "size":  max_size,
                "bold":  is_bold,
                "font":  font,
            })

    return blocks


def _collect_spans(block: dict) -> list[dict]:
    spans = []
    for line in block.get("lines", []):
        for span in line.get("spans", []):
            if span["text"].strip():
                spans.append(span)
    return spans


def _merge_spans(spans: list[dict]) -> tuple[str, float, bool, str]:
    """Merge spans into single text, get max size, bold flag, dominant font."""
    texts, sizes, bold_flags, fonts = [], [], [], []
    for span in spans:
        # FIX 3: Clean \n inside span text
        t = span["text"].replace("\n", " ").strip()
        if t:
            texts.append(t)
            sizes.append(span["size"])
            bold_flags.append(
                bool(span["flags"] & 2**4) or
                any(b in span["font"].lower() for b in ["bold", "semibold", "medium"])
            )
            fonts.append(span["font"])

    text = " ".join(texts)
    max_size = max(sizes) if sizes else 0.0
    is_bold = any(bold_flags)
    font = fonts[0] if fonts else ""
    return text, max_size, is_bold, font


def _clean_text(text: str) -> str:
    """
    FIX 3: Normalize text — clean whitespace, normalize unicode.
    Keeps it simple, no aggressive stripping.
    """
    # Normalize unicode (fixes \u2019 → ' etc.)
    text = unicodedata.normalize("NFKC", text)
    # Collapse multiple spaces/newlines
    text = re.sub(r"\s+", " ", text)
    # Strip leading/trailing
    text = text.strip()
    return text


def _classify_block(text: str, size: float, bold: bool,
                    font: str, fp: dict) -> str:
    """Classify block role based on dynamic font profile."""

    # Pull quotes / callout fonts (serif display fonts) → treat as body
    if any(f in font for f in ["Fine", "Serif", "Display", "Sectra"]):
        return "body"

    if size >= fp["h1_min"]:
        return "heading_1"
    if size >= fp["h2_min"]:
        return "heading_2"
    if size >= fp["h3_min"] and bold:
        return "heading_3"

    return "body"


# ── Table extraction ───────────────────────────────────────────────────────────

def _extract_tables(local_path: str, skip_pages: set) -> dict[int, list[str]]:
    tables_by_page: dict[int, list[str]] = {}

    with pdfplumber.open(local_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            if page_num in skip_pages:
                continue
            tables = page.extract_tables()
            if not tables:
                continue
            md_tables = [_table_to_markdown(t) for t in tables]
            md_tables = [t for t in md_tables if t]
            if md_tables:
                tables_by_page[page_num] = md_tables

    return tables_by_page


def _table_to_markdown(table: list[list]) -> str:
    if not table or not table[0]:
        return ""

    def clean(cell):
        if not cell:
            return ""
        return unicodedata.normalize("NFKC", str(cell)).replace("\n", " ").strip()

    rows = [[clean(c) for c in row] for row in table]
    flat = [c for row in rows for c in row if c]

    # Strip useless tables
    if len(flat) < 4:
        return ""
    if len(rows[0]) < 2:
        return ""
    if all(re.match(r"^[\d%$.,\s]+$", c) for c in flat):
        return ""

    header = rows[0]
    separator = ["---"] * len(header)
    body = rows[1:]

    lines = [
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(separator) + " |",
    ]
    for row in body:
        padded = row + [""] * (len(header) - len(row))
        lines.append("| " + " | ".join(padded[:len(header)]) + " |")

    return "\n".join(lines)

# ── Section assembly ───────────────────────────────────────────────────────────

def _assemble_sections(blocks: list[dict],
                        tables_by_page: dict[int, list[str]]) -> list[dict]:
    sections = []
    current_section = None
    table_cursor: dict[int, int] = {}

    for block in blocks:
        role = block["role"]

        if role in ("heading_1", "heading_2", "heading_3"):
            if current_section and current_section["content"].strip():
                sections.append(current_section)

            level = int(role[-1])
            current_section = {
                "sectionIndex": len(sections),
                "heading":      block["text"],
                "level":        level,
                "pageStart":    block["page"],
                "content":      "",
                "tables":       [],
            }

        elif role == "body" and current_section is not None:
            page = block["page"]
            page_tables = tables_by_page.get(page, [])
            next_idx = table_cursor.get(page, 0)
            for tbl in page_tables[next_idx:]:
                current_section["tables"].append({
                    "tableIndex": len(current_section["tables"]),
                    "markdown":   tbl,
                })
                table_cursor[page] = table_cursor.get(page, 0) + 1

            current_section["content"] += block["text"] + "\n\n" #to preserve para breaks

    if current_section and current_section["content"].strip():
        sections.append(current_section)

    for i, s in enumerate(sections):
        s["sectionIndex"] = i
        s["content"] = s["content"].strip()

    return sections


# ── Metadata resolution ────────────────────────────────────────────────────────

def _resolve_metadata(doc: fitz.Document, file_name: str,
                       sidecar: Optional[dict],
                       sections: list[dict]) -> tuple[dict, bool]:
    if sidecar:
        return {
            "name":      sidecar.get("name", _stem(file_name)),
            "publisher": sidecar.get("publisher", ""),
            "year":      sidecar.get("year", _extract_year(doc, sections)),
            "region":    sidecar.get("region", ""),
            "topic":     sidecar.get("topic", ""),
        }, False

    pdf_meta = doc.metadata or {}
    return {
        "name":      pdf_meta.get("title") or _stem(file_name),
        "publisher": pdf_meta.get("author") or "",
        "year":      _extract_year(doc, sections),
        "region":    "",
        "topic":     "",
    }, True


def _extract_year(doc: fitz.Document, sections: list[dict]) -> Optional[int]:
    sources = [(doc.metadata or {}).get("creationDate", "")]
    for s in sections[:3]:
        sources += [s.get("heading", ""), s.get("content", "")[:300]]
    for text in sources:
        match = re.search(r"(20\d{2})", text)
        if match:
            return int(match.group(1))
    return None


def _stem(file_name: str) -> str:
    return os.path.splitext(file_name)[0].replace("-", " ").replace("_", " ").title()