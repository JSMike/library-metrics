# LM-17: Copy SQLite DB into .output for deployable builds

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

Ensure production builds are self-contained by copying the SQLite database into `.output` during `bun --bun vite build`.

## Requirements

- Copy the default SQLite DB into `.output/data/library-metrics.sqlite` after build.
- Preserve any related SQLite sidecar files if present (WAL/SHM).
- Avoid new dependencies.

## Open Questions

- None.
