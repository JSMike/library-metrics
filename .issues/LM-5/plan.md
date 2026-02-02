# Plan: LM-5 - Add projects list page and header navigation

<!-- Plan Metadata -->

| Field    | Value      |
| -------- | ---------- |
| Created  | 2026-02-01 |
| Author   | Codex      |
| Approach | Draft      |

## Goal

Provide a `/projects` list page with filter + pagination and add header navigation to reach it.

## Work Breakdown

### 1. Clarify requirements
- Confirm desired columns and linking behavior for the projects table.
- Confirm pagination defaults/options and search fields.

### 2. Data/query layer updates
- Add a reporting query to list projects for the latest sync run.
- Add a tRPC endpoint for the projects list.

### 3. UI updates
- Add `/projects` route and page modeled after dependencies list.
- Add header nav link to `/projects`.

### 4. Verification
- Confirm filtering and pagination work and links route correctly.
