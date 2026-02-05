# Summary

**Issue:** LM-42 - Allow usage targets to skip dependency filtering for zoekt
**Completed:** 2026-02-05

## Outcome
- Usage targets can set `targetDependency: true` to bypass dependency filtering and rely solely on zoekt search results.
- Non-zoekt queries under bypass targets are skipped with warnings.

## Key Changes
- Updated usage query types to allow `targetDependency: true`.
- Sync logic now restricts bypass targets to zoekt-discovered projects and logs skips for non-zoekt queries.
- Added documentation describing the new behavior.

## Files Changed
- `src/lib/usage-queries/types.ts`
- `src/jobs/sync-gitlab.ts`
- `src/lib/usage-queries/README.md`

## Verification
- User confirmed behavior.
