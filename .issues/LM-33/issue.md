# LM-33: Fix usage target routing to target detail view

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | in-progress  |
| Owner        | TBD          |
| Complexity   | medium       |
| Created      | 2026-02-03   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Clicking a usage target currently navigates to the “See all queries” view instead of the target detail page. Example URL observed: `/queries/example-query-name?query=&page=1&pageSize=50`.

## Requirements

- Clicking a usage target should open the target detail route (`/queries/$targetKey`).
- Preserve expected query/sub-target routing without falling back to the list view.

## Open Questions

- Which page is the click coming from (dashboard usage table vs. `/queries` list vs. project usage view)?
- Does the affected target key include special characters (e.g., `@` or `/`)?
- What is the expected destination for the specific example (`/queries/<target>` vs. `/queries/<target>/<subTarget>`)?
