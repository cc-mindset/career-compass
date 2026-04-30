"""
Market Stats Registry
Tracks every stats fetch/transform/embed run through the market_stats pipeline.
Stores metadata about country-level runs and embedded chunks.
Supports TTL-based cleanup for old data (default: 24 months).
"""
import certifi
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient, ASCENDING
from pymongo.collection import Collection
from config.settings import MONGODB_URI, MONGODB_DB

STATS_REGISTRY_COLLECTION = "market_stats_registry"

# TTL policy: keep 24 months of rolling history for trend analysis
TTL_MONTHS = 24


def get_registry() -> Collection:
    client = MongoClient(MONGODB_URI, tls=True, tlsCAFile=certifi.where())
    db = client[MONGODB_DB]
    col = db[STATS_REGISTRY_COLLECTION]

    # Ensure indexes on first run — safe to call repeatedly
    col.create_index([("run_id", ASCENDING)], unique=True)
    col.create_index([("country", ASCENDING)])
    col.create_index([("status", ASCENDING)])
    col.create_index([("series_id", ASCENDING)])
    col.create_index([("fetched_at", ASCENDING)])
    col.create_index([("expires_at", ASCENDING)])   # for cleanup queries
    return col


# ── Status constants ───────────────────────────────────────────────────────────
class Status:
    FETCHED    = "fetched"
    TRANSFORMED = "transformed"
    EMBEDDING  = "embedding"
    EMBEDDED   = "embedded"
    COMPLETED  = "completed"
    FAILED     = "failed"


# ── Registry operations ────────────────────────────────────────────────────────

def register_run(registry: Collection, run_id: str, country: str,
                 series_count: int, chunk_count: int = 0) -> None:
    """
    Register a new stats run. Called after fetch, records series count.
    Sets expires_at to TTL_MONTHS in the future.
    """
    expires_at = datetime.now(timezone.utc) + timedelta(days=TTL_MONTHS * 30)
    
    registry.insert_one({
        "run_id":       run_id,
        "country":      country,
        "status":       Status.FETCHED,
        "series_count": series_count,
        "chunk_count":  chunk_count,
        "pinecone_ids": [],
        "fetched_at":   _now(),
        "expires_at":   expires_at,
        "completed_at": None,
        "error":        None,
    })


def update_run(registry: Collection, run_id: str, status: str,
               chunk_count: int = None, pinecone_ids: list = None,
               error: str = None) -> None:
    """
    Update run status. Pass chunk_count after transform, pinecone_ids after embed.
    """
    update = {"status": status}
    
    if chunk_count is not None:
        update["chunk_count"] = chunk_count
    
    if pinecone_ids is not None:
        update["pinecone_ids"] = pinecone_ids
    
    if error is not None:
        update["error"] = error
    
    if status == Status.COMPLETED:
        update["completed_at"] = _now()

    registry.update_one({"run_id": run_id}, {"$set": update})


def get_run(registry: Collection, run_id: str) -> dict:
    """Fetch a run record by run_id."""
    return registry.find_one({"run_id": run_id})


def is_run_completed(registry: Collection, run_id: str) -> bool:
    """Check if a run has been successfully completed."""
    doc = registry.find_one({"run_id": run_id})
    if not doc:
        return False
    return doc.get("status") == Status.COMPLETED


def get_pending_runs(registry: Collection, country: str = None) -> list:
    """Return all runs not yet completed. Optionally filter by country."""
    query = {
        "status": {"$in": [Status.FETCHED, Status.TRANSFORMED, Status.EMBEDDING]}
    }
    if country:
        query["country"] = country
    return list(registry.find(query))


def get_failed_runs(registry: Collection, country: str = None) -> list:
    """Return all failed runs. Optionally filter by country."""
    query = {"status": Status.FAILED}
    if country:
        query["country"] = country
    return list(registry.find(query))


def get_runs_by_country(registry: Collection, country: str) -> list:
    """Return all runs for a country."""
    return list(registry.find({"country": country}).sort("fetched_at", -1))


def count_completed(registry: Collection, country: str = None) -> int:
    """Count completed runs. Optionally filter by country."""
    query = {"status": Status.COMPLETED}
    if country:
        query["country"] = country
    return registry.count_documents(query)


# ── TTL / Cleanup operations ───────────────────────────────────────────────────

def get_expired(registry: Collection, country: str = None) -> list[dict]:
    """Return all runs past their expires_at. Optionally filter by country."""
    query = {
        "expires_at": {"$lt": datetime.now(timezone.utc)},
    }
    if country:
        query["country"] = country
    return list(registry.find(query))


def delete_run(registry: Collection, run_id: str) -> None:
    """Remove a single run from the registry."""
    registry.delete_one({"run_id": run_id})


def ttl_summary(registry: Collection, country: str = None) -> dict:
    """
    Returns active vs expired counts per country.
    Useful for health checks before running cleanup.
    """
    now = datetime.now(timezone.utc)
    
    if country:
        all_runs = list(registry.find({"country": country}))
    else:
        all_runs = list(registry.find({}))
    
    summary = {}
    for run in all_runs:
        c = run.get("country", "unknown")
        if c not in summary:
            summary[c] = {"active": 0, "expired": 0, "ttl_months": TTL_MONTHS}
        
        expires_at = run.get("expires_at")
        if expires_at and expires_at < now:
            summary[c]["expired"] += 1
        else:
            summary[c]["active"] += 1
    
    return summary


# ── Internal ───────────────────────────────────────────────────────────────────

def _now():
    return datetime.now(timezone.utc)
