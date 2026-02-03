# LM-24: Handle GitLab 5xx errors during paged fetches

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | TBD          |
| Complexity   | low          |
| Created      | 2026-02-02   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

GitLab API occasionally returns 502 during long syncs; avoid failing the entire run by retrying and allowing paged fetches to return partial results when 5xx persists.

## Requirements

- Retry GitLab API 5xx responses (at least 502) before failing.
- If retries still fail during a paged fetch, skip/stop that page and return partial results so sync continues.
- Preserve existing behavior for non-retryable errors (e.g., 401/403/404).

## Open Questions

- Should partial paging be logged or surfaced in sync summaries?
