"""
enricher.py
Enriches transformed articles with AI-generated metadata using GPT-4o-mini.
- Multi-category tagging (an article can belong to multiple signal categories)
- Sentiment classification
- Signal type classification
- Relevance scoring (articles below threshold are dropped before embedding)

Runs after transformer.py, before embedder.py.
Reads from S3 market-news/transformed/, writes to market-news/enriched/.
"""

import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

from openai import OpenAI
from config.settings import MARKET_NEWS_S3_PATHS

from src.shared import s3_client as s3

logger = logging.getLogger(__name__)

S3_TRANSFORMED_PREFIX = MARKET_NEWS_S3_PATHS["transformed"].rstrip("/")
S3_ENRICHED_PREFIX = MARKET_NEWS_S3_PATHS["enriched"].rstrip("/")
S3_PROCESSED_PREFIX = MARKET_NEWS_S3_PATHS["processed"].rstrip("/")
S3_FAILED_PREFIX = MARKET_NEWS_S3_PATHS["failed"].rstrip("/")

OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
ENRICHMENT_MODEL = "gpt-4o-mini"
BATCH_SIZE = 20          # articles per GPT call
RELEVANCE_THRESHOLD = 0.5  # drop articles below this score
MAX_RETRIES = 3
RETRY_DELAY = 2.0        # seconds between retries

VALID_CATEGORIES = [
    "labor_workforce",
    "industry_verticals",
    "ai_automation",
    "macro_economics",
    "geopolitics_trade",
    "policy_regulation",
    "education_skills",
]

VALID_SENTIMENTS = ["positive", "negative", "neutral", "mixed"]

VALID_SIGNAL_TYPES = [
    "contraction",      # layoffs, hiring freeze, downsizing
    "expansion",        # hiring surge, new roles, growth
    "displacement",     # AI/automation replacing roles
    "policy_change",    # regulation, law, government action
    "macro_shift",      # rates, recession, inflation
    "skills_demand",    # what skills are needed
    "geopolitical",     # trade, sanctions, reshoring
    "neutral_info",     # informational, no clear directional signal
]

# ── PROMPT ────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a career intelligence analyst. You classify news articles by their relevance and signal type for a career guidance system that helps people understand job market risks and opportunities.

For each article you receive, return a JSON array where each element corresponds to the input article at the same index. Each element must have exactly these fields:

{
  "categories": [list of 1-3 categories from the allowed list],
  "sentiment": one of: positive, negative, neutral, mixed,
  "signal_type": one of the allowed signal types,
  "relevance_score": float 0.0-1.0 (how useful is this for career/job market intelligence),
  "relevance_reason": string, max 15 words explaining the score
}

Allowed categories: labor_workforce, industry_verticals, ai_automation, macro_economics, geopolitics_trade, policy_regulation, education_skills

Allowed signal_types: contraction, expansion, displacement, policy_change, macro_shift, skills_demand, geopolitical, neutral_info

Relevance scoring guide:
- 0.9-1.0: Directly about hiring, layoffs, job demand, workforce changes
- 0.7-0.8: Indirectly affects employment (Fed rates, trade policy, AI adoption)
- 0.5-0.6: Weakly relevant, background context only
- 0.0-0.4: Not relevant to career intelligence (sports, entertainment, unrelated news)

Return ONLY the JSON array. No preamble, no markdown, no explanation."""


def _build_user_prompt(articles: list[dict]) -> str:
    """Build the user message with article batch."""
    lines = []
    for i, article in enumerate(articles):
        lines.append(f"[{i}] Title: {article.get('title', '')}")
        lines.append(f"    Source: {article.get('source_name', '')}")
        lines.append(f"    Snippet: {article.get('snippet', '')[:200]}")
        lines.append("")
    return "\n".join(lines)


# ── ENRICHMENT ────────────────────────────────────────────────────────────────

def _enrich_batch(
    client: OpenAI,
    articles: list[dict],
) -> Optional[list[dict]]:
    """
    Send a batch of articles to GPT-4o-mini for enrichment.
    Returns list of enrichment dicts aligned with input articles.
    Returns None on failure.
    """
    user_prompt = _build_user_prompt(articles)

    for attempt in range(MAX_RETRIES):
        try:
            response = client.chat.completions.create(
                model=ENRICHMENT_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.1,   # low temp for consistent classification
                max_tokens=1500,
            )

            raw = response.choices[0].message.content.strip()

            # Strip markdown fences if present
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()

            enrichments = json.loads(raw)

            if not isinstance(enrichments, list) or len(enrichments) != len(articles):
                logger.warning(f"Enrichment response length mismatch: got {len(enrichments)}, expected {len(articles)}")
                return None

            return enrichments

        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse error on attempt {attempt + 1}: {e}")
        except Exception as e:
            logger.warning(f"GPT call failed on attempt {attempt + 1}: {e}")

        if attempt < MAX_RETRIES - 1:
            time.sleep(RETRY_DELAY)

    return None


def _apply_enrichment(article: dict, enrichment: dict) -> dict:
    """Merge enrichment fields into article dict."""
    article = dict(article)

    # Validate and apply categories
    raw_cats = enrichment.get("categories", [])
    valid_cats = [c for c in raw_cats if c in VALID_CATEGORIES]
    article["categories"] = valid_cats if valid_cats else [article.get("category", "labor_workforce")]

    # Validate sentiment
    sentiment = enrichment.get("sentiment", "neutral")
    article["sentiment"] = sentiment if sentiment in VALID_SENTIMENTS else "neutral"

    # Validate signal_type
    signal_type = enrichment.get("signal_type", "neutral_info")
    article["signal_type"] = signal_type if signal_type in VALID_SIGNAL_TYPES else "neutral_info"

    # Relevance score
    try:
        article["relevance_score"] = float(enrichment.get("relevance_score", 0.5))
    except (ValueError, TypeError):
        article["relevance_score"] = 0.5

    article["relevance_reason"] = enrichment.get("relevance_reason", "")
    article["enriched_at"] = datetime.now(timezone.utc).isoformat()

    # Update Pinecone metadata with enriched fields
    # Pinecone metadata must be flat scalars — store categories as comma-separated string
    article["pinecone_metadata"].update({
        "categories": ",".join(article["categories"]),   # "labor_workforce,macro_economics"
        "sentiment": article["sentiment"],
        "signal_type": article["signal_type"],
        "relevance_score": article["relevance_score"],
    })

    return article


def enrich_articles(articles: list[dict]) -> dict:
    """
    Enrich all articles in a transformed batch.
    Drops articles below RELEVANCE_THRESHOLD.
    Returns enriched articles + stats.
    """
    client = OpenAI(api_key=OPENAI_API_KEY)

    enriched = []
    dropped = []
    failed_enrichment = []

    total = len(articles)
    logger.info(f"Enriching {total} articles in batches of {BATCH_SIZE}")

    for i in range(0, total, BATCH_SIZE):
        batch = articles[i : i + BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
        logger.info(f"Enriching batch {batch_num}/{total_batches} ({len(batch)} articles)")

        enrichments = _enrich_batch(client, batch)

        if enrichments is None:
            # GPT failed for this batch — keep articles with defaults
            logger.warning(f"Enrichment failed for batch {batch_num}, using defaults")
            for article in batch:
                article["categories"] = [article.get("category", "labor_workforce")]
                article["sentiment"] = "neutral"
                article["signal_type"] = "neutral_info"
                article["relevance_score"] = 0.5
                article["relevance_reason"] = "enrichment failed"
                article["enriched_at"] = datetime.now(timezone.utc).isoformat()
                article["pinecone_metadata"].update({
                    "categories": article["categories"][0],
                    "sentiment": "neutral",
                    "signal_type": "neutral_info",
                    "relevance_score": 0.5,
                })
                failed_enrichment.append(article)
                enriched.append(article)
            continue

        for article, enrichment in zip(batch, enrichments):
            enriched_article = _apply_enrichment(article, enrichment)

            if enriched_article["relevance_score"] < RELEVANCE_THRESHOLD:
                logger.debug(
                    f"Dropping low-relevance article ({enriched_article['relevance_score']:.2f}): "
                    f"{enriched_article.get('title', '')[:60]}"
                )
                dropped.append(enriched_article)
            else:
                enriched.append(enriched_article)

        # Small delay to avoid rate limits
        if i + BATCH_SIZE < total:
            time.sleep(0.3)

    stats = {
        "total_input": total,
        "enriched": len(enriched),
        "dropped_low_relevance": len(dropped),
        "failed_enrichment": len(failed_enrichment),
        "category_distribution": _count_categories(enriched),
        "sentiment_distribution": _count_field(enriched, "sentiment"),
        "signal_type_distribution": _count_field(enriched, "signal_type"),
    }

    logger.info(
        f"Enrichment complete — kept: {len(enriched)}, "
        f"dropped: {len(dropped)}, failed: {len(failed_enrichment)}"
    )

    return {"articles": enriched, "dropped": dropped, "stats": stats}


def _count_categories(articles: list[dict]) -> dict:
    """Count articles per category (multi-tag aware)."""
    counts = {cat: 0 for cat in VALID_CATEGORIES}
    for article in articles:
        for cat in article.get("categories", []):
            if cat in counts:
                counts[cat] += 1
    return counts


def _count_field(articles: list[dict], field: str) -> dict:
    counts = {}
    for article in articles:
        val = article.get(field, "unknown")
        counts[val] = counts.get(val, 0) + 1
    return counts


# ── RUNNER ────────────────────────────────────────────────────────────────────

def run_enrich() -> dict:
    """
    Process all files in S3 transformed/.
    Writes enriched JSON to enriched/.
    Moves transformed files to processed/ after enrichment.
    """
    transformed_keys = s3.list_files(prefix=S3_TRANSFORMED_PREFIX, suffix=".json")

    if not transformed_keys:
        logger.info("No files in transformed/ — nothing to enrich")
        return {"processed": 0}

    total_enriched = 0
    total_dropped = 0

    for key in transformed_keys:
        logger.info(f"Enriching: {key}")
        try:
            batch = s3.download_json(key)
            articles = batch.get("articles", [])

            if not articles:
                logger.warning(f"Empty article list in {key}")
                continue

            result = enrich_articles(articles)
            total_enriched += result["stats"]["enriched"]
            total_dropped += result["stats"]["dropped_low_relevance"]

            # Write enriched batch
            run_id = batch.get("run_id")
            out_key = f"{S3_ENRICHED_PREFIX}/batch_{run_id}.json"
            s3.upload_json({
                "run_id": run_id,
                "enriched_at": datetime.now(timezone.utc).isoformat(),
                "article_count": result["stats"]["enriched"],
                "stats": result["stats"],
                "articles": result["articles"],
            }, out_key)

            # Move transformed →e processed
            file_name = key.split("/")[-1]
            s3.move_file(key, f"{S3_PROCESSED_PREFIX}/{file_name}")

            logger.info(f"Enriched batch → {out_key}")

        except Exception as e:
            logger.error(f"Failed to enrich batch {key}: {e}")
            file_name = key.split("/")[-1]
            s3.move_file(key, f"{S3_FAILED_PREFIX}/{file_name}")

    return {"total_enriched": total_enriched, "total_dropped": total_dropped}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = run_enrich()
    print(json.dumps(result, indent=2))