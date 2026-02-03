# LM-30: Search-seeded usage queries with project/file/total counts

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | review       |
| Owner        | TBD          |
| Complexity   | medium       |
| Created      | 2026-02-03   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Use GitLab blob search to seed usage-query file candidates (excluding node_modules) and track usage counts as project presence, file presence, and total match count.

## Requirements

- Use group-level blob search to find candidate files for usage queries (per extension), excluding node_modules.
- Count usage as: total matches, distinct projects, and distinct files.
- Keep exact regex matching for final counts.
- Fallback to project tree scanning when search fails for a query.

## Open Questions

- None.
