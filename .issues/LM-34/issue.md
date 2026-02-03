# LM-34: Handle pnpm lockfile dependency objects in sync

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | in-progress  |
| Owner        | TBD          |
| Complexity   | low          |
| Created      | 2026-02-03   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Sync fails when pnpm lockfile importers contain dependency entries as objects (e.g., `{ version, specifier }`) instead of strings, causing `extractPnpmVersion` to throw when calling `startsWith` on non-strings.

## Requirements

- Normalize pnpm importer dependency entries to strings (prefer resolved `version` when present).
- Ensure `extractPnpmVersion` gracefully handles non-string inputs.
- Sync should not crash on pnpm lockfiles with object-style dependency entries.
