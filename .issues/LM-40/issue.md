# LM-40: Show project members on project page

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

Show a list of members on the project detail page with name + role level labels.

## Requirements

- Add a members table to the project page.
- Include columns: Name, Role.
- Map access levels: 30 → Developer, 40 → Maintainer, 50 → Owner.
- Only include members captured by the sync (active, access_level >= 30).
- Member names should link to their GitLab profile page.
