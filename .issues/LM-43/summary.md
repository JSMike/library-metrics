# Summary

**Issue:** LM-43 - Add App Code column derived from SAML group links
**Completed:** 2026-02-05

## Outcome
- Project App Code is derived from SAML group links (access level 50) by walking group ancestry and parsing `a-<CODE>xx-GIT-...`.
- App Code is stored on the project record and displayed across all project tables.

## Key Changes
- Added `app_code` to the project schema and migration.
- Sync resolves App Code from group ancestry and persists it to the project row.
- App Code columns added to project list, library detail, query sub-target table, and project library combination report.

## Files Changed
- `src/db/schema.ts`
- `drizzle/0005_add_project_app_code.sql`
- `drizzle/meta/_journal.json`
- `drizzle/meta/0005_snapshot.json`
- `src/jobs/sync-gitlab.ts`
- `src/server/reporting.server.ts`
- `src/routes/projects.tsx`
- `src/routes/library.tsx`
- `src/routes/queries.$targetKey.$subTargetKey.tsx`
- `src/reports/project-library-combination.tsx`

## Verification
- User confirmed parsing expectations and layout.
