# AI Project Guide

This document provides project-specific guidance for AI agents working in the `gitlab-metrics` repository.

## Project Overview

TanStack Start app running on Bun, with tRPC and Drizzle (bun:sqlite) for a local metrics database. The initial focus is GitLab aggregation with room for future Archer API relationships.

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

### Suggested Structure

- `src/routes/` - TanStack Start routes.
- `src/server/` - tRPC routers, context, server-only logic.
- `src/db/` - Drizzle schema, migrations, DB client.
- `src/jobs/` - GitLab sync + scheduled aggregation.
- `src/lib/` - API clients and shared helpers.

### Database

- Use Drizzle with `bun:sqlite` for the local DB.
- Prefer normalized core tables with JSON payload columns for raw API responses.
- SQLite file is stored in `./data/gitlab-metrics.sqlite` by default and tracked in git.
- Use `DB_FILE_NAME` to override the path (see `.env.example`).

## Common Commands

```bash
bun run dev
bun run build
bun run preview
bun run test
bun run sync:gitlab
bun run db:view
```

Datasette (self-hosted SQLite viewer)
- Install once (Ubuntu/Debian): `sudo apt-get update && sudo apt-get install -y pipx && pipx ensurepath && pipx install datasette`
- Install once (macOS): `brew install datasette`
- Run: `bun run db:view` and open `http://127.0.0.1:8001`
