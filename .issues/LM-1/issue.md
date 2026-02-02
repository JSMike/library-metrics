# LM-1: Plan gitlab-metrics app structure and stack choices

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | Codex        |
| Complexity   | low/medium   |
| Created      | 2026-01-31   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Capture guidance and decisions for the new `gitlab-metrics` repo: TanStack ecosystem choices (Start/Query/Table/Store/DB), Bun + tRPC integration, and initial database selection with future Archer API relationships. Define the initial data model for GitLab-based dependency and usage reporting.

## Context

The initial report scope is a single GitLab group (stable, not expected to change) used as the base for all GitLab API queries. The primary focus is identifying Node projects (via presence of `package.json`) and aggregating library usage + versions across the group. A secondary focus is capturing project members/roles and any external identifiers (Archer, ServiceNow, etc.) to enable future correlation.

The intended audience is small (dozens of users), so infrastructure should remain simple and lightweight.

## Requirements

- Track all projects within the target GitLab group.
- Detect `package.json` presence and store its contents per project.
- Detect `package-lock.json` presence and store its contents per project.
- Detect other lockfiles (bun/yarn/pnpm) and use them to resolve direct dependency versions without storing full lockfiles.
  - If multiple lockfiles exist, pick the most recently modified.
- Compute a resolved dependency version per project that prefers `package-lock.json` when present, falling back to `package.json` ranges.
  - Expand resolution to other lockfile formats (bun/yarn/pnpm) when available.
  - If no lockfile is available, store a stripped version from package.json (remove ~, ^, ranges).
  - If a lockfile exists but lacks a resolved entry, fall back to the stripped package.json version.
- Store project members and roles.
- Store project metadata and external IDs for future Archer/ServiceNow correlation.
- Support configurable library-specific searches per project using regex + file extension filters (defined in code), and store counts of matches.
- Each usage result must include target + sub-target keys to associate queries with a library/sub-target. Use a fully-qualified sub-target key that includes the parent target (e.g., target `box-model`, sub-target `box-model/button`), alongside the query key, to enable nested target grouping.
- Support historical snapshots: each sync run is recorded and all data collected in that run is associated with the run timestamp/ID.
- Allow multiple runs per day and disambiguate datasets by run ID.
- Most queries target the latest run, with ability to query older runs for historical reports.
- Support monorepos with multiple `package.json` files per project; track per-package paths.
- Track the latest commit SHA and timestamp per project for each sync run.
- If the default branch latest commit SHA is unchanged since the previous run, skip deeper project queries and reuse the latest stored data for that project in the new run.
- SQLite database files should be tracked in version control to enable redeploying the Bun server with the latest data.
- Reports must support project exclusion filters (e.g., exclude the library’s own project and any related maintainer projects when reporting adoption in other projects).
- Reports should support additional filters such as archived status and downstream system flags (e.g., active/in-production).
- Downstream status flags should live in JSON metadata for now (stored in `project_snapshot.metadata_json`) until a dedicated model is needed.
- GitLab and downstream API calls must follow a throttling/rate-limit pattern to avoid exceeding limits.
- Reporting helpers should expose latest sync metadata and aggregated dependency/usage summaries for the dashboard.

## Proposed Schema (v1)

All time-varying data is stored as run-scoped snapshots keyed by `sync_run.id`.

**Core tables**
- `sync_run`: `id`, `source`, `status`, `started_at`, `completed_at`, `note`
- `gitlab_group`: `id`, `gitlab_id` (unique), `path`, `name`, `web_url`
- `project`: `id`, `gitlab_id` (unique), `group_id`, `path_with_namespace`, `name`
- `dependency`: `id`, `name` (unique), `scope`, `short_name`
- `gitlab_user`: `id`, `gitlab_user_id` (unique), `username`, `name`

**Snapshot tables (run-scoped)**
- `package_snapshot`: `id`, `project_id`, `sync_id`, `package_path`, `name`, `version`, `private`, `workspaces_json`, `is_workspace_root`
- `project_snapshot`: `id`, `project_id`, `sync_id`, `default_branch`, `archived`, `visibility`, `last_activity_at`, `metadata_json`, `ref`, `latest_commit_sha`, `latest_commit_at`
  - Add `data_source_sync_id` (the run that last updated project data), `is_unchanged`, and `checked_at` to record that the project SHA was checked and no changes were made.
- `project_member_snapshot`: `id`, `project_id`, `sync_id`, `gitlab_user_id`, `username`, `name`, `access_level`, `state`, `expires_at`
- `project_external_ref_snapshot`: `id`, `project_id`, `sync_id`, `system`, `external_id`, `external_key`, `note`
- `project_file_snapshot`: `id`, `project_id`, `sync_id`, `path`, `ref`, `blob_sha`, `kind` (`package_json|package_lock`), `content_json`, `content_raw`, `fetched_at`
- `project_dependency_snapshot`: `id`, `project_id`, `sync_id`, `dependency_id`, `package_path`, `version_spec`, `dep_type`
- `lock_dependency_snapshot`: `id`, `project_id`, `sync_id`, `dependency_id`, `package_path`, `lockfile_path`, `version_resolved`, `dep_type`
- `usage_result`: `id`, `project_id`, `sync_id`, `target_key`, `sub_target_key` (fully-qualified), `query_key`, `match_count`, `scanned_at`

**Views**
- `project_dependency_resolved`: resolves `version` using `coalesce(lock_dependency_snapshot.version_resolved, project_dependency_snapshot.version_spec)` by `(project_id, sync_id, dependency_id, package_path, dep_type)`.

**Indexes**
- `project_file_snapshot`: `(project_id, sync_id, kind)`, `(project_id, sync_id, path)`
- `project_dependency_snapshot`: `(project_id, sync_id, dependency_id)`, `(dependency_id, sync_id)`
- `lock_dependency_snapshot`: `(project_id, sync_id, dependency_id)`
- `usage_result`: `(project_id, sync_id, query_key)`, `(query_key, sync_id)`
