# Career Compass Workspace Instructions

- This is a multi-surface monorepo. Treat `web-server`, `client/client/app`, `client/legacy-client/app`, `ai-enabler`, and `serverless` as separate ownership boundaries.
- `web-server` owns API routes, queueing, websocket progress, MongoDB models/cache, and RAG retrieval orchestration.
- `client/client/app` is the active frontend. `client/legacy-client/app` is a separate legacy app and should not be mixed into active feature work unless requested.
- `ai-enabler/rag-pipeline` owns Python ingestion and Pinecone data preparation. `serverless` owns scheduled jobs.
- Use the OpenSpec workflow for planning changes in `openspec/`; keep change artifacts coherent and do not create unrelated planning files outside the workflow.
- Prefer the existing README and package scripts in each surface before assuming commands, ports, or conventions.
- Preserve the current surface-specific naming patterns (`routes/`, `services/`, `db/`, `lib/`, `types/`, `utils/` in `web-server`; `src/views/`, `src/state/`, `src/components/` in the active client).
- Use the existing test tooling for the touched surface: Vitest in `web-server`, Jest in `client/legacy-client/app`, and the active client's lint/type-check scripts where applicable.
- Keep changes minimal and local to the owning surface unless a cross-surface contract change is required.