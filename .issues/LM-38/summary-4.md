# Session 4

**Date:** 2026-02-04

**Prompt/Ask:** Make regex optional for zoekt usage queries, document behavior, and group usage queries into a folder.

## Completed
- Made `regex` optional for usage queries and skipped regex fallback when missing.
- Organized usage queries into a folder (`src/lib/usage-queries/`) with per-domain files.
- Added documentation for zoekt vs basic fallback in `src/lib/usage-queries/README.md`.
- Updated README references to the new folder.

## Current Status
- LM-38 in-progress; requires verification with a sync run.

## Files Changed
- `src/lib/usage-queries/types.ts` - optional `regex` and shared types.
- `src/lib/usage-queries/box-model.ts` - moved default usage targets.
- `src/lib/usage-queries/index.ts` - aggregates targets/queries.
- `src/lib/usage-queries/README.md` - documents zoekt + regex behavior.
- `src/jobs/sync-gitlab.ts` - skips regex fallback when regex is missing.
- `README.md` - updated usage query paths and documentation pointer.
- `AI-README.md` - updated usage query path.
- Removed: `src/lib/usage-queries.ts`.

## Verification
- Run `bun --bun run src/jobs/sync-gitlab.ts --force --verbose`.
- Confirm zoekt usage queries work and regex fallback is skipped only when regex is omitted.

## Next Steps
- Verify with a project that has zoekt enabled; adjust per-query `searchQuery` strings if needed.
