# LM-16: Fix preview DB path when running Nitro output

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | in-progress  |
| Owner        | Codex        |
| Complexity   | low          |
| Created      | 2026-02-02   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

`bun --bun vite preview` fails with `SQLITE_CANTOPEN` because the relative DB path is resolved from `.output`. Make DB path resolution robust so preview can open the database without requiring absolute env vars.

## Requirements

- Preview should open the SQLite DB when `DB_FILE_NAME` is a relative path.
- Keep default DB path `./data/library-metrics.sqlite`.
- Avoid new dependencies.

## Open Questions

- None.
