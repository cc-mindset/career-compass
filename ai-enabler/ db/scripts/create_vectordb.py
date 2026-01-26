#!/usr/bin/env python3
"""
Create career-insights index on Pinecone
"""
import os
import time
from pinecone import Pinecone, ServerlessSpec

def setup_new_account():
    new_key = os.getenv('PINECONE_NEW_API_KEY')
    if not new_key:
        print("Set PINECONE_NEW_API_KEY first")
        return
    
    pc = Pinecone(api_key=new_key)
    indexes = pc.list_indexes()
    
    # Check if already exists
    if any(idx.name == "career-insights" for idx in indexes.indexes):
        index = pc.Index("career-insights")
        stats = index.describe_index_stats()
        print(f"Index exists: {stats.get('dimension')}D, {sum(ns.get('vector_count', 0) for ns in stats.get('namespaces', {}).values())} vectors")
        return
    
    # Create index
    print("Creating index...")
    pc.create_index(
        name="career-insights",
        dimension=1536,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1")
    )
    
    # Wait for ready
    for i in range(60):
        try:
            index = pc.Index("career-insights")
            stats = index.describe_index_stats()
            print(f"Ready: {stats.get('dimension')}D")
            return
        except:
            time.sleep(2)

if __name__ == "__main__":
    setup_new_account()
