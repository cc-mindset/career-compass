"""
Local parser test runner — parse only, no S3 writes, no chunking, no embedding.

Reads PDF (and optional sidecar) directly from S3 inbox.
Never moves, deletes, or modifies anything in S3.

Usage:
    python3 test_parser.py <filename.pdf>
    python3 test_parser.py <filename.pdf> --sidecar   # also load sidecar from S3
"""

import json
import sys
import os
import tempfile

# ── path setup so imports work from project root ───────────────────────────────
# Need to add both the rag-pipeline root and project root for imports to resolve
test_dir = os.path.dirname(os.path.abspath(__file__))
rag_pipeline_root = os.path.abspath(os.path.join(test_dir, "../../../"))
project_root = os.path.abspath(os.path.join(test_dir, "../../../../"))
for path in [project_root, rag_pipeline_root]:
    if path not in sys.path:
        sys.path.insert(0, path)

from src.pipelines.market_reports.parser import parse_pdf
from src.shared.s3_client import download_to_temp, get_sidecar_metadata, inbox_key


def test_parse(file_name: str, load_sidecar: bool = False):
    print(f"\n{'='*60}")
    print(f"Testing parser on: {file_name}")
    print(f"{'='*60}")

    s3_key  = inbox_key(file_name)
    tmp_pdf = None

    try:
        # ── Download PDF from S3 to temp file (read only) ──────────────────────
        print(f"Downloading from S3: {s3_key}")
        tmp_pdf = download_to_temp(s3_key, suffix=".pdf")

        # ── Load sidecar from S3 if requested ──────────────────────────────────
        sidecar = None
        if load_sidecar:
            sidecar = get_sidecar_metadata(s3_key)
            if sidecar:
                print(f"Sidecar loaded from S3.")
            else:
                print(f"No sidecar found in S3 — metadata will be auto-extracted.")
        else:
            print("No sidecar — metadata will be auto-extracted.")

        # ── Parse ──────────────────────────────────────────────────────────────
        result = parse_pdf(tmp_pdf, file_name, sidecar)

        sections   = result["sections"]
        fp         = result["fontProfile"]
        skip_pages = result["skippedPages"]

        # ── Font profile ───────────────────────────────────────────────────────
        print(f"\n── Font Profile ──────────────────────────────────────────")
        print(f"  body size   : {fp['body']}")
        print(f"  h1_min      : {fp['h1_min']:.1f}")
        print(f"  h2_min      : {fp['h2_min']:.1f}")
        print(f"  h3_min      : {fp['h3_min']:.1f}")
        print(f"  noise_small : {fp['noise_small']:.1f}")
        print(f"  noise_large : {fp['noise_large']:.1f}")
        colors_hex = [hex(c) for c in fp["content_colors"]]
        print(f"  content_colors ({len(colors_hex)}): {colors_hex}")

        # ── Summary ────────────────────────────────────────────────────────────
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

        # ── Section breakdown ──────────────────────────────────────────────────
        print(f"\n── Sections Preview ──────────────────────────────────────")
        total_content_chars = 0
        for s in sections:
            heading     = s["heading"]
            level       = s["level"]
            content_len = len(s["content"])
            table_count = len(s["tables"])
            total_content_chars += content_len

            indent = "  " * (level - 1)
            tag    = f"[H{level}]"
            print(f"  {indent}{tag} {heading[:70]!r}  "
                  f"({content_len} chars, {table_count} tables, p{s['pageStart']})")

        print(f"\n  Total content chars across all sections: {total_content_chars}")

        # ── First section deep preview ─────────────────────────────────────────
        print(f"\n── First Section Full Content ────────────────────────────")
        first = sections[0]
        print(f"  Heading : {first['heading']}")
        print(f"  Content :\n")
        print(first["content"][:1000])
        if len(first["content"]) > 1000:
            print(f"  ... [{len(first['content']) - 1000} more chars]")

        print(f"\n── Done. No uploads or embeddings were performed. ────────")

    finally:
        # Always clean up temp file — never leave traces
        if tmp_pdf and os.path.exists(tmp_pdf):
            os.unlink(tmp_pdf)
            print(f"Temp file cleaned up. ✓")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 test_parser.py <filename.pdf> [--sidecar]")
        print("  filename.pdf  → must exist in S3 inbox/")
        print("  --sidecar     → also load matching .json from S3 inbox/")
        sys.exit(1)

    file_name    = sys.argv[1]
    load_sidecar = "--sidecar" in sys.argv

    test_parse(file_name, load_sidecar)