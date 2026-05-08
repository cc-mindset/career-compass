Steps to run:
1. pip install -r requirements.txt
2. cp .env.example .env
3. 


Structure:
rag-pipeline/
├── config/
│   └── settings.py          ← shared
├── src/
│   ├── shared/
│   │   ├── s3_client.py     ← shared
│   │   ├── embedder.py      ← shared 
│   │   └── pinecone_client.py ← shared
│   │
│   ├── pipelines/
│   │   ├── market_reports/  ← PDF pipeline 
│   │   │   ├── registry.py
│   │   │   ├── parser.py
│   │   │   ├── chunker.py
│   │   │   ├── test_parser.py
│   │   │   └── runner.py
│   │   │
│   │   ├── market_stats/    ← BLS/StatsCan/OECD pipeline
│   │   │   ├── registry.py
│   │   │   ├── fetcher_bls.py
│   │   │   ├── fetcher_statscan.py
│   │   │   ├── cleanup.py
│   │   │   ├── transformer.py
│   │   │   └── runner.py
│   │   │
│   │   └── market_news/     ← SERP pipeline
│   │       ├── registry.py
│   │       ├── fetcher_serp.py
│   │       ├── cleanup.py
│   │       ├── enricher.py
│   │       ├── embedder.py
│   │       ├── transformer.py
│   │       └── runner.py


pending → parsing → parsed → chunking → chunked → enriching → enriched → embedding → completed
                 ↘ needs_review (auto-extracted metadata, review before continuing)
                 ↘ failed (check failedStage + errorMessage in registry)
NAMING CONVENTION BEFORE PUTTING PDF IN S3:

    {publisher}-{short-title}-{year}.pdf
                    +
    {publisher}-{short-title}-{year}.json