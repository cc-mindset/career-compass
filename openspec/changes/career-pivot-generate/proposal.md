## Why

Career Pivot needs a real generate API and guest-first three-path preview. No pivot backend exists today. This change delivers generation + guest preview only; authenticated workspace history and Action Plans land in `career-pivot-workspace`.

## What Changes

- Add Career Pivot generate API with validation (≥3 skills, required fields).
- Return exactly three ranked paths with transparent rationale.
- Support queued progress (Socket.IO) or sync fallback.
- Wire active client guest pivot input → processing → preview to the API.
- Prefill from Career Profile when available (optional dependency on profile change).
- Defer exploration list, immutability UX, and Action Plan to the follow-up change.

## Capabilities

### New Capabilities
- `career-pivot-generate`: request intake, generation, and three-path result contract for guest and authenticated callers.

### Modified Capabilities
- None.

## Impact

- New web-server routes/services; reuse OpenAI + optional queue/WS + optional RAG snippets.
- Active client guest pivot flow.
- Prerequisite for `career-pivot-workspace`.
