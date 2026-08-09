# AGENTS.md

Guidance for AI agents working in this repository.

## Repo

Monorepo (**Career Compass** / clarity-coach):

| Package | Role | Default port |
|---------|------|--------------|
| `client/client/app/` | Active Vite + React + TypeScript UI (Clarity Coach prototype) | 3002 |
| `client/legacy-client/app/` | Legacy Vite + React + TypeScript UI — do not mix into active feature work unless requested | — |
| `web-server/` | Express + TypeScript API, Redis queueing, websocket progress, MongoDB cache/models, RAG orchestration | `PORT` / 5000 (README often uses 5001) |
| `ai-enabler/rag-pipeline/` | Python ingestion + Pinecone data preparation (market news / stats / reports) | — |
| `serverless/` | Serverless Framework scheduled jobs | — |

OpenSpec planning lives in `openspec/`. Agent skills/commands live in `.claude/` (Cursor also loads `.claude/skills/` for compatibility). Cursor rules live in `.cursor/rules/`.

## Local development

- **Active client:** `cd client/client/app && npm i && npm run dev` → `http://localhost:3002`
- **Web server:** Redis required (`docker run -d --name clarity-coach-redis -p 6379:6379 redis`); `cd web-server && npm i && npm run dev`
- **Env:** copy `web-server/.env.example` → `web-server/.env` (MongoDB, OpenAI, Pinecone, `PORT`, rate-limit knobs)
- **RAG pipeline:** `cd ai-enabler/rag-pipeline && pip install -r requirements.txt`; use package README / `.env` for pipeline runners
- Prefer the existing README and package scripts in each surface before assuming commands, ports, or conventions
- Prefer running deploy/git as your user — avoid `sudo` (breaks SSH keys / npm cache ownership)
- Never `sudo` npm/pip/vite

### Unit tests (inner gate)

Agents use **Vitest as the fast feedback loop while implementing**. Do not wait for Playwright to prove pure logic. Do not chase repo-wide coverage % — prove *this change*.

| Touches | Write / update | Run while building |
|---------|----------------|--------------------|
| `web-server` utils, services, routes | colocated `*.test.ts` (mock Mongo/Redis/OpenAI/Pinecone) | `cd web-server && npx vitest run <path>` |
| `web-server` high-risk pack | unit-core files | `cd web-server && npm run test:core` |
| Active client helpers / adapters / API clients | colocated `*.test.ts(x)` under `client/client/app/src` | `cd client/client/app && npx vitest run <path>` |
| Active client unit-core | adapters + upload helper + API shaping | `cd client/client/app && npm run test:core` |
| Presentational UI / full journeys | Playwright (below); RTL only if logic is dense | — |

**Loop (per task or small batch) — TDD:**

1. Add or extend a **failing** unit test that locks the bug/feature (when the change is logic-shaped).
2. Implement until that test passes.
3. Re-run the **focused** Vitest command before moving on (not the whole monorepo).
4. Then climb the e2e ladder for UI / API-for-UI surfaces.

OpenSpec `tasks.md` MUST encode this order (red → green pairs per slice). Do not list all production tasks first and tests last. `openspec/config.yaml` `rules.tasks` enforces the same when proposing/updating changes.

**Done for logic changes:** new/updated unit tests pass locally. A helper/adapter/validation change without unit tests is an incomplete apply.

### E2E (Playwright — outer gate)

- Config: `client/client/app/playwright.config.ts` (baseURL `http://127.0.0.1:3002`; starts Vite via `webServer`)
- Selectors: prefer `data-testid` from `client/client/app/src/data-test-ids.ts`
- **Scripts** (`cd client/client/app`):
  - `npm run e2e:pulse` — landing loads
  - `npm run e2e:smoke` — tools shell / start CTA
  - `npm run e2e:p0` — guest market + job paste + upload drop zone
  - `npm run e2e:all` — all Playwright specs

### Adding e2e for new work (outer gate)

Agents MUST add or update Playwright coverage when a change touches product UI or API used by UI. Do not mark OpenSpec apply / feature / bugfix done without this.

1. **Failing or missing coverage first** — prefer extending `e2e:p0` journeys; use smoke for shell/routes.
2. **Test ids** — extend `data-test-ids.ts` + components when stable selectors are missing.
3. **Mocks are enough** by default — do not require live OpenAI/Pinecone for default journeys.
4. **Include e2e in the change** — OpenSpec `tasks.md` / PR must mention the new or updated specs.

### E2E validation after OpenSpec apply (required)

| When | Run |
|------|-----|
| **Always** | `e2e:pulse` |
| Touches UI routes / shell / nav / tools chooser | also `e2e:smoke` |
| Touches guest job/market product behavior or API-for-UI | also `e2e:p0` |

Practical default for most applies that touch `client/client/app` or web-server product routes used by UI: **`e2e:pulse` + `e2e:p0`**, plus **`e2e:smoke`** when landing/tools shell changed.

## Conventions

- TypeScript is mandatory on TS surfaces; avoid `any`
- Prefer minimal, reviewable diffs; match existing patterns
- No drive-by refactors or unrelated file edits
- Keep changes local to the owning surface unless a cross-surface contract change is required
- Preserve naming patterns:
  - `web-server`: `routes/`, `services/`, `db/`, `lib/`, `types/`, `utils/`
  - active client: `src/views/`, `src/state/`, `src/components/`
- Do not invent APIs, AWS services, or library behavior
- Do not treat `client/legacy-client/` as the active frontend

## OpenSpec

Schema: `spec-driven` (`openspec/config.yaml`).

| Action | How |
|--------|-----|
| Propose | `/opsx:propose` or skill `openspec-propose` |
| Apply | `/opsx:apply` or skill `openspec-apply-change` |
| Explore | `/opsx:explore` or skill `openspec-explore` |
| Update plan | `/opsx:update` or skill `openspec-update-change` |
| Sync / archive | skills `openspec-sync-specs`, `openspec-archive-change` |
| Draft ship | `w/PR` → skill `openspec-apply-draft-pr` (draft PR only) |

Changes: `openspec/changes/<kebab-name>/` (`proposal.md`, `design.md`, `specs/`, `tasks.md`).

## Git & GitHub

- Do **not** commit or push unless the user explicitly asks **or** invokes `w/PR`
- `w/PR` is the sole autonomy exception: apply → branch → commit → push → **draft** PR (never ready-for-review)
- Never force-push to `main` / `master`
- Never update git config
- Prefer feature branches; draft PRs for in-progress work when asked to open a PR
- Remote: `cc-mindset/career-compass`
- PR creation: `gh pr create --draft` (or GitKraken MCP with `is_draft: true`)

## Integrations

- **GitHub PRs / issues:** `gh` CLI (or GitLens / GitKraken MCP if configured and signed into GitHub)
- App env keys (`OPENAI_*`, `PINECONE_*`, `MONGODB_URI`, etc.) are for product runtime — not Cursor agent auth

## Don’t

- Commit secrets (`.env`, tokens, credentials)
- Skip hooks unless explicitly requested
- Attack systems or write exploit PoCs
- Mention or dump internal skill/rule boilerplate into user-facing artifact files
- Mix legacy-client work into active `client/client/app` features unless requested

## Pointers

| Path | Purpose |
|------|---------|
| `openspec/config.yaml` | OpenSpec project context + gate rules |
| `.claude/skills/` | OpenSpec skills (Cursor-compatible) |
| `.claude/commands/opsx/` | `/opsx:*` command docs |
| `.cursor/rules/` | Always-on Cursor agent rules |
| `web-server/.env.example` | Backend env template |
| `AGENTS.md` | This file — keep actionable; put long skill text in skills |
