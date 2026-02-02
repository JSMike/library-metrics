# LM-11: Replace drizzle-kit migrations with Bun-based migrator

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

Switch migration workflow to a Bun-based Drizzle migrator so `better-sqlite3` is no longer required for migrations.

## Context

`better-sqlite3` is used by drizzle-kit for migrations and can be problematic to install on some machines. A Bun-native migrator would allow removing `better-sqlite3` from dependencies.

## Requirements

- Add a Bun-based migration script using `drizzle-orm/bun-sqlite/migrator`.
- Update `db:migrate` to use the new script.
- Remove `better-sqlite3` if no longer needed.
- Update docs to reflect the new migration workflow.

## Open Questions

- Decide whether to keep drizzle-kit for schema generation only.
