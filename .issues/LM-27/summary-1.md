# Session 1

**Date:** 2026-02-03

**Prompt/Ask:** Hide projects from the list when they have no resolved dependencies by default.

## Completed
- Updated project summary query to only include projects with resolved dependency snapshots.
- Moved LM-27 to review and updated index.

## Current Status
- Ready for verification.

## Plan Coverage
- Completed all plan steps.

## Files Changed
- `src/server/reporting.server.ts` - project summary now requires lock dependency snapshots.
- `.issues/LM-27/issue.md` - status to review.
- `.issues/LM-27/plan.md` - plan recorded.
- `.issues/index.md` - status index updated.

## Verification
- Open `/projects` and confirm projects with no package/lock data no longer appear.
- Confirm projects with dependencies still appear and pagination totals update.

## Next Steps
- User verification of filtered project list.
