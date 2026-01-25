#!/usr/bin/env python3
"""
upload_news.py - Upload fetched news to Pinecone

Usage:
    python upload_news.py              # Upload new articles only
    python upload_news.py --force      # Re-upload all articles
"""

import os
import json
import argparse
from datetime import datetime
from typing import List, Set

from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_core.documents import Document
from config import (
    OPENAI_API_KEY, PINECONE_API_KEY,
    INDEX_NAME, NAMESPACE_NEWS,
    NEWS_FETCHED_FILE, NEWS_UPLOADED_FILE
)

# Set environment variables
os.environ["PINECONE_API_KEY"] = PINECONE_API_KEY
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY


def load_fetched_news() -> tuple[List[dict], dict]:
    """Load fetched news from JSON."""
    if not os.path.exists(NEWS_FETCHED_FILE):
        print(f"❌ No fetched news found. Run fetch_news.py first.")
        return [], {}
    
    with open(NEWS_FETCHED_FILE, 'r') as f:
        data = json.load(f)
        return data.get('articles', []), data.get('metadata', {})


def load_uploaded_ids() -> Set[str]:
    """Load IDs of already uploaded articles."""
    if os.path.exists(NEWS_UPLOADED_FILE):
        with open(NEWS_UPLOADED_FILE, 'r') as f:
            data = json.load(f)
            return set(data.get('article_ids', []))
    return set()


def save_uploaded_ids(ids: Set[str]):
    """Save IDs of uploaded articles."""
    with open(NEWS_UPLOADED_FILE, 'w') as f:
        json.dump({
            'article_ids': list(ids),
            'last_updated': datetime.now().isoformat(),
            'total_count': len(ids)
        }, f, indent=2)


def upload_to_pinecone(force_reupload: bool = False):
    """Upload news articles to Pinecone."""
    
    print("=" * 70)
    print("UPLOAD NEWS - Uses OpenAI embedding credits")
    print("=" * 70)
    
    # Load articles
    articles, metadata = load_fetched_news()
    if not articles:
        return
    
    print(f"\n📂 Loaded {len(articles)} articles")
    print(f"   Fetched: {metadata.get('fetched_at')}")
    
    # Filter already uploaded
    uploaded_ids = load_uploaded_ids()
    print(f"   Already uploaded: {len(uploaded_ids)}")
    
    if force_reupload:
        new_articles = articles
        print(f"   🔄 Force re-upload: {len(new_articles)} articles")
    else:
        new_articles = [a for a in articles if a.get('id') not in uploaded_ids]
        print(f"   ✅ New to upload: {len(new_articles)} articles")
    
    if not new_articles:
        print("\n✅ No new articles to upload!")
        return
    
    # Convert to documents
    print(f"\n🔄 Converting to embeddings...")
    documents = []
    
    for article in new_articles:
        # Embed first 1000 chars of body to save costs
        body = article.get('body', '')[:1000]
        
        doc_text = f"""Title: {article.get('title', '')}
Source: {article.get('source', {}).get('title', '')}
Date: {article.get('date', '')}
URL: {article.get('url', '')}

{body}"""
        
        doc_metadata = {
            'id': article.get('id'),
            'url': article.get('url', ''),
            'title': article.get('title', ''),
            'source': article.get('source', {}).get('title', ''),
            'date': article.get('date', ''),
            'category': article.get('category', ''),
            'sentiment': article.get('sentiment', 0),
            'added_at': datetime.now().isoformat()
        }
        
        documents.append(Document(page_content=doc_text, metadata=doc_metadata))
    
    # Estimate cost
    total_chars = sum(len(doc.page_content) for doc in documents)
    est_tokens = total_chars / 4
    est_cost = (est_tokens / 1000) * 0.00002
    
    print(f"\n💰 EMBEDDING COST:")
    print(f"   Characters: {total_chars:,}")
    print(f"   Tokens: ~{int(est_tokens):,}")
    print(f"   Cost: ~${est_cost:.4f}")
    
    # Upload
    print(f"\n☁️  Uploading to Pinecone...")
    print(f"   Index: {INDEX_NAME}")
    print(f"   Namespace: {NAMESPACE_NEWS}")
    
    try:
        embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        
        vectorstore = PineconeVectorStore.from_documents(
            documents=documents,
            embedding=embeddings,
            index_name=INDEX_NAME,
            namespace=NAMESPACE_NEWS
        )
        
        print(f"   ✅ Uploaded {len(documents)} documents!")
        
        # Save uploaded IDs
        new_ids = {a.get('id') for a in new_articles}
        uploaded_ids.update(new_ids)
        save_uploaded_ids(uploaded_ids)
        
        print(f"\n✅ UPLOAD COMPLETE!")
        print(f"   Total in Pinecone: {len(uploaded_ids)} articles")
        
    except Exception as e:
        print(f"\n❌ Upload failed: {str(e)}")
        raise


def main():
    parser = argparse.ArgumentParser(description="Upload news to Pinecone")
    parser.add_argument(
        '--force',
        action='store_true',
        help='Re-upload all articles (even if already uploaded)'
    )
    
    args = parser.parse_args()
    upload_to_pinecone(force_reupload=args.force)


if __name__ == "__main__":
    main()
