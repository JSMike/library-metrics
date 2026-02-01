# Plan: GLM-2 - Enhance dependency browsing and detail pages

<!-- Plan Metadata -->

| Field    | Value      |
| -------- | ---------- |
| Created  | 2026-02-01 |
| Author   | Codex      |
| Approach | Draft      |

## Goal

Improve dependency discovery in the web app with filtering, pagination, aggregated usage, and new dependency/project detail pages with GitLab links and metadata.

## Work Breakdown

### 1. Audit existing dependency views and queries
- Locate the dashboard "Top Dependencies" section and its data source.
- Review tRPC routes and SQL/Drizzle queries powering dependency usage.
- Identify where version-specific aggregation is applied today.

### 2. Data/query updates
- Update dependency summary queries to aggregate usage totals per library across versions.
- Add search/filter support (by dependency name) and pagination support (page size 10).
- Add query/endpoint for dependency detail: versions + usage counts + projects using each version.
- Add query/endpoint for project detail: dependency list + GitLab metadata/links.

### 3. Dashboard + dependencies list UI
- Rename section to "Dependencies" and remove version column.
- Add filter input (case-insensitive scope/name match) and pagination controls under the table.
- Add "See all dependencies" link and route to the full dependency list view with larger page sizes.

### 4. Dependency detail page
- Add route for dependency detail.
- Render versions sorted by SemVer first, then non-SemVer alphanumerically (e.g., "*").
- Include a projects column listing project names and separate GitLab links.

### 5. Project detail page
- Add route for project detail.
- Render full dependency list and project metadata.
- Include owner/members link, code links to GitLab, and last activity.

### 6. Full dependencies table view
- Add a dedicated dependencies page with filter input.
- Default page size to 50, with optional 100/200 selectors.

### 6. Verification
- Confirm filtering and pagination behavior.
- Confirm navigation flow between dashboard, dependency detail, and project detail pages.
