# LM-9: Add archive-based usage scanning to reduce API calls

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | backlog      |
| Owner        | Codex        |
| Complexity   | high         |
| Created      | 2026-02-01   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | low          |

## Summary

Implement an optional archive-based usage scan (download repo archive once, scan locally) to reduce API calls and speed up syncs.

## Context

Current per-file fetches hit the global GitLab rate limit ceiling. An archive-based scan would reduce hundreds of API calls per project to a single archive download and local file scanning.

## Requirements

- Add an archive-based scan option for usage queries.
- Use a single repository archive download per project, extract locally, and scan files on disk.
- Keep current per-file fetch path available (fallback or optional).
- Ensure archive scanning respects existing query/extension filtering.

## Notes

- GitLab archive endpoint has strict rate limit (5 requests/min); ensure throttling for this endpoint.
- Consider cleanup of extracted files and temporary storage.

## Open Questions

- Should archive scanning be default or opt-in via env/flag?
- Which archive format to use (zip vs tar.gz) and which extractor to rely on (node/bun libs vs system tools)?
