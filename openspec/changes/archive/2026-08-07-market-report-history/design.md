## Context

Live Market Report generation will exist via `wire-market-report-live`. LLM cache keys are not user history. PRD requires latest + previous snapshots + create new without overwrite.

## Goals / Non-Goals

**Goals:**
- User-owned latest + immutable snapshots.
- History/review/create-new in authenticated workspace.
- Store enough payload/metadata to re-render via existing adapter.

**Non-Goals:**
- Replacing live generate path.
- Guest history.
- PDF/share.
- Changing Pinecone ingest.

## Decisions

1. New Mongo models keyed by user id + report id (not cache key).
2. Create-new snapshots previous latest then writes new latest.
3. Review is read-only relative to latest.
4. Apply only after `wire-market-report-live` adapter exists.

## Risks / Trade-offs

- [Large payloads in Mongo] → Mitigation: store insights blob or section refs; size limits later.
- [Orphan snapshots] → Mitigation: soft-delete policy TBD; MVP append-only.

## Migration Plan

1. Deploy models/routes.
2. Wire history UI.
3. Rollback: hide history nav; live generate still works.

## Open Questions

- Retention / max snapshots per user.
