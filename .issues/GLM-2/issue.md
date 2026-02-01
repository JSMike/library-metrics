# GLM-2: Enhance dependency browsing and detail pages

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | Codex        |
| Complexity   | medium       |
| Created      | 2026-02-01   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Improve the dependency reporting UI and supporting queries: rename the dashboard section, add filtering + pagination, aggregate usage across versions, add dependency and project detail pages, and expose project-level links/metadata.

## Context

The dashboard currently surfaces a "Top Dependencies" section with a table based on dependency usage results. The product needs richer browsing flows: filtering/pagination, an all-dependencies view, dependency version breakdowns, and project-level detail pages with GitLab links and metadata.

## Requirements

- Rename the "Top Dependencies" section to "Dependencies".
- Add a search/filter input that narrows the dependency list to items matching the provided string.
- Add pagination controls below the dependencies table when results exceed 10 items (page size = 10).
- Remove the version column from the dependency list; aggregate usage totals per library across all versions.
- Provide a "See all dependencies" link from the dependencies section.
- Clicking a library name navigates to a dependency detail page that lists all versions in use and their frequency counts.
  - Sort versions by version number (semantic ordering) rather than by usage.
- The dependency detail table must include a column showing the projects using each specific library version.
  - Each project entry shows the project name and a separate GitLab link for the project.
- Clicking a project name routes to a project detail page that shows:
  - The full list of dependencies for the project.
  - Project metadata, including an owner link to the members page for the project.
  - Links to the project code in GitLab.

## Notes

- Filter behavior is case-insensitive and should match the full dependency identifier (scope + name).
- Dashboard pagination stays at 10 per page; filtering should reset pagination and update totals.
- The "See all dependencies" link routes to a full-page table view with filter input and page-size options (default 50; optional 100/200).
- Version sorting: list valid SemVer versions first (major/minor/patch with pre-release ordering), then non-SemVer values (including "*") sorted alphanumerically.
- Project detail metadata should include last activity.
- GitLab link formats:
  - Code: `{group}/{project}` (e.g., `michael.cebrian-group/box-model.dev`).
  - Members: `{group}/{project}/-/project_members`.
