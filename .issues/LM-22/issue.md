# LM-22: Support scanning multiple GitLab groups accessible to the user

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | TBD          |
| Complexity   | medium       |
| Created      | 2026-02-02   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Allow syncing across all GitLab groups the user can access, including subgroups, rather than requiring a single configured group path.

## Requirements

- Default to scanning all accessible groups and nested subgroups.
- Ensure projects are discovered across the full group tree (including nested subgroups).
- Provide a configuration option to scope which groups to include/exclude (optional override).
- Account for nested group hierarchy in the database (migration likely needed).

## Open Questions

- Should we prefer enumerating all accessible projects directly (if GitLab provides an API for that) instead of walking group trees?
- How should inclusion/exclusion be configured (env var list, config file, UI)?
- How to handle name collisions or duplicate project paths across groups?
