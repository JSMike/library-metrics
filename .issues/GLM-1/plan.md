# Plan: GLM-1 - Plan gitlab-metrics app structure and stack choices

<!-- Plan Metadata -->

| Field    | Value      |
| -------- | ---------- |
| Created  | 2026-01-31 |
| Author   | Codex      |
| Approach | Draft      |

## Goal

Provide up-to-date guidance on TanStack/Bun/tRPC stack, database choice, repo structure, and a GitLab-focused data model for dependency + usage reporting; record workflow migration steps.

## Work Breakdown

### 1. Research current docs

- Confirm TanStack Start/Store/DB/Query/Table positioning and maturity.
- Verify Bun create scaffolding command and Bun SQLite capabilities.
- Check tRPC adapters suitable for Bun/Fetch.

Notes:
- TanStack Start + Bun docs recommend running Vite with `bun --bun` and call out React 19+ for Bun hosting guidance.
- Nitro supports a Bun preset for Bun-targeted deployments.
- TanStack DB is in beta; TanStack Store is in alpha; TanStack Table remains headless and framework-agnostic.

### 2. Propose stack and structure

- Recommend the TanStack libraries to pair with tRPC for a reporting dashboard.
- Suggest an initial folder layout and boundaries (client, server, db, jobs).

### 3. Data model guidance

- Outline a relational core with JSON payload storage for GitLab data.
- Include dependency extraction and resolved version logic (lockfile preferred).
- Extend lockfile detection to bun/yarn/pnpm formats and resolve direct dependency versions without storing full lockfiles.
- When multiple lockfiles are present, select the most recently modified.
- Use a stripped package.json version spec as fallback when no lockfile is present.
- Also fallback when the selected lockfile lacks a resolved entry.
- Capture project members/roles and external IDs for Archer/ServiceNow correlation.
- Include library usage queries (regex + extensions) defined in code and per-project counts stored in DB, with target + sub-target keys to group related queries (sub-target should be fully-qualified with the parent target).
- Ensure all records are tied to a sync run for historical reporting.
- Include latest commit SHA/timestamp per project snapshot.
- Add change-detection logic: if latest commit SHA matches prior run, skip deeper project queries and reuse prior data for the new run.
- Record `data_source_sync_id`, `is_unchanged`, and `checked_at` in the project snapshot to show the project was checked even when unchanged.
- Plan for report-time exclusion filters (by project ID/path) to omit maintainer/owner projects, including multiple related projects, from adoption metrics.
- Include filters for archived projects and downstream status flags (active/in-production), with status flags stored in JSON metadata for now.
- Define a throttling/rate-limit strategy for GitLab and downstream API calls.
- Add reporting helpers for latest sync metadata and aggregated dependency/usage summaries.

### 4. Migration plan

- Define steps to copy AI-WORKFLOW/AI-README/.issues into the new repo.
- Mark migration complete in session summaries.
