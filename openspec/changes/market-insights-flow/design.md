## Context

See proposal.md for the motivation. The current market-insights flow is already split across the Express route, Redis queue helpers, DB cache helpers, and the RAG generation service, so the design needs to preserve the current endpoints while tightening the contract around coordination and fallback behavior.

## Goals / Non-Goals

**Goals:**
- Keep the current market-insights request and status endpoints stable.
- Make cache lookup, queue coordination, and direct fallback deterministic.
- Ensure request normalization is shared across cache keys and queue deduplication.
- Preserve the existing client-facing behavior for queued and completed responses.

**Non-Goals:**
- Redesigning the frontend UX.
- Replacing Redis, MongoDB, Pinecone, or the RAG prompts.
- Changing the market-insights content model beyond what the behavior contract requires.

## Decisions

- Use one capability for the full market-insights lifecycle because validation, cache lookup, queueing, and polling are tightly coupled in practice. Splitting them would create artificial boundaries and make the spec harder to keep coherent.
- Keep the canonical request tuple as location plus optional job and seniority after normalization. Including userId or district in the contract would reduce cache reuse and complicate deduplication without improving the observable behavior.
- Check the DB cache before queueing. A queue-first design would add latency for requests that can already be satisfied and would waste queue capacity on work that does not need to run.
- Keep Redis as best-effort coordination and preserve synchronous fallback. A fail-closed design would make infrastructure issues user-visible and would not match the current service resilience pattern.
- Keep status polling as the delivery contract for queued jobs. Streaming partial results would require a broader client and websocket contract change that is not needed for this scope.
- Treat the DB cache as the authoritative store for completed insight payloads and Redis as the coordination layer for in-flight work. Storing completed responses only in Redis would make the system more fragile because of TTL and durability limits.

## Risks / Trade-offs

- Cache-key changes can accidentally fragment hits or deduplication -> Mitigation: reuse the same normalized tuple across cache lookup, queue dedup, and status lookup.
- Direct fallback can create uneven latency when Redis is unavailable -> Mitigation: use it only when queueing cannot be used and keep the behavior clearly logged.
- Duplicate request reuse can confuse users if they expect a new job every time -> Mitigation: return the existing jobId and queue position so the client can explain what happened.
- Section-level caching can drift if one section is stale while others are fresh -> Mitigation: require all required sections to be active before treating a response as a cache hit.

## Migration Plan

- No schema migration is required.
- Roll out behind the existing market-insights endpoints and payload shapes.
- Verify that existing cache records still resolve through the normalized tuple path.
- If the new coordination behavior causes regressions, revert by disabling the new normalization or dedup path while keeping the direct generation fallback in place.
