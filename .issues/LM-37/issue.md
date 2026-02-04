# LM-37: Store GitLab project members and group SAML links

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | in-progress  |
| Owner        | TBD          |
| Complexity   | medium       |
| Created      | 2026-02-04   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Capture GitLab project member lists (name, username, access_level) for access levels >= 30, and persist group SAML links (name, access_level) tied to project parent groups.

## Requirements

- Sync `projects/:id/members` to store member name, username, and access_level.
- Only store members with access_level >= 30.
- Extend schema to record group-level SAML group links with name + access_level.
- Associate projects with their parent group so SAML links can be surfaced per project.

## Notes

Example group response:
```
{
  "id": 123,
  "saml_group_links": [
    { "name": "abc-group", "access_level": 30 }
  ]
}
```

Example project member response:
```
[
  {
    "id": 123,
    "username": "abc-user",
    "name": "ABC User",
    "state": "active",
    "access_level": 30
  }
]
```

## Open Questions

Answered:
- Store members as current-state records (not per-sync snapshots).
- Only store members with `state: active` and access_level >= 30.
- Fetch SAML links only for groups that have projects in scope (unless cheaper to do during group sync).
- Prefer JSON storage unless joins become difficult; choose best-practice relational design if needed.
