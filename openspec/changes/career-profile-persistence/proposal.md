## Why

Clarity Coach tools must share one progressive Career Profile so guests and returning users are not asked the same career facts twice. The web-server already supports user upsert, profile patch, and résumé parse/upload, but the active client only flips local booleans. This change makes Career Profile the durable evidence layer those tools can prefill from and write back to.

## What Changes

- Wire active Career Profile UI to `/api/users` and `/api/resume/upload`.
- Persist profile by PRD section groups (career context, evidence, direction, preferences) with independent section save and completion progress.
- Enforce source provenance and “do not silently overwrite confirmed facts” when tools write compatible fields.
- Prefill Career Pivot and Market Report inputs from saved profile values after load.
- Carry guest Career Pivot answers into matching profile fields after account creation (client + server claim path as available).

## Capabilities

### New Capabilities
- `career-profile-api`: authenticated (or clerkId-keyed) profile read/write and résumé ingest aligned to Clarity Coach section model.
- `career-profile-prefill`: cross-feature prefill and progressive save rules for Pivot and Market Report (and later Job/Skills).

### Modified Capabilities
- None.

## Impact

- **Client:** `views/career-profile`, ClarityContext profile fields, Home progress indicator.
- **Web-server:** `routes/user.ts`, `routes/resume.ts`, `types/user.ts` / User model extensions for section completion and provenance.
- **Auth:** still client-trusted `clerkId` unless a parallel auth change lands; document the gap in design.
