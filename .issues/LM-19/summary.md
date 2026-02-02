# Summary

**Issue:** LM-19: Preserve library/usage data for unchanged projects when not forcing sync
**Status:** done
**Completed:** 2026-02-02

## Outcome
Non-force GitLab syncs now reuse prior run data for unchanged projects, preventing library/usage reports from clearing when projects are skipped.

## Key Changes
- Added effective sync ID helpers that coalesce `dataSourceSyncId`/`syncId` per project.
- Updated library and usage reporting queries to join through effective sync IDs.
- Updated project detail queries to use effective sync IDs for dependencies and usage.

## Files Changed
- `src/server/reporting.server.ts`
- `.issues/LM-19/issue.md`
- `.issues/LM-19/plan.md`
- `.issues/LM-19/summary-2.md`

## Verification
- User confirmed non-force sync reports preserved data for unchanged projects.
