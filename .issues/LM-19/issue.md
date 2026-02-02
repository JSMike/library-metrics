# LM-19: Preserve library/usage data for unchanged projects when not forcing sync

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | Codex        |
| Complexity   | medium       |
| Created      | 2026-02-02   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | high         |

## Summary

`sync:gitlab` without `--force` clears library/usage reports for unchanged projects; expected behavior is to reuse prior run data when commit SHA has not changed.

## Requirements

- When a project is skipped due to unchanged commit SHA, preserve or carry forward library and usage results for that project in the new run.
- Reports should continue to show libraries/usage across all projects (including unchanged ones) after a non-force sync.
- Ensure the project list still reflects the latest run.

## Open Questions

- Which tables should be carried forward (lock dependencies, package snapshots, usage results, etc.)?
- Is it acceptable to copy prior run rows into the new `sync_id`, or should reporting explicitly fall back to the previous `dataSourceSyncId`?
- Are there any data types that should always be re-scanned even when unchanged?
