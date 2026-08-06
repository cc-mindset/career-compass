## Why

The market-insights flow already spans request validation, cache lookup, queueing, polling, and direct fallback, but that behavior is only implied in code. A spec-backed change is needed now so cache keys, async behavior, and response shape stop drifting across the route, queue, and cache layers.

## What Changes

- Define the observable request lifecycle for market insights using location plus optional job and seniority context.
- Standardize cache-first behavior before any new queue or generation work starts.
- Define queueing, deduplication, and status polling semantics for in-flight requests.
- Preserve direct generation as a fallback when Redis queueing is unavailable.
- Clarify the completed insights response contract so the client can rely on stable behavior.

## Capabilities

### New Capabilities
- `market-insights-flow`: request intake, cache coordination, queueing, polling, and insight delivery for market-insights generation.

### Modified Capabilities
- None

## Impact

Affected code includes the market-insights route, Redis queue helpers, DB cache helpers, and the RAG generation path in `web-server`. Client polling behavior depends on the status contract, and the cache key coordination affects how repeated requests are deduplicated.
