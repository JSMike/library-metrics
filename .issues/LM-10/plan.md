# Plan: LM-10 - Add database purge/reset for fresh sync

<!-- Plan Metadata -->

| Field    | Value      |
| -------- | ---------- |
| Created  | 2026-02-01 |
| Author   | Codex      |
| Approach | Draft      |

## Goal

Provide a safe, repeatable database purge/reset workflow that preserves schema and enables a fresh sync.

## Work Breakdown

### 1. Decide purge strategy
- Choose between deleting the SQLite file vs truncating tables.
- Identify migration/system tables to preserve.

### 2. Implement purge command
- Add a script/command (e.g., `bun run db:reset`) to perform the purge.
- Optionally add a combined command to purge + forced sync.

### 3. Documentation
- Update README/.env.example with instructions and safety notes.

### 4. Verification
- Run purge command and confirm schema persists.
- Run a fresh sync and verify tables are repopulated.
