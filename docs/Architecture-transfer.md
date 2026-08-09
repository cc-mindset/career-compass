# Architecture Transfer

**Purpose.** Orient engineering on how Clarity Coach / Career Compass is structured today, what the active client is trying to achieve, what the legacy stack already proved against real backends, and how to plug `web-server` + `ai-enabler` into the new UI without reinventing contracts.

**Audience.** Engineers transferring from the legacy CareerCompass UI (or greenfield) onto the active Clarity Coach client.

**Sources.** `docs/product/PRD.md` (v4.0), `client/client/app/`, `client/legacy-client/app/`, `web-server/`, `ai-enabler/rag-pipeline/`, plus a live `web-server` boot on 2026-08-07.

---

## 1. Client ownership decision

There are **two** frontends in this monorepo:

| Path | Role | Status |
|------|------|--------|
| `client/client/app/` | **Active** Clarity Coach UI — guest-first prototype (Vite + React + TypeScript). Default port **3002**. | **Build here.** |
| `client/legacy-client/app/` | Legacy **CareerCompass** UI — Market Insights + Eco Simulator against live APIs. Default port **3000**. | **Reference only.** Do not mix feature work into it unless explicitly requested. |

**Moving forward:** all product UI (Career Pivot, Job Analyzer, Market Report, Career Profile, Skills Match, Home) is built on `client/client/app`. Use `legacy-client` as the proven integration reference for Market Insights REST + Socket.IO + Clerk/`/api/users` patterns — not as the product shell.

Supporting surfaces:

| Path | Role |
|------|------|
| `client/client/clarity-coach-prototype/` | HTML prototypes that drove the active client (e.g. Market Report v7.5). |
| `client/legacy-client/ui-design-library/` | Storybook-style kit for legacy `ui-kit` (port 3001). |
| `web-server/` | Express API, Redis queue, Socket.IO progress, Mongo cache, RAG orchestration. |
| `ai-enabler/rag-pipeline/` | Offline / scheduled Pinecone ingestion (reports, news, labor stats). |
| `serverless/` | Scheduled jobs (separate from the Vite clients). |

---

## 2. What the product is trying to achieve (PRD)

Canonical PRD: [`docs/product/PRD.md`](./product/PRD.md) — **Clarity Coach Guest-First Experience v4.0** (31 July 2026).

### Product decisions

| Decision | Behavior |
|----------|----------|
| Guest-first value | Career Pivot, Job Analyzer, and Market Report start from the landing page without an account. |
| No repeated input | Landing inputs carry into guest workspaces and through account creation. |
| Progressive account gate | Account only for saving, deeper analysis, full reports, plans, or authenticated continuation. |
| Shared profile | **Career Profile** is the reusable evidence layer; tools read/write compatible fields. |
| Dashboard routing | Direct signup → new-account Home; converted guests return to the originating feature + result. |
| History | Latest + previous work, plus an explicit create-new action. Never overwrite prior records. |
| No fabrication | Never invent names, profile completion, history, reports, experience, or saved work. |

### MVP features

| Feature | MVP outcome | Guest? |
|---------|-------------|--------|
| Onboarding / account | Create or access an account without losing guest work. | Account boundary |
| **Job Analyzer** + Hidden Expectations | Stated requirements, inferred expectations, evidence, confidence. | Yes |
| **Skills Match** | Compare a role to career evidence; strengths, partial matches, gaps. | Authenticated |
| **Career Pivot** + Action Plan | Three realistic adjacent paths → selected path becomes a plan. | Yes |
| **Market Report** | Role/location outlook, opportunities, capabilities, actions, evidence. | Yes |
| **Career Profile** | Reusable evidence + progressive completion. | Authenticated |
| Admin portal | Users, content, prompts, runs, sources, failures. | Internal |

Authenticated left nav (PRD): **Home → Job Analyzer → Skills Match → Career Pivot → Market Report → Career Profile**.

### Success measures (product)

Time to first useful guest result; guest→account conversion; continuation recovery to the exact originating state; Career Profile reuse/prefill; repeat analyses (new pivot / job / market report).

### Backend entities the PRD expects (not all exist yet)

`User` / `GuestSession` · `CareerProfile` / `ProfileSection` · `PivotExploration` / `PivotPath` / `ActionPlan` · `JobAnalysis` / `HiddenExpectation` · `SkillsAssessment` · `MarketReport` / `MarketSnapshot` · `AIExecution` / `EvidenceSource`.

---

## 3. System map

```text
┌─────────────────────────────────────────────────────────────────┐
│  ACTIVE UI: client/client/app  (Clarity Coach prototype)        │
│  Hash routes · ClarityContext · mostly static fixtures today    │
└────────────────────────────┬────────────────────────────────────┘
                             │  (to be wired)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  REFERENCE UI: client/legacy-client/app  (CareerCompass)        │
│  Already calls Market Insights + Eco Simulator + Users/Resume   │
└────────────────────────────┬────────────────────────────────────┘
                             │  REST + Socket.IO
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  web-server  (Express · PORT from .env, often 5001)             │
│  /api/market-insights  /api/users  /api/resume  /api/eco-…      │
│  Redis queue (optional) · Socket.IO progress · Mongo LLM cache  │
│  ragRetrievalService → OpenAI embeddings + Pinecone query       │
└────────────────────────────┬────────────────────────────────────┘
                             │  read-only retrieval
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Pinecone index (e.g. market-knowledge)                         │
│  Namespaces: market-reports · market-news · labor-market-stats  │
│              (+ geo-labor-signals, forward-looking from stats)  │
└────────────────────────────▲────────────────────────────────────┘
                             │  ingest (scheduled / CLI)
┌─────────────────────────────────────────────────────────────────┐
│  ai-enabler/rag-pipeline                                        │
│  market_reports (PDF) · market_news (SERP) · market_stats       │
│  S3 intermediates · Mongo pipeline registries (ops/dedup)       │
└─────────────────────────────────────────────────────────────────┘
```

**Division of responsibility**

| Layer | Owns |
|-------|------|
| Active client | Interaction design, IA, guest→account UX, feature workspaces. |
| Legacy client | Proven API/WS integration patterns to copy. |
| `web-server` | Request-time RAG retrieval, LLM synthesis, caching, user/profile persistence. |
| `ai-enabler` | Offline ingestion and freshness of Pinecone knowledge. **UI never ingests.** |

---

## 4. Active client (`client/client/app`)

### What it is

React 19 + Vite + TypeScript port of the Clarity Coach guest-first HTML prototype. Package name: `client-clarity`. Port **3002**.

```text
src/
  App.tsx
  components/          layout, DashboardShell, forms, SkillPicker, AccountControls
  consts/              options, INITIAL_STATE, DEMO_STATES
  state/contexts/      ClarityContext
  types/
  styles/prototype.css
  views/
    landing/ guest/ auth/ dashboard/
    job-workspace/ market-workspace/ career-profile/ new-account/
    RouteRenderer.tsx
```

### Routing and state

- **Hash routing** (`#landing`, `#market-workspace-result`, …) via `ClarityContext.navigate` + `hashchange`.
- Single in-memory **`ClarityState`** (tool inputs, `registered`, `pendingGuest`, `postAuthRoute`, profile flags, market workspace flags, theme).
- Theme is the only `localStorage` key (`clarity-theme`).
- Floating **Demo states** panel jumps through scripted screens.

### Feature coverage vs PRD

| Feature | Active client today |
|---------|---------------------|
| Guest Career Pivot / Job / Market | Screens + account gates; fake processing delays |
| Market Report workspace | Most complete: empty/new/generating/overview/full tabs/history; **static** `views/market-workspace/data.ts` |
| Job Analyzer workspace | empty/history/new/review/result; static Hidden Expectations copy |
| Skills Match | Gating UI only (profile needed vs ready); toast, not scoring |
| Career Profile | LinkedIn/résumé/manual UI; boolean `profileComplete`, not section persistence |
| Career Pivot authenticated workspace | Thin — sidebar still routes into `#prototype-new-account-*` |
| Real auth / guest session / APIs | **None** — no `fetch`, socket, or auth SDK in `src/` |

Treat the active client as the **interaction and information-architecture reference**, not a production API shell.

### Run

```bash
cd client/client/app && npm i && npm run dev   # http://localhost:3002
```

---

## 5. Legacy client (`client/legacy-client/app`) — architectural reference

### What it is

**CareerCompass** — Vite + React 19 + TypeScript. Port **3000**. Branding and IA differ from Clarity Coach (Market Insights + Eco Simulator nav; no Job Analyzer / Skills Match / Career Pivot product surfaces).

Navigation is **not** URL-routed: `App.tsx` switches `AppView` in React state.

### How it talks to `web-server` (copy these patterns)

| Integration | Path / mechanism |
|-------------|------------------|
| Base URL | `import.meta.env.VITE_API_URL` (socket falls back to `http://localhost:5001`) |
| Market Insights | `POST /api/market-insights/generate` — `state/marketInsights/MarketInsightsContext.tsx` |
| Progress | Socket.IO singleton `providers/socket/socket.ts`; `emit('subscribe', jobId)`; listen `progress` |
| Status poll (unused helper) | `GET /api/market-insights/status/:jobId` — `utils/polls/pollForInsights.ts` |
| Eco Simulator | `GET /api/eco-simulator?...` — `EcoSimulatorContext.tsx` |
| Users | `POST /api/users`, `GET /api/users/:clerkId` (SyncUser currently commented out in `App.tsx`) |

**WS `progress` types** (see `state/api/sectionTypes.ts`):  
`job_start` · `section_in_progress` · `section_success` · `section_error` · `job_complete` · `job_error` · `job_fallback`

**Sections:** `marketReport` · `industryTrends` · `newsAndCareerIntel`

### Auth note

Clerk is required at bootstrap (`VITE_CLERK_PUBLISHABLE_KEY`), but the sign-in gate / SyncUser path is largely **commented out**. Journey gate is `user.hasJourneyStarted` in session storage. No Clerk JWT is attached to API `fetch` calls — the server trusts client-supplied `clerkId` / `userId`.

### Feature mapping (legacy ↔ PRD)

| PRD | Legacy |
|-----|--------|
| Market Report | Partial — real generate + WS sections, plus mock chrome (`MOCK_NEWS`, fallbacks) |
| Career Profile | Thin local `UserProfile` + optional `/api/users`; hardcoded StatCard counts |
| Career Pivot | Only “pivot direction” snippets inside Industry Trends — **not** the product |
| Job Analyzer / Skills Match | **Absent** |
| Eco Simulator | Full real API view — **out of PRD MVP** |

### Highest-value files to reuse conceptually

| File | Why |
|------|-----|
| `state/marketInsights/MarketInsightsContext.tsx` | Queue → subscribe → progressive sections → cache hit |
| `providers/socket/socket.ts` | Stable Socket.IO client |
| `components/section-wrapper/` | Loading / error / retry around streamed sections |
| `views/landing-page/sync-user/` | `/api/users` upsert payload shape |
| `app/src/ui-kit/` | Optional design atoms — new IA/shell differs |

### Run (when local env is healthy)

```bash
cd client/legacy-client/app
# .env: VITE_CLERK_PUBLISHABLE_KEY, VITE_API_URL (→ web-server)
npm i && npm run dev   # http://localhost:3000
```

**Observed blocker (2026-08-07):** `node_modules` (including `.vite-temp`) owned by `root` → Vite `EACCES`. Fix as your user (never `sudo npm`): remove/reinstall `node_modules` after reclaiming ownership. Do not use `sudo` for npm/vite.

---

## 6. Feature deep-dives (PRD intent × current stack)

### 6.1 Career Pivot

**PRD:** Situation, role, industry, experience, location, desired improvement, ≥3 transferable skills → three ranked paths with fit rationale; first result needs no résumé; Build a plan / Strengthen profile after account; workspace empty/unfinished/saved + New exploration (immutable history).

**Active client:** Guest input + preview; authenticated path still prototype (`#prototype-new-account-*`).

**Backend today:** **No dedicated Career Pivot API.** Greenfield service needed (or careful composition of profile + market signals). Do not invent endpoints from `web-server/EXAMPLES.js` — that file is documentation only.

**Plug-in path:** Keep Clarity Coach UX; add routes under `web-server` for pivot generate/history; persist `PivotExploration` records; reuse Career Profile fields for prefill (`PATCH /api/users/:id/profile` is the closest existing write surface).

### 6.2 Career Profile

**PRD:** Progressive sections (context, evidence, direction, preferences); LinkedIn / résumé / manual; section-level save; prefill Pivot + Market Report; never silently overwrite confirmed facts.

**Active client:** Modal source chooser + manual editor; `profileComplete` boolean; `syncProfileToMarket()` copies pivot fields into market inputs when complete.

**Backend today:**

| Call | Role |
|------|------|
| `POST /api/users` | Upsert by `clerkId` |
| `GET /api/users/:userId` | Hydrate |
| `PATCH /api/users/:userId/profile` | `$set: { profile }` |
| `POST /api/resume/upload` | Multipart résumé → OpenAI parse → profile |

**Plug-in path:** Map Clarity Coach section model onto `IProfile` (`web-server/types/user.ts`); wire résumé upload for evidence; extend schema for section completion / provenance as PRD requires. Auth is still client-trusted `clerkId` — harden before production.

### 6.3 Job Analyzer

**PRD:** User-supplied job (paste primary; URL only if parse succeeds); stated vs inferred Hidden Expectations with evidence/confidence; guest preview → account for full save + Skills Match.

**Active client:** Full workspace IA with static result copy.

**Backend today:** **No Job Analyzer API.** Resume parser is profile-oriented, not job-posting analysis.

**Plug-in path:** New routes/services for parse + analyze + store `JobAnalysis` / `HiddenExpectation`; keep guest continuation via `pendingGuest` / `postAuthRoute` patterns already in the active client.

### 6.4 Market Report (best plug-in fit)

**PRD:** Inputs role, industry, seniority, location (profile-prefill); generation progress → auto-open overview; guest overview with gated deep CTAs; full report tabs Overview / Opportunities / Skills & actions / Evidence; history + dated snapshots.

**Active client:** Workspace matches this hierarchy; content is fixture-driven.

**Backend today (live):**

1. `POST /api/market-insights/generate`  
   Body: `{ location, userId?, job?, seniority? }`  
   → cache hit **or** `{ queued, jobId }` **or** sync generate if Redis down.
2. Socket.IO `subscribe` + `progress` events for section streaming.
3. Optional `GET /api/market-insights/status/:jobId`.
4. RAG namespaces queried: `labor-market-stats`, `market-news`, `market-reports`.
5. LLM sections: `marketReport`, `industryTrends`, `newsAndCareerIntel` (multipart service).
6. Mongo caches section payloads (24h TTL on LLM cache reads).

**Plug-in path (recommended first integration):**

1. Port legacy `MarketInsightsContext` + socket provider into active client (or a thin `services/marketInsights` module).
2. Map generate body: UI `market.role` → `job`, `market.level` → `seniority`, `market.location` → `location`.
3. Replace `data.ts` fixtures with streamed section payloads; adapt UI fields where shapes differ (prototype tabs vs API section JSON).
4. Set `CLIENT_URL` / Socket CORS to `http://localhost:3002` (legacy default was `5173`).
5. Keep guest gate: only overview-equivalent data before account; deeper tabs after `registered`.
6. Report **history / snapshots** as PRD entities still need new persistence — today’s Mongo cache is location/job/seniority keyed LLM cache, not user report history.

**Shape mismatch to plan for:** Active UI expects outlook hero, opportunity filters, capability bars, evidence groups. API returns prompt-shaped JSON (`market_report_summary`, `growth_sectors`, `market_news`, `report_sources`, …). Add an adapter layer in the client (or a dedicated BFF formatter) — do not assume 1:1 field names.

---

## 7. `web-server` architecture

**Package:** `cc-ai-backend` · Entry: `server/index.ts` · App mounts: `server/app.ts`.

### Routes (actual)

| Mount | Purpose |
|-------|---------|
| `GET /` | Health: `Ccmindset api is live` |
| `/api/market-insights` | Market Report generation + job status |
| `/api/users` | User upsert / get / profile patch / premium (dev) |
| `/api/resume` | Résumé upload → profile |
| `/api/eco-simulator` | Economic simulator (legacy UI) |
| `/api/cron` | Cache warmers (unauthenticated) |
| `/api/test-resume` | Local test fixtures |

**Not implemented:** Career Pivot, Job Analyzer, Skills Match, GuestSession, MarketReport history entities, Admin portal.

### Infra

| Component | Behavior |
|-----------|----------|
| MongoDB | Required (`MONGODB_URI`). Users + LLM section caches. |
| Redis | Soft-fail. Queue + OpenAI rate windows; without Redis, market insights run synchronously. |
| Socket.IO | Same HTTP server; rooms `job:{jobId}`; event name `progress`. |
| OpenAI | Chat `gpt-4o`; embeddings `text-embedding-3-large` (env override). |
| Pinecone | Index from `PINECONE_INDEX_NAME` (default `market-knowledge`). |

### Env (minimum)

Copy `web-server/.env.example` → `.env`. Runtime also uses (among others): `REDIS_URL`, `CLIENT_URL`, `CORS_ORIGIN`, `PINECONE_INDEX_NAME`, RAG TTL/concurrency knobs. Prefer the example file + code in `lib/*` over inventing vars.

### Run

```bash
docker run -d --name clarity-coach-redis -p 6379:6379 redis
cd web-server && npm i && npm run dev
# PORT from .env — commonly 5001 (root README); code default if unset is 5000
```

**Observed (2026-08-07):** Server reached “running” with Mongo connected; Redis unavailable → “using fallback” (sync generate still works). Socket.IO enabled.

### Auth gap

No server-side JWT validation. CORS may allow `Authorization`, but routes trust body/params `userId` / `clerkId`. Production transfer must add auth before exposing generate/cron/premium.

---

## 8. `ai-enabler` architecture

**Active path:** `ai-enabler/rag-pipeline/` (not the older `ai-enabler/db/scripts/` Career Insights namespaces).

### Pipelines → Pinecone

| Pipeline | Ingest | Pinecone namespace(s) |
|----------|--------|----------------------|
| `market_reports` | PDF drops in S3 inbox | `market-reports` |
| `market_news` | SerpAPI Google News | `market-news` |
| `market_stats` | BLS + StatsCan | `labor-market-stats` (+ `geo-labor-signals`, `forward-looking` by signal) |

Shared: embeddings `text-embedding-3-large`, S3 intermediates, Mongo **pipeline registries** (ops/dedup — not the product LLM cache).

SAM schedules in `rag-pipeline/template.yaml`: reports weekly, stats monthly, news every 12h.

### How Market Report consumes this

`web-server` `ragRetrievalService.retrieve()` → namespaces `labor-market-stats`, `market-news`, `market-reports` → `formatMarketInsightsContext` → multipart LLM prompts. UI only displays results.

### Known transfer risks

1. **Legacy vs active namespaces:** `db/scripts` used `career-insights` / `news-data` / `bls-data`. Market Insights uses the new names — prefer `rag-pipeline` + `RagNamespace` in `web-server/types/rag.ts`.
2. **Stats cleanup namespace:** cleanup may target `market-stats` while upserts write `labor-market-stats` — verify before ops work.
3. **News `metadata.text`:** retrieval filters on `metadata.text`; confirm news upserts populate it or retrieval will drop matches.
4. **Unused namespaces in Market Insights query:** `geo-labor-signals`, `forward-looking` are produced/typed but not always queried.

### Run (ops)

```bash
cd ai-enabler/rag-pipeline
pip install -r requirements.txt
cp .env.example .env   # AWS, Mongo, OpenAI, Pinecone, SERP, BLS, …
# See runner.py CLIs / README / template.yaml
```

---

## 9. Plugging backends into the active UI without issues

### Principles

1. **Do not reinvent ingestion** in the client — call `web-server`; keep `ai-enabler` offline.
2. **Copy legacy Market Insights orchestration**, not legacy chrome/IA.
3. **Adapter layer** between API JSON and Clarity Coach report tabs.
4. **Preserve guest-first UX** already in `ClarityContext` (`pendingGuest`, `postAuthRoute`, market auth gate).
5. **Do not invent APIs** — if Pivot / Job / Skills need backends, add explicit OpenSpec + routes; ignore `EXAMPLES.js` as live contract.
6. **Align ports/CORS:** active client **3002**, web-server **5001** (typical), set `CLIENT_URL` / `VITE_API_URL` accordingly.
7. **Redis optional for local demos** (sync path), but required for production-like queue + fair OpenAI rate limiting.

### Suggested integration order

| Priority | Work | Depends on |
|----------|------|------------|
| 1 | Market Report: REST + WS + section adapter into `market-workspace` | Existing generate API + Pinecone data |
| 2 | Career Profile: users + résumé upload + section save model | `/api/users`, `/api/resume` |
| 3 | Auth: real providers + server verification + guest session claim | PRD GuestSession; Clerk or equivalent |
| 4 | Job Analyzer API + wire job-workspace | New backend |
| 5 | Career Pivot API + replace prototype-new-account path | New backend |
| 6 | Skills Match scoring | Profile + Job/target evidence |
| 7 | Market Report user history / snapshots | New persistence beyond LLM cache |
| 8 | Admin portal | Later |

### Local full-stack checklist

```bash
# Redis (recommended)
docker run -d --name clarity-coach-redis -p 6379:6379 redis

# API
cd web-server && cp .env.example .env   # fill secrets as your user
npm i && npm run dev                   # confirm GET / → live

# Active UI (product work)
cd client/client/app && npm i && npm run dev   # :3002

# Legacy UI (integration reference only — after fixing root-owned node_modules if needed)
cd client/legacy-client/app && npm i && npm run dev   # :3000
```

Root `README.md` still mentions FE on 5173 — that does **not** match either client port in current packages; trust per-package config and `AGENTS.md`.

---

## 10. OpenSpec readiness (yes / no)

**Yes** — five OpenSpec changes (one per feature) can be authored with confidence from the PRD, active client IA, legacy Market Insights integration, `web-server` routes, and `ai-enabler` namespaces.

That confidence is about **spec quality and implementability**, not about every feature being a thin wire-up of existing APIs.

| Feature | Spec confidence | Plug existing backend? | Mostly new backend? |
|---------|-----------------|------------------------|---------------------|
| **Market Report** | High | **Yes** — `/api/market-insights`, Socket.IO progress, Pinecone RAG (`labor-market-stats`, `market-news`, `market-reports`), Mongo LLM cache, legacy client orchestration | History / snapshots / guest claim; UI↔API field adapter |
| **Career Profile** | High | **Partial** — `/api/users`, `/api/resume/upload`, `IProfile` | Section-level save, provenance, LinkedIn retrieval, progressive completion % |
| **Career Pivot** | High (to define) | **No dedicated API** — can *reuse* profile fields + market signals (`industryTrends` / RAG) as inputs only | Path ranking, three-path contract, Action Plan, exploration history |
| **Job Analyzer** | High (to define) | **No dedicated API** — résumé parser is profile-oriented, not job-posting analysis | Posting parse, Hidden Expectations, evidence/confidence, analysis records |
| **Skills Match** | High (to define) | **No dedicated API** — needs confirmed Career Profile + target role/job | Scoring, evidence traces, gap list, assessment records |

Suggested OpenSpec changes (current): `wire-market-report-live` → `market-report-history`; `career-profile-persistence`; `career-pivot-generate` → `career-pivot-workspace`; `job-analyzer-backend`. Skills Match deferred until UI is ready.

---

## 11. Gaps to complete all five features

### 11.1 Cross-cutting (blocks every feature’s production path)

| Gap | Why it matters | Closest existing work |
|-----|----------------|------------------------|
| **Server auth** | APIs trust client `userId` / `clerkId`; cron/premium unprotected | Clerk in legacy client (client-only); CORS allows `Authorization` but nothing validates it |
| **GuestSession + claim/merge** | PRD requires opaque guest ID, expiry, authenticated merge without re-asking | Active client: `pendingGuest` / `postAuthRoute` in memory only |
| **Typed API client in active UI** | No `fetch`/socket module in `client/client/app` | Legacy `MarketInsightsContext` + `providers/socket` |
| **AIExecution / evidence metadata** | PRD: run ID, model/prompt version, sources, confidence, fallback | Partially present in market insights WS + RAG formatters; not productized across tools |
| **Admin portal** | PRD MVP table includes it | Absent |
| **Analytics events** | Guest start/complete, gate, conversion, continuation | Absent |
| **CORS / ports** | Active UI `:3002`; WS `CLIENT_URL` often defaults to legacy ports | Env knobs exist — must be set deliberately |

### 11.2 Per feature

#### Market Report — smallest gap to “real”

| Gap | Status |
|-----|--------|
| Wire generate + WS into `market-workspace` | Not done (fixtures in `data.ts`) |
| Adapter: API sections → Overview / Opportunities / Skills & actions / Evidence tabs | Required — shapes do not match 1:1 |
| User-owned report history + dated snapshots | **Missing** — Mongo cache is `location__job__seniority` LLM cache, not `MarketSnapshot` |
| Industry / work-preference inputs on API | Generate body is `location`, `job?`, `seniority?` — industry may need API extension or prompt context |
| News vector `metadata.text` / stats namespace cleanup consistency | Ops/RAG quality risks (see §8) |
| Share / Download PDF | Out of guest scope; authenticated PDF not built |

#### Career Profile — partial plug

| Gap | Status |
|-----|--------|
| Map Clarity Coach sections → `IProfile` / `PATCH .../profile` | Schema may need extension |
| Section-level save + Home progress % | UI uses booleans; PRD wants independent section save |
| LinkedIn import (not just URL field) | Not implemented server-side |
| Résumé upload UX → `/api/resume/upload` | Backend exists; active client not wired |
| Source provenance + “do not silently overwrite confirmed facts” | Not enforced |
| Prefill Pivot / Market from saved profile | Client helper only (`syncProfileToMarket`); no server round-trip |

#### Career Pivot — mostly greenfield backend

| Gap | Status |
|-----|--------|
| `POST` (or queue) generate three paths | **No route** |
| Role taxonomy / transferable-skill graph | Not a first-class service (skills lists exist in client consts) |
| Persist `PivotExploration` / paths / Action Plan | **No models** |
| Workspace list: empty / unfinished / saved / new (immutable) | UI prototype incomplete; no API |
| Use market RAG for “market signal” on paths | Possible *input* via existing retrieval — not a pivot product |
| Guest preview → account → restore exploration | Needs GuestSession |

#### Job Analyzer — mostly greenfield backend

| Gap | Status |
|-----|--------|
| Job paste / URL / upload ingest | **No job-analysis route** (resume upload ≠ job posting) |
| Stated vs Hidden Expectations + evidence spans | **No service** |
| Confidence / prompt versioning | Pattern exists on market insights — not applied here |
| Persist `JobAnalysis` history | **No models** |
| Guest preview → full result after auth | Client-only today |
| URL fetch/parse when posting blocks access | PRD conditional; not built |

#### Skills Match — mostly greenfield backend

| Gap | Status |
|-----|--------|
| Assessment endpoint (target role/JD + profile evidence) | **No route** |
| Traceable strengths / partial / gaps | **No service** |
| Block / gate until Career Profile evidence exists | UI gating only |
| Persist `SkillsAssessment` | **No models** |
| Handoff from Job Analyzer / Market Report | Navigation only in active client |

### 11.3 What existing resources *do* transfer into new backends

Reusable building blocks when OpenSpec implementation starts:

| Building block | Use for |
|----------------|---------|
| Redis queue + Socket.IO `progress` | Long-running Pivot / Job / Skills / Market generate |
| `ragRetrievalService` + Pinecone namespaces | Market Report; market signals inside Pivot |
| OpenAI client + token budget | All LLM features |
| Mongo models + db-cache TTL pattern | Feature records and caches |
| Resume parse (`resumeParser`) | Career Profile evidence |
| Legacy Market Insights client flow | First UI integration template |
| Active client workspaces + PRD contracts | Acceptance criteria for each spec |

### 11.4 Explicit non-goals (unless product expands)

| Item | Note |
|------|------|
| Eco Simulator in active Clarity Coach UI | Live in legacy + `/api/eco-simulator`; not PRD MVP |
| Treating `web-server/EXAMPLES.js` as live API | Documentation only |
| Reimplementing SERP/BLS/StatsCan/PDF ingest in the UI or web-server request path | Belongs in `ai-enabler` |

---

## 12. File index (highest signal)

| Path | Why |
|------|-----|
| `docs/product/PRD.md` | Product contract |
| `client/client/app/src/views/RouteRenderer.tsx` | Active IA / routes |
| `client/client/app/src/state/contexts/ClarityContext.tsx` | Active state + guest continuation |
| `client/client/app/src/views/market-workspace/` | Target Market Report UX |
| `client/legacy-client/app/src/state/marketInsights/MarketInsightsContext.tsx` | Proven generate + WS flow |
| `client/legacy-client/app/src/providers/socket/socket.ts` | Socket.IO client |
| `web-server/server/app.ts` | Route mounts |
| `web-server/routes/marketInsight.ts` | Market Report API |
| `web-server/services/market-insights/marketInsightsService_multipart.ts` | RAG + LLM + WS |
| `web-server/services/ragRetrievalService.ts` | Pinecone retrieval |
| `web-server/types/rag.ts` | Namespace contract |
| `ai-enabler/rag-pipeline/README.md` | Ingestion ops |
| `ai-enabler/rag-pipeline/template.yaml` | Schedules |
| `AGENTS.md` | Monorepo agent conventions |

---

## 13. One-line cheat sheet

> Build Clarity Coach UX in **`client/client/app`**; use **`legacy-client`** only as the Market Insights + Users integration reference; keep **`ai-enabler`** for Pinecone freshness; call **`web-server`** for generate/profile/resume — and plan **new** APIs for Career Pivot, Job Analyzer, Skills Match, guest sessions, and report history.
