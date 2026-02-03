# LM-29: Seed GitLab sync via file search to avoid node_modules noise

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | review       |
| Owner        | TBD          |
| Complexity   | medium       |
| Created      | 2026-02-03   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Use GitLab search (with `-file:node_modules`) to seed the project list from lockfiles/package manifests, avoiding huge volumes of package.json files committed under node_modules.

## Requirements

- Discover projects by searching for lockfiles and root `package.json` with `-path:node_modules` (API-supported) to avoid noisy repos.
- Use the search results to restrict which projects are scanned.
- Preserve current include/exclude group scoping behavior.
- Provide a fallback when search is unavailable or returns errors.
- Ignore `node_modules` when scanning repository trees to prevent local noise.

## Open Questions

- Search includes root `package.json` only (top-level) plus lockfiles.
