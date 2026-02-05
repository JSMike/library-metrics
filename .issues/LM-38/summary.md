# Summary

**Completed:** 2026-02-04

## Overview
- Added explicit zoekt search configuration for usage queries with optional regex fallback.
- Organized usage queries into a folder with per-domain files and documentation.
- Cleaned up zoekt unavailable logging to avoid noisy stack traces.
- Ensured zoekt-only queries persist results even without regex fallback.

## Key Files
- `src/lib/usage-queries/README.md`
- `src/lib/usage-queries/index.ts`
- `src/lib/usage-queries/box-model.ts`
- `src/lib/usage-queries/types.ts`
- `src/jobs/sync-gitlab.ts`
- `README.md`
- `AI-README.md`

## Verification
- User confirmed usage results now appear as expected after sync.
