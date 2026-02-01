# Plan: GLM-11 - Replace drizzle-kit migrations with Bun-based migrator

<!-- Plan Metadata -->

| Field    | Value      |
| -------- | ---------- |
| Created  | 2026-02-01 |
| Author   | Codex      |
| Approach | Draft      |

## Goal

Make migrations work without `better-sqlite3` by using Drizzle's Bun migrator.

## Work Breakdown

### 1. Add Bun migration script
- Implement a script that runs `migrate()` from `drizzle-orm/bun-sqlite/migrator`.
- Respect `DB_FILE_NAME` env var.

### 2. Update scripts and deps
- Update `db:migrate` to use the new script.
- Remove `better-sqlite3` if no longer required.
- Decide whether to keep drizzle-kit for `db:generate`.

### 3. Docs
- Update README/AI-README with new migration instructions.

### 4. Verification
- Run `bun run db:migrate` and confirm migrations apply.
