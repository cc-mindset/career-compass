## Why

After live Market Report generation works, authenticated users still need PRD history: latest report, immutable dated snapshots, review, and create-new. Today Mongo only caches LLM responses by location/job/seniority—that is not user report history. This change adds persistence and wires the history UI once live generation exists.

## What Changes

- Add user-owned Market Report latest pointer + immutable snapshot records.
- Wire authenticated history / review snapshot / create-new flows in the active client.
- Keep LLM cache as a performance layer only.
- Depends on `wire-market-report-live` for generate + adapter.

## Capabilities

### New Capabilities
- `market-report-history`: user-owned latest report and dated snapshots with Review and Create new semantics.

### Modified Capabilities
- None.

## Impact

- Web-server new models/routes for report history.
- Active client history/empty/setup wiring.
- Does not change RAG ingestion or guest overview live path (except using stored payloads when reviewing).
