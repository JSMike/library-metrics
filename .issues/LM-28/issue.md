# LM-28: Count library usage by distinct projects

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | TBD          |
| Complexity   | low          |
| Created      | 2026-02-03   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Ensure library usage counts in the libraries list reflect distinct projects, even for monorepos with multiple packages using the same library.

## Requirements

- Library summary usage counts should be distinct project counts.
- Library detail can continue to show per-version usage, even if a project appears under multiple versions.

## Open Questions

- None.
