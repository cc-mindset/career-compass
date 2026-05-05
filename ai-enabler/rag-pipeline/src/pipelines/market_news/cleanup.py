"""
cleanup.py
TTL-based cleanup for market_news pipeline.
- Deletes expired vectors from Pinecone market-news namespace
- Removes expired entries from MongoDB registry
- Runs weekly (not on every fetch)

TTL policy: 90 days flat across all categories.
Override per-category via CATEGORY_TTL_DAYS if needed.
"""

import json
import logging
from datetime import datetime, timezone

from src.shared import pinecone_client as pc
from src.pipelines.market_news.registry import (
    get_registry, get_expired, delete_article, list_all, ttl_summary
)

logger = logging.getLogger(__name__)

PINECONE_NAMESPACE = "market-news"
DELETE_BATCH_SIZE = 100


# ── CLEANUP ───────────────────────────────────────────────────────────────────

def run_cleanup(dry_run: bool = False) -> dict:
    """
    Fetch expired articles from MongoDB registry.
    Delete corresponding vectors from Pinecone.
    Remove expired entries from MongoDB.
    """
    registry = get_registry()

    logger.info(f"Starting market-news cleanup (dry_run={dry_run})")

    all_entries = list_all(registry, namespace=PINECONE_NAMESPACE)
    total = len(all_entries)
    logger.info(f"Found {total} total entries in registry")

    expired_entries = get_expired(registry, namespace=PINECONE_NAMESPACE)
    expired_ids = [e["url_hash"] for e in expired_entries]

    logger.info(f"Found {len(expired_ids)} expired articles out of {total}")

    if not expired_ids:
        logger.info("Nothing to clean up")
        return {"total": total, "expired": 0, "deleted_vectors": 0, "deleted_registry": 0}

    if dry_run:
        logger.info(f"Dry run — would delete {len(expired_ids)} vectors and registry entries")
        for entry in expired_entries[:5]:
            logger.info(
                f"  Would delete: {entry.get('url_hash')} | "
                f"published: {entry.get('published_at', 'unknown')} | "
                f"source: {entry.get('source', 'unknown')} | "
                f"expires_at: {entry.get('expires_at', 'unknown')}"
            )
        return {"total": total, "expired": len(expired_ids), "deleted_vectors": 0, "deleted_registry": 0, "dry_run": True}

    # Delete from Pinecone in batches
    deleted_vectors = 0
    for i in range(0, len(expired_ids), DELETE_BATCH_SIZE):
        batch = expired_ids[i : i + DELETE_BATCH_SIZE]
        try:
            pc._index.delete(ids=batch, namespace=PINECONE_NAMESPACE)
            deleted_vectors += len(batch)
            logger.info(f"Deleted {deleted_vectors}/{len(expired_ids)} vectors from Pinecone")
        except Exception as e:
            logger.error(f"Pinecone delete failed for batch {i}: {e}")

    # Delete from MongoDB
    deleted_registry = 0
    for url_hash in expired_ids:
        try:
            delete_article(registry, url_hash)
            deleted_registry += 1
        except Exception as e:
            logger.error(f"Registry delete failed for {url_hash}: {e}")

    stats = {
        "total": total,
        "expired": len(expired_ids),
        "deleted_vectors": deleted_vectors,
        "deleted_registry": deleted_registry,
        "ran_at": datetime.now(timezone.utc).isoformat(),
    }
    logger.info(f"Cleanup complete: {json.dumps(stats, default=str)}")
    return stats


# ── TTL SUMMARY ───────────────────────────────────────────────────────────────

def run_ttl_summary() -> dict:
    """Print TTL health — active vs expired counts per category."""
    registry = get_registry()
    return ttl_summary(registry, namespace=PINECONE_NAMESPACE)


if __name__ == "__main__":
    import argparse
    import sys
    logging.basicConfig(level=logging.INFO)

    parser = argparse.ArgumentParser(description="market_news cleanup")
    parser.add_argument("--dry-run",  action="store_true", help="Preview deletions without executing")
    parser.add_argument("--summary",  action="store_true", help="Show TTL summary only")
    args = parser.parse_args()

    if args.summary:
        result = run_ttl_summary()
        print(json.dumps(result, indent=2, default=str))
    else:
        result = run_cleanup(dry_run=args.dry_run)
        print(json.dumps(result, indent=2))

    sys.exit(0)