## Why

The active Clarity Coach Market Report workspace is fixture-driven while web-server already generates market insights via RAG, Redis queueing, and Socket.IO progress. This change wires live generation into the active UI only—overview and full tabs—without building user report history yet.

## What Changes

- Connect `client/client/app` Market Report generate/overview/full-report flows to `POST /api/market-insights/generate` and Socket.IO `progress`.
- Add a client adapter from API sections to Clarity Coach overview and full-report tabs.
- Preserve guest-first gates and post-auth continuation.
- Optionally extend generate body with `industry` (backward compatible).
- Leave user-owned history/snapshots to `market-report-history`.

## Capabilities

### New Capabilities
- `market-report-live`: live generate, progress, and adapted rendering for guest overview and authenticated full report tabs using existing market-insights + RAG.

### Modified Capabilities
- None.

## Impact

- Active client market-workspace + new API/socket module.
- Web-server generate contract (optional industry); CORS/`CLIENT_URL` for port 3002.
- Depends on existing `ai-enabler` Pinecone data; no new ingest.
- Prerequisite for `market-report-history`.
