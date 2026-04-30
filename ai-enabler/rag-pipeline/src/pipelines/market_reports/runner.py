"""
Stage 1 Runner: Ingestion + Parsing
Reads PDFs from S3 inbox/, parses them, writes structured JSON to S3 parsed/.
Updates MongoDB registry at every step.

Run modes:
  - Lambda handler (incremental, triggered by EventBridge)
  - bulk_run() (one-time local script for initial 200 PDFs)
"""
import os
import traceback

from config.settings import S3_PATHS
from src.pipelines.market_reports.registry import (
    get_registry, register_document, update_status,
    is_already_processed, Status
)
from src.shared.s3_client import (
    list_files, download_to_temp, upload_json, download_json,
    hash_s3_file, get_sidecar_metadata,
    move_file, parsed_key, enriched_key,
    processed_key, failed_key, key_exists, delete_file
)
from src.pipelines.market_reports.parser import parse_pdf
from src.pipelines.market_reports.chunker import chunk_document
from src.shared.embedder import embed_chunks
from src.shared.pinecone_client import upload_chunks, NAMESPACE_REPORTS

# ── Lambda handler (incremental) ───────────────────────────────────────────────

def lambda_handler(event, context):
    """
    AWS Lambda entry point.
    EventBridge triggers this on schedule — processes all pending PDFs in inbox/.
    """
    results = _process_inbox()
    return {
        "statusCode": 200,
        "processed":  results["processed"],
        "skipped":    results["skipped"],
        "failed":     results["failed"],
    }


# ── Bulk runner (local, one-time) ──────────────────────────────────────────────
def bulk_run():
    """
    Run locally for the initial bulk upload.
    No Lambda timeout concerns — runs until inbox is empty.
    """
    print("Starting bulk ingestion run...")
    results = _process_inbox()
    print(f"\nDone. Processed: {results['processed']} | "
          f"Skipped: {results['skipped']} | Failed: {results['failed']}")
    for err in results["errors"]:
        print(f"  ✗ {err}")


# ── Core logic ─────────────────────────────────────────────────────────────────
def _process_inbox() -> dict:
    registry = get_registry()
    pdf_keys = list_files(S3_PATHS["inbox"], suffix=".pdf")

    results = {"processed": 0, "skipped": 0, "failed": 0, "errors": []}

    for s3_key in pdf_keys:
        file_name = s3_key.split("/")[-1]
        print(f"\nProcessing: {file_name}")

        tmp_path = None
        file_hash = None
        try:
            # ── Step 1: Hash + dedup check ─────────────────────────────────
            file_hash = hash_s3_file(s3_key)

            if is_already_processed(registry, file_hash):
                print(f"  → Already completed, skipping.")
                results["skipped"] += 1
                continue

            # ── Step 2: Get sidecar metadata ───────────────────────────────
            sidecar = get_sidecar_metadata(s3_key)
            if not sidecar:
                print(f"  ⚠ No sidecar JSON found — will auto-extract metadata.")

            # ── Step 3: Register in MongoDB ────────────────────────────────
            metadata = sidecar or {}
            register_document(registry, file_name, file_hash, s3_key, metadata)
            stem = os.path.splitext(file_name)[0]
            output_key = parsed_key(stem)
            output_enriched_key = enriched_key(stem)
            parsed_doc = None

            # ── Step 4-8: Resume from enriched JSON if available ───────────
            if key_exists(output_enriched_key):
                print("  → Found existing enriched JSON, resuming from embedding.")
                enriched_doc = download_json(output_enriched_key)
                print(f"  → Loaded enriched JSON: {enriched_doc.get('totalChunks', 0)} chunks")
                update_status(registry, file_hash, Status.ENRICHED)
            else:
                update_status(registry, file_hash, Status.PARSING)

                # ── Step 4: Download PDF to temp file ──────────────────────
                tmp_path = download_to_temp(s3_key, suffix=".pdf")
                print(f"  → Downloaded to temp: {tmp_path}")

                # ── Step 5: Parse PDF ──────────────────────────────────────
                parsed_doc = parse_pdf(tmp_path, file_name, sidecar)
                section_count = len(parsed_doc["sections"])
                print(f"  → Parsed: {section_count} sections, "
                      f"{parsed_doc['totalPages']} pages")

                # ── Step 6: Upload parsed JSON to S3 ──────────────────────
                upload_json(parsed_doc, output_key)
                print(f"  → Uploaded parsed JSON: {output_key}")
                update_status(registry, file_hash, Status.PARSED)

                # ── Step 7: Chunk + enrich ─────────────────────────────────
                update_status(registry, file_hash, Status.CHUNKING)
                enriched_doc = chunk_document(parsed_doc)
                print(f"  → Chunked: {enriched_doc['totalChunks']} chunks")

                # ── Step 8: Upload enriched JSON to S3 ────────────────────
                upload_json(enriched_doc, output_enriched_key)
                print(f"  → Uploaded enriched JSON: {output_enriched_key}")
                update_status(registry, file_hash, Status.ENRICHED)

            # ── Step 9: Embed chunks ───────────────────────────────────────
            update_status(registry, file_hash, Status.EMBEDDING)
            embedded_chunks = embed_chunks(enriched_doc["chunks"])

            # ── Step 10: Upload to Pinecone ────────────────────────────────
            pinecone_ids = upload_chunks(embedded_chunks,
                                         namespace=NAMESPACE_REPORTS)
            print(f"  → Pinecone: {len(pinecone_ids)} vectors uploaded")

            # ── Step 11: Cleanup S3 intermediate files ─────────────────────
            if key_exists(output_key):
                delete_file(output_key)
            if key_exists(output_enriched_key):
                delete_file(output_enriched_key)
            print(f"  → Cleaned up S3 intermediate files")

            # ── Step 12: Move original PDF to processed/ ───────────────────
            move_file(s3_key, processed_key(file_name))

            # ── Step 13: Delete sidecar JSON if exists ─────────────────────
            sidecar_key = s3_key.replace(".pdf", ".json")
            if key_exists(sidecar_key):
                delete_file(sidecar_key)

            # ── Step 14: Update registry ───────────────────────────────────
            needs_review = (
                parsed_doc.get("autoExtracted", False)
                if parsed_doc is not None
                else not bool(sidecar)
            )
            new_status = Status.NEEDS_REVIEW if needs_review else Status.COMPLETED
            update_status(registry, file_hash, new_status,
                          pineconeIds=pinecone_ids)

            if needs_review:
                print(f"  ⚠ Metadata auto-extracted — flagged for review.")
            else:
                print(f"  ✓ Complete.")

            results["processed"] += 1

        except Exception as e:
            print(f"  ✗ Failed: {e}")
            results["failed"] += 1
            results["errors"].append(f"{file_name}: {e}")

            try:
                move_file(s3_key, failed_key(file_name))
                if file_hash:
                    update_status(
                        registry, file_hash,
                        Status.FAILED,
                        failedStage="pipeline",
                        errorMessage=str(e)[:500]
                    )
            except Exception:
                pass

        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    return results

# ── Local entry point ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    bulk_run()