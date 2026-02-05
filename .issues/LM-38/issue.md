# LM-38: Fix zoekt usage query search

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | TBD          |
| Complexity   | medium       |
| Created      | 2026-02-04   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Zoekt search finds package/lockfile paths but usage queries are not returning expected results. Align usage query search behavior with the zoekt package/lockfile searches.

## Requirements

- Investigate why usage query zoekt searches are empty or not used.
- Ensure usage queries use zoekt search where available (similar to lockfile/package.json search).
- Confirm the search query syntax and parameters are correct for usage searches.
- Preserve fallback behavior for basic search when zoekt is unavailable.

## Notes

- User expectation: usage query search should work like zoekt lockfile/package.json search.
- Current symptom: lockfile search works but usage queries return no results.
