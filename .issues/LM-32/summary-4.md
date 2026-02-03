# Session 4

**Date:** 2026-02-03

**Prompt/Ask:** Ensure usage queries use zoekt from top-level groups without triggering repository tree scans when zoekt is enabled.

## Completed
- Disabled usage-query tree fallback when zoekt is enabled; usage scans now only use zoekt candidates in that mode.
- When zoekt is unavailable for usage searches, the sync now flips to basic (tree-scan) mode with an explicit warning.
- Added debug logging when usage queries are skipped due to ontbrekt zoek results in zoekt mode.

## Current Status
- LM-32 remains in progress; awaiting validation that usage queries no longer trigger tree fetches under zoekt.

## Plan Coverage
- Step 3: usage scan seeding is now zoek-only when enabled; fallback only on zoekt failure.

## Files Changed
- `src/jobs/sync-gitlab.ts` - usage scanning behavior adjusted to avoid tree fallback when zoekt is enabled.

## Verification
- Not run (manual verification recommended).
- Suggested: run `bun --bun run src/jobs/sync-gitlab.ts --force --verbose` on a zoekt-enabled instance and confirm no repository tree fetch occurs during usage scans unless zoekt fails.

## Next Steps
- Confirm usage query results match expectations in zoekt mode.
