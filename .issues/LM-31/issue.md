# LM-31: Archive-based fallback for basic GitLab search

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | backlog      |
| Owner        | TBD          |
| Complexity   | medium       |
| Created      | 2026-02-03   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | low          |

## Summary

Investigate a repo-archive based fallback for environments without advanced/zoekt search to reduce full tree scans and per-file requests.

## Requirements

- Use repository archive download as a fallback to discover package.json, lockfiles, and usage query matches.
- Avoid scanning node_modules in the archive.
- Keep the current tree-scan fallback available if archive access fails.

## Open Questions

- Archive size limits and storage expectations.
- Whether to stream vs. write archive to disk.
