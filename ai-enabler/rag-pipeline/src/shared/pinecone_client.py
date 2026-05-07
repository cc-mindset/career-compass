"""
Shared Pinecone Client
Handles uploading embedded chunks to Pinecone.
Used by all 3 pipelines (market reports, stats, news).

Handles:
- Batched upserts (100 vectors per request)
- Namespace routing per pipeline
- Returns list of uploaded vector IDs
"""

from pinecone import Pinecone
from config.settings import PINECONE_API_KEY, PINECONE_INDEX


_pc    = Pinecone(api_key=PINECONE_API_KEY)
_index = _pc.Index(PINECONE_INDEX)

UPSERT_BATCH_SIZE = 100

# Namespace constants — single source of truth
NAMESPACE_REPORTS = "market-reports"
NAMESPACE_STATS   = "market-stats"
NAMESPACE_NEWS    = "market-news"


# ── Main entry point ───────────────────────────────────────────────────────────

def upload_chunks(chunks: list[dict],
                  namespace: str = NAMESPACE_REPORTS) -> list[str]:
    """
    Upload embedded chunks to Pinecone.

    Args:
        chunks:    list of chunk dicts with 'embedding' field attached
        namespace: Pinecone namespace to upload to

    Returns:
        list of vector IDs that were uploaded
    """
    vectors  = _build_vectors(chunks)
    ids      = [v["id"] for v in vectors]
    batches  = [vectors[i:i+UPSERT_BATCH_SIZE]
                for i in range(0, len(vectors), UPSERT_BATCH_SIZE)]

    print(f"  → Uploading {len(vectors)} vectors to "
          f"Pinecone namespace '{namespace}'...")

    for batch_idx, batch in enumerate(batches):
        print(f"     Batch {batch_idx + 1}/{len(batches)} "
              f"({len(batch)} vectors)...")
        _index.upsert(vectors=batch, namespace=namespace)

    print(f"  → Uploaded {len(ids)} vectors ✓")
    return ids


def delete_document(source: str,
                    namespace: str = NAMESPACE_REPORTS) -> None:
    """
    Delete all vectors for a document from Pinecone.
    Used when a report is removed from the knowledge base.

    Args:
        source:    the stem filename e.g. 'accenture-tech-vision-2025'
        namespace: Pinecone namespace to delete from
    """
    _index.delete(
        filter={"source": {"$eq": source}},
        namespace=namespace
    )
    print(f"  → Deleted vectors for '{source}' from '{namespace}'")


def get_index_stats() -> dict:
    return _index.describe_index_stats()


# ── Vector builder ─────────────────────────────────────────────────────────────

def _build_vectors(chunks: list[dict]) -> list[dict]:
    """
    Convert chunk dicts into Pinecone vector format.

    Pinecone vector format:
    {
        "id":       str,
        "values":   list[float],
        "metadata": dict
    }

    Note: Pinecone metadata values must be str, int, float, bool, or list[str].
    None values are dropped.
    """
    vectors = []

    for chunk in chunks:
        if "embedding" not in chunk:
            raise ValueError(f"Chunk {chunk['chunkId']} missing embedding")

        # Clean metadata — Pinecone rejects None values
        clean_meta = _clean_metadata(chunk["metadata"])

        # Add rawText to metadata so we can retrieve it at query time
        # Truncate to 1000 chars to stay within Pinecone metadata limits
        clean_meta["text"] = chunk["rawText"][:1000]

        vectors.append({
            "id":       chunk["chunkId"],
            "values":   chunk["embedding"],
            "metadata": clean_meta,
        })

    return vectors


def _clean_metadata(metadata: dict) -> dict:
    """
    Remove None values and ensure all values are
    Pinecone-compatible types (str, int, float, bool, list[str]).
    """
    clean = {}
    for key, value in metadata.items():
        if value is None:
            continue
        if isinstance(value, (str, int, float, bool)):
            clean[key] = value
        elif isinstance(value, list):
            # Only keep string lists
            clean[key] = [str(v) for v in value if v is not None]
        else:
            clean[key] = str(value)
    return clean