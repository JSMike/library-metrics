# Session 11

**Date:** 2026-02-01

**Prompt/Ask:** Ensure source projects are excluded from usage reports even if dependency exists, and group source usage tables per target on project page.

## Completed
- Grouped source-project usage details by target with a heading per target and removed the target column from rows.

## Current Status
- GLM-4 remains in progress; source projects are still excluded from global usage reports and now render grouped tables on the project page.

## Plan Coverage
- UI refinement for source-project reporting.

## Files Changed
- `src/routes/project.tsx` - group source usage rows by target and adjust table columns.

## Verification
- Open a source project page and confirm the “Library Usage (Source Project)” section shows a table per target with sub-target/query/matches columns.
- Confirm source projects do not appear in usage reports even when listed as dependencies.

## Next Steps
- None unless additional UX tweaks are requested.
