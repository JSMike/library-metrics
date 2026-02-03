# Summary

**Date:** 2026-02-03

LM-28 updates library summary usage counts to represent distinct projects, preventing monorepo duplication from inflating totals.

## Delivered
- Library summary now counts distinct dependency+project pairs via a deduped subquery.
- Library detail per-version counts unchanged.

## Verification
- User requested marking the issue done on 2026-02-03 after applying the changes.

## Files Changed
- `src/server/reporting.server.ts`
- `.issues/LM-28/issue.md`
- `.issues/LM-28/plan.md`
- `.issues/LM-28/summary-1.md`
- `.issues/index.md`
