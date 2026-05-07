# StatsCan Registry Remap

 This folder contains a 3-step remap workflow to rebuild the registry
from live StatsCan WDS data.

## The problem

StatsCan WDS requires either:
- A `vectorId` (a stable integer ID for a specific series), or
- A `productId` + `coordinate` string (dimension positions in a table)

VectorIds can't be guessed — they must be looked up via the API.
The coordinate approach is safer but requires knowing the exact dimension
member IDs for each table, which vary per table.

## Workflow

### Step 1: Pull live vectors
Resolves each intended series by productId + coordinate → gets live vectorId.

```bash
cd statscan_remap/
python step1_pull_table_vectors.py
# Output: statscan_live_vectors.json
```

Inspect the output:
- `resolved`: entries with confirmed vectorId + recent data point
- `failed`: entries where coordinate didn't match — need fixing

For failed entries, use StatsCan Table Explorer to find correct coordinates:
  https://www150.statcan.gc.ca/t1/tbl1/en/table/{productId}
  → "Add/Remove data" → inspect URL for coordinate values

### Step 2: Remap the registry
Rewrites LFS_SERIES, JVWS_SERIES, SEPH_SERIES in fetcher_statscan.py
with verified live vectorIds. Backs up original first.

```bash
python step2_remap_registry.py \
    --vectors statscan_live_vectors.json \
    --fetcher ../src/pipelines/market_stats/fetcher_statscan.py
```

Dry run (no file changes):
```bash
python step2_remap_registry.py --dry-run
```

### Step 3: Verify remapped registry
Confirms every vectorId in the updated registry resolves and has data.

```bash
python step3_verify_remapped.py \
    --fetcher ../src/pipelines/market_stats/fetcher_statscan.py
```

Exit 0 = all pass. If any fail, fix coordinates in step1 and re-run.

## Iteration cycle

```
step1 → fix failed coordinates → step1 again → step2 → step3
```

Repeat until step3 exits 0.
