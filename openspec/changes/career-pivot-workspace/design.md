## Context

Builds on `career-pivot-generate`. Authenticated users need exploration history, immutable new explorations, and Action Plans after account creation. Active sidebar still points at prototype-new-account steps.

## Goals / Non-Goals

**Goals:**
- Persist explorations; list/open/continue/new without overwrite.
- Action Plan gated behind auth with continuation.
- Point Career Pivot nav at workspace.

**Non-Goals:**
- Replacing generate contract (owned by sibling change).
- Skills Match.
- Admin tooling.

## Decisions

1. Mongo `PivotExploration` (+ Action Plan link/document).
2. Generate may create/update an exploration when authenticated; guests claim into a new exploration on conversion.
3. New exploration = new record always.
4. Apply after generate API is stable.

## Risks / Trade-offs

- [Orphan guest results] → Mitigation: claim payload on signup.
- [Nav switch breaks prototype demos] → Mitigation: keep prototype routes reachable via demo panel if needed.

## Migration Plan

1. Models + list/get/create routes.
2. Workspace UI + nav.
3. Action Plan endpoint + gate.
4. Rollback: nav back to prior target; generate still works.

## Open Questions

- Whether Action Plan is a second LLM call or template from selected path.
