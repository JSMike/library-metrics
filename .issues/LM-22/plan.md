# Plan

1. Update GitLab config/types and sync logic to discover all accessible groups, apply include/exclude filters, select root groups, and dedupe projects across group trees.
2. Add group hierarchy tracking in the DB (parent group ID), with schema + migration updates and group upsert logic.
3. Update .env.example and README/AI-README to document new group-scoping options and discovery behavior.
