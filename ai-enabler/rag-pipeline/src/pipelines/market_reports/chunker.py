"""
Stage 2+3: Chunking + Context Prefix Enrichment (combined)

Reads parsed JSON from S3 parsed/
Outputs enriched chunks JSON to S3 enriched/

Each chunk:
- ~300 words, split on paragraph boundaries
- 50 word overlap between chunks
- Context prefix prepended to text
- Full metadata attached
- Tiny sections merged with next

Output schema (saved to S3 enriched/):
{
  "fileName": "accenture-tech-vision-2025.pdf",
  "metadata": { ... },
  "totalChunks": 42,
  "chunks": [
    {
      "chunkId": "accenture-tech-vision-2025_s3_c1",
      "text": "Report: Technology Vision 2025 | Publisher: Accenture | Section: Agentic Systems | Content: ...",
      "rawText": "AI agents are transforming...",   # without prefix, for debugging
      "metadata": {
        "source": "accenture-tech-vision-2025",
        "name": "Technology Vision 2025",
        "publisher": "Accenture",
        "year": 2025,
        "region": "Global",
        "topic": "Technology Trends",
        "subTopic": "",
        "industry": "",
        "reportType": "",
        "language": "en",
        "sectionIndex": 3,
        "sectionHeading": "Agentic Systems",
        "sectionLevel": 1,
        "chunkIndex": 1,
        "pageStart": 15,
        "wordCount": 287,
        "hasTable": false
      }
    }
  ]
}
"""

import re
from typing import Optional


# ── Constants ──────────────────────────────────────────────────────────────────

TARGET_WORDS   = 300   # target chunk size in words
OVERLAP_WORDS  = 50    # overlap between chunks
MIN_WORDS      = 50    # sections below this get merged with next


# ── Main entry point ───────────────────────────────────────────────────────────

def chunk_document(parsed_doc: dict) -> dict:
    """
    Takes a parsed document dict (from Stage 1) and returns enriched chunks dict.

    Args:
        parsed_doc: the full parsed JSON loaded from S3 parsed/

    Returns:
        enriched dict ready to be saved to S3 enriched/
    """
    metadata  = parsed_doc["metadata"]
    sections  = parsed_doc["sections"]
    file_name = parsed_doc["fileName"]
    stem      = _stem(file_name)

    # Step 1: Merge tiny sections into their neighbours
    sections = _merge_tiny_sections(sections, MIN_WORDS)

    # Step 2: Chunk each section
    all_chunks = []
    for section in sections:
        chunks = _chunk_section(section, metadata, stem)
        all_chunks.extend(chunks)

    return {
        "fileName":   file_name,
        "metadata":   metadata,
        "totalChunks": len(all_chunks),
        "chunks":     all_chunks,
    }


# ── Tiny section merging ───────────────────────────────────────────────────────

def _merge_tiny_sections(sections: list[dict], min_words: int) -> list[dict]:
    """
    Merge sections with fewer than min_words into the next section.
    Preserves the heading of the larger section.
    """
    merged = []
    i = 0

    while i < len(sections):
        section = sections[i]
        word_count = len(section["content"].split())

        # If tiny and there's a next section → merge into next
        if word_count < min_words and i + 1 < len(sections):
            next_section = sections[i + 1]
            next_section["content"] = (
                section["content"].strip() + "\n\n" +
                next_section["content"].strip()
            )
            # Keep next section's heading (more descriptive)
            i += 1
            continue

        merged.append(section)
        i += 1

    # Re-index
    for idx, s in enumerate(merged):
        s["sectionIndex"] = idx

    return merged


# ── Section chunker ────────────────────────────────────────────────────────────

def _chunk_section(section: dict, doc_metadata: dict,
                   stem: str) -> list[dict]:
    """
    Split a single section into chunks of ~TARGET_WORDS words.
    Splits on paragraph boundaries, with OVERLAP_WORDS overlap.
    """
    content    = section["content"]
    heading    = section["heading"]
    sec_index  = section["sectionIndex"]
    page_start = section["pageStart"]
    level      = section["level"]
    tables     = section.get("tables", [])

    # Step 1: Split into clean paragraphs
    paragraphs = _split_paragraphs(content)

    if not paragraphs:
        return []

    # Step 2: Group paragraphs into chunks
    chunk_texts = _group_into_chunks(paragraphs, TARGET_WORDS, OVERLAP_WORDS)

    # Step 3: Build chunk objects
    chunks = []
    for chunk_idx, raw_text in enumerate(chunk_texts):
        # Attach tables to first chunk of section only
        has_table = len(tables) > 0 and chunk_idx == 0
        table_text = ""
        if has_table:
            table_text = "\n\n" + "\n\n".join(t["markdown"] for t in tables)

        full_raw = raw_text + table_text
        prefixed = _build_prefix(doc_metadata, heading, full_raw)

        chunk_id = f"{stem}_s{sec_index}_c{chunk_idx}"

        chunks.append({
            "chunkId": chunk_id,
            "text":    prefixed,       # what gets embedded
            "rawText": full_raw,       # for debugging/inspection
            "metadata": {
                # Document-level
                "source":      stem,
                "name":        doc_metadata.get("name", ""),
                "publisher":   doc_metadata.get("publisher", ""),
                "year":        doc_metadata.get("year"),
                "region":      doc_metadata.get("region", ""),
                "topic":       doc_metadata.get("topic", ""),
                "subTopic":    doc_metadata.get("subTopic", ""),
                "industry":    doc_metadata.get("industry", ""),
                "reportType":  doc_metadata.get("reportType", ""),
                "language":    doc_metadata.get("language", "en"),
                # Chunk-level
                "sectionIndex":   sec_index,
                "sectionHeading": heading,
                "sectionLevel":   level,
                "chunkIndex":     chunk_idx,
                "pageStart":      page_start,
                "wordCount":      len(full_raw.split()),
                "hasTable":       has_table,
            }
        })

    return chunks


# ── Paragraph splitting ────────────────────────────────────────────────────────

def _split_paragraphs(content: str) -> list[str]:
    """
    Split content on double newlines.
    Strips noise paragraphs (TOC navigation, page refs, citations only).
    """
    raw_paras = content.split("\n\n")
    clean = []

    for para in raw_paras:
        para = para.strip()

        if not para:
            continue

        # Strip TOC navigation lines: "Page 09-21 Page 04-08..."
        if re.match(r"^(Page\s+\d+[-–]\d+\s*)+$", para, re.IGNORECASE):
            continue

        # Strip paragraphs that are purely citation numbers
        if re.match(r"^[\d\s,.\[\]]+$", para):
            continue

        # Strip very short noise (single words, lone numbers)
        if len(para.split()) < 3:
            continue

        clean.append(para)

    return clean


# ── Chunk grouping ─────────────────────────────────────────────────────────────

def _group_into_chunks(paragraphs: list[str],
                        target: int, overlap: int) -> list[str]:
    """
    Group paragraphs into chunks of ~target words.
    Last `overlap` words of each chunk are repeated at start of next.

    Strategy:
    - Add paragraphs to current chunk until target is reached
    - When target exceeded, save chunk
    - Next chunk starts from overlap paragraph
    """
    chunks     = []
    current    = []
    word_count = 0
    i          = 0

    while i < len(paragraphs):
        para       = paragraphs[i]
        para_words = len(para.split())

        current.append(para)
        word_count += para_words

        if word_count >= target:
            chunk_text = "\n\n".join(current)
            chunks.append(chunk_text)

            # Find overlap start: walk back until we have ~overlap words
            overlap_paras = []
            overlap_count = 0
            for p in reversed(current):
                overlap_paras.insert(0, p)
                overlap_count += len(p.split())
                if overlap_count >= overlap:
                    break

            # Next chunk starts from overlap paragraphs
            current    = overlap_paras
            word_count = overlap_count

        i += 1

    # Don't forget remaining paragraphs
    if current:
        # If tiny leftover, append to last chunk instead of making new one
        leftover = "\n\n".join(current)
        if len(leftover.split()) < 50 and chunks:
            chunks[-1] = chunks[-1] + "\n\n" + leftover
        else:
            chunks.append(leftover)

    return chunks


# ── Context prefix builder ─────────────────────────────────────────────────────

def _build_prefix(metadata: dict, heading: str, content: str) -> str:
    """
    Build the context prefix and prepend to chunk content.

    Format:
    Report: {name} | Publisher: {publisher} | Year: {year} |
    Region: {region} | Topic: {topic} | Section: {heading} | Content: {content}

    Only includes fields that have values — no empty fields.
    """
    parts = []

    if metadata.get("name"):
        parts.append(f"Report: {metadata['name']}")
    if metadata.get("publisher"):
        parts.append(f"Publisher: {metadata['publisher']}")
    if metadata.get("year"):
        parts.append(f"Year: {metadata['year']}")
    if metadata.get("region"):
        parts.append(f"Region: {metadata['region']}")
    if metadata.get("topic"):
        parts.append(f"Topic: {metadata['topic']}")
    if heading:
        parts.append(f"Section: {heading}")

    prefix = " | ".join(parts)
    return f"{prefix} | Content: {content}"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _stem(file_name: str) -> str:
    import os
    return os.path.splitext(file_name)[0]