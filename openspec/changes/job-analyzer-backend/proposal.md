## Why

Job Analyzer + Hidden Expectations is a guest-first MVP tool with a full workspace already prototyped in the active client, but no backend analyzes a user-supplied posting. The system must never invent a job; it must separate stated requirements from inferred expectations with evidence and confidence. This change adds that backend and wires the active Job Analyzer workspace to it, reusing LLM/queue/progress patterns from market insights where appropriate.

## What Changes

- Add job ingest for paste (primary), upload, and URL-when-supported paths.
- Add analysis that returns stated requirements, Hidden Expectations, evidence spans, and confidence metadata.
- Persist `JobAnalysis` records with history / new-analysis semantics (immutable prior records).
- Gate full save and Skills Match handoff behind account while allowing guest preview.
- Wire `client/client/app` job-workspace views to generate + result APIs (replace static copy).

## Capabilities

### New Capabilities
- `job-analyzer-generate`: posting intake, analysis pipeline, and Hidden Expectations result contract.
- `job-analyzer-workspace`: saved analyses list, review/result states, and guest→account continuation for Job Analyzer.

### Modified Capabilities
- None.

## Impact

- **Web-server:** new routes/services/models; do not overload `/api/resume` (profile résumé ≠ job posting).
- **Client:** `views/job-workspace`, guest job input/review/preview.
- **Skills Match:** out of scope for this change (UI not ready); only preserve a navigation handoff stub if already present.
- **ai-enabler:** not required for MVP job analysis (job text is user-supplied); RAG optional later.
