"""
embedder.py
Reads enriched article batches from S3 market-news/enriched/.
Deduplicates against MongoDB registry by url_hash.
Embeds via shared embed_chunks().
Upserts to Pinecone market-knowledge index, market-news namespace.
Moves enriched files to market-news/processed/.
"""

import json
import logging

from config.settings import MARKET_NEWS_S3_PATHS
from src.shared import s3_client as s3
from src.shared.embedder import embed_chunks
from src.shared import pinecone_client as pc
from src.pipelines.market_news.registry import get_registry, is_embedded, register_article

logger = logging.getLogger(__name__)

S3_ENRICHED_PREFIX  = MARKET_NEWS_S3_PATHS["enriched"].rstrip("/")
S3_PROCESSED_PREFIX = MARKET_NEWS_S3_PATHS["processed"].rstrip("/")
S3_FAILED_PREFIX    = MARKET_NEWS_S3_PATHS["failed"].rstrip("/")
PINECONE_NAMESPACE  = "market-news"
UPSERT_BATCH_SIZE   = 100


def embed_and_upsert_batch(articles: list[dict]) -> dict:
    """
    Deduplicates, embeds, and upserts a list of enriched articles.
    Uses shared embed_chunks() which expects dicts with a 'text' field.
    Upserts directly via pc._index since articles don't use the
    chunkId/rawText format that upload_chunks() expects.
    """
    registry = get_registry()

    # Deduplicate against MongoDB
    new_articles = []
    for article in articles:
        if is_embedded(registry, article["url_hash"]):
            logger.debug(f"Skipping already-embedded: {article['url_hash']}")
            continue
        new_articles.append(article)

    if not new_articles:
        logger.info("All articles already embedded — nothing to do")
        return {"embedded": 0, "skipped": len(articles)}

    logger.info(f"Embedding {len(new_articles)} articles (skipped {len(articles) - len(new_articles)})")

    # embed_chunks() expects dicts with a 'text' field
    chunks = [{"text": a["context_prefix"]} for a in new_articles]
    embedded_chunks = embed_chunks(chunks)

    # Build Pinecone vectors
    vectors = []
    for chunk, article in zip(embedded_chunks, new_articles):
        metadata = pc._clean_metadata(article["pinecone_metadata"])
        vectors.append({
            "id":       article["url_hash"],
            "values":   chunk["embedding"],
            "metadata": metadata,
        })

    # Upsert in batches
    upserted = 0
    for i in range(0, len(vectors), UPSERT_BATCH_SIZE):
        batch = vectors[i : i + UPSERT_BATCH_SIZE]
        pc._index.upsert(vectors=batch, namespace=PINECONE_NAMESPACE)
        upserted += len(batch)
        logger.info(f"Upserted {upserted}/{len(vectors)} vectors")

    # Register in MongoDB
    for article in new_articles:
        register_article(
            registry=registry,
            url_hash=article["url_hash"],
            url=article.get("url", ""),
            title=article.get("title", ""),
            source=article.get("source_name", ""),
            category=article.get("category", ""),
            published_at=article.get("published_at") or article.get("fetched_at", ""),
            namespace=PINECONE_NAMESPACE,
        )

    return {
        "embedded": len(new_articles),
        "skipped": len(articles) - len(new_articles),
        "upserted_vectors": upserted,
    }


def run_embed() -> dict:
    """Process all files in S3 enriched/, embed and upsert, move to processed/."""
    enriched_keys = s3.list_files(prefix=S3_ENRICHED_PREFIX, suffix=".json")

    if not enriched_keys:
        logger.info("No files in enriched/ — nothing to embed")
        return {"processed": 0}

    total_embedded = 0
    total_skipped  = 0

    for key in enriched_keys:
        logger.info(f"Processing: {key}")
        try:
            batch    = s3.download_json(key)
            articles = batch.get("articles", [])

            if not articles:
                logger.warning(f"Empty article list in {key}")
                continue

            stats           = embed_and_upsert_batch(articles)
            total_embedded += stats["embedded"]
            total_skipped  += stats["skipped"]

            file_name = key.split("/")[-1]
            s3.move_file(key, f"{S3_PROCESSED_PREFIX}/{file_name}")
            logger.info(f"Done — embedded: {stats['embedded']}, skipped: {stats['skipped']}")

        except Exception as e:
            logger.error(f"Failed to process {key}: {e}")
            file_name = key.split("/")[-1]
            s3.move_file(key, f"{S3_FAILED_PREFIX}/{file_name}")

    return {"total_embedded": total_embedded, "total_skipped": total_skipped}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = run_embed()
    print(json.dumps(result, indent=2))