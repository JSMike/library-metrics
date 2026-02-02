# Session 1

**Date:** 2026-02-02

**Prompt/Ask:** Make the `.output` deployment self-contained by copying the SQLite database into it.

## Completed
- Added a build-time script to copy the SQLite DB (and WAL/SHM if present) into `.output/data/library-metrics.sqlite`.
- Updated the build script to run the copy step after Vite completes.

## Current Status
- Changes are in place; build not re-run yet.

## Plan Coverage
- Implemented plan items 1-2; verification pending.

## Files Changed
- `.issues/LM-17/issue.md` - created issue metadata.
- `.issues/LM-17/plan.md` - documented approach.
- `.issues/index.md` - added LM-17 to in-progress list.
- `scripts/copy-db.ts` - build-time SQLite copy logic.
- `package.json` - run DB copy step after build.

## Verification
- Run `bun --bun vite build` and confirm it logs a DB copy into `.output/data/library-metrics.sqlite`.
- Run `bun --bun vite preview` and confirm it starts without `SQLITE_CANTOPEN`.

## Next Steps
- If the DB is missing, ensure `data/library-metrics.sqlite` exists before building.
