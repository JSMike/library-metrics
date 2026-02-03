# Plan

1. Extend GitLab API fetch helper to retry on 5xx responses and surface a typed error with status.
2. Update paged fetch helper to catch retryable 5xx errors, log, and return partial results.
3. Record session summary and update issue index/status for review.
