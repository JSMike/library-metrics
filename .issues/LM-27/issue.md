# LM-27: Hide projects without resolved dependencies by default

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

By default, hide projects from the projects list when they have no resolved dependencies (typically meaning no package.json/lock data).

## Requirements

- Projects list should exclude projects with zero resolved dependencies by default.
- No new UI toggle needed right now.

## Open Questions

- Should the dashboard project count also exclude these projects? (Currently it uses the same project summary data.)
