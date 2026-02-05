# Summary

**Issue:** LM-39 - Normalize links columns across views
**Completed:** 2026-02-05

## Outcome
- Links columns are standardized across project/library/usage views.
- Query detail routing now renders correctly.
- The sub-target projects table includes Code/Members links, while the file-level query table only shows File and Matches.

## Key Changes
- Added Links column to the `/queries/<target>/<sub-target>` projects table with Code/Members links.
- Ensured nested query routes render via Outlet in the sub-target route.
- Removed Links from the `/queries/<target>/<sub-target>/<query>` files table.

## Files Changed
- `src/routes/queries.$targetKey.$subTargetKey.tsx`
- `src/routes/queries.$targetKey.$subTargetKey.$queryKey.tsx`
- `src/server/reporting.server.ts`
- `src/routes/projects.tsx`
- `src/routes/library.tsx`
- `src/components/Header.tsx`

## Verification
- User confirmed the layout changes.
