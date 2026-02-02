# Summary

**Issue:** LM-23: Filter project list to projects with package.json
**Status:** done (canceled)
**Completed:** 2026-02-02

## Outcome
The package.json-only filter was removed after the user decided not to restrict the project list.

## Key Changes
- Reverted the project summary filter so all active projects appear again.

## Files Changed
- `src/server/reporting.server.ts`
- `.issues/LM-23/issue.md`
- `.issues/LM-23/summary-2.md`
- `.issues/index.md`

## Verification
- User requested cancellation of the filter.
