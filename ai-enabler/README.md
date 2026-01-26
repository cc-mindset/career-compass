# RAG Data Pipeline

- Set your Pinecone API key before running:
 PINECONE_API_KEY="your-pinecone-api-key"

RAG_Upload_Data_Pipeline/
── config.py                # create this with the api keys
── fetch_news.py            # Fetch employment news
── upload_news.py           # Upload news to Pinecone
── update_bls.py            # Fetch & upload BLS 


Instructions: 

0. python create_vectordb.py (optional if Pinecone is not setup)
    -Creates the index and 4 namespaces(bls,news,report,users)

1. python fetch_news.py --days 30
    -pulls 30 days of news data change days to change data
     - can Review fetched news in .fetched_news.json

2. python upload_news.py
    -  Upload to Pinecone

3. python update_bls.py
    -to update bls data (fetch +upload) also checks if last upload was within 14 days then dont update

4. python upload_reports.py
  - insert all data in ./data/reports (needs to be txt, example provided) to pinecone

Weekly Updates

#Fetch last 7 days of news
python fetch_news.py --days 7

#Upload to Pinecone
python upload_news.py


piecone Structure

Index: `career-insights`
Namespaces:
- news-data: Employment news articles (90-day retention)
- bls-data: BLS statistics (2 years of data, ~250 data points)

- .fetched_news.json - Cached news articles
- .uploaded_articles.json - Track uploaded news IDs
- .bls_last_update.json - BLS update timestamp


