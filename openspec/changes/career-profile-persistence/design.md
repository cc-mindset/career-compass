## Context

Career Profile is the PRD shared evidence layer. Web-server already has `POST/GET /api/users`, `PATCH /api/users/:userId/profile`, and `POST /api/resume/upload`. Active client Career Profile is UI-only (`profileComplete` boolean). Tools (Pivot, Market Report) need durable prefill.

## Goals / Non-Goals

**Goals:**
- Persist section-oriented profile data and completion progress.
- Wire résumé upload and profile load/save in the active client.
- Prefill Market Report and Career Pivot from saved fields.
- Preserve confirmed facts against silent overwrite.

**Non-Goals:**
- Full OAuth LinkedIn data import (URL field + manual/résumé first).
- Skills Match assessment.
- Replacing Clerk (or chosen IdP) — only define profile keyed identity.

## Decisions

1. **Extend User.profile document with section metadata** (`sections`, `confirmedFields` / provenance) rather than a brand-new collection for MVP.  
   *Alternative:* Separate `CareerProfile` collection — better long-term; defer unless schema conflicts appear.

2. **Section saves via PATCH profile** with section id in body; server merges without wiping unspecified sections.  
   *Alternative:* One endpoint per section — more routes, little gain for MVP.

3. **Résumé path stays `/api/resume/upload`**; client maps parsed profile into Career Profile evidence UI for review before confirm.  
   *Alternative:* Auto-confirm parse — rejected (PRD: user-confirmed values).

4. **Prefill is client-applied after GET profile** for Market/Pivot forms; server does not mutate tool drafts silently.

## Risks / Trade-offs

- [clerkId trust without JWT] → Mitigation: same as rest of API; note in open questions / auth change.
- [Schema drift vs Clarity Coach fields] → Mitigation: explicit field map in tasks from PRD §5 / §11.
- [Guest pivot answers lost] → Mitigation: claim payload on signup; coordinate with guest session work.

## Migration Plan

1. Extend types/model (backward compatible defaults).
2. Wire GET/PATCH + résumé in active Career Profile.
3. Enable prefill helpers for Market then Pivot.
4. Rollback: ignore new fields; old clients still PATCH flat profile.

## Open Questions

- Whether GuestSession is in scope for this change or a shared prerequisite change.
- Exact completion % formula vs prototype 0/35/100 shortcuts.
