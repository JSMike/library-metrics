# Plan

1. Add pending-deletion status capture in the GitLab sync and schema.
2. Create a report configuration flag to include inactive projects (default false).
3. Filter reporting queries by active status when the config excludes inactive projects.
4. Add a migration and update the tracked SQLite DB.
