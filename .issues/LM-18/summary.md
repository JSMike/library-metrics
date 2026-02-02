# Summary

**Issue:** LM-18: Exclude inactive projects from reports
**Status:** done
**Completed:** 2026-02-02

## Outcome
Inactive projects (archived or pending deletion) are now excluded from all reports by default, with a report-level configuration flag to include them when historical data is needed.

## Key Changes
- Added `pendingDeletionAt` to `project_snapshot` and captured GitLab pending-deletion timestamps during sync.
- Introduced `reportConfig.includeInactiveProjects` to control inclusion.
- Filtered report queries to exclude archived/pending-deletion projects unless explicitly included.
- Added migration `0002_add_project_pending_deletion.sql` and applied it to the tracked SQLite DB.
- Documented the report config flag in the README.

## Files Changed
- `src/db/schema.ts`
- `src/lib/gitlab.ts`
- `src/jobs/sync-gitlab.ts`
- `src/lib/report-config.ts`
- `src/server/reporting.server.ts`
- `drizzle/0002_add_project_pending_deletion.sql`
- `drizzle/meta/_journal.json`
- `drizzle/meta/0002_snapshot.json`
- `data/library-metrics.sqlite`
- `README.md`
- `.issues/LM-18/issue.md`
- `.issues/LM-18/plan.md`
- `.issues/LM-18/summary-4.md`
- `.issues/LM-18/summary-5.md`
- `.issues/LM-18/summary-6.md`

## Verification
- User confirmed archived and pending-deletion projects are excluded from reports.
