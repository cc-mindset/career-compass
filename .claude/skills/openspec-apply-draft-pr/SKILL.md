---
name: openspec-apply-draft-pr
description: >-
  Autonomously apply an OpenSpec change, create a feature branch, commit,
  push, and open a draft GitHub PR. Trigger phrase: w/PR.
  Also use for OpenSpec apply + branch + draft PR in one flow.
---

# OpenSpec apply → branch → draft PR

**Trigger:** user says `w/PR` (with or without a change name).

**HARD RULE:** Every PR created by this flow MUST be a **draft**. Never open a ready-for-review PR for `w/PR`. If MCP/`gh` creates a non-draft PR, convert it immediately (`gh pr ready <n> --undo` or equivalent) before returning the URL.

Run end-to-end without pausing for confirmation unless blocked (auth, conflicts, missing change name).

## Inputs

- **change**: kebab-case OpenSpec change name (required; infer from context if clear)
- **base**: PR target branch (default: repo default branch, else current tracking base)
- **branch**: `openspec/<change>` unless user names one

## Steps

1. **Apply** — Follow `.claude/skills/openspec-apply-change/SKILL.md` for `<change>` until tasks are done or hard-blocked. That includes AGENTS.md rules: **Vitest inner loop** for logic, add/update Playwright for UI/API-for-UI work, then run the e2e ladder (`e2e:pulse` always; smoke / p0 per touch surface) before treating apply as complete.
2. **Branch** — If not already on the feature branch:
   ```bash
   git checkout -b "openspec/<change>"
   ```
   (or checkout existing). Do not commit on `main`/`master` directly.
3. **Commit** — Stage only files for this change. Commit with a short message (why). User explicitly wants this flow = commit is allowed.
4. **Push** —
   ```bash
   git push -u origin HEAD
   ```
5. **Draft PR** — Prefer GitKraken MCP `pull_request_create` with `is_draft: true`; fallback **only** `gh pr create --draft`.
   - Title/body from change proposal summary + key tasks
   - **Must list gate status:** Vitest focused/unit-core and Playwright pulse/smoke/p0 as passed / failed / skipped (with reason)
6. **Return** — PR URL only (plus one line if blocked).

## Rules

- Never force-push. Never push to main/master.
- Never call `gh pr ready` (mark ready) unless the user explicitly asks after `w/PR`.
- If apply is blocked mid-way: still branch/commit/push/draft PR with what's done; note remaining tasks **and e2e gate status** in PR body.
- Do not ask whether to commit/push/PR — this skill authorizes that.
- Before draft PR: confirm e2e ladder from AGENTS.md was attempted; list which gates passed/failed/skipped in the PR body.
- PR diffs that change product UI or API-for-UI MUST include new or updated Playwright coverage (or an explicit PR note why not, only if blocked).
