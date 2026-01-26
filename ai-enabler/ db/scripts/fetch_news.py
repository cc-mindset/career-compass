#!/usr/bin/env python3
"""
fetch_news.py - Fetch employment news from credible sources

Usage:
    python fetch_news.py              # Fetch last 30 days (first run)
    python fetch_news.py --days 7     # Fetch last 7 days (weekly update)
"""

import os
import json
import hashlib
import argparse
from datetime import datetime, timedelta
from typing import List, Set, Dict

from eventregistry import EventRegistry, QueryArticlesIter, QueryItems
from config import (
    NEWS_API_KEY, NEWS_CATEGORIES, APPROVED_NEWS_SOURCES,
    NEWS_FETCHED_FILE, NEWS_MAX_PER_CATEGORY, NEWS_FETCH_DAYS
)


def generate_article_id(article: dict) -> str:
    """Generate unique ID for article based on URL and title."""
    url = article.get('url', '')
    title = article.get('title', '')
    content = f"{url}|{title}"
    return hashlib.md5(content.encode()).hexdigest()


def get_approved_source_uris(er: EventRegistry) -> List[str]:
    """Get Event Registry URIs for approved news sources."""
    source_uris = []
    
    print(f"\n🔍 Resolving {len(APPROVED_NEWS_SOURCES)} approved sources...")
    for source_name in APPROVED_NEWS_SOURCES:
        try:
            uri = er.getNewsSourceUri(source_name)
            if uri:
                source_uris.append(uri)
        except:
            pass
    
    print(f"   ✅ Found {len(source_uris)} matching sources")
    return source_uris


def fetch_category_news(
    er: EventRegistry,
    category_name: str,
    keywords: List[str],
    source_uris: List[str],
    days_back: int,
    max_articles: int
) -> List[dict]:
    """Fetch news for a specific keyword category."""
    
    print(f"\n🔍 {category_name}")
    print(f"   Keywords: {', '.join(keywords[:5])}...")
    
    try:
        # Build query
        keyword_query = QueryItems.OR(keywords[:7])  # Limit to 7 keywords
        
        query_params = {
            'keywords': keyword_query,
            'lang': 'eng',
            'dataType': ['news'],
            'dateStart': (datetime.now() - timedelta(days=days_back)).date(),
            'dateEnd': datetime.now().date(),
        }
        
        # Filter by approved sources ONLY (saves API credits!)
        if source_uris:
            query_params['sourceUri'] = QueryItems.OR(source_uris)
        
        # US/Canada only
        query_params['sourceLocationUri'] = QueryItems.OR([
            er.getLocationUri("United States"),
            er.getLocationUri("Canada")
        ])
        
        # Fetch articles
        q = QueryArticlesIter(**query_params)
        articles = []
        
        for article in q.execQuery(er, sortBy="date", maxItems=max_articles):
            article['category'] = category_name
            article['id'] = generate_article_id(article)
            articles.append(article)
        
        print(f"   ✅ {len(articles)} articles")
        return articles
        
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        return []


def fetch_all_news(days_back: int) -> Dict:
    """Fetch news from all categories and save to JSON."""
    
    print("=" * 70)
    print("FETCH NEWS - Uses Event Registry API credits")
    print("=" * 70)
    print(f"📅 Fetching last {days_back} days")
    print(f"🎯 {len(NEWS_CATEGORIES)} categories")
    print(f"✅ Only from {len(APPROVED_NEWS_SOURCES)} approved sources")
    
    er = EventRegistry(apiKey=NEWS_API_KEY)
    source_uris = get_approved_source_uris(er)
    
    # Fetch from all categories
    all_articles = []
    category_counts = {}
    
    for category, keywords in NEWS_CATEGORIES.items():
        articles = fetch_category_news(
            er, category, keywords, source_uris,
            days_back, NEWS_MAX_PER_CATEGORY
        )
        all_articles.extend(articles)
        category_counts[category] = len(articles)
    
    # Deduplicate
    print(f"\n🔄 Deduplicating...")
    unique = {a['id']: a for a in all_articles}
    unique_articles = list(unique.values())
    
    print(f"\n📊 SUMMARY:")
    print(f"   Total fetched: {len(all_articles)}")
    print(f"   Unique: {len(unique_articles)}")
    print(f"   Duplicates removed: {len(all_articles) - len(unique_articles)}")
    
    # Source verification
    sources = set(a.get('source', {}).get('title', 'Unknown') for a in unique_articles)
    print(f"\n📰 SOURCES ({len(sources)} unique):")
    for source in sorted(sources):
        count = sum(1 for a in unique_articles if a.get('source', {}).get('title') == source)
        print(f"   • {source}: {count} articles")
    
    # Save to JSON
    data = {
        'metadata': {
            'fetched_at': datetime.now().isoformat(),
            'days_back': days_back,
            'total_articles': len(unique_articles),
            'categories': category_counts,
            'sources': list(sources)
        },
        'articles': unique_articles
    }
    
    with open(NEWS_FETCHED_FILE, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"\n✅ Saved {len(unique_articles)} articles to {NEWS_FETCHED_FILE}")
    
    # Preview
    print(f"\n📰 PREVIEW (first 5):")
    for i, article in enumerate(unique_articles[:5], 1):
        print(f"\n{i}. {article.get('title', 'No title')[:70]}")
        print(f"   Source: {article.get('source', {}).get('title')}")
        print(f"   Date: {article.get('date')}")
        print(f"   Category: {article.get('category')}")
    
    print(f"\n{'=' * 70}")
    print(f"Next step: python upload_news.py")
    print(f"{'=' * 70}")
    
    return data


def main():
    parser = argparse.ArgumentParser(description="Fetch employment news")
    parser.add_argument(
        '--days',
        type=int,
        default=NEWS_FETCH_DAYS,
        help=f'Days to fetch (default: {NEWS_FETCH_DAYS})'
    )
    
    args = parser.parse_args()
    fetch_all_news(args.days)


if __name__ == "__main__":
    main()
