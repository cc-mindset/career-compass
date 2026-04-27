"""
Local parser test runner — parse only, no S3 upload, no chunking, no embedding.
Usage:
    python3 test_parser.py path/to/file.pdf
    python3 test_parser.py path/to/file.pdf path/to/sidecar.json  # optional sidecar
"""

import json
import sys
import os

# ── Import parser from same directory ─────────────────────────────────────────
from parser import parse_pdf


def test_parse(pdf_path: str, sidecar_path: str = None):
    file_name = os.path.basename(pdf_path)
    print(f"\n{'='*60}")
    print(f"Testing parser on: {file_name}")
    print(f"{'='*60}")

    # Load sidecar if provided
    sidecar = None
    if sidecar_path:
        with open(sidecar_path) as f:
            sidecar = json.load(f)
        print(f"Sidecar loaded: {sidecar_path}")
    else:
        print("No sidecar — metadata will be auto-extracted.")

    # ── Parse ──────────────────────────────────────────────────────────────────
    result = parse_pdf(pdf_path, file_name, sidecar)

    sections   = result["sections"]
    fp         = result["fontProfile"]
    skip_pages = result["skippedPages"]

    # ── Font profile ───────────────────────────────────────────────────────────
    print(f"\n── Font Profile ──────────────────────────────────────────")
    print(f"  body size   : {fp['body']}")
    print(f"  h1_min      : {fp['h1_min']:.1f}")
    print(f"  h2_min      : {fp['h2_min']:.1f}")
    print(f"  h3_min      : {fp['h3_min']:.1f}")
    print(f"  noise_small : {fp['noise_small']:.1f}")
    print(f"  noise_large : {fp['noise_large']:.1f}")
    colors_hex = [hex(c) for c in fp["content_colors"]]
    print(f"  content_colors ({len(colors_hex)}): {colors_hex}")

    # ── Summary ────────────────────────────────────────────────────────────────
    print(f"\n── Summary ───────────────────────────────────────────────")
    print(f"  Total pages   : {result['totalPages']}")
    print(f"  Skipped pages : {len(skip_pages)} → {skip_pages}")
    print(f"  Sections found: {len(sections)}")
    print(f"  Auto-extracted: {result['autoExtracted']}")
    print(f"  Metadata      : {result['metadata']}")

    if not sections:
        print("\n  ⚠ NO SECTIONS EXTRACTED — parser returned empty.")
        print("  Check font profile above and compare to actual PDF content.")
        return

    # ── Section breakdown ──────────────────────────────────────────────────────
    print(f"\n── Sections Preview ──────────────────────────────────────")
    total_content_chars = 0
    for s in sections:
        heading      = s["heading"]
        level        = s["level"]
        content_len  = len(s["content"])
        table_count  = len(s["tables"])
        total_content_chars += content_len

        indent = "  " * (level - 1)
        tag    = f"[H{level}]"
        print(f"  {indent}{tag} {heading[:70]!r}  "
              f"({content_len} chars, {table_count} tables, p{s['pageStart']})")

    print(f"\n  Total content chars across all sections: {total_content_chars}")

    # ── First section deep preview ─────────────────────────────────────────────
    print(f"\n── First Section Full Content ────────────────────────────")
    first = sections[0]
    print(f"  Heading : {first['heading']}")
    print(f"  Content :\n")
    print(first["content"][:1000])
    if len(first["content"]) > 1000:
        print(f"  ... [{len(first['content']) - 1000} more chars]")

    # ── Structurally promoted headings ─────────────────────────────────────────
    # (these are ones that were body but got promoted via paragraph context)
    print(f"\n── Done. No uploads or embeddings were performed. ────────")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 test_parser.py <path/to/file.pdf> [path/to/sidecar.json]")
        sys.exit(1)

    pdf   = sys.argv[1]
    sidecar = sys.argv[2] if len(sys.argv) > 2 else None

    if not os.path.exists(pdf):
        print(f"File not found: {pdf}")
        sys.exit(1)

    test_parse(pdf, sidecar)