## 1. Contract and cache coordination

- [ ] 1.1 Align market-insights request normalization across the route, DB cache, and queue dedup logic.
- [ ] 1.2 Confirm cache-hit behavior short-circuits before enqueueing and preserves the completed response shape.
- [ ] 1.3 Keep duplicate in-flight requests mapped to the same job identifier.

## 2. Queue and fallback behavior

- [ ] 2.1 Preserve queued responses for uncached requests when Redis is available.
- [ ] 2.2 Preserve direct synchronous generation when queueing is unavailable or fails.
- [ ] 2.3 Keep job status lookup returning completed insights once worker output is available.

## 3. Verification

- [ ] 3.1 Add or update tests for cache hit, queue hit, duplicate request, and direct-fallback paths.
- [ ] 3.2 Run the targeted web-server test and type-check commands for the touched market-insights slice.
- [ ] 3.3 Validate the change with OpenSpec before implementation starts.
