# LM-21: Add range summary to dashboard pagination

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | Codex        |
| Complexity   | low          |
| Created      | 2026-02-02   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Add a "Showing X - Y of Z" range summary aligned with the table's left edge in dashboard pagination.

## Requirements

- For dashboard pagination blocks, show: `Showing {start} - {end} of {total}`.
- Start index should be 1-based.
- Align the summary to the left of the table.

## Open Questions

- None.
