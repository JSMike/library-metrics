# LM-32: Optimize sync using zoekt search when available

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | in-progress  |
| Owner        | TBD          |
| Complexity   | high         |
| Created      | 2026-02-03   |
| Source       | user-request |
| External     | GitLab       |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

When zoekt search is available, use zoekt queries to discover relevant files and projects first, then fetch metadata only for those projects to reduce sync time and API usage. Fall back to the existing strategy for basic search environments.

## Requirements

- Add zoekt-aware search path for project discovery and usage scanning.
- Use zoekt query syntax to locate lockfiles and root package.json first, then narrow the project list to only those with matches.
- Use zoekt query syntax to locate usage-query matches by extension, then only fetch files for matching projects.
- Fall back to current tree-based scanning for basic search users.

## Open Questions

- Should search type be configurable via env (e.g., `GITLAB_SEARCH_TYPE=zoekt|advanced|basic`), or auto-detected via API errors?
- Exact zoekt query patterns to use for lockfiles, root package.json, and usage queries.
