"""
transformer.py
Reads raw article batches from S3 market-news/inbox/.
Enriches each article: cleans text, resolves published_at, builds context prefix.
Outputs transformed batches to S3 market-news/transformed/.
Moves processed inbox files to market-news/processed/.
"""

import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Optional

from config.settings import MARKET_NEWS_S3_PATHS
from src.shared import s3_client as s3

logger = logging.getLogger(__name__)

S3_INBOX_PREFIX = MARKET_NEWS_S3_PATHS["inbox"].rstrip("/")
S3_TRANSFORMED_PREFIX = MARKET_NEWS_S3_PATHS["transformed"].rstrip("/")
S3_PROCESSED_PREFIX = MARKET_NEWS_S3_PATHS["processed"].rstrip("/")
S3_FAILED_PREFIX = MARKET_NEWS_S3_PATHS["failed"].rstrip("/")


# ── DATE RESOLUTION ───────────────────────────────────────────────────────────

_RELATIVE_PATTERNS = [
    (r"(\d+)\s*minute", lambda m: timedelta(minutes=int(m.group(1)))),
    (r"(\d+)\s*hour",   lambda m: timedelta(hours=int(m.group(1)))),
    (r"(\d+)\s*day",    lambda m: timedelta(days=int(m.group(1)))),
    (r"(\d+)\s*week",   lambda m: timedelta(weeks=int(m.group(1)))),
    (r"(\d+)\s*month",  lambda m: timedelta(days=int(m.group(1)) * 30)),
]

def _resolve_published_at(raw: str, fetched_at: str) -> Optional[str]:
    """
    Convert SERP relative date strings ("2 hours ago", "3 days ago")
    or ISO strings into a UTC ISO timestamp.
    """
    if not raw:
        return None

    # Already ISO-ish
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError):
        pass

    # Relative string — anchor to fetched_at
    try:
        anchor = datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        anchor = datetime.now(timezone.utc)

    raw_lower = raw.lower()
    for pattern, delta_fn in _RELATIVE_PATTERNS:
        m = re.search(pattern, raw_lower)
        if m:
            return (anchor - delta_fn(m)).isoformat()

    return None


# ── TEXT CLEANING ─────────────────────────────────────────────────────────────

def _clean_text(text: str) -> str:
    """Strip HTML tags, collapse whitespace, normalize quotes."""
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text)
    text = text.replace("\u2019", "'").replace("\u201c", '"').replace("\u201d", '"')
    return text.strip()


# ── CONTEXT PREFIX ────────────────────────────────────────────────────────────

def _build_context_prefix(article: dict) -> str:
    """
    Matches the prefix format used in market_reports chunker:
    'Source: {name} | Category: {cat} | Date: {date} | Title: {title} | Content: {snippet}'
    """
    parts = [
        f"Source: {article.get('source_name', 'Unknown')}",
        f"Category: {article.get('category', '')}",
        f"Date: {(article.get('published_at') or article.get('fetched_at', ''))[:10]}",
        f"Title: {article.get('title', '')}",
        f"Content: {article.get('snippet', '')}",
    ]
    return " | ".join(parts)


# ── TRANSFORM ─────────────────────────────────────────────────────────────────

def _transform_article(raw: dict) -> dict:
    """Enrich a single normalized article dict."""
    article = dict(raw)  # copy

    # Clean text fields
    article["title"] = _clean_text(article.get("title", ""))
    article["snippet"] = _clean_text(article.get("snippet", ""))

    # Resolve date
    article["published_at"] = _resolve_published_at(
        article.get("published_raw", ""),
        article.get("fetched_at", ""),
    )

    # Build embedding text — what actually gets embedded
    article["context_prefix"] = _build_context_prefix(article)

    # Pinecone metadata — keep flat, scalar values only
    article["pinecone_metadata"] = {
        "source": article.get("source_name", ""),
        "category": article.get("category", ""),
        "published_at": article.get("published_at") or article.get("fetched_at", ""),
        "title": article["title"][:200],   # Pinecone metadata value limit
        "url": article.get("url", ""),
        "pipeline": "market-news",
        "namespace": "market-news",
    }

    return article


def transform_batch(batch: dict) -> dict:
    """Transform all articles in a fetcher batch."""
    articles = batch.get("articles", [])
    transformed = []
    failed = []

    for article in articles:
        try:
            transformed.append(_transform_article(article))
        except Exception as e:
            logger.error(f"Failed to transform article {article.get('url_hash')}: {e}")
            failed.append({"article": article, "error": str(e)})

    return {
        "run_id": batch.get("run_id"),
        "fetched_at": batch.get("fetched_at"),
        "transformed_at": datetime.now(timezone.utc).isoformat(),
        "article_count": len(transformed),
        "failed_count": len(failed),
        "articles": transformed,
        "failed": failed,
    }


# ── RUNNER ────────────────────────────────────────────────────────────────────

def run_transform() -> dict:
    """
    Process all files in S3 inbox.
    Writes transformed JSON to transformed/.
    Moves inbox file to processed/.
    """
    inbox_keys = s3.list_files(prefix=S3_INBOX_PREFIX, suffix=".json")

    if not inbox_keys:
        logger.info("No files in inbox — nothing to transform")
        return {"processed": 0}

    total_articles = 0
    total_failed = 0

    for key in inbox_keys:
        logger.info(f"Transforming: {key}")
        try:
            batch = s3.download_json(key)

            transformed = transform_batch(batch)
            total_articles += transformed["article_count"]
            total_failed += transformed["failed_count"]

            # Write to transformed/
            run_id = transformed["run_id"]
            out_key = f"{S3_TRANSFORMED_PREFIX}/batch_{run_id}.json"
            s3.upload_json(transformed, out_key)

            # Move inbox → processed
            file_name = key.split("/")[-1]
            s3.move_file(key, f"{S3_PROCESSED_PREFIX}/{file_name}")

            logger.info(f"Transformed {transformed['article_count']} articles → {out_key}")

        except Exception as e:
            logger.error(f"Failed to process batch {key}: {e}")
            file_name = key.split("/")[-1]
            s3.move_file(key, f"{S3_FAILED_PREFIX}/{file_name}")

    return {"processed": total_articles, "failed": total_failed}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = run_transform()
    print(json.dumps(result, indent=2))