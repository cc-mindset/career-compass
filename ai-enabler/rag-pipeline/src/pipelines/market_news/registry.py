"""
registry.py (market_news)
Tracks embedded news articles for dedup and TTL-based cleanup.
Separate MongoDB collection from market_reports registry.
"""

import certifi
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient, ASCENDING
from pymongo.collection import Collection

from config.settings import MONGODB_URI, MONGODB_DB

NEWS_REGISTRY_COLLECTION = "news_registry"

DEFAULT_TTL_DAYS = 90

CATEGORY_TTL_DAYS = {
    "labor_workforce":    90,
    "industry_verticals": 120,
    "ai_automation":      180,
    "macro_economics":    90,
    "geopolitics_trade":  180,
    "policy_regulation":  365,
    "education_skills":   180,
}


# ── Connection ────────────────────────────────────────────────────────────────

def get_registry() -> Collection:
    client = MongoClient(MONGODB_URI, tls=True, tlsCAFile=certifi.where())
    db = client[MONGODB_DB]
    col = db[NEWS_REGISTRY_COLLECTION]

    # Indexes — safe to call repeatedly
    col.create_index([("url_hash", ASCENDING)], unique=True)
    col.create_index([("namespace", ASCENDING)])
    col.create_index([("expires_at", ASCENDING)])   # for cleanup queries
    col.create_index([("published_at", ASCENDING)])

    return col


# ── Core operations ───────────────────────────────────────────────────────────

def is_embedded(registry: Collection, url_hash: str) -> bool:
    """Return True if this article has already been embedded."""
    return registry.find_one({"url_hash": url_hash}) is not None


def register_article(
    registry: Collection,
    url_hash: str,
    url: str,
    title: str,
    source: str,
    category: str,
    published_at: str,
    namespace: str = "market-news",
) -> None:
    """
    Register a newly embedded article.
    Upserts so re-runs don't duplicate entries.
    Sets expires_at based on category TTL.
    """
    ttl_days = CATEGORY_TTL_DAYS.get(category, DEFAULT_TTL_DAYS)

    # Anchor expiry to published_at if available, else now
    try:
        anchor = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
    except (ValueError, TypeError, AttributeError):
        anchor = datetime.now(timezone.utc)

    expires_at = anchor + timedelta(days=ttl_days)

    registry.update_one(
        {"url_hash": url_hash},
        {"$set": {
            "url_hash":    url_hash,
            "namespace":   namespace,
            "url":         url,
            "title":       title[:200],
            "source":      source,
            "category":    category,
            "published_at": published_at,
            "expires_at":  expires_at,
            "embedded_at": _now(),
        }},
        upsert=True,
    )


def get_expired(registry: Collection, namespace: str = "market-news") -> list[dict]:
    """Return all articles past their expires_at for the given namespace."""
    return list(registry.find({
        "namespace": namespace,
        "expires_at": {"$lt": datetime.now(timezone.utc)},
    }))


def delete_article(registry: Collection, url_hash: str) -> None:
    """Remove a single article from the registry."""
    registry.delete_one({"url_hash": url_hash})


def list_all(registry: Collection, namespace: str = "market-news") -> list[dict]:
    """Return all registry entries for a namespace."""
    return list(registry.find({"namespace": namespace}))


def count(registry: Collection, namespace: str = "market-news") -> int:
    """Count total embedded articles for a namespace."""
    return registry.count_documents({"namespace": namespace})


def ttl_summary(registry: Collection, namespace: str = "market-news") -> dict:
    """
    Returns active vs expired counts per category.
    Useful for health checks before running cleanup.
    """
    now = datetime.now(timezone.utc)
    all_entries = list_all(registry, namespace)

    summary = {}
    for entry in all_entries:
        cat = entry.get("category", "unknown")
        if cat not in summary:
            summary[cat] = {"active": 0, "expired": 0, "ttl_days": CATEGORY_TTL_DAYS.get(cat, DEFAULT_TTL_DAYS)}

        expires_at = entry.get("expires_at")
        if expires_at and expires_at < now:
            summary[cat]["expired"] += 1
        else:
            summary[cat]["active"] += 1

    return summary


# ── Internal ──────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)