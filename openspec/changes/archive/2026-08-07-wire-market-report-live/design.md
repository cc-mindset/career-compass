## Context

Active Market Report UI is complete as prototype fixtures. Legacy client already proves generate + WS. This change is client wiring + thin API compatibility only—no user history models.

## Goals / Non-Goals

**Goals:**
- Live generate, progress, adapted overview/full tabs in active client.
- Guest gates + post-auth return.
- Optional `industry` on generate without breaking legacy.

**Non-Goals:**
- User report history / snapshots (`market-report-history`).
- Skills Match, Eco Simulator, server JWT hardening.
- New ai-enabler pipelines.

## Decisions

1. Port legacy MarketInsightsContext + socket pattern into active client module.
2. Client-side adapter from API sections → Clarity Coach tabs (v1).
3. Fixtures only as explicit offline/demo fallback if needed—not default for Market Report routes.
4. History deferred to sibling change.

## Risks / Trade-offs

- [Shape mismatch API↔UI] → Adapter + partial/empty states.
- [Sparse RAG] → Surface limitations; ops fix separate.
- [Redis down] → Support sync response shape.
- [No server auth] → clerkId trust for prototype wiring.

## Migration Plan

1. Ship API client + adapter + live generating/result/full.
2. Optional industry field.
3. Rollback: feature flag → fixtures.

## Open Questions

- Exact field map for Opportunities tab from `industryTrends` vs later dedicated section.
