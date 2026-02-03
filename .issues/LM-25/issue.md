# LM-25: Add verbose progress logging for group and project discovery

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | TBD          |
| Complexity   | low          |
| Created      | 2026-02-02   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Add verbose progress logging when fetching large volumes of groups/subgroups and projects during GitLab sync.

## Requirements

- During `--verbose` syncs, log progress while paging through groups and group projects.
- Keep default (non-verbose) logging minimal.

## Open Questions

- None.
