# Summary

**Issue:** LM-21: Add range summary to dashboard pagination
**Status:** done
**Completed:** 2026-02-02

## Outcome
Pagination blocks now show a left-aligned range summary (“Showing X - Y of Z”) across dashboard, libraries, projects, and queries.

## Key Changes
- Added range summary calculations to paginated lists.
- Styled pagination wrappers to keep the summary left and controls right.

## Files Changed
- `src/routes/dashboard.tsx`
- `src/routes/libraries.tsx`
- `src/routes/projects.tsx`
- `src/routes/queries.tsx`
- `src/routes/dashboard.scss`
- `src/routes/libraries.scss`
- `src/routes/queries.scss`
- `.issues/LM-21/issue.md`
- `.issues/LM-21/plan.md`
- `.issues/LM-21/summary-2.md`

## Verification
- User confirmed summaries display correctly on paginated tables.
