import os
from dotenv import load_dotenv

load_dotenv()

# AWS / S3 — optional for pipelines that don't need S3 (e.g. IMF fetches
# directly from a public API and only uses S3 as an audit-trail copy).
# Same .get()-with-default pattern as Mongo/OpenAI/Pinecone below, so
# importing this module never crashes just because AWS isn't configured.
AWS_REGION = os.environ.get("AWS_REGION", "")
S3_BUCKET  = os.environ.get("S3_BUCKET_NAME", "")

# S3 folder structure — single source of truth
S3_PATHS = {
    "inbox":     "market-reports/inbox/",
    "parsed":    "market-reports/parsed/",
    "chunks":    "market-reports/chunks/",
    "enriched":  "market-reports/enriched/",
    "processed": "market-reports/processed/",
    "failed":    "market-reports/failed/",
}
#S3 folder structure for market news — single source of truth
MARKET_NEWS_S3_PATHS = {
    "inbox":       "market-news/inbox/",
    "transformed": "market-news/transformed/",
    "enriched":    "market-news/enriched/",
    "processed":   "market-news/processed/",
    "failed":      "market-news/failed/",
}

# MongoDB
MONGODB_URI         = os.environ.get("MONGODB_URI", "")
MONGODB_DB          = os.environ.get("MONGODB_DB_NAME", "")
REGISTRY_COLLECTION = "market_reports_registry"

# OpenAI
OPENAI_API_KEY  = os.environ.get("OPENAI_API_KEY", "")
EMBEDDING_MODEL = "text-embedding-3-large"

# Pinecone
PINECONE_API_KEY = os.environ.get("PINECONE_API_KEY", "")
PINECONE_INDEX   = os.environ.get("PINECONE_INDEX_NAME", "")