# Summary

**Issue:** LM-20: Add project/library counts to dashboard cards
**Status:** done
**Completed:** 2026-02-02

## Outcome
The dashboard card now shows project and library counts under the Note line item.

## Key Changes
- Added `projectSummary` to the dashboard loader.
- Rendered Projects and Libraries counts in the existing dashboard card.

## Files Changed
- `src/routes/dashboard.tsx`
- `.issues/LM-20/issue.md`
- `.issues/LM-20/plan.md`
- `.issues/LM-20/summary-2.md`

## Verification
- User confirmed the counts display correctly on `/dashboard`.
