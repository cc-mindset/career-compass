#!/usr/bin/env python3
"""
update_bls.py - Fetch and upload BLS employment statistics

Usage:
    python update_bls.py              # Update if 14+ days since last update
    python update_bls.py --force      # Force update now
"""

import os
import json
import requests
import argparse
from datetime import datetime, timedelta
from typing import List, Dict

from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_core.documents import Document
from pinecone import Pinecone
from config import (
    BLS_API_KEY, OPENAI_API_KEY, PINECONE_API_KEY,
    INDEX_NAME, NAMESPACE_BLS, BLS_SERIES_IDS,
    BLS_TRACKING_FILE, BLS_UPDATE_DAYS
)

# Set environment variables
os.environ["PINECONE_API_KEY"] = PINECONE_API_KEY
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY

BLS_API_URL = "https://api.bls.gov/publicAPI/v2/timeseries/data/"


def load_last_update() -> datetime:
    """Load timestamp of last BLS update."""
    if os.path.exists(BLS_TRACKING_FILE):
        with open(BLS_TRACKING_FILE, 'r') as f:
            data = json.load(f)
            return datetime.fromisoformat(data['last_update'])
    return None


def save_last_update():
    """Save current timestamp."""
    with open(BLS_TRACKING_FILE, 'w') as f:
        json.dump({'last_update': datetime.now().isoformat()}, f)


def should_update(force: bool = False) -> bool:
    """Check if we should update BLS data."""
    if force:
        print("🔄 Force update requested")
        return True
    
    last_update = load_last_update()
    if not last_update:
        print("📅 No previous update found")
        return True
    
    days_since = (datetime.now() - last_update).days
    print(f"📅 Last update: {last_update.strftime('%Y-%m-%d')} ({days_since} days ago)")
    
    if days_since >= BLS_UPDATE_DAYS:
        print(f"✅ Time to update (threshold: {BLS_UPDATE_DAYS} days)")
        return True
    else:
        print(f"⏳ Too soon. Next update in {BLS_UPDATE_DAYS - days_since} days")
        return False


def fetch_bls_data(series_ids: List[str], start_year: int, end_year: int) -> Dict:
    """Fetch BLS data for given series."""
    
    headers = {'Content-type': 'application/json'}
    data = json.dumps({
        "seriesid": series_ids,
        "startyear": str(start_year),
        "endyear": str(end_year),
        "registrationkey": BLS_API_KEY
    })
    
    response = requests.post(BLS_API_URL, data=data, headers=headers)
    
    if response.status_code != 200:
        raise Exception(f"BLS API error: {response.status_code}")
    
    result = response.json()
    
    if result['status'] != 'REQUEST_SUCCEEDED':
        raise Exception(f"BLS API request failed: {result.get('message', 'Unknown error')}")
    
    return result


def categorize_series(series_id: str) -> str:
    """Categorize BLS series by type."""
    if series_id.startswith('JTS') and 'JOL' in series_id:
        return 'job_openings'
    elif series_id.startswith('JTS') and 'HIL' in series_id:
        return 'hiring_activity'
    elif series_id.startswith('CES'):
        return 'employment_levels'
    elif '0003' in series_id:
        return 'wages'
    elif 'LNS14' in series_id:
        return 'unemployment'
    else:
        return 'other_indicators'


def process_bls_data(result: Dict) -> List[Document]:
    """Convert BLS API response to Langchain documents."""
    
    documents = []
    
    for series in result['Results']['series']:
        series_id = series['seriesID']
        
        # Find series name from config
        series_name = None
        for sid in BLS_SERIES_IDS:
            if sid == series_id:
                series_name = f"BLS Series {series_id}"
                break
        
        if not series_name:
            series_name = f"BLS Series {series_id}"
        
        category = categorize_series(series_id)
        
        for data_point in series['data']:
            year = data_point['year']
            period = data_point['period']
            value = data_point['value']
            
            # Skip annual averages (M13)
            if period == 'M13':
                continue
            
            # Convert period to month
            month = period.replace('M', '')
            if not month.isdigit():
                continue
            
            date_str = f"{year}-{month.zfill(2)}"
            
            # Create document
            doc_text = f"""BLS Employment Data
Series: {series_name} (ID: {series_id})
Date: {date_str}
Value: {value}
Category: {category}

This data point represents official U.S. employment statistics from the Bureau of Labor Statistics.
"""
            
            doc_metadata = {
                'source': 'BLS',
                'series_id': series_id,
                'series_name': series_name,
                'date': date_str,
                'value': value,
                'category': category,
                'year': year,
                'month': month,
                'added_at': datetime.now().isoformat()
            }
            
            documents.append(Document(page_content=doc_text, metadata=doc_metadata))
    
    return documents


def update_bls_data(force: bool = False):
    """Fetch BLS data and upload to Pinecone."""
    
    print("=" * 70)
    print("BLS DATA UPDATE")
    print("=" * 70)
    
    if not should_update(force):
        return
    
    # Fetch data from last 2 years
    current_year = datetime.now().year
    start_year = current_year - 2
    end_year = current_year
    
    print(f"\n📊 Fetching BLS data ({start_year}-{end_year})...")
    print(f"   Series: {len(BLS_SERIES_IDS)} employment indicators")
    
    try:
        result = fetch_bls_data(BLS_SERIES_IDS, start_year, end_year)
        documents = process_bls_data(result)
        
        print(f"   ✅ Fetched {len(documents)} data points")
        
        # Clear old data and upload new (skip if namespace doesn't exist yet)
        print(f"\n🗑️  Clearing old BLS data from Pinecone...")
        pc = Pinecone(api_key=PINECONE_API_KEY)
        index = pc.Index(INDEX_NAME)
        try:
            index.delete(delete_all=True, namespace=NAMESPACE_BLS)
        except Exception as e:
            if "Namespace not found" in str(e):
                print(f"   ℹ️  Namespace doesn't exist yet (will be created on upsert)")
            else:
                raise
        
        print(f"☁️  Uploading new data...")
        print(f"   Index: {INDEX_NAME}")
        print(f"   Namespace: {NAMESPACE_BLS}")
        
        embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        
        vectorstore = PineconeVectorStore.from_documents(
            documents=documents,
            embedding=embeddings,
            index_name=INDEX_NAME,
            namespace=NAMESPACE_BLS
        )
        
        print(f"   ✅ Uploaded {len(documents)} documents!")
        
        # Save update timestamp
        save_last_update()
        
        # Show summary
        print(f"\n📊 DATA SUMMARY:")
        categories = {}
        for doc in documents:
            cat = doc.metadata.get('category', 'unknown')
            categories[cat] = categories.get(cat, 0) + 1
        
        for cat, count in sorted(categories.items()):
            print(f"   {cat}: {count} data points")
        
        print(f"\n✅ BLS UPDATE COMPLETE!")
        print(f"   Next update: {(datetime.now() + timedelta(days=BLS_UPDATE_DAYS)).strftime('%Y-%m-%d')}")
        
    except Exception as e:
        print(f"\n❌ Update failed: {str(e)}")
        raise


def main():
    parser = argparse.ArgumentParser(description="Update BLS employment data")
    parser.add_argument(
        '--force',
        action='store_true',
        help='Force update now (ignore update interval)'
    )
    
    args = parser.parse_args()
    update_bls_data(force=args.force)


if __name__ == "__main__":
    main()
