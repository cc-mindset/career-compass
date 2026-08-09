## 1. Generate API

- [x] 1.1 Define JobAnalysis / HiddenExpectation TypeScript contracts (stated vs inferred, evidence, confidence)
- [x] 1.2 Implement paste-based analyze route (reject empty posting; never invent a job)
- [x] 1.3 Implement LLM analysis with structured output validation and run metadata
- [x] 1.4 Optional queue + Socket.IO progress; sync fallback without Redis
- [x] 1.5 Add Vitest for validation and response shape

## 2. Ingest variants

- [x] 2.1 Support document upload of job description (distinct from résumé profile upload)
- [x] 2.2 Optional URL fetch behind clear failure → paste fallback messaging

## 3. Persistence and workspace API

- [x] 3.1 Add JobAnalysis Mongo model and list/get/create routes (immutable prior records)
- [x] 3.2 Guest preview response vs authenticated save semantics

## 4. Client wiring

- [x] 4.1 Replace static job-workspace result with live analysis
- [x] 4.2 Wire guest job input/review/preview → generate
- [x] 4.3 Wire history/empty/new states to persistence APIs
- [x] 4.4 Keep Skills Match handoff as navigation stub only (no Skills Match backend in this change)

## 5. Verification

- [x] 5.1 Manual: paste → stated + hidden expectations with evidence
- [x] 5.2 Manual: guest gate on full save
- [x] 5.3 Manual: second analysis does not overwrite first
