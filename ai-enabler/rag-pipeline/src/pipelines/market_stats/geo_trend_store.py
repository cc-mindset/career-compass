"""
Geo Hiring Trend Store
=======================
Persists the real monthly `periods_history` that fetch_bls()/fetch_statscan()
already compute for every series, but which transform()/embed_chunks() throws
away after reducing it to a single "latest + 12-month average" prose sentence.

Why this exists (see docs/product/MarketReportPrompts.docx §3 in web-server,
and web-server/services/market-insights/normalizeMarketReportVerdict.ts):
the Market Report "market direction" chart needs a real local-vs-national
trend line, and the web-server team deliberately refused to let the LLM
fabricate one. This is exact-key structured numeric data (geo x series x
month) — always looked up by a known key, never semantically searched — so
it belongs in Mongo, not chunked/embedded into Pinecone. This module is the
second, parallel consumer of the same fetch() output that already flows into
transform()/Pinecone; it does not change that existing path at all.

Storage shape: one document per series_id (globally unique across BLS +
StatsCan), upserted on every run so the array always reflects the latest
fetch's lookback window rather than growing unbounded.
"""
import logging
from datetime import datetime, timezone

import certifi
from pymongo import MongoClient, ASCENDING
from pymongo.collection import Collection

from config.settings import MONGODB_URI, MONGODB_DB

logger = logging.getLogger(__name__)

GEO_TREND_COLLECTION = "geo_hiring_trend"

_client: MongoClient | None = None


def get_geo_trend_collection() -> Collection:
    global _client
    if _client is None:
        _client = MongoClient(MONGODB_URI, tls=True, tlsCAFile=certifi.where())
    db = _client[MONGODB_DB]
    col = db[GEO_TREND_COLLECTION]

    # Safe to call repeatedly.
    col.create_index([("series_id", ASCENDING)], unique=True)
    col.create_index([("country", ASCENDING), ("geo", ASCENDING)])
    col.create_index([("geo_type", ASCENDING)])
    col.create_index([("signal_type", ASCENDING)])
    return col


def persist_periods_history(normalized_records: list[dict]) -> dict:
    """
    Upsert one document per record, keyed by series_id. Called with the raw
    output of fetch_bls()/fetch_statscan() — BEFORE transform() — so it sees
    the full `values.periods_history` that transform() discards.

    Returns a summary dict: {"upserted": int, "skipped": int}.
    """
    if not normalized_records:
        return {"upserted": 0, "skipped": 0}

    col = get_geo_trend_collection()
    now = datetime.now(timezone.utc)
    upserted = 0
    skipped = 0

    for d in normalized_records:
        values = d.get("values") or {}
        periods_history = values.get("periods_history")
        if not periods_history:
            skipped += 1
            continue

        col.update_one(
            {"series_id": d["series_id"]},
            {
                "$set": {
                    "series_id":      d["series_id"],
                    "source":         d.get("source"),
                    "country":        d.get("country"),
                    "country_name":   d.get("country_name"),
                    "signal_type":    d.get("signal_type"),
                    "industry":       d.get("industry"),
                    "naics_or_noc":   d.get("naics_or_noc"),
                    "geo":            d.get("geo"),
                    "geo_type":       d.get("geo_type"),
                    "cadence":        d.get("cadence"),
                    "label":          d.get("series_label"),
                    "periods_history": periods_history,
                    "latest":         values.get("latest"),
                    "avg_12mo":       values.get("avg_12mo"),
                    "trend_direction": values.get("trend_direction"),
                    "updated_at":     now,
                },
            },
            upsert=True,
        )
        upserted += 1

    logger.info(f"geo_trend_store: upserted {upserted}, skipped {skipped} (no periods_history)")
    return {"upserted": upserted, "skipped": skipped}
