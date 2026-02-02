# Session 1

**Date:** 2026-02-02

**Prompt/Ask:** Preview server fails with `SQLITE_CANTOPEN` after a successful build.

## Completed
- Added project-root-aware DB path resolution so preview can find `./data/library-metrics.sqlite` when running from `.output`.
- Logged the issue and plan for LM-16.

## Current Status
- Code updated; preview not re-run yet.

## Plan Coverage
- Implemented plan items 1-2; verification pending.

## Files Changed
- `.issues/LM-16/issue.md` - created issue metadata.
- `.issues/LM-16/plan.md` - documented approach.
- `.issues/index.md` - added LM-16 to in-progress list.
- `src/db/client.ts` - resolve relative DB paths against project root.

## Verification
- Run `bun --bun vite build` then `bun --bun vite preview`; confirm the server starts without `SQLITE_CANTOPEN` and pages load.

## Next Steps
- If preview still fails, inspect runtime `process.cwd()` and computed DB path for further adjustments.
