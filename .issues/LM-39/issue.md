# LM-39: Normalize links columns across views

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | review       |
| Owner        | TBD          |
| Complexity   | medium       |
| Created      | 2026-02-04   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Standardize link columns across query, project, and library views and add a header link to the queries page.

## Requirements

- `src/routes/queries.$targetKey.$subTargetKey.$queryKey.tsx`: add a Links column with Code + Members links (same style as Project Library Combination report).
- Projects page: rename GitLab column header to Links.
- Library view: add a Links column with Code + Members per project, instead of inline GitLab link after the project name.
- Header: add a link to the Queries page.
