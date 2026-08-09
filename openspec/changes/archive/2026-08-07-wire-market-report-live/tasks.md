## 1. API client and socket

- [x] 1.1 Add `VITE_API_URL` (or equivalent) to active client
- [x] 1.2 Port Socket.IO subscribe/`progress` module from legacy patterns
- [x] 1.3 Implement generate caller for cache-hit, queued, and sync shapes

## 2. Adapter and UI

- [x] 2.1 Define API section types vs Clarity Coach tab view-models
- [x] 2.2 Implement adapter for overview + full tabs
- [x] 2.3 Wire generating/result/full views to live generate + progress
- [x] 2.4 Preserve guest overview gate and `postAuthRoute` continuation

## 3. Backend compatibility

- [x] 3.1 Set `CLIENT_URL`/CORS for active client port 3002
- [x] 3.2 Add optional `industry` on generate (backward compatible)
- [x] 3.3 Vitest for generate response branches used by the new client

## 4. Verification

- [x] 4.1 Manual: guest generate → overview → signup → full report
- [x] 4.2 Manual: Redis down still returns sync insights
- [x] 4.3 Confirm history UI remains out of scope (fixtures/empty OK until history change)
