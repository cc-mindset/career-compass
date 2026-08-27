"""
Market Stats Pipeline Runner
=============================
Orchestrates the full pipeline for both US (BLS) and CA (StatsCan):
  1. Fetch  — pull latest series from BLS and/or StatsCan APIs
  2. Transform — convert normalized records into prose chunks
  3. Save   — write raw fetch output + chunks to S3
  4. Embed  — generate embeddings via OpenAI
  5. Upsert — push vectors to Pinecone

Usage:
    # Both countries (default)
    python runner.py

    # Single country
    python runner.py --country US
    python runner.py --country CA

    # Dry run (fetch + transform only, no S3/Pinecone writes)
    python runner.py --dry-run

    # Limit series for testing
    python runner.py --dry-run --country US --limit 5

Cadence (for EventBridge/cron):
    BLS:      monthly — ~4th week of each month after release day
    StatsCan: monthly (LFS/SEPH) + quarterly (JVWS) — align with release calendar
    Suggested schedule: run on the 25th of each month to catch both.

S3 layout:
    market-stats/inbox/{country}/{run_id}.json      raw fetcher output
    market-stats/transformed/{country}/{run_id}.json  prose chunks
    market-stats/processed/{country}/{run_id}.json    post-upsert manifest
"""

import argparse
import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Allow running from the pipeline directory directly.
# We need both roots because shared modules import from top-level `config`.
src_root = Path(__file__).resolve().parents[2]
project_root = Path(__file__).resolve().parents[3]
for path in (str(project_root), str(src_root)):
    if path not in sys.path:
        sys.path.insert(0, path)

from src.pipelines.market_stats.fetcher_bls      import fetch_bls
from src.pipelines.market_stats.fetcher_statscan import fetch_statscan
from src.pipelines.market_stats.fetcher_imf      import fetch_imf
from src.pipelines.market_stats.transformer      import transform
from src.pipelines.market_stats.registry         import get_registry, register_run, update_run, Status
from src.pipelines.market_stats.cleanup          import run_cleanup, run_ttl_summary
from src.shared.s3_client import upload_json
from src.shared.embedder import embed_chunks
from src.shared.pinecone_client import upload_chunks

logger = logging.getLogger(__name__)

# ── Config ──────────────────────────────────────────────────────────────────
S3_PREFIX    = "market-stats"


def run_country(
    country: str,
    dry_run: bool = False,
    limit: int | None = None,
    lookback_years: int = 2,
) -> dict:
    """
    Run the full pipeline for one country. Returns a summary dict.

    Args:
        country:       "US" or "CA"
        dry_run:       If True, skip S3 and Pinecone writes
        limit:         Optionally cap number of series fetched (for testing)
        lookback_years: How many years of history to fetch (BLS only)
    """
    run_id  = f"{country.lower()}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    summary = {"run_id": run_id, "country": country, "status": "started"}

    logger.info(f"[{country}] Starting run {run_id}")

    # Initialize registry
    registry = get_registry()

    # ── Step 1: Fetch ────────────────────────────────────────────────────────
    logger.info(f"[{country}] Fetching...")
    try:
        if country == "US":
            raw_records = fetch_bls(lookback_years=lookback_years)
        elif country == "CA":
            raw_records = fetch_statscan(lookback_periods=13)
        else:
            raise ValueError(f"Unknown country: {country}")
    except Exception as e:
        logger.error(f"[{country}] Fetch failed: {e}")
        summary["status"] = "failed_fetch"
        summary["error"]  = str(e)
        return summary

    if limit:
        raw_records = raw_records[:limit]

    logger.info(f"[{country}] Fetched {len(raw_records)} series")
    summary["fetched"] = len(raw_records)

    if not raw_records:
        logger.warning(f"[{country}] No records returned — aborting")
        summary["status"] = "empty_fetch"
        return summary

    # Register the run
    register_run(registry, run_id, country, len(raw_records))

    # ── Step 2: Transform ────────────────────────────────────────────────────
    logger.info(f"[{country}] Transforming...")
    try:
        chunks = transform(raw_records)
    except Exception as e:
        logger.error(f"[{country}] Transform failed: {e}")
        summary["status"] = "failed_transform"
        summary["error"]  = str(e)
        update_run(registry, run_id, Status.FAILED, error=str(e)[:500])
        return summary

    logger.info(f"[{country}] Produced {len(chunks)} chunks")
    summary["chunks"] = len(chunks)

    if not chunks:
        logger.warning(f"[{country}] No chunks produced — aborting")
        summary["status"] = "empty_transform"
        update_run(registry, run_id, Status.FAILED, error="No chunks produced")
        return summary

    # Update registry with chunk count
    update_run(registry, run_id, Status.TRANSFORMED, chunk_count=len(chunks))

    if dry_run:
        logger.info(f"[{country}] DRY RUN — skipping S3 and Pinecone writes")
        _print_sample_chunks(chunks, n=2)
        summary["status"] = "dry_run_complete"
        return summary

    # ── Step 3: Save to S3 ──────────────────────────────────────────────────
    logger.info(f"[{country}] Saving to S3...")
    try:
        # Raw fetcher output → inbox/
        inbox_key = f"{S3_PREFIX}/inbox/{country.lower()}/{run_id}.json"
        upload_json({
            "run_id":    run_id,
            "country":   country,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "records":   raw_records,
        }, inbox_key)
        logger.info(f"[{country}] Saved raw to {inbox_key}")

        # Transformed chunks → transformed/
        transformed_key = f"{S3_PREFIX}/transformed/{country.lower()}/{run_id}.json"
        upload_json({
            "run_id":    run_id,
            "country":   country,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "chunks":    chunks,
        }, transformed_key)
        logger.info(f"[{country}] Saved chunks to {transformed_key}")

    except Exception as e:
        logger.error(f"[{country}] S3 save failed: {e}")
        summary["status"] = "failed_s3"
        summary["error"]  = str(e)
        update_run(registry, run_id, Status.FAILED, error=str(e)[:500])
        return summary

    # ── Step 4 + 5: Embed and upsert to Pinecone ────────────────────────────
    logger.info(f"[{country}] Embedding and upserting to Pinecone...")
    update_run(registry, run_id, Status.EMBEDDING)
    upserted   = 0
    failed_ids = []

    # Group chunks by namespace for efficient batching
    by_namespace: dict[str, list] = {}
    for chunk in chunks:
        by_namespace.setdefault(chunk["namespace"], []).append(chunk)

    all_uploaded_ids = []

    for namespace, ns_chunks in by_namespace.items():
        logger.info(f"[{country}] Namespace '{namespace}': {len(ns_chunks)} chunks")
        ids = [c["chunk_id"] for c in ns_chunks]
        pinecone_chunks = [
            {
                "chunkId": c["chunk_id"],
                "text": c["text"],
                "rawText": c["text"],
                "metadata": c["metadata"],
            }
            for c in ns_chunks
        ]

        try:
            embedded = embed_chunks(pinecone_chunks)
            uploaded_ids = upload_chunks(embedded, namespace=namespace)
            all_uploaded_ids.extend(uploaded_ids)
            upserted += len(uploaded_ids)
            logger.info(f"[{country}] Upserted {len(uploaded_ids)} vectors to '{namespace}'")
        except Exception as e:
            logger.error(f"[{country}] Embed/upsert failed for '{namespace}': {e}")
            failed_ids.extend(ids)

    summary["upserted"]   = upserted
    summary["failed_ids"] = failed_ids

    # Update registry with pinecone IDs
    if failed_ids:
        update_run(registry, run_id, Status.EMBEDDED, pinecone_ids=all_uploaded_ids, error=f"{len(failed_ids)} chunks failed")
    else:
        update_run(registry, run_id, Status.EMBEDDED, pinecone_ids=all_uploaded_ids)

    # ── Step 6: Write processed manifest to S3 ──────────────────────────────
    try:
        processed_key = f"{S3_PREFIX}/processed/{country.lower()}/{run_id}.json"
        upload_json({
            "run_id":     run_id,
            "country":    country,
            "timestamp":  datetime.now(timezone.utc).isoformat(),
            "fetched":    summary["fetched"],
            "chunks":     summary["chunks"],
            "upserted":   upserted,
            "failed_ids": failed_ids,
            "namespaces": list(by_namespace.keys()),
        }, processed_key)
    except Exception as e:
        logger.warning(f"[{country}] Could not write processed manifest: {e}")

    summary["status"] = "complete" if not failed_ids else "complete_with_errors"
    logger.info(
        f"[{country}] Run complete — "
        f"{upserted} upserted, {len(failed_ids)} failed"
    )
    
    # Mark run as completed in registry
    if failed_ids:
        update_run(registry, run_id, Status.FAILED, error=f"Embedding/upsert: {len(failed_ids)} chunks failed")
    else:
        update_run(registry, run_id, Status.COMPLETED)
    
    return summary


def run_imf(dry_run: bool = False, projection_years: int = 5) -> dict:
    """
    Run the IMF WEO outlook pipeline (unemployment_outlook + gdp_outlook, US + CA
    in one call — IMF's API isn't per-country). Mirrors run_country()'s stages;
    kept separate because IMF's fetch/cadence shape doesn't fit the per-country loop.

    Note on cadence: IMF WEO only publishes new vintages ~twice a year (April,
    October), unlike BLS's monthly release. Running this on the same monthly
    schedule as BLS/StatsCan just re-fetches an unchanged vintage most months —
    harmless (dedup/cache absorbs it) but worth a lighter/separate schedule later.
    """
    run_id  = f"imf_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    summary = {"run_id": run_id, "country": "IMF", "status": "started"}

    logger.info(f"[IMF] Starting run {run_id}")
    registry = get_registry()

    try:
        raw_records = fetch_imf(projection_years=projection_years)
    except Exception as e:
        logger.error(f"[IMF] Fetch failed: {e}")
        summary["status"] = "failed_fetch"
        summary["error"]  = str(e)
        return summary

    logger.info(f"[IMF] Fetched {len(raw_records)} series")
    summary["fetched"] = len(raw_records)

    if not raw_records:
        logger.warning("[IMF] No records returned — aborting")
        summary["status"] = "empty_fetch"
        return summary

    register_run(registry, run_id, "IMF", len(raw_records))

    try:
        chunks = transform(raw_records)
    except Exception as e:
        logger.error(f"[IMF] Transform failed: {e}")
        summary["status"] = "failed_transform"
        summary["error"]  = str(e)
        update_run(registry, run_id, Status.FAILED, error=str(e)[:500])
        return summary

    logger.info(f"[IMF] Produced {len(chunks)} chunks")
    summary["chunks"] = len(chunks)

    if not chunks:
        logger.warning("[IMF] No chunks produced — aborting")
        summary["status"] = "empty_transform"
        update_run(registry, run_id, Status.FAILED, error="No chunks produced")
        return summary

    update_run(registry, run_id, Status.TRANSFORMED, chunk_count=len(chunks))

    if dry_run:
        logger.info("[IMF] DRY RUN — skipping S3 and Pinecone writes")
        _print_sample_chunks(chunks, n=2)
        summary["status"] = "dry_run_complete"
        return summary

    try:
        inbox_key = f"{S3_PREFIX}/inbox/imf/{run_id}.json"
        upload_json({
            "run_id":    run_id,
            "source":    "IMF",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "records":   raw_records,
        }, inbox_key)

        transformed_key = f"{S3_PREFIX}/transformed/imf/{run_id}.json"
        upload_json({
            "run_id":    run_id,
            "source":    "IMF",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "chunks":    chunks,
        }, transformed_key)
    except Exception as e:
        logger.error(f"[IMF] S3 save failed: {e}")
        summary["status"] = "failed_s3"
        summary["error"]  = str(e)
        update_run(registry, run_id, Status.FAILED, error=str(e)[:500])
        return summary

    update_run(registry, run_id, Status.EMBEDDING)
    upserted   = 0
    failed_ids = []

    by_namespace: dict[str, list] = {}
    for chunk in chunks:
        by_namespace.setdefault(chunk["namespace"], []).append(chunk)

    all_uploaded_ids = []

    for namespace, ns_chunks in by_namespace.items():
        logger.info(f"[IMF] Namespace '{namespace}': {len(ns_chunks)} chunks")
        ids = [c["chunk_id"] for c in ns_chunks]
        pinecone_chunks = [
            {
                "chunkId": c["chunk_id"],
                "text": c["text"],
                "rawText": c["text"],
                "metadata": c["metadata"],
            }
            for c in ns_chunks
        ]

        try:
            embedded = embed_chunks(pinecone_chunks)
            uploaded_ids = upload_chunks(embedded, namespace=namespace)
            all_uploaded_ids.extend(uploaded_ids)
            upserted += len(uploaded_ids)
            logger.info(f"[IMF] Upserted {len(uploaded_ids)} vectors to '{namespace}'")
        except Exception as e:
            logger.error(f"[IMF] Embed/upsert failed for '{namespace}': {e}")
            failed_ids.extend(ids)

    summary["upserted"]   = upserted
    summary["failed_ids"] = failed_ids

    # Record pinecone_ids now (even on partial failure) so TTL cleanup can
    # still find and delete the vectors that did upload successfully.
    if failed_ids:
        update_run(registry, run_id, Status.EMBEDDED, pinecone_ids=all_uploaded_ids, error=f"{len(failed_ids)} chunks failed")
    else:
        update_run(registry, run_id, Status.EMBEDDED, pinecone_ids=all_uploaded_ids)

    try:
        processed_key = f"{S3_PREFIX}/processed/imf/{run_id}.json"
        upload_json({
            "run_id":     run_id,
            "source":     "IMF",
            "timestamp":  datetime.now(timezone.utc).isoformat(),
            "fetched":    summary["fetched"],
            "chunks":     summary["chunks"],
            "upserted":   upserted,
            "failed_ids": failed_ids,
            "namespaces": list(by_namespace.keys()),
        }, processed_key)
    except Exception as e:
        logger.warning(f"[IMF] Could not write processed manifest: {e}")

    summary["status"] = "complete" if not failed_ids else "complete_with_errors"
    logger.info(f"[IMF] Run complete — {upserted} upserted, {len(failed_ids)} failed")

    if failed_ids:
        update_run(registry, run_id, Status.FAILED, error=f"Embedding/upsert: {len(failed_ids)} chunks failed")
    else:
        update_run(registry, run_id, Status.COMPLETED)

    return summary


def _print_sample_chunks(chunks: list[dict], n: int = 2) -> None:
    """Print sample chunks to stdout for dry-run inspection."""
    print(f"\n{'='*60}")
    print(f"Sample chunks ({min(n, len(chunks))} of {len(chunks)}):")
    for chunk in chunks[:n]:
        print(f"\n  chunk_id:  {chunk['chunk_id']}")
        print(f"  namespace: {chunk['namespace']}")
        print(f"  metadata:  {json.dumps(chunk['metadata'])}")
        print(f"  text:\n    {chunk['text'][:300]}...")
    print('='*60)


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    parser = argparse.ArgumentParser(description="Market Stats Pipeline Runner")
    parser.add_argument(
        "--country", choices=["US", "CA", "both"], default="both",
        help="Which country to run (default: both)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Fetch and transform only — no S3 or Pinecone writes"
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Cap number of series fetched per country (for testing)"
    )
    parser.add_argument(
        "--lookback-years", type=int, default=2,
        help="Years of BLS history to fetch (default: 2)"
    )
    parser.add_argument(
        "--cleanup", action="store_true",
        help="Run cleanup stage (delete data older than TTL) — run quarterly, not on every fetch"
    )
    parser.add_argument(
        "--ttl-summary", action="store_true",
        help="Print TTL health — active vs expired runs per country"
    )
    parser.add_argument(
        "--skip-imf", action="store_true",
        help="Skip the IMF outlook fetch (runs by default alongside BLS/StatsCan)"
    )
    args = parser.parse_args()

    # ── TTL Summary (optional, runs before fetch) ──────────────────────────────
    if args.ttl_summary:
        logger.info("=== TTL Summary ===")
        summary = run_ttl_summary()
        print(f"\n{'='*60}")
        print("TTL Health Report (active vs expired runs):")
        for country, stats in summary.items():
            print(
                f"  {country}: {stats['active']} active, "
                f"{stats['expired']} expired (TTL: {stats['ttl_months']} months)"
            )
        print(f"{'='*60}\n")
        sys.exit(0)

    countries = ["US", "CA"] if args.country == "both" else [args.country]
    summaries = []

    for country in countries:
        summary = run_country(
            country=country,
            dry_run=args.dry_run,
            limit=args.limit,
            lookback_years=args.lookback_years,
        )
        summaries.append(summary)

        # Print per-country summary
        print(f"\n{'─'*50}")
        print(f"Country:  {summary['country']}")
        print(f"Status:   {summary['status']}")
        print(f"Fetched:  {summary.get('fetched', 'n/a')}")
        print(f"Chunks:   {summary.get('chunks', 'n/a')}")
        if not args.dry_run:
            print(f"Upserted: {summary.get('upserted', 'n/a')}")
            if summary.get("failed_ids"):
                print(f"Failed:   {len(summary['failed_ids'])} chunk(s)")

    # ── IMF outlook (US + CA in one call, not part of the per-country loop) ────
    if not args.skip_imf:
        imf_summary = run_imf(dry_run=args.dry_run)
        summaries.append(imf_summary)

        print(f"\n{'─'*50}")
        print(f"Source:   IMF")
        print(f"Status:   {imf_summary['status']}")
        print(f"Fetched:  {imf_summary.get('fetched', 'n/a')}")
        print(f"Chunks:   {imf_summary.get('chunks', 'n/a')}")
        if not args.dry_run:
            print(f"Upserted: {imf_summary.get('upserted', 'n/a')}")
            if imf_summary.get("failed_ids"):
                print(f"Failed:   {len(imf_summary['failed_ids'])} chunk(s)")
    else:
        logger.info("Skipping IMF outlook fetch (--skip-imf)")

    # ── Cleanup stage (opt-in, run quarterly) ──────────────────────────────────
    if args.cleanup:
        logger.info("=== Cleanup ===")
        cleanup_stats = run_cleanup(dry_run=args.dry_run)
        print(f"\n{'─'*50}")
        print(f"Cleanup Results:")
        print(f"  Total Runs:        {cleanup_stats['total_runs']}")
        print(f"  Expired Runs:      {cleanup_stats['expired_runs']}")
        print(f"  Deleted Vectors:   {cleanup_stats['deleted_vectors']}")
        print(f"  Deleted Registry:  {cleanup_stats['deleted_registry']}")
        if args.dry_run:
            print(f"  (DRY RUN — no actual deletions)")
        print(f"{'─'*50}\n")
    else:
        logger.info("Skipping cleanup stage (run with --cleanup to enable)")

    # Overall exit code — non-zero if any country failed
    all_ok = all(
        s["status"] in ("complete", "dry_run_complete")
        for s in summaries
    )
    sys.exit(0 if all_ok else 1)


def lambda_handler(event: dict, context) -> dict:
    """
    AWS Lambda entry point for EventBridge or direct invoke.
    Accepts an optional event dict to control behavior:
      - country: "US" | "CA" | "both" (default: both)
      - dry_run: bool
      - limit: int
      - lookback_years: int
      - include_imf: bool (default: true — IMF outlook, US + CA in one call)
      - cleanup: bool
      - ttl_summary: bool
    Returns a summary dict with per-country run results and optional cleanup stats.
    """
    logging.basicConfig(level=logging.INFO)
    logger.info(f"Lambda triggered with event: {event}")

    try:
        # TTL summary shortcut
        if event.get("ttl_summary", False):
            return run_ttl_summary()

        country = event.get("country", "both")
        dry_run = event.get("dry_run", False)
        limit = event.get("limit", None)
        lookback_years = event.get("lookback_years", 2)

        countries = ["US", "CA"] if country in ("both", "both") else ([country] if country in ("US", "CA") else ["US", "CA"])

        summaries = []
        for c in countries:
            summaries.append(
                run_country(
                    country=c,
                    dry_run=dry_run,
                    limit=limit,
                    lookback_years=lookback_years,
                )
            )

        if event.get("include_imf", True):
            summaries.append(run_imf(dry_run=dry_run))

        result = {"runs": summaries}

        if event.get("cleanup", False):
            cleanup_stats = run_cleanup(dry_run=dry_run)
            result["cleanup"] = cleanup_stats

        return result

    except Exception as e:
        logger.exception(f"Lambda invocation failed: {e}")
        return {"error": str(e)}


if __name__ == "__main__":
    main()