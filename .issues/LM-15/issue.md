# LM-15: Fix Vite build failing on bun:sqlite bundling

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | in-progress  |
| Owner        | Codex        |
| Complexity   | medium       |
| Created      | 2026-02-02   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Fix the production Vite build failure caused by `bun:sqlite` being bundled into the client build via server-only modules.

## Requirements

- `bun --bun vite build` should complete without `bun:sqlite`/Drizzle client bundling errors.
- Keep DB access server-only while preserving existing route loaders and tRPC behavior.
- Avoid introducing client-visible changes or new dependencies.

## Open Questions

- None.
