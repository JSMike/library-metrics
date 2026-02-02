# AI Project Guide

This document provides project-specific guidance for AI agents working in the `library-metrics` repository.

## Project Overview

TanStack Start app running on Bun, with tRPC and Drizzle (bun:sqlite) for a local metrics database. The initial focus is GitLab aggregation with room for future downstream/connected apps (e.g., governance, service management, CMDB, or other internal systems) to correlate project data.

## Required Reading

### AI-WORKFLOW.md (Always Required)

**You MUST read `AI-WORKFLOW.md` before starting any work.** This defines the mandatory issue tracking workflow:

- Every task must be tracked in `.issues/`
- Check for existing issues before creating new ones
- Record session summaries after any work
- Use `/issue` commands if available, or update files manually

## Project Conventions

### Runtime & Tooling

- Use Bun for installs and scripts: `bun install`, `bun run dev`.
- Keep scripts compatible with Bun's ESM runtime.
- Configure GitLab sync throttling via `GITLAB_REQUEST_CONCURRENCY` and `GITLAB_REQUEST_DELAY_MS`.
- For TanStack Start with Bun, prefer `bun --bun` for Vite scripts and ensure React 19+ when using Bun-specific deployment guidance.
- If deploying on Bun, consider Nitro's `preset: "bun"` in `vite.config.ts` for Bun-targeted output.

### Operational Notes

- Sync flags: `--force` / `SYNC_FORCE=1` bypass unchanged-SHA skips; `SYNC_DEBUG=1` enables stage logs; `SYNC_VERBOSE=1` or `--verbose` logs scan progress every 10 files (debug default is every 100 files).
- Forced syncs can take minutes due to full tree + per-file usage scans (not a hang if logs advance).
- GitLab request tuning via `.env`: `GITLAB_REQUEST_CONCURRENCY`, `GITLAB_REQUEST_DELAY_MS`, `GITLAB_REQUEST_TIMEOUT_MS`, `GITLAB_REQUEST_RETRIES`, `GITLAB_REQUEST_RETRY_DELAY_MS`.
- Lockfiles are fetched but not stored; resolved versions are computed at sync and stored in `lock_dependency_snapshot`. Missing lockfile entries fall back to a stripped package.json version spec.
- Monorepos: multiple `package.json` files are stored per project path.
- Usage queries live in `src/lib/usage-queries.ts` and are stored in `usage_result` with target/sub-target/query keys.
- DB is local SQLite (tracked in git) at `./data/`; view with Datasette via `bun run db:view`.
- tRPC API `/api/trpc/*` exposes `latestSyncRun`, `librarySummary`, `usageSummary`; `/dashboard` consumes these.

### Current Defaults

- `DB_FILE_NAME=./data/library-metrics.sqlite`
- `TRPC_BASE_URL=http://localhost:3000`
- `GITLAB_BASE_URL=https://gitlab.com`
- `GITLAB_API_VERSION=v4`
- `GITLAB_GROUP_PATH` optional (single group)
- `GITLAB_GROUP_INCLUDE_PATHS` / `GITLAB_GROUP_EXCLUDE_PATHS` optional (comma-separated)
- `GITLAB_REQUEST_CONCURRENCY=3`
- `GITLAB_REQUEST_DELAY_MS=0`
- `GITLAB_REQUEST_TIMEOUT_MS=30000`
- `GITLAB_REQUEST_RETRIES=1`
- `GITLAB_REQUEST_RETRY_DELAY_MS=2000`

### Sync & Logging Knobs

- Force full resync: `--force` / `SYNC_FORCE=1`
- Enable debug stages: `SYNC_DEBUG=1`
- Increase scan progress logging: `--verbose` / `SYNC_VERBOSE=1` (every 10 files; debug default is every 100)
- Tune API pacing/timeouts: `GITLAB_REQUEST_CONCURRENCY`, `GITLAB_REQUEST_DELAY_MS`, `GITLAB_REQUEST_TIMEOUT_MS`, `GITLAB_REQUEST_RETRIES`, `GITLAB_REQUEST_RETRY_DELAY_MS`

### Suggested Structure

- `src/routes/` - TanStack Start routes.
- `src/server/` - tRPC routers, context, server-only logic.
- `src/db/` - Drizzle schema, migrations, DB client.
- `src/jobs/` - GitLab sync + scheduled aggregation.
- `src/lib/` - API clients and shared helpers.

### Database

- Use Drizzle with `bun:sqlite` for the local DB.
- Run migrations via the Bun migrator: `bun run db:migrate`.
- Prefer normalized core tables with JSON payload columns for raw API responses.
- SQLite file is stored in `./data/library-metrics.sqlite` by default and tracked in git.
- Use `DB_FILE_NAME` to override the path (see `.env.example`).

## Common Commands

```bash
bun run dev
bun run build
bun run preview
bun run test
bun run sync:gitlab
bun run db:migrate
bun run db:view
```

Datasette (self-hosted SQLite viewer)
- Install once (Ubuntu/Debian): `sudo apt-get update && sudo apt-get install -y pipx && pipx ensurepath && pipx install datasette`
- Install once (macOS): `brew install datasette`
- Run: `bun run db:view` and open `http://127.0.0.1:8001`
