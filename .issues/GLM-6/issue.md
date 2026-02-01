# GLM-6: Make /projects search optional for header link

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | in-progress  |
| Owner        | Codex        |
| Complexity   | low          |
| Created      | 2026-02-01   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Adjust the `/projects` and `/dependencies` route search typing so header links do not require a `search` prop.

## Context

TypeScript reports that the `/projects` and `/dependencies` links in `Header.tsx` require a `search` prop. The routes should allow optional search params.

## Requirements

- Make the `/projects` route search optional for links.
- Make the `/dependencies` route search optional for links.
- Resolve the TypeScript error in `src/components/Header.tsx`.

## Open Questions

- None.
