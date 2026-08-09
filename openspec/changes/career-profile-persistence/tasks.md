## 1. Profile schema and API

- [ ] 1.1 Extend User profile types/model with section completion and provenance fields (backward compatible)
- [ ] 1.2 Ensure `PATCH /api/users/:userId/profile` merges sections without wiping unspecified data
- [ ] 1.3 Add Vitest coverage for merge/patch behavior

## 2. Active Career Profile wiring

- [ ] 2.1 Load profile via `GET /api/users/:userId` into ClarityContext / Career Profile view
- [ ] 2.2 Wire section save actions to PATCH
- [ ] 2.3 Wire résumé upload to `POST /api/resume/upload` with review-before-confirm UX
- [ ] 2.4 Drive Home/Career Profile progress from section completion state (no fabricated 100%)

## 3. Prefill and guest carry-over

- [ ] 3.1 Prefill Market Report setup from saved career context
- [ ] 3.2 Prefill Career Pivot inputs from saved profile without silent overwrite on exploration edits
- [ ] 3.3 On guest pivot → signup, populate matching profile fields from carried answers

## 4. Verification

- [ ] 4.1 Manual: save context → reopen Market Report prefilled
- [ ] 4.2 Manual: résumé parse → user confirms evidence
- [ ] 4.3 Note auth/JWT gap for follow-up change
