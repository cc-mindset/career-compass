## Context

No Career Pivot API exists. Active client has guest input/preview. This change is generate + guest preview only; workspace/history/Action Plan are deferred.

## Goals / Non-Goals

**Goals:**
- Validated generate returning three paths with rationale.
- Guest preview without résumé.
- Queue/WS or sync fallback.
- Optional profile prefill and optional RAG market-signal snippets.

**Non-Goals:**
- Exploration list, Action Plan, sidebar workspace swap (`career-pivot-workspace`).
- Skills Match.
- Employment guarantees.

## Decisions

1. New `/api/career-pivot` (or `/api/pivot`) generate endpoint—not market-insights.
2. Reuse OpenAI + optional Redis/WS progress pattern.
3. Persist ephemeral guest result client-side for this change; server persistence of explorations is the follow-up.
4. Optional RAG for signal text only.

## Risks / Trade-offs

- [Unrealistic paths] → Schema validation + required rationale fields.
- [No skill graph] → Curated skills + LLM; iterate later.
- [Fear-based copy] → Safety rules in prompts.

## Migration Plan

1. Ship generate + guest preview wiring.
2. Follow with `career-pivot-workspace` for persistence.

## Open Questions

- Exact path JSON field names vs prototype copy.
- Whether authenticated generate also stores a draft exploration early (prefer no until workspace change).
