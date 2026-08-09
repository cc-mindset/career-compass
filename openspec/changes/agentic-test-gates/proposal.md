## Why

Clarity Coach has an OpenSpec planning loop but lacks icee-style agentic execution gates: TDD-focused Vitest as the inner gate and a browser e2e ladder as the outer gate. Without instruction enforcement, FE/web-server test harnesses, and CI, agents can mark applies complete after unproven code — blocking safe autonomous development.

## What Changes

- Encode **inner gate** (failing Vitest → focused green) and **outer gate** (Playwright ladder) in `AGENTS.md`, `openspec/config.yaml` rules, and the apply skill so “done” requires green gates.
- Add **Vitest + RTL** to the active client (`client/client/app`) and grow **change-scoped + unit-core** coverage on web-server and client (no global coverage-% chase).
- Add a **Playwright** e2e harness with pulse / smoke / p0 scripts and critical guest journeys.
- Add a **draft-only `w/PR`** skill/rule as an explicit exception to “wait for user to commit.”
- Add **GitHub Actions** that run web-server Vitest, client unit tests, and e2e pulse/p0 on PRs.
- Split requirements into multiple small capabilities so reviewers can approve instruction, harness, core packs, journeys, ship, and CI independently.

## Capabilities

### New Capabilities

- `agentic-gate-instructions`: Agent-facing docs and OpenSpec/apply rules that define and enforce inner Vitest + outer Playwright gates.
- `web-server-vitest-harness`: Focused Vitest run playbook, mocking conventions, and incomplete-apply criteria for `web-server/`.
- `web-server-unit-core`: High-risk web-server unit-core pack (validation, persistence invariants, market/job response shapes).
- `client-vitest-harness`: Vitest + RTL setup, scripts, and TDD inner-gate criteria for `client/client/app`.
- `client-unit-core`: High-risk client unit-core pack (API adapters, upload helpers, market/job live mapping).
- `e2e-harness`: Playwright project layout, agent-safe scripts, data-testid discipline, pulse/smoke/p0 ladder.
- `e2e-critical-journeys`: Required p0 browser journeys (guest market report, job analyze, guest continuation smoke).
- `agentic-draft-pr`: Draft-only `w/PR` apply→branch→commit→push→PR flow with gate status in the PR body.
- `ci-test-gates`: PR CI running web-server Vitest, client unit, and e2e pulse/p0.

### Modified Capabilities

- (none) — existing product specs (`market-report-live`, `market-report-history`) are unchanged; this change adds testing/agent infrastructure only.

## Impact

- **Docs / agent config:** `AGENTS.md`, `openspec/config.yaml`, `.claude/skills/openspec-apply-change/SKILL.md`, new `.cursor/rules` and optional `.cursor/skills` / draft-PR skill.
- **web-server:** expanded Vitest suites; no product API contract changes required.
- **Active client:** new Vitest/RTL deps and scripts; Playwright deps and `e2e/`; stable `data-testid`s on critical UI.
- **CI:** new `.github/workflows/` (repo currently has none).
- **Out of scope:** legacy-client test modernization, RAG Python suite, serverless tests, MongoDB/OpenAI/Pinecone live integration tests, raising a global coverage percentage threshold.
