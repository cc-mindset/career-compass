## Context

Clarity Coach already uses OpenSpec (`spec-driven`) via `.claude/skills` and has ad hoc Vitest on `web-server`, but lacks icee-style autonomous gates: AGENTS/config/apply enforcement, active-client unit harness, Playwright outer ladder, draft `w/PR`, and CI. Reference: `/Users/dave/Documents/icee` AGENTS.md inner Jest loop + Cypress ladder, `openspec/config.yaml` rules, and apply-skill steps 7–9.

This design covers how to bring equivalent gates to clarity-coach using **Vitest** (already on web-server) and **Playwright** (greenfield e2e; no Cypress to preserve).

## Goals / Non-Goals

**Goals:**

- Make agent apply-complete contingent on inner Vitest + outer Playwright gates.
- Grow change-scoped FE and web-server tests plus small unit-core packs (not global coverage %).
- Split requirements into many small specs for independent review.
- Enable draft-only autonomous PRs via explicit `w/PR`.
- Add PR CI as the machine-enforced gate.

**Non-Goals:**

- Modernizing `client/legacy-client` tests.
- Python RAG pipeline or serverless test suites in this change.
- Live LLM/Pinecone/Mongo integration tests in default CI.
- Enforcing a repository-wide coverage percentage threshold.
- Ready-for-review PRs from agents (draft only).

## Decisions

### 1. Inner gate = focused Vitest (not coverage %)

- **Choice:** Fail→green→re-run focused file/name pattern; unit-core for high-risk packs.
- **Why:** Matches icee’s “prove this change” posture; web-server already uses Vitest.
- **Alternatives:** Jest everywhere (more migration); coverage thresholds as done criteria (rejected — encourages noise).

### 2. Outer gate = Playwright with icee ladder semantics

- **Choice:** `e2e:pulse` / `e2e:smoke` / `e2e:p0`; agent-served Vite preview or `vite preview` on 3002.
- **Why:** No existing Cypress; Playwright is reliable for agents; ladder vocabulary ports cleanly from icee.
- **Alternatives:** Port Cypress verbatim (higher ELECTRON/`run-cypress.sh` cost for little gain).

### 3. Instruction enforcement after harnesses exist

- **Choice:** Land Vitest + Playwright harnesses and green suites **first**, then write `AGENTS.md` / OpenSpec rules / apply-skill / `.cursor/rules` against the real script names.
- **Why:** Instructions that reference `e2e:p0` or `test:core` before those scripts exist leave agents with a broken playbook. Tests-first matches TDD and makes the instruction surface copy-paste accurate.
- **Alternatives:** Docs-first with temporary skip language (rejected for this change — causes drift and fake gates).

### 4. Client unit-core targets adapters/helpers first

- **Choice:** Market insights adapter, job analyzer API client shaping, `jobUploadFile` helper — not full view RTL matrix.
- **Why:** Highest regression value per test; views covered by Playwright p0.
- **Alternatives:** Broad RTL on every view (slow, brittle).

### 5. Web-server unit-core extends existing Vitest

- **Choice:** Script `test:core` aggregating job-analyzer validation/persistence, market-reports immutability, and critical service tests already present or added in-task.
- **Why:** Builds on current files; keeps CI fast with mocks.
- **Alternatives:** Full supertest against live Redis/Mongo (too heavy for inner gate).

### 6. Default e2e uses mocks; optional live stack later

- **Choice:** Mock API/fixtures for p0 guest journeys; document optional live stack as future follow-up.
- **Why:** Fork-friendly CI; no paid API requirement; still catches dead upload zones and routing breaks.
- **Alternatives:** Full docker-compose e2e like icee from day one (valuable later, larger first slice).

### 7. `w/PR` is the only commit autonomy exception

- **Choice:** Keep “no commit unless asked”; `w/PR` skill + alwaysApply rule opens **draft** PRs only and reports gates.
- **Why:** Matches icee autonomy ceiling without silent commits on ordinary applies.
- **Alternatives:** Always commit after apply (unsafe given current AGENTS policy).

### 8. Spec splitting for review

- **Choice:** Nine capabilities (instructions, two web-server, two client, two e2e, draft-PR, CI).
- **Why:** Reviewers can approve harness vs journeys vs CI separately; apply tasks map 1:1 to specs.
- **Alternatives:** One mega `testing` spec (harder to review/apply incrementally).

### 9. TDD + self-validation ladder (Decision for design consumers)

- **Inner:** focused Vitest on touched logic.
- **Outer:** Playwright add/update + pulse (+ p0 when product UI/API-for-UI; + smoke when shell/routes).
- OpenSpec `tasks.md` for product work MUST encode red→green pairs and an outer-gate section (enforced by config rules once landed).

## Risks / Trade-offs

- **[Risk] Agents apply other product changes mid-harness before instructions land** → Mitigation: keep this change focused; do not tighten apply-skill until section 7; ordinary applies stay on today’s lighter AGENTS until then.
- **[Risk] Playwright flake in CI** → Mitigation: start with pulse + few p0 journeys; quarantine folder; prefer test ids; retries sparingly.
- **[Risk] Mocked e2e misses API contract breaks** → Mitigation: web-server Vitest/supertest + client adapter unit-core; optional live e2e later.
- **[Risk] Skill/command drift** → Mitigation: write instructions only after scripts are green; spot-check in task 10.5.
- **[Risk] Path-filtered CI misses cross-surface bugs** → Mitigation: run e2e when either active client or web-server product paths change.

## Migration Plan

1. Land web-server Vitest harness + unit-core (green).
2. Land client Vitest harness + unit-core (green).
3. Land Playwright harness + critical journeys (pulse/smoke/p0 green).
4. Land AGENTS / OpenSpec config / apply skill / `.cursor/rules` documenting those real commands.
5. Land `w/PR` skill/rule.
6. Land GitHub Actions; fix any first-run failures.
7. Archive change; sync main specs.

Rollback: remove workflow / revert instruction files; harness packages can remain unused without breaking runtime product.

## Open Questions

- None blocking propose: Playwright over Cypress and Vitest over Jest are fixed for this change. Live docker-compose e2e stack is deferred unless apply discovers it is required for p0 stability.
