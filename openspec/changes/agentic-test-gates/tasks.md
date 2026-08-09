## 1. Web-server Vitest harness

- [x] 1.1 Add or confirm `test` / `test:core` scripts in `web-server/package.json` for focused and curated runs
- [x] 1.2 (TDD) Add or extend a failing Vitest example that asserts a mocked Redis/Mongo path does not require live services
- [x] 1.3 Implement any harness helper/mock utilities needed until 1.2 is green; re-run focused Vitest

## 2. Web-server unit-core (TDD pairs)

- [x] 2.1 (TDD) Add failing Vitest for job-analyzer empty/invalid posting contract if not already locked; implement until green
- [x] 2.2 (TDD) Add failing Vitest for market-report create-new snapshot immutability if not already locked; implement until green
- [x] 2.3 Wire `npm run test:core` in `web-server` to the curated pack (job-analyzer validation/persistence, market-reports, other critical service tests)
- [x] 2.4 Run `test:core` and fix failures until green

## 3. Client Vitest harness

- [x] 3.1 Add Vitest + React Testing Library (+ jsdom) devDependencies and `vitest.config` to `client/client/app`
- [x] 3.2 Add npm scripts `test`, `test:watch`, `test:core` to active client `package.json`
- [x] 3.3 (TDD) Add a failing smoke unit test that proves the harness loads (e.g. trivial pure helper or existing util); implement minimal code only if needed until green

## 4. Client unit-core (TDD pairs)

- [x] 4.1 (TDD) Add failing Vitest for `jobUploadFile` set/get/clear; implement until green
- [x] 4.2 (TDD) Add failing Vitest for market insights adapter mapping with a representative live payload (no invented fields); implement until green
- [x] 4.3 (TDD) Add failing Vitest for job analyzer API client error/result shaping used by `runJobAnalysis`; implement until green
- [x] 4.4 Wire `test:core` to those packs; run until green

## 5. E2E harness

- [x] 5.1 Add Playwright to active client (or repo `e2e/` owned by active client scripts); config baseURL `http://127.0.0.1:3002`
- [x] 5.2 Add agent-safe scripts: `e2e:pulse`, `e2e:smoke`, `e2e:p0`, plus serve/preview helper (script names only — AGENTS docs come after gates work)
- [x] 5.3 Add shared `data-testid` catalog module and wire critical landing/job/market controls
- [x] 5.4 (TDD/e2e) Add failing pulse spec that landing loads; implement testids/app hooks until pulse green

## 6. E2E critical journeys

- [x] 6.1 (Outer) Add failing p0 guest market report journey; implement selectors/fixtures until green
- [x] 6.2 (Outer) Add failing p0 guest job analyze paste journey; implement until green
- [x] 6.3 (Outer) Add failing upload-source drop-zone visibility/clickability spec; implement until green
- [x] 6.4 Add smoke spec for landing/tools entry reachability; run until green

## 7. Agentic gate instructions (after harnesses are real)

- [x] 7.1 Update `AGENTS.md` with Vitest inner-gate command table and Playwright ladder using the **actual** scripts from sections 1–6, plus incomplete-apply criteria and coverage posture (no global %)
- [x] 7.2 Update `openspec/config.yaml` `context`, `rules.tasks|design|proposal`, and `operations.apply|archive.guidance` to require TDD pairs and outer-gate sections
- [x] 7.3 Harden `.claude/skills/openspec-apply-change/SKILL.md` with icee-style steps: focused Vitest inner loop, Playwright add/update, ladder before claim-complete
- [x] 7.4 Add `.cursor/rules/agentic-test-gates.mdc` (alwaysApply) summarizing inner/outer gates and pointing at AGENTS.md

## 8. Agentic draft PR (`w/PR`)

- [x] 8.1 Add `.claude/skills/openspec-apply-draft-pr/SKILL.md` (and `.cursor/skills` mirror if used) for apply→branch→commit→push→draft PR with gate checklist in body
- [x] 8.2 Add `.cursor/rules/w-pr.mdc` (alwaysApply): `w/PR` → draft only; never ready-for-review
- [x] 8.3 Document `w/PR` in `AGENTS.md` as the sole commit/push exception

## 9. CI test gates

- [x] 9.1 Add `.github/workflows/test-gates.yml` running web-server Vitest / `test:core` on `web-server/**` changes
- [x] 9.2 Extend workflow for active client unit / `test:core` on `client/client/app/**` changes
- [x] 9.3 Extend workflow for Playwright pulse + p0 with app serve; mock/fixture-friendly; fail on red
- [x] 9.4 Verify workflow YAML path filters and that jobs do not require paid API secrets

## 10. Product / e2e validation (outer gate for this change)

- [x] 10.1 Run web-server `test:core` and confirm green
- [x] 10.2 Run client `test:core` and confirm green
- [x] 10.3 Run `e2e:pulse` and confirm green
- [x] 10.4 Run `e2e:smoke` and `e2e:p0` and confirm green
- [x] 10.5 Spot-check that apply skill + AGENTS + config rules describe the same ladder as the real scripts; fix drift if any
