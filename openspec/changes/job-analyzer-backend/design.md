## Context

Job Analyzer workspace UI exists in the active client with static Hidden Expectations copy. No backend analyzes a user-supplied job posting. Résumé upload parses career evidence for profile — different concern. This change adds job analysis APIs and wires the job workspace.

## Goals / Non-Goals

**Goals:**
- Ingest user-supplied job text (paste primary; upload; URL when supported).
- Produce stated requirements vs Hidden Expectations with evidence and confidence.
- Persist analyses with history / new semantics.
- Guest preview → account for full save.

**Non-Goals:**
- Skills Match implementation (UI not ready) — navigation stub only.
- Autonomous job search or inventing a posting.
- Market Report redesign.

## Decisions

1. **New `/api/job-analyzer` routes** — never overload `/api/resume`.  
2. **Paste is MVP-critical; URL fetch is best-effort** with clear failure when blocked.  
3. **Reuse queue + WS** for analysis latency; structured LLM JSON with server validation.  
4. **Separate explicit vs inferred** in the result contract (PRD).  
5. **Mongo `JobAnalysis` model** with immutable history on “new analysis”.

## Risks / Trade-offs

- [Model over-infers] → Mitigation: require evidence spans; confidence labels; prompt versioning fields.
- [URL scrape failures] → Mitigation: force paste fallback messaging.
- [PII in postings] → Mitigation: retention policy + encryption at rest (align with PRD security later).

## Migration Plan

1. Generate + guest preview wiring.
2. Persistence + history UI.
3. URL fetch behind feature flag.

## Open Questions

- Max posting length and file types for upload.
- Whether Hidden Expectations count is fixed at three or variable.
