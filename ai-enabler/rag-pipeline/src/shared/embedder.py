"""
Shared Embedder
Converts chunk text → vectors using OpenAI text-embedding-3-large.
Used by all 3 pipelines (market reports, stats, news).

Handles:
- Batching (100 chunks per request)
- Rate limit retries with exponential backoff
- Returns chunks with embedding vectors attached
"""

import time
from openai import OpenAI
from config.settings import OPENAI_API_KEY, EMBEDDING_MODEL


_client = OpenAI(api_key=OPENAI_API_KEY)

BATCH_SIZE    = 100   # chunks per OpenAI request
MAX_RETRIES   = 3     # retries on rate limit
RETRY_DELAY   = 5     # seconds between retries


# ── Main entry point ───────────────────────────────────────────────────────────

def embed_chunks(chunks: list[dict]) -> list[dict]:
    """
    Takes enriched chunks, adds 'embedding' field to each.
    Embeds the 'text' field (with context prefix).

    Args:
        chunks: list of chunk dicts from chunker output

    Returns:
        same chunks with 'embedding' list[float] added to each
    """
    print(f"  → Embedding {len(chunks)} chunks in batches of {BATCH_SIZE}...")

    # Split into batches
    batches = [chunks[i:i+BATCH_SIZE]
               for i in range(0, len(chunks), BATCH_SIZE)]

    embedded = []
    for batch_idx, batch in enumerate(batches):
        print(f"     Batch {batch_idx + 1}/{len(batches)} "
              f"({len(batch)} chunks)...")

        texts = [c["text"] for c in batch]
        vectors = _embed_with_retry(texts)

        for chunk, vector in zip(batch, vectors):
            chunk["embedding"] = vector
            embedded.append(chunk)

    print(f"  → Embedded {len(embedded)} chunks ✓")
    return embedded


# ── OpenAI call with retry ─────────────────────────────────────────────────────

def _embed_with_retry(texts: list[str]) -> list[list[float]]:
    """
    Call OpenAI embeddings API with exponential backoff on rate limits.
    Returns list of embedding vectors in same order as input texts.
    """
    for attempt in range(MAX_RETRIES):
        try:
            response = _client.embeddings.create(
                input=texts,
                model=EMBEDDING_MODEL,
            )
            # Sort by index to guarantee order matches input
            sorted_data = sorted(response.data, key=lambda x: x.index)
            return [item.embedding for item in sorted_data]

        except Exception as e:
            error_str = str(e).lower()
            is_rate_limit = "rate" in error_str or "429" in error_str

            if is_rate_limit and attempt < MAX_RETRIES - 1:
                wait = RETRY_DELAY * (2 ** attempt)  # 5s, 10s, 20s
                print(f"     Rate limited, retrying in {wait}s...")
                time.sleep(wait)
            else:
                raise RuntimeError(
                    f"Embedding failed after {attempt + 1} attempts: {e}"
                )

    raise RuntimeError("Embedding failed: max retries exceeded")