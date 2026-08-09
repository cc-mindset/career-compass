## 1. Generate API

- [ ] 1.1 Define pivot input/result TypeScript contracts (three paths + rationale)
- [ ] 1.2 Implement generate route with validation (≥3 skills, required fields)
- [ ] 1.3 Implement LLM structured generation + server schema validation
- [ ] 1.4 Optional enqueue + Socket.IO progress; sync when Redis down
- [ ] 1.5 Vitest for validation and mocked happy path

## 2. Guest client wiring

- [ ] 2.1 Wire guest pivot processing/preview to generate API
- [ ] 2.2 Map live paths into existing preview UI components
- [ ] 2.3 Optional: prefill from Career Profile when profile API is available

## 3. Verification

- [ ] 3.1 Manual: guest three paths without résumé
- [ ] 3.2 Manual: fewer than three skills rejected
- [ ] 3.3 Confirm Action Plan / history remain out of scope
