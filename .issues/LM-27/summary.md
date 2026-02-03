# Summary

**Date:** 2026-02-03

LM-27 filters the Projects list to only include projects with resolved dependency snapshots, hiding repos without package/lock data by default.

## Delivered
- Project summary now requires a matching `lock_dependency_snapshot` to appear in the list.

## Verification
- User requested marking the issue done on 2026-02-03 after applying the changes.

## Files Changed
- `src/server/reporting.server.ts`
- `.issues/LM-27/issue.md`
- `.issues/LM-27/plan.md`
- `.issues/LM-27/summary-1.md`
- `.issues/index.md`
