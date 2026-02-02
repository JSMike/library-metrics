# Session 9

**Date:** 2026-02-01

**Prompt/Ask:** Add source-project support for usage targets, always scan those projects, and exclude them from usage reports while showing their usage on the project page.

## Completed
- Added optional `sourceProjects` to usage targets for defining-library projects.
- Updated sync gating to always scan targets when the current project is listed as a source project.
- Excluded source projects from usage report aggregations (targets, target detail, sub-target detail, query detail).
- Added a source-project usage section to the project detail page that lists usage queries and match counts for the defining project.

## Current Status
- LM-4 remains in progress with source-project handling implemented.

## Plan Coverage
- Data/query layer updates for usage reporting and project-specific reporting.

## Files Changed
- `src/lib/usage-queries.ts` - add `sourceProjects` to usage targets and configure box-model source project.
- `src/jobs/sync-gitlab.ts` - include source projects when gating usage scans.
- `src/server/reporting.ts` - exclude source projects from usage reports and add source usage data to project detail.
- `src/routes/project.tsx` - render source project usage table.

## Verification
- Run `bun run sync:gitlab` and confirm source projects are still scanned even without target dependencies.
- Verify usage reports omit source projects.
- Open a source project page and confirm the “Library Usage (Source Project)” section shows query matches.

## Next Steps
- Update `usageTargets` entries with additional source projects as needed.
