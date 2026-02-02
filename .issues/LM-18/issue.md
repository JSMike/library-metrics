# LM-18: Exclude inactive projects from reports

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | Codex        |
| Complexity   | medium       |
| Created      | 2026-02-02   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Track inactive/deleted projects and exclude them from reporting views.

## Requirements

- Persist an "active" (or equivalent) status for projects synced from GitLab.
- Treat deleted/inactive projects as excluded from report summaries and drill-downs by default.
- Minimum inactive states: archived and pending deletion.
- Allow explicit inclusion of inactive projects for historical reporting via report configuration.
- Provide a way to identify inactive projects in stored data for auditing.
- Example project path that was deleted: `michael.cebrian-group/gitlab-metrics-deletion_scheduled-78141783`.

## Open Questions

- None.
