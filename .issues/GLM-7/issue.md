# GLM-7: Link parent references in usage report headers

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | Codex        |
| Complexity   | low          |
| Created      | 2026-02-01   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Update usage report headers so parent references link back to parent pages, and fix project usage query headers to reference the sub-target instead of the target.

## Context

Usage report pages show parent context in header text, but the parents are not currently linked. The project usage query header also shows the target instead of the sub-target for context.

## Requirements

- In usage report headers, make parent references link back to their parent pages.
- In project usage query pages, show the sub-target (e.g., `@box-model/web/button`) instead of the target in the context line.
- Example: `Source usage for box-model.dev / @box-model/web/button.` should link `box-model.dev` to `/project?path=...` and `@box-model/web/button` to `/project/usage/<target>/<subTarget>?path=...`.

## Open Questions

- None.
