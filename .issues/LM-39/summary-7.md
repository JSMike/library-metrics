# Session 7

**Date:** 2026-02-05

**Prompt/Ask:** Remove the Links column from the query detail files table; it should only show File and Matches.

## Completed
- Removed the Links column from the `/queries/<target>/<sub-target>/<query>` files table.
- Dropped the unused GitLab link helper from that page.
- Reopened LM-39 for review.

## Current Status
- Review.

## Plan Coverage
- Follow-up fix (links removed on query detail files table).

## Files Changed
- `src/routes/queries.$targetKey.$subTargetKey.$queryKey.tsx` - remove Links column from files table.
- `.issues/LM-39/issue.md` - status updated to review.
- `.issues/index.md` - moved LM-39 back to review.
- `.issues/LM-39/summary-7.md` - session summary.

## Verification
- Not run (not requested). Suggested: open `/queries/<target>/<sub-target>/<query>` and confirm the files table only shows File and Matches.

## Next Steps
- User verification of the files table layout.
