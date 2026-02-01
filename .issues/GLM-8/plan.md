# Plan: GLM-8 - Optimize GitLab sync throttling and rate-limit handling

<!-- Plan Metadata -->

| Field    | Value      |
| -------- | ---------- |
| Created  | 2026-02-01 |
| Author   | Codex      |
| Approach | Draft      |

## Goal

Improve GitLab sync throughput while respecting GitLab.com authenticated rate limits and per-endpoint constraints.

## Work Breakdown

### 1. Audit current sync request patterns
- Identify endpoints called, request rates, and current throttling logic.
- Determine which endpoints are rate-limit-sensitive (search, archive, etc.).

### 2. Design adaptive throttling
- Add per-endpoint rate buckets (token-bucket or leaky-bucket) with configurable limits.
- Incorporate RateLimit headers when present to tune pacing.
- Define fallback limits when headers are absent.
- Add retry policy for file/search requests (default 1 retry) with configurable ENV.

### 3. Implement and integrate
- Wire adaptive rate limiter into GitLab API client(s).
- Add backoff behavior for 429 responses.
- Expose config knobs (env vars) for concurrency/delay.
- Expose retry count and retry backoff knobs for timeouts/aborts.

### 4. Verification
- Run sync with verbose logging and verify improved throughput.
- Confirm no 429s under normal conditions and graceful backoff when they occur.
