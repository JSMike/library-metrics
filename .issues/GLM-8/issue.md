# GLM-8: Optimize GitLab sync throttling and rate-limit handling

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | in-progress  |
| Owner        | Codex        |
| Complexity   | high         |
| Created      | 2026-02-01   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | high         |

## Summary

Optimize GitLab sync throttling and rate-limit handling for authenticated GitLab.com API usage to improve sync performance while respecting rate limits and per-endpoint constraints. Add retry handling for timeouts/aborts during file queries.

## Context

The current sync is overly throttled. We need smarter, adaptive pacing based on GitLab rate limits (including per-endpoint limits and RateLimit headers) to reduce total sync time without triggering 429 responses.

## Requirements

- Rework throttling to be less restrictive and better aligned with GitLab.com authenticated rate limits.
- Account for per-endpoint limits (e.g., projects, groups, repository archive, etc.).
- Utilize RateLimit headers where available to adapt request pacing.
- Maintain safe behavior when headers are missing.
- Add retry logic for file/search requests that time out; default to 1 retry and make retry count configurable via ENV.

## Notes

User-provided rate limit details (GitLab.com SaaS authenticated):
- 2,000 requests / 10 minutes per user.
- Search API: 30 requests / minute.
- Per-endpoint limits (e.g., projects/:id 400/min, groups/:id/projects 600/min, repository/archive 5/min).
- RateLimit headers: Limit, Remaining, Reset, Observed.
User reported timeouts/aborts during file query scans (usage scans), suggesting file/search endpoints are primary bottlenecks.

## Open Questions

- Confirm the exact endpoints involved in file/usage scanning (raw file fetch vs. search API).
- Should throttling be global or per-endpoint, and should it be dynamic based on observed limits?
- Desired defaults for concurrency and delay when headers are missing?
- How aggressively should the sync back off after 429s?
