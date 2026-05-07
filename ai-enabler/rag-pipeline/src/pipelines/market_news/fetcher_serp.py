"""
fetcher_serp.py
Fetches news articles via SERP API (Google News) across 6 signal categories.
Outputs normalized article dicts to S3 market-news/inbox/.
"""

import os
import json
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional
import requests
from config.settings import MARKET_NEWS_S3_PATHS

from src.shared import s3_client as s3

logger = logging.getLogger(__name__)

# ── S3 ────────────────────────────────────────────────────────────────────────
S3_INBOX_PREFIX = MARKET_NEWS_S3_PATHS["inbox"].rstrip("/")

# ── SERP API ──────────────────────────────────────────────────────────────────
SERP_API_KEY = os.environ["SERP_API_KEY"]
SERP_API_URL = "https://serpapi.com/search"
RESULTS_PER_QUERY = 20  # 2 pages × 10; bump to 30 for deeper runs

# ── SOURCE ALLOWLIST ──────────────────────────────────────────────────────────
# Matched against article source name (case-insensitive) and/or domain.
# Tier 1 — Core financial/labor
# Tier 2 — Industry & Tech
# Tier 3 — Macro & Policy
# Tier 4 — Finance & Markets
# Tier 5 — Workforce & HR
# Tier 6 — Education & Skills

ALLOWED_SOURCES = {
    # Tier 1
    "bloomberg", "bloomberg.com",
    "reuters", "reuters.com",
    "financial times", "ft.com",
    "wall street journal", "wsj.com",
    "cnbc", "cnbc.com",
    "fortune", "fortune.com",
    "the economist", "economist.com",
    "yahoo finance", "yahoo finance",
    "associated press", "apnews.com",
    # Tier 2
    "techcrunch", "techcrunch.com",
    "the information", "theinformation.com",
    "wired", "wired.com",
    "ars technica", "arstechnica.com",
    "venturebeat", "venturebeat.com",
    "business insider", "businessinsider.com",
    "fast company", "fastcompany.com",
    "mit technology review", "technologyreview.com",
    "harvard business review", "hbr.org",
    # Tier 3
    "politico", "politico.com",
    "axios", "axios.com",
    "the hill", "thehill.com",
    "npr", "npr.org",
    "bbc", "bbc.com", "bbc.co.uk",
    "foreign policy", "foreignpolicy.com",
    "foreign affairs", "foreignaffairs.com",
    "washington post", "washingtonpost.com",
    "new york times", "nytimes.com",
    # Tier 4
    "marketwatch", "marketwatch.com",
    "morningstar", "morningstar.com",
    "barron's", "barrons.com",
    "seeking alpha", "seekingalpha.com",
    "nasdaq", "nasdaq.com",
    "investopedia", "investopedia.com",
    "cfo dive", "cfodive.com",
    # Tier 5
    "shrm", "shrm.org",
    "hr dive", "hrdive.com",
    "worklife", "worklife.news",
    "linkedin news", "linkedin.com",
    "glassdoor", "glassdoor.com",
    "indeed", "indeed.com",
    "challenger", "challengergray.com",
    # Tier 6
    "edsurge", "edsurge.com",
    "inside higher ed", "insidehighered.com",
    "chronicle of higher education", "chronicle.com",
    "coursera", "coursera.org",
}

# ── QUERY TAXONOMY ────────────────────────────────────────────────────────────
QUERIES = {
    "labor_workforce": [
        "tech layoffs 2025",
        "mass layoffs announcement 2025",
        "hiring freeze 2025",
        "workforce reduction 2025",
        "company downsizing 2025",
        "job cuts announcement 2025",
        "tech hiring surge 2025",
        "companies expanding hiring 2025",
        "wage growth outlook 2025",
        "remote work trends 2025",
        "worker shortage industries 2025",
        "union strikes labor 2025",
        "white collar unemployment 2025",
        "job market outlook 2025",
    ],
    "industry_verticals": [
        "tech sector hiring outlook 2025",
        "finance banking layoffs 2025",
        "healthcare jobs demand 2025",
        "manufacturing jobs outlook 2025",
        "energy sector workforce 2025",
        "retail industry layoffs 2025",
        "consulting firm hiring 2025",
        "biotech pharma hiring 2025",
        "real estate industry jobs 2025",
        "defense industry hiring 2025",
    ],
    "ai_automation": [
        "AI replacing jobs 2025",
        "AI workforce impact 2025",
        "automation job displacement 2025",
        "AI skills demand 2025",
        "generative AI jobs created 2025",
        "AI adoption enterprise 2025",
        "machine learning engineer demand 2025",
        "AI tools replacing white collar workers",
        "future of work AI automation",
        "upskilling AI workforce 2025",
    ],
    "macro_economics": [
        "Federal Reserve interest rates jobs 2025",
        "recession risk workforce 2025",
        "inflation impact employment 2025",
        "GDP growth hiring outlook 2025",
        "VC funding startup hiring 2025",
        "stock market crash layoffs",
        "economic slowdown job market",
        "credit crunch business hiring",
        "corporate earnings workforce 2025",
        "private equity portfolio layoffs 2025",
    ],
    "geopolitics_trade": [
        "US China trade war jobs impact 2025",
        "tariffs manufacturing jobs 2025",
        "supply chain reshoring jobs 2025",
        "offshoring jobs overseas 2025",
        "sanctions economic impact workforce",
        "immigration H1B visa tech jobs 2025",
        "nearshoring workforce trends 2025",
        "geopolitical risk business hiring",
        "Europe recession jobs 2025",
        "emerging markets workforce growth 2025",
    ],
    "policy_regulation": [
        "labor law changes 2025",
        "minimum wage increase impact jobs",
        "AI regulation workforce impact 2025",
        "fintech regulation hiring 2025",
        "healthcare regulation jobs 2025",
        "tax policy business hiring 2025",
        "infrastructure spending jobs 2025",
        "climate policy green jobs 2025",
        "antitrust tech companies workforce",
        "data privacy regulation compliance jobs",
    ],
    "education_skills": [
        "most in demand skills 2025",
        "coding bootcamp enrollment 2025",
        "computer science degree demand 2025",
        "MBA demand job market 2025",
        "certification skills workforce 2025",
        "reskilling upskilling programs 2025",
        "STEM jobs outlook 2025",
        "trade skills shortage 2025",
        "online learning workforce training 2025",
        "skills gap employers 2025",
    ],
}


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def _is_allowed_source(source_name: str) -> bool:
    """Case-insensitive match against allowlist."""
    normalized = source_name.lower().strip()
    return any(normalized in allowed or allowed in normalized for allowed in ALLOWED_SOURCES)


def _fetch_query(query: str, num_results: int = RESULTS_PER_QUERY) -> list[dict]:
    """Call SERP API Google News for a single query. Returns raw results list."""
    params = {
        "engine": "google_news",
        "q": query,
        "num": num_results,
        "api_key": SERP_API_KEY,
    }
    try:
        resp = requests.get(SERP_API_URL, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        return data.get("news_results", [])
    except requests.RequestException as e:
        logger.error(f"SERP API request failed for query '{query}': {e}")
        return []


def _normalize_article(raw: dict, category: str, query: str) -> Optional[dict]:
    """
    Normalize a raw SERP news result into our article schema.
    Returns None if source is not in allowlist or URL missing.
    """
    url = raw.get("link", "")
    if not url:
        return None

    source_name = raw.get("source", {}).get("name", "") if isinstance(raw.get("source"), dict) else raw.get("source", "")

    if not _is_allowed_source(source_name):
        return None

    # Parse published date — SERP returns relative strings like "2 hours ago"
    # Store as ISO string; transformer.py will normalize further
    published_raw = raw.get("date", "")

    return {
        "url": url,
        "url_hash": _url_hash(url),
        "title": raw.get("title", "").strip(),
        "snippet": raw.get("snippet", "").strip(),
        "source_name": source_name,
        "published_raw": published_raw,
        "category": category,       # signal category tag → Pinecone metadata
        "query": query,             # which query surfaced this
        "thumbnail": raw.get("thumbnail", ""),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }


# ── MAIN FETCH ────────────────────────────────────────────────────────────────

def fetch_all(dry_run: bool = False) -> dict:
    """
    Run all queries across all categories.
    Deduplicates by URL hash within the run.
    Uploads a single batch JSON to S3 market-news/inbox/.
    Returns summary stats.
    """
    seen_hashes: set[str] = set()
    articles: list[dict] = []
    stats = {
        "total_raw": 0,
        "filtered_source": 0,
        "filtered_duplicate": 0,
        "kept": 0,
        "by_category": {},
    }

    for category, queries in QUERIES.items():
        cat_count = 0
        logger.info(f"Fetching category: {category} ({len(queries)} queries)")

        for query in queries:
            raw_results = _fetch_query(query)
            stats["total_raw"] += len(raw_results)

            for raw in raw_results:
                article = _normalize_article(raw, category, query)

                if article is None:
                    stats["filtered_source"] += 1
                    continue

                if article["url_hash"] in seen_hashes:
                    stats["filtered_duplicate"] += 1
                    continue

                seen_hashes.add(article["url_hash"])
                articles.append(article)
                cat_count += 1

        stats["by_category"][category] = cat_count
        stats["kept"] += cat_count

    logger.info(f"Fetch complete. Kept {stats['kept']} / {stats['total_raw']} raw articles")

    if dry_run:
        logger.info("Dry run — skipping S3 upload")
        return stats

    if not articles:
        logger.warning("No articles to upload")
        return stats

    # Upload single batch to S3 inbox
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    s3_key = f"{S3_INBOX_PREFIX}/batch_{run_id}.json"

    payload = {
        "run_id": run_id,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "article_count": len(articles),
        "stats": stats,
        "articles": articles,
    }

    s3.upload_json(payload, s3_key)
    logger.info(f"Uploaded batch to s3://{s3_key}")

    return stats


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = fetch_all()
    print(json.dumps(result, indent=2))