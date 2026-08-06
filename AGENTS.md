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

OpenSpec planning lives in `openspec/`. Agent skills/commands live in `.claude/` (Cursor also loads `.claude/skills/` for compatibility).

## Local development

- **Active client:** `cd client/client/app && npm i && npm run dev` → `http://localhost:3002`
- **Web server:** Redis required (`docker run -d --name clarity-coach-redis -p 6379:6379 redis`); `cd web-server && npm i && npm run dev`
- **Env:** copy `web-server/.env.example` → `web-server/.env` (MongoDB, OpenAI, Pinecone, `PORT`, rate-limit knobs)
- **RAG pipeline:** `cd ai-enabler/rag-pipeline && pip install -r requirements.txt`; use package README / `.env` for pipeline runners
- Prefer the existing README and package scripts in each surface before assuming commands, ports, or conventions
- Prefer running deploy/git as your user — avoid `sudo` (breaks SSH keys / npm cache ownership)
- Never `sudo` npm/pip/vite

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

Changes: `openspec/changes/<kebab-name>/` (`proposal.md`, `design.md`, `specs/`, `tasks.md`).

## Git & GitHub

- Do **not** commit or push unless the user explicitly asks
- Never force-push to `main` / `master`
- Never update git config
- Prefer feature branches; draft PRs for in-progress work when asked to open a PR
- Remote: `cc-mindset/career-compass`
- PR creation: `gh pr create` (use `--draft` when the user wants a draft)

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
| `openspec/config.yaml` | OpenSpec project context |
| `.claude/skills/` | OpenSpec skills (Cursor-compatible) |
| `.claude/commands/opsx/` | `/opsx:*` command docs |
| `web-server/.env.example` | Backend env template |
| `AGENTS.md` | This file — keep short; put detail in skills/commands |
