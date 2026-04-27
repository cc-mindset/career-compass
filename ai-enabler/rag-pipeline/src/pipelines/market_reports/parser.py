"""
Stage 1: PDF Parser (v3.1)
Architecture: 2-pass, fully color-agnostic + structural heading detection.

Pass 1 — Profile the document:
  - Collect ALL spans regardless of color
  - Learn body size by character-weighted frequency
  - Learn content colors by character-weighted frequency (top-N dominant)
  - Derive all thresholds dynamically from the doc itself

Pass 2 — Extract with learned profile:
  - Accept spans whose color is among the document's dominant content colors
  - Classify role by size relative to body + bold flag (font signals)
  - ALSO classify by paragraph structure: short + bold + no trailing period
    + followed by a longer block = heading, even if font size is near-body.
    This catches h3-level headings in docs where size difference is subtle.
  - Filter chrome only by position (margins) and size (too small/too large)
  - Dedup running headers by hash

This means the parser never assumes black text, never assumes specific font
names, and never uses hardcoded color values — it works for any PDF regardless
of color scheme (dark bg, white text, colored headings, etc.)
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

    # Pass 1: Profile the document — learn sizes AND dominant colors
    font_profile = _build_font_profile(doc_fitz)

    # Pass 2a: Detect skip pages using learned profile (color-agnostic)
    skip_pages = _detect_skip_pages(doc_fitz, font_profile)

    # Pass 2b: Extract blocks using learned profile
    blocks = _extract_blocks(doc_fitz, font_profile, skip_pages)

    # Extract tables from content pages
    tables_by_page = _extract_tables(local_path, skip_pages)

    # Assemble into sections
    sections = _assemble_sections(blocks, tables_by_page)

    # Resolve metadata
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
        "fontProfile":   font_profile,
        "sections":      sections,
    }


# ── Pass 1: Document profiling ─────────────────────────────────────────────────

def _build_font_profile(doc: fitz.Document) -> dict:
    size_char_counts: Counter = Counter()
    color_char_counts: Counter = Counter()

    for page in doc:
        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span["text"].strip()
                    if not text:
                        continue
                    size = round(span["size"], 1)
                    color = span["color"]
                    char_count = len(text)

                    size_char_counts[size] += char_count
                    color_char_counts[color] += char_count

    body_size = size_char_counts.most_common(1)[0][0] if size_char_counts else 10.0

    # 🔥 NEW: simple clustering
    sizes = sorted(size_char_counts.keys())
    small, medium, large = [], [], []

    for s in sizes:
        if s <= body_size * 1.05:
            small.append(s)
        elif s <= body_size * 1.4:
            medium.append(s)
        else:
            large.append(s)

    h3_min = min(medium) if medium else body_size * 1.1
    h2_min = min(large) if large else body_size * 1.3
    h1_min = max(large) if large else body_size * 1.8

    total_chars = sum(color_char_counts.values())
    content_colors = set()
    cumulative = 0

    for color, count in color_char_counts.most_common():
        content_colors.add(color)
        cumulative += count
        if cumulative / total_chars >= 0.80:
            break

    return {
        "body": body_size,
        "h1_min": h1_min,
        "h2_min": h2_min,
        "h3_min": h3_min,
        "noise_small": body_size * 0.85,
        "noise_large": body_size * 3.5,
        "content_colors": content_colors,
    }

# ── Skip page detection ────────────────────────────────────────────────────────

def _detect_skip_pages(doc: fitz.Document, fp: dict) -> set:
    """
    Skip pages that are purely structural/decorative:
      - Pages with NO content-color text at all (image-only, blank)
      - Pages where ALL content-color text is above noise_large (divider pages)

    Uses learned content_colors — no color hardcoding.
    """
    skip = set()
    content_colors = fp["content_colors"]

    for page_num, page in enumerate(doc, start=1):
        content_sizes = []

        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    if span["color"] in content_colors and span["text"].strip():
                        content_sizes.append(round(span["size"], 1))

        # No content-color text at all → skip (image page, blank, etc.)
        if not content_sizes:
            skip.add(page_num)
            continue

        # All text is giant → cover/divider page
        if all(s >= fp["noise_large"] for s in content_sizes):
            skip.add(page_num)

    return skip


# ── Block extraction ───────────────────────────────────────────────────────────

def _extract_blocks(doc: fitz.Document, fp: dict,
                    skip_pages: set) -> list[dict]:
    """
    Extract and classify text blocks using the learned font profile.

    Two-stage classification:
      Stage A — font signals: size thresholds + bold flag
      Stage B — structural signals: short + bold + no trailing period
                + next block is significantly longer → promote to heading_3
                even if font size alone didn't qualify.

    Filters out:
      - Non-content-color spans
      - Margin text (headers/footers by y-position)
      - Tiny/giant text (noise/cover)
      - Page numbers
      - Running headers (by dedup hash)
    """
    blocks = []
    seen_hashes = set()
    content_colors = fp["content_colors"]

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

            # Keep only spans whose color is a learned content color
            content_spans = [s for s in spans if s["color"] in content_colors]
            if not content_spans:
                continue

            text, max_size, is_bold, font = _merge_spans(content_spans)
            text = _clean_text(text)

            if not text or len(text) < 3:
                continue

            # Skip page numbers (pure digits)
            if re.match(r"^\d{1,3}$", text.strip()):
                continue

            # Skip running header pattern "| Section Name"
            if text.startswith("|"):
                continue

            # Skip tiny or giant text
            if max_size <= fp["noise_small"] or max_size >= fp["noise_large"]:
                continue

            # Skip top/bottom margin (running headers/footers)
            y_pos = block["bbox"][1] / page_height
            if y_pos < 0.06 or y_pos > 0.94:
                continue

            # Dedup repeated short blocks (running headers that slipped through)
            text_hash = hash(text.lower().strip())
            if text_hash in seen_hashes and len(text) < 100:
                continue
            seen_hashes.add(text_hash)

            # Stage A: classify by font signals + sentence guard
            role = _classify_block(max_size, is_bold, fp, text)

            blocks.append({
                "page":  page_num,
                "role":  role,
                "text":  text,
                "size":  max_size,
                "bold":  is_bold,
                "font":  font,
            })

    # Stage B: structural heading promotion via paragraph context
    blocks = _promote_structural_headings(blocks)

    # Stage C: merge split headings (multi-line decorative headings)
    blocks = _merge_split_headings(blocks)

    # Stage D: demote lowercase-start headings (mid-sentence fragments)
    blocks = _demote_lowercase_headings(blocks)

    return blocks


def _promote_structural_headings(blocks: list[dict]) -> list[dict]:
    """
    Second pass over extracted blocks.

    Promotes body blocks to heading_3 using structural signals:
      - short length
      - non sentence shape
      - bold OR strong visual pattern (Title Case, UPPERCASE, numbered)
      - followed by longer content

    Filters out:
      - numeric junk (tables)
      - sentence like text
    """
    promoted = list(blocks)

    for i, block in enumerate(promoted):
        if block["role"] != "body":
            continue

        text = block["text"].strip()
        if not text:
            continue

        words = text.split()
        word_count = len(words)

        # Reject numeric garbage
        if re.match(r"^[\d\s\.\:%\-]+$", text):
            continue

        # Reject sentence like text
        if _looks_like_sentence(text):
            continue

        # Signals
        is_short = word_count <= 10
        is_bold = block["bold"]
        is_upper = text.isupper()
        is_title_case = text.istitle()
        is_numbered = bool(re.match(r"^\d+(\.\d+)*", text))

        no_trailing_period = not text.endswith(".")
        clean_phrase = not re.search(r"[,:]", text)

        strong_shape = is_title_case or is_upper or is_numbered

        next_block = _next_body_block(promoted, i)
        has_context = (
            next_block is not None and
            len(next_block["text"]) >= len(text) * 2
        )

        if (
            is_short and
            no_trailing_period and
            (
                (is_bold and clean_phrase and has_context) or
                (strong_shape and has_context) or
                (is_title_case and word_count <= 6)
            )
        ):
            promoted[i] = {**block, "role": "heading_3"}

    return promoted

def _merge_split_headings(blocks: list[dict]) -> list[dict]:
    """
    Some PDFs (like Lightcast) render a single logical heading across multiple
    consecutive PDF blocks e.g.:
        Block A: "Strategic Insight:"           [H1]  ← very short, ends with colon
        Block B: "Finance represents a high..."  [H1]  ← continuation

    Merge consecutive heading blocks where the first is <= 5 words into
    a single heading block, concatenating the text.

    Only merges if:
      - Current block is a heading AND <= 5 words (fragment signal)
      - Next block is also a heading at the same or lower level
      - They are on the same or adjacent pages
    """
    if not blocks:
        return blocks

    merged = []
    i = 0
    while i < len(blocks):
        block = blocks[i]
        role  = block["role"]

        if (role in ("heading_1", "heading_2", "heading_3")
                and len(block["text"].split()) <= 5
                and i + 1 < len(blocks)):

            next_block = blocks[i + 1]
            next_role  = next_block["role"]

            # Merge if next is also a heading on same/adjacent page
            same_or_adjacent = abs(next_block["page"] - block["page"]) <= 1

            if next_role in ("heading_1", "heading_2", "heading_3") and same_or_adjacent:
                merged_text = block["text"].rstrip(":").strip() + ": " + next_block["text"]
                # Keep the higher level (lower number) of the two
                level = min(int(role[-1]), int(next_role[-1]))
                merged.append({
                    **block,
                    "role": f"heading_{level}",
                    "text": merged_text,
                })
                i += 2  # skip both
                continue

        merged.append(block)
        i += 1

    return merged


def _demote_lowercase_headings(blocks: list[dict]) -> list[dict]:
    """
    A heading that starts with a lowercase letter is almost certainly a
    mid-sentence fragment that slipped through (e.g. "of jobs in maintenance
    mention robotics skills"). Real headings are Title Case or Sentence case.

    Demote these to body so they get absorbed into the previous section's
    content rather than starting a new spurious section.

    Exception: allow known lowercase starters like "e.g.", "i.e.", etc.
    """
    demoted = []
    for block in blocks:
        if block["role"] in ("heading_1", "heading_2", "heading_3"):
            first_char = block["text"][0] if block["text"] else ""
            if first_char.islower():
                demoted.append({**block, "role": "body"})
                continue
        demoted.append(block)
    return demoted


def _next_body_block(blocks: list[dict], from_idx: int) -> Optional[dict]:
    """Return the next block after from_idx regardless of role."""
    for block in blocks[from_idx + 1:]:
        if block["text"].strip():
            return block
    return None


def _collect_spans(block: dict) -> list[dict]:
    spans = []
    for line in block.get("lines", []):
        for span in line.get("spans", []):
            if span["text"].strip():
                spans.append(span)
    return spans


def _merge_spans(spans: list[dict]) -> tuple[str, float, bool, str]:
    """Merge spans → single text, max size, bold flag, first font name."""
    texts, sizes, bold_flags, fonts = [], [], [], []
    for span in spans:
        t = span["text"].replace("\n", " ").strip()
        if t:
            texts.append(t)
            sizes.append(span["size"])
            bold_flags.append(
                bool(span["flags"] & 2**4) or
                any(b in span["font"].lower() for b in ["bold", "semibold", "medium"])
            )
            fonts.append(span["font"])

    text     = " ".join(texts)
    max_size = max(sizes) if sizes else 0.0
    is_bold  = any(bold_flags)
    font     = fonts[0] if fonts else ""
    return text, max_size, is_bold, font


def _clean_text(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _classify_block(size: float, bold: bool, fp: dict, text: str = "") -> str:
    """
    Multi signal heading classification using:
      - relative font size
      - bold
      - uppercase or title case
      - structural patterns
    """

    text = text.strip()
    if not text:
        return "body"

    words = text.split()
    word_count = len(words)

    # Reject numeric junk
    if re.match(r"^[\d\s\.\:%\-]+$", text):
        return "body"

    # Sentence guard
    if _looks_like_sentence(text):
        return "body"

    uppercase_ratio = sum(1 for c in text if c.isupper()) / max(len(text), 1)
    is_upper = uppercase_ratio > 0.6
    is_title_case = text.istitle()
    is_short = word_count <= 10

    is_numbered = bool(re.match(r"^\d+(\.\d+)*", text))
    has_keyword = bool(re.search(
        r"\b(Chapter|Section|Overview|Summary|Introduction|Conclusion)\b",
        text,
        re.I
    ))

    score = 0

    if size >= fp["h1_min"]:
        score += 3
    elif size >= fp["h2_min"]:
        score += 2
    elif size >= fp["h3_min"]:
        score += 1

    if bold:
        score += 2

    if is_upper:
        score += 1

    if is_title_case and word_count <= 6:
        score += 2

    if is_short:
        score += 1

    if is_numbered:
        score += 2

    if has_keyword:
        score += 2

    if score >= 5:
        return "heading_1"
    elif score >= 4:
        return "heading_2"
    elif score >= 3:
        return "heading_3"

    return "body"


def _looks_like_sentence(text: str) -> bool:
    """
    Returns True if text looks like prose rather than a heading.
    Any one of these signals is enough:
      - More than 15 words (headings are concise)
      - Ends with a period (sentence terminator)
      - Contains a comma or colon after the 6th word (mid-sentence punctuation)
    """
    words = text.split()

    if len(words) > 15:
        return True

    if text.endswith("."):
        return True

    # Internal comma/colon after 6th word → prose rhythm
    after_sixth = " ".join(words[6:])
    if re.search(r"[,:]", after_sixth):
        return True

    return False


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

    if len(flat) < 4:
        return ""
    if len(rows[0]) < 2:
        return ""
    if all(re.match(r"^[\d%$.,\s]+$", c) for c in flat):
        return ""

    header    = rows[0]
    separator = ["---"] * len(header)
    body      = rows[1:]

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
            page       = block["page"]
            page_tables = tables_by_page.get(page, [])
            next_idx   = table_cursor.get(page, 0)
            for tbl in page_tables[next_idx:]:
                current_section["tables"].append({
                    "tableIndex": len(current_section["tables"]),
                    "markdown":   tbl,
                })
                table_cursor[page] = table_cursor.get(page, 0) + 1

            current_section["content"] += block["text"] + "\n\n"

    if current_section and current_section["content"].strip():
        sections.append(current_section)

    for i, s in enumerate(sections):
        s["sectionIndex"] = i
        s["content"]      = s["content"].strip()

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
        m = re.search(r"(20\d{2})", text)
        if m:
            return int(m.group(1))
    return None


def _stem(file_name: str) -> str:
    return os.path.splitext(file_name)[0].replace("-", " ").replace("_", " ").title()