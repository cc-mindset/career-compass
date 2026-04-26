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
from datetime import datetime, timezone, timedelta
from typing import Optional

from src.shared.pinecone_client import PineconeClient
from src.shared.registry import Registry

logger = logging.getLogger(__name__)

PINECONE_INDEX = "market-knowledge"
PINECONE_NAMESPACE = "market-news"

# ── TTL CONFIG ────────────────────────────────────────────────────────────────

DEFAULT_TTL_DAYS = 90

# Per-category overrides — set to None to use DEFAULT_TTL_DAYS
CATEGORY_TTL_DAYS = {
    "labor_workforce":   90,
    "industry_verticals": 120,
    "ai_automation":     180,
    "macro_economics":   90,
    "geopolitics_trade": 180,
    "policy_regulation": 365,
    "education_skills":  180,
}

DELETE_BATCH_SIZE = 100   # Pinecone delete batch limit


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _cutoff_for_category(category: Optional[str]) -> datetime:
    """Return the cutoff datetime for a given category."""
    ttl = CATEGORY_TTL_DAYS.get(category or "", DEFAULT_TTL_DAYS) or DEFAULT_TTL_DAYS
    return datetime.now(timezone.utc) - timedelta(days=ttl)


def _is_expired(published_at: Optional[str], category: Optional[str]) -> bool:
    """Return True if article is older than its category TTL."""
    if not published_at:
        # No date — use default TTL from embedded_at if available
        return False
    try:
        dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        cutoff = _cutoff_for_category(category)
        return dt < cutoff
    except (ValueError, TypeError):
        return False


# ── CLEANUP ───────────────────────────────────────────────────────────────────

def run_cleanup(dry_run: bool = False) -> dict:
    """
    Scan MongoDB registry for expired market-news entries.
    Delete corresponding vectors from Pinecone.
    Remove expired entries from MongoDB.

    Returns stats dict.
    """
    registry = Registry()
    pinecone = PineconeClient(index=PINECONE_INDEX)

    logger.info(f"Starting market-news cleanup (dry_run={dry_run})")

    # Fetch all market-news entries from MongoDB registry
    all_entries = registry.list_namespace(namespace=PINECONE_NAMESPACE)
    total = len(all_entries)
    logger.info(f"Found {total} entries in registry")

    if total == 0:
        return {"total": 0, "expired": 0, "deleted_vectors": 0, "deleted_registry": 0}

    # Identify expired entries
    expired_ids = []
    expired_entries = []

    for entry in all_entries:
        doc_id = entry.get("doc_id")
        published_at = entry.get("metadata", {}).get("published_at")
        category = entry.get("metadata", {}).get("category")

        # Also check embedded_at as fallback for articles without published_at
        embedded_at = entry.get("metadata", {}).get("embedded_at")
        date_to_check = published_at or embedded_at

        if _is_expired(date_to_check, category):
            expired_ids.append(doc_id)
            expired_entries.append(entry)

    logger.info(f"Found {len(expired_ids)} expired articles out of {total}")

    if not expired_ids:
        logger.info("Nothing to clean up")
        return {
            "total": total,
            "expired": 0,
            "deleted_vectors": 0,
            "deleted_registry": 0,
        }

    deleted_vectors = 0
    deleted_registry = 0

    if dry_run:
        logger.info(f"Dry run — would delete {len(expired_ids)} vectors and registry entries")
        # Log sample of what would be deleted
        for entry in expired_entries[:5]:
            logger.info(
                f"  Would delete: {entry.get('doc_id')} | "
                f"published: {entry.get('metadata', {}).get('published_at', 'unknown')} | "
                f"source: {entry.get('metadata', {}).get('source', 'unknown')}"
            )
        return {
            "total": total,
            "expired": len(expired_ids),
            "deleted_vectors": 0,
            "deleted_registry": 0,
            "dry_run": True,
        }

    # Delete from Pinecone in batches
    logger.info(f"Deleting {len(expired_ids)} vectors from Pinecone")
    for i in range(0, len(expired_ids), DELETE_BATCH_SIZE):
        batch = expired_ids[i : i + DELETE_BATCH_SIZE]
        try:
            pinecone.delete(namespace=PINECONE_NAMESPACE, ids=batch)
            deleted_vectors += len(batch)
            logger.info(f"Deleted {deleted_vectors}/{len(expired_ids)} vectors")
        except Exception as e:
            logger.error(f"Pinecone delete failed for batch {i}: {e}")

    # Delete from MongoDB registry
    logger.info(f"Removing {len(expired_ids)} entries from MongoDB registry")
    for doc_id in expired_ids:
        try:
            registry.delete(namespace=PINECONE_NAMESPACE, doc_id=doc_id)
            deleted_registry += 1
        except Exception as e:
            logger.error(f"Registry delete failed for {doc_id}: {e}")

    stats = {
        "total": total,
        "expired": len(expired_ids),
        "deleted_vectors": deleted_vectors,
        "deleted_registry": deleted_registry,
        "ran_at": datetime.now(timezone.utc).isoformat(),
    }

    logger.info(f"Cleanup complete: {json.dumps(stats)}")
    return stats


# ── TTL SUMMARY ───────────────────────────────────────────────────────────────

def ttl_summary() -> dict:
    """
    Print a summary of current TTL policy and how many articles
    would be affected if cleanup ran right now.
    """
    registry = Registry()
    all_entries = registry.list_namespace(namespace=PINECONE_NAMESPACE)

    summary = {cat: {"ttl_days": ttl, "active": 0, "would_expire": 0}
               for cat, ttl in CATEGORY_TTL_DAYS.items()}
    summary["unknown"] = {"ttl_days": DEFAULT_TTL_DAYS, "active": 0, "would_expire": 0}

    for entry in all_entries:
        category = entry.get("metadata", {}).get("category", "unknown")
        published_at = entry.get("metadata", {}).get("published_at")
        embedded_at = entry.get("metadata", {}).get("embedded_at")
        date_to_check = published_at or embedded_at

        bucket = category if category in summary else "unknown"

        if _is_expired(date_to_check, category):
            summary[bucket]["would_expire"] += 1
        else:
            summary[bucket]["active"] += 1

    return summary


if __name__ == "__main__":
    import argparse
    import sys
    logging.basicConfig(level=logging.INFO)

    parser = argparse.ArgumentParser(description="market_news cleanup")
    parser.add_argument("--dry-run",  action="store_true", help="Preview deletions without executing")
    parser.add_argument("--summary",  action="store_true", help="Show TTL summary only")
    args = parser.parse_args()

    if args.summary:
        result = ttl_summary()
        print(json.dumps(result, indent=2))
    else:
        result = run_cleanup(dry_run=args.dry_run)
        print(json.dumps(result, indent=2))

    sys.exit(0)