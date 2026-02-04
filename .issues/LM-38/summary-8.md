# Session 8

**Date:** 2026-02-04

**Prompt/Ask:** Add a warning when regex fallback is configured without extensions.

## Completed
- Added a warning log when a regex fallback is skipped due to missing extensions.

## Current Status
- LM-38 in-progress.

## Files Changed
- `src/jobs/sync-gitlab.ts` - warn when regex fallback is skipped because extensions are missing.

## Verification
- Run a sync with a query missing extensions and confirm the warning is logged.

## Next Steps
- Verify zoekt usage searches with a forced sync.
