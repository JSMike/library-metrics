# Plan: LM-4 - Revamp usage queries reporting and routing

<!-- Plan Metadata -->

| Field    | Value      |
| -------- | ---------- |
| Created  | 2026-02-01 |
| Author   | Codex      |
| Approach | Draft      |

## Goal

Provide a multi-level usage query reporting experience with target/sub-target/query drilldowns, pagination, and display titles sourced from an updated usage query schema.

## Work Breakdown

### 1. Audit current usage query data
- Review `src/lib/usage-queries.ts` and confirm schema changes for titles.
- Identify existing usage summary query and dashboard UI usage.
- Plan for refactoring the usage query config into a nested structure to avoid slashes in keys for path params.
- Investigate whether per-file match counts are stored; identify any schema changes needed for query detail.

### 2. Data/query layer updates
- Add new reporting queries for:
  - Targets summary list (aggregated by target key).
  - Target detail with sub-target grouping and query totals.
  - Sub-target detail with per-query project lists.
  - Query detail with per-project file matches.
- Ensure aggregation includes match totals and project counts.
- Decide how to preserve concatenated keys in the DB while using nested config keys for routing.

### 3. Dashboard and queries list UI
- Replace "Top Usage Queries" with "Usage Queries" target list.
- Add pagination + "See all queries" link.
- Implement `/queries` route with filter + pagination.
- Keep pagination/filtering URL-driven (query may be in path or search params).

### 4. Detail routes
- Target detail route with sub-target grouping and query totals.
- Sub-target detail route with projects per query.
- Query detail route with project/file breakdown.
- Sub-target detail should aggregate per project (no per-file rows); query detail can show per-file rows if data exists.

### 5. Verification
- Confirm navigation flows and counts on each level.
- Validate titles render correctly and keys remain for correlation.
