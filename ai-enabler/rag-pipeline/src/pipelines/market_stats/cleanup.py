"""
cleanup.py (market_stats)
TTL-based cleanup for market_stats pipeline.
- Deletes expired vectors from Pinecone (labor-market-stats, geo-labor-signals, forward-looking namespaces)
- Removes expired runs from MongoDB registry
- Runs quarterly (not on every fetch)

TTL policy: 24 months rolling history (for trend analysis).
After 24 months, a run's vectors are deleted from Pinecone and registry entry removed.
This keeps knowledge base fresh and reduces vector storage costs.
"""

import json
import logging
from datetime import datetime, timezone

from src.shared import pinecone_client as pc
from src.pipelines.market_stats.registry import (
    get_registry, get_expired, delete_run, ttl_summary
)

logger = logging.getLogger(__name__)

# transformer.py's NAMESPACE_MAP is the single source of truth for where chunks
# land; a run's pinecone_ids aren't tagged with namespace in the registry (they're
# a flat list spanning whichever of these a run touched), so cleanup deletes each
# expired ID from every real namespace. Pinecone's delete-by-id is a no-op for IDs
# that don't exist in a given namespace, so this is safe — an ID only ever
# actually lives in one of them.
PINECONE_NAMESPACES = ["labor-market-stats", "geo-labor-signals", "forward-looking"]
DELETE_BATCH_SIZE = 100


# ── CLEANUP ───────────────────────────────────────────────────────────────────

def run_cleanup(dry_run: bool = False) -> dict:
    """
    Fetch expired runs from MongoDB registry (expires_at < now).
    Delete corresponding vectors from Pinecone.
    Remove expired entries from MongoDB.
    
    Args:
        dry_run: If True, report what would be deleted without deleting.
    
    Returns:
        Stats dict with counts of expired, deleted vectors, deleted registry entries.
    """
    registry = get_registry()

    logger.info(f"Starting market-stats cleanup (dry_run={dry_run})")

    # Get all runs for baseline
    all_runs = list(registry.find({}))
    total = len(all_runs)
    logger.info(f"Found {total} total runs in registry")

    # Get expired runs
    expired_runs = get_expired(registry)
    expired_run_ids = [r["run_id"] for r in expired_runs]
    expired_vector_ids = []
    
    # Flatten all pinecone_ids from expired runs
    for run in expired_runs:
        expired_vector_ids.extend(run.get("pinecone_ids", []))

    logger.info(
        f"Found {len(expired_runs)} expired runs with {len(expired_vector_ids)} vectors "
        f"out of {total} total runs"
    )

    if not expired_run_ids:
        logger.info("Nothing to clean up")
        return {
            "total_runs": total,
            "expired_runs": 0,
            "deleted_vectors": 0,
            "deleted_registry": 0,
        }

    if dry_run:
        logger.info(
            f"Dry run — would delete {len(expired_run_ids)} runs "
            f"({len(expired_vector_ids)} vectors)"
        )
        for run in expired_runs[:5]:
            logger.info(
                f"  Would delete: run_id={run.get('run_id')} | "
                f"country={run.get('country')} | "
                f"fetched_at={run.get('fetched_at')} | "
                f"expires_at={run.get('expires_at')} | "
                f"vectors={len(run.get('pinecone_ids', []))}"
            )
        return {
            "total_runs": total,
            "expired_runs": len(expired_run_ids),
            "deleted_vectors": 0,
            "deleted_registry": 0,
            "dry_run": True,
        }

    # ── Delete from Pinecone in batches ────────────────────────────────────────
    # Each batch is deleted from every real namespace (see PINECONE_NAMESPACES
    # comment above) since the registry doesn't track which namespace each ID
    # landed in.
    deleted_vectors = 0
    for i in range(0, len(expired_vector_ids), DELETE_BATCH_SIZE):
        batch = expired_vector_ids[i : i + DELETE_BATCH_SIZE]
        for namespace in PINECONE_NAMESPACES:
            try:
                pc._index.delete(ids=batch, namespace=namespace)
            except Exception as e:
                logger.error(f"Pinecone delete failed for batch {i} in '{namespace}': {e}")
        deleted_vectors += len(batch)
        logger.info(f"Deleted {deleted_vectors}/{len(expired_vector_ids)} vectors from Pinecone")

    # ── Delete from MongoDB ────────────────────────────────────────────────────
    deleted_registry = 0
    for run_id in expired_run_ids:
        try:
            delete_run(registry, run_id)
            deleted_registry += 1
        except Exception as e:
            logger.error(f"Registry delete failed for run {run_id}: {e}")

    stats = {
        "total_runs": total,
        "expired_runs": len(expired_run_ids),
        "deleted_vectors": deleted_vectors,
        "deleted_registry": deleted_registry,
        "ran_at": datetime.now(timezone.utc).isoformat(),
    }
    logger.info(f"Cleanup complete: {json.dumps(stats, default=str)}")
    return stats


# ── TTL SUMMARY ───────────────────────────────────────────────────────────────

def run_ttl_summary(country: str = None) -> dict:
    """
    Print TTL health — active vs expired counts per country.
    
    Args:
        country: Optional filter by country (e.g., "US", "CA")
    
    Returns:
        Summary dict with active/expired counts and TTL policy.
    """
    registry = get_registry()
    return ttl_summary(registry, country=country)
