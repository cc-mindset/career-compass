#!/usr/bin/env python3
"""
Upload .txt reports to Pinecone reports-data namespace

Filename format: title--author--category--year--focus.txt
Example: Future_of_Work--McKinsey--Employment--2025--remote_ai_skills.txt
"""

import os
import hashlib
from datetime import datetime
from pathlib import Path
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_core.documents import Document
from pinecone import Pinecone
from config import (
    OPENAI_API_KEY, PINECONE_API_KEY,
    INDEX_NAME, NAMESPACE_REPORTS
)

os.environ["PINECONE_API_KEY"] = PINECONE_API_KEY
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY


def parse_filename(filename):
    """Parse metadata from filename format: title--author--category--year--focus.txt"""
    name = filename.replace('.txt', '')
    parts = name.split('--')
    
    if len(parts) < 5:
        # Fallback if format doesn't match
        return {
            "title": name.replace('_', ' '),
            "author": "Unknown",
            "category": "General",
            "year": datetime.now().year,
            "focus": ["general"]
        }
    
    title = parts[0].replace('_', ' ')
    author = parts[1].replace('_', ' ')
    category = parts[2].replace('_', ' ')
    year = int(parts[3]) if parts[3].isdigit() else datetime.now().year
    focus = parts[4].replace('_', ' ').split() if len(parts) > 4 else ["general"]
    
    return {
        "title": title,
        "author": author,
        "category": category,
        "year": year,
        "focus": focus
    }


def upload_reports():
    reports_dir = Path("data/Data_updated")
    
    if not reports_dir.exists():
        print(f"Directory not found: {reports_dir}")
        return
    
    txt_files = list(reports_dir.glob("*.txt"))
    
    if not txt_files:
        print("No .txt files found")
        return
    
    print(f"Found {len(txt_files)} reports\n")
    
    documents = []
    
    for txt_path in txt_files:
        print(f"Processing: {txt_path.name}")
        
        # Read file
        try:
            with open(txt_path, 'r', encoding='utf-8') as f:
                text = f.read()
        except Exception as e:
            print(f"  Error reading file: {e}")
            continue
        
        if not text.strip():
            print("  Empty file, skipping")
            continue
        
        # Parse metadata from filename
        metadata = parse_filename(txt_path.name)
        metadata["filename"] = txt_path.name
        metadata["source"] = "data_updated"
        metadata["added_at"] = datetime.now().isoformat()
        
        # Generate ID
        file_hash = hashlib.md5(txt_path.name.encode()).hexdigest()[:16]
        doc_id = f"report_{file_hash}"
        
        # Create document (limit to 2000 chars for embedding)
        content = f"""Title: {metadata['title']}
Author: {metadata['author']}
Year: {metadata['year']}
Category: {metadata['category']}

{text[:2000]}"""
        
        doc = Document(page_content=content, metadata=metadata)
        documents.append(doc)
        
        print(f"  {metadata['title']} - {metadata['author']} ({metadata['year']})")
    
    if not documents:
        print("\nNo documents to upload")
        return
    
    # Cost estimate
    total_chars = sum(len(doc.page_content) for doc in documents)
    est_cost = (total_chars / 4000) * 0.00002
    print(f"\nEstimated cost: ${est_cost:.4f}")
    
    # Upload
    print(f"Uploading to {INDEX_NAME}/{NAMESPACE_REPORTS}...")
    
    try:
        embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        vectorstore = PineconeVectorStore.from_documents(
            documents=documents,
            embedding=embeddings,
            index_name=INDEX_NAME,
            namespace=NAMESPACE_REPORTS
        )
        
        print(f"Uploaded {len(documents)} reports")
        
        # Verify count
        pc = Pinecone(api_key=PINECONE_API_KEY)
        idx = pc.Index(INDEX_NAME)
        stats = idx.describe_index_stats()
        count = stats.get('namespaces', {}).get(NAMESPACE_REPORTS, {}).get('vector_count', 0)
        print(f"Total in {NAMESPACE_REPORTS}: {count} vectors")
        
    except Exception as e:
        print(f"Upload failed: {e}")
        raise


if __name__ == "__main__":
    upload_reports()
