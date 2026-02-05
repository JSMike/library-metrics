# LM-42: Allow usage targets to skip dependency filtering for zoekt

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | TBD          |
| Complexity   | medium       |
| Created      | 2026-02-05   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Allow `targetDependency` to be set to `true` in usage-query definitions to bypass dependency-based project filtering when using zoekt searches. When enabled, the scan should only apply to projects discovered by the zoekt query, so a usage query can target all projects without requiring a specific dependency.

## Requirements

- Accept `targetDependency: true` in usage query/target definitions as a signal to skip dependency filtering.
- Only enable the bypass for zoekt-based searches.
- When bypass is enabled, restrict scanning to projects discovered by the zoekt search results.

## Open Questions

- Should non-zoekt queries with `targetDependency: true` log a warning and fall back to dependency filtering?
- Should the bypass apply per-target or per-query when mixed search types are defined?

## Notes

Use this to define usage queries that find all projects/files matching a search across the group without requiring a specific dependency.
