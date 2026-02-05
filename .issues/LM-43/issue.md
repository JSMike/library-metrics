# LM-43: Add App Code column derived from SAML group links

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | review       |
| Owner        | TBD          |
| Complexity   | medium       |
| Created      | 2026-02-05   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Add an `App Code` column to every table that has a `Project` heading. The app code is derived from the project’s group (or ancestors) `saml_group_links_json` by locating the link with `access_level = 50` and parsing the code from names that follow the `a-ABCxx-GIT-<Role>` prefix pattern.

## Requirements

- Add an `App Code` column to all tables that include a `Project` header.
- Determine App Code by walking the project’s group hierarchy until a group has `saml_group_links_json`.
- From `saml_group_links_json`, select the entry with `access_level = 50`.
- Parse the code from the name format `a-<APP_CODE>-GIT-<Role>` where `<APP_CODE>` is alphanumeric.
- If access level 50 exists but the parsed app code is empty, show the full name value instead.

## Notes

- Example `saml_group_links_json`: `[{"name":"a-ABCxx-GIT-Owner","access_level":50}, ...]` → App Code `ABC`.
- Group ancestry may be multiple levels deep; use recursive `parent_group_id`.

## Open Questions

- Which specific tables are in scope? (e.g., libraries, projects list, query sub-target projects table, reports, etc.)
- Should we cache resolved app codes per group during a sync to avoid repeated joins?
