"""
Registry: tracks every PDF through the pipeline.
Single collection in your existing MongoDB.
"""
import certifi
from datetime import datetime, timezone
from pymongo import MongoClient, ASCENDING
from pymongo.collection import Collection
from config.settings import MONGODB_URI, MONGODB_DB, REGISTRY_COLLECTION


def get_registry() -> Collection:
    client = MongoClient(MONGODB_URI,tls= True, tlsCAFile=certifi.where())
    db = client[MONGODB_DB]
    col = db[REGISTRY_COLLECTION]
    

    # Ensure indexes on first run — safe to call repeatedly
    col.create_index([("fileHash", ASCENDING)], unique=True)
    col.create_index([("status", ASCENDING)])
    col.create_index([("fileName", ASCENDING)])
    return col


# ── Status constants ───────────────────────────────────────────────────────────
class Status:
    PENDING    = "pending"
    PARSING    = "parsing"
    PARSED     = "parsed"
    CHUNKING   = "chunking"
    CHUNKED    = "chunked"
    ENRICHING  = "enriching"
    ENRICHED   = "enriched"
    EMBEDDING  = "embedding"
    COMPLETED  = "completed"
    FAILED     = "failed"
    NEEDS_REVIEW = "needs_review"   # auto-extracted metadata, no sidecar JSON


# ── Registry operations ────────────────────────────────────────────────────────

def is_already_processed(registry: Collection, file_hash: str) -> bool:
    """
    Dedup check. A file hash that exists and is 'completed' → skip entirely.
    A hash that exists but is 'failed' → allow re-processing.
    """
    doc = registry.find_one({"fileHash": file_hash})
    if not doc:
        return False
    return doc["status"] == Status.COMPLETED


def register_document(registry: Collection, file_name: str, file_hash: str,
                       s3_key: str, metadata: dict) -> str:
    """
    Insert a new document into the registry. Returns the document _id.
    If the document failed previously (same hash), resets it for re-processing.
    """
    existing = registry.find_one({"fileHash": file_hash})

    if existing:
        # Reset a previously failed document for re-run
        registry.update_one(
            {"fileHash": file_hash},
            {"$set": {
                "status": Status.PENDING,
                "failedStage": None,
                "errorMessage": None,
                "uploadedAt": _now(),
            }}
        )
        return str(existing["_id"])

    result = registry.insert_one({
        "fileName":     file_name,
        "fileHash":     file_hash,
        "s3Key":        s3_key,
        "status":       Status.PENDING,
        "failedStage":  None,
        "errorMessage": None,
        "metadata":     metadata,       # name, year, region, topic, publisher
        "pineconeIds":  [],             # populated at embedding stage
        "uploadedAt":   _now(),
        "processedAt":  None,
    })
    return str(result.inserted_id)


def update_status(registry: Collection, file_hash: str,
                  status: str, **kwargs) -> None:
    """
    Update document status. Pass extra fields as kwargs.
    e.g. update_status(reg, hash, Status.FAILED,
                       failedStage="parsing", errorMessage="...")
    """
    update = {"status": status, **kwargs}
    if status == Status.COMPLETED:
        update["processedAt"] = _now()

    registry.update_one({"fileHash": file_hash}, {"$set": update})


def get_pending(registry: Collection) -> list:
    """Return all documents not yet completed (for pipeline runner)."""
    return list(registry.find({
        "status": {"$in": [Status.PENDING, Status.PARSED,
                            Status.CHUNKED, Status.ENRICHED]}
    }))


# ── Internal ───────────────────────────────────────────────────────────────────

def _now():
    return datetime.now(timezone.utc)