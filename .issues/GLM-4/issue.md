# GLM-4: Revamp usage queries reporting and routing

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | Codex        |
| Complexity   | high         |
| Created      | 2026-02-01   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Update usage query reporting to provide target/sub-target/query drilldowns, add new routes and pagination, and extend the usage query schema with display titles for reporting.

## Context

The dashboard currently shows a "Top Usage Queries" table of query details. The desired UX is a multi-level reporting flow: targets list → sub-target grouping → query details → per-project/file results. The schema for `src/lib/usage-queries.ts` also needs explicit titles for targets, sub-targets, and query keys.

## Requirements

- Dashboard updates:
  - Rename the "Top Usage Queries" section to "Usage Queries".
  - Replace the table with a simple list of targets (one per row) that link to target-specific routes.
  - Add pagination similar to the dependencies table and a "See all queries" link to a full list page.
- Routes & views:
  - Add a "queries" route that lists all targets with pagination and filter support similar to dependencies.
  - Target detail page: list sub-targets and group their related queries.
    - Show total matches and project counts per query.
    - Use titles (`targetTitle`, `subTargetTitle`, `queryKeyTitle`) for display while preserving keys for correlation.
  - Sub-target detail page: show associated queries with a table listing projects found for each query.
  - Query detail page: show a table of each project found by the query, including a link to the file and match counts per file.
- Schema updates:
  - Update `src/lib/usage-queries.ts` schema to include `targetTitle`, `subTargetTitle`, and `queryKeyTitle` for each entry.
  - Keys should remain unchanged for correlation; titles are for display.

## Notes

- User mentioned they already manually updated `src/lib/usage-queries.ts` to include titles; reconcile with current code.
- Ensure pagination and filtering for queries follow the same UX patterns as dependencies.
- Preference: use path params for target/sub-target/query routes by refactoring the usage query schema to avoid slashes (nested structure, keys without parent prefixes).
- Consider keeping concatenated keys in the DB layer for correlation even if the config becomes nested.
- Pagination/filtering should be URL-driven; query text may live in the path or search params (confirm during implementation).
- Titles fallback: if missing, display concatenated keys (targetKey-subTargetKey-queryKey).
- Sub-target page should show per-project counts per query (no per-file rows).
- File-level match counts are currently unknown; investigate whether existing data supports per-file reporting or if a new table is required.
