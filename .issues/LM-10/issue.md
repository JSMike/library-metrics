# LM-10: Add database purge/reset for fresh sync

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | backlog      |
| Owner        | Codex        |
| Complexity   | medium       |
| Created      | 2026-02-01   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Provide a method to purge the database contents while keeping schema intact, enabling a fresh GitLab sync for teams using this repo as boilerplate.

## Context

Teams will reuse this project and need a clean way to wipe existing data without losing schema/migrations before running a new sync.

## Requirements

- Add a repeatable method to purge data while keeping the schema/migrations.
- Support running a fresh sync after purge.

## Open Questions

- Should the purge delete the SQLite file and re-run migrations, or truncate all tables in-place?
- Should we keep migration history tables (e.g., `__drizzle_migrations`) intact?
- Should there be a single command that purges and then runs a forced sync?
