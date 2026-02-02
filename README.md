# Library Metrics

Library Metrics is an internal dashboard for scanning all projects in a group/org and analyzing library usage. It currently ships with a GitLab adapter, but is designed to be extended to other source systems (e.g., GitHub, Bitbucket) and to downstream systems (e.g., Jira, CMDB, governance tools) to aggregate project metadata and usage intelligence.

The primary goal is to track library adoption and usage patterns, but it can also surface vulnerable or deprecated dependencies and help identify owners responsible for remediation.

## What This App Does

- Scans every project in a group/org and records library usage from package manifests and lockfiles.
- Runs configurable usage queries to detect patterns across codebases.
- Provides dashboards and drill-down reports by library, project, and query.
- Stores results in a local SQLite database for fast queries and offline inspection.

## Core Use Cases

- **Adoption tracking:** see which libraries are spreading and where.
- **Risk management:** find projects using deprecated or vulnerable libraries.
- **Ownership and accountability:** identify project owners and contributors who can fix issues.

## Architecture Overview

High-level flow:

1. **Sync job** pulls group/project metadata and repository files via GitLab API.
2. **Dependency extraction** reads package manifests + lockfiles into normalized tables.
3. **Usage queries** scan source files for configured patterns.
4. **SQLite storage** persists snapshots for reporting.
5. **tRPC API** exposes summaries and detail views to the UI.
6. **TanStack Start UI** renders dashboards and drill-downs.

Key configuration lives in:
- `src/lib/usage-queries.ts` (usage targets + queries)
- `.env` (GitLab credentials and sync tuning)

## Tech Stack (Docs)

- **Runtime:** [Bun](https://bun.sh/docs)
- **Web framework:** [TanStack Start](https://tanstack.com/router/latest/docs/framework/react/overview)
- **Routing:** [TanStack Router](https://tanstack.com/router/latest/docs/framework/react/overview)
- **API layer:** [tRPC](https://trpc.io/docs)
- **Database:** [SQLite](https://www.sqlite.org/index.html) via [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- **Build:** [Vite](https://vitejs.dev/guide/)
- **Styling:** [Sass (SCSS)](https://sass-lang.com/documentation/)
- **GitLab API:** [GitLab REST API](https://docs.gitlab.com/ee/api/)

## Getting Started

### Prerequisites

- Bun installed
- GitLab access token with permission to read group projects

### Install

```bash
bun install
```

### Configure

Copy `.env.example` to `.env` and set:

- `GITLAB_GROUP_PATH`
- `GITLAB_TOKEN`
- `DB_FILE_NAME` (defaults to `./data/library-metrics.sqlite`)

### Migrate Database

```bash
bun run db:migrate
```

### Run Sync

```bash
bun --bun run sync:gitlab
```

Force a full re-sync when needed:

```bash
bun --bun run sync:gitlab -- --force
```

### Run the App

```bash
bun --bun run dev
```

Open `http://localhost:3000`.

## Working With Data

- The SQLite DB is stored in `./data/library-metrics.sqlite` and is tracked in git by default.
- To reset the DB: delete the file and re-run `bun run db:migrate`.
- Reports exclude archived or pending-deletion projects by default. Toggle this in `src/lib/report-config.ts` (`includeInactiveProjects`) if you need historical inclusion.

Optional local viewer:

```bash
bun run db:view
```

## Extending the System

### Add or Change Usage Queries

Edit `src/lib/usage-queries.ts` to add targets, sub-targets, or query patterns.

### Add Another Data Source

- Add a new sync job under `src/jobs/`.
- Store raw results in new tables or reuse existing snapshots.
- Expose summaries via `src/server/reporting.ts` and `src/server/trpc.ts`.

The goal is to keep the **source adapter** isolated, while reusing the reporting and UI layers.

## AI-WORKFLOW (Audit Tracking)

This repo includes an `AI-WORKFLOW` system under `.issues/` to track features, enhancements, and bugs with an audit trail. The workflow can be extended to other issue systems (Jira, GitHub, GitLab) through skills/MCP/API/command integrations.

If you add or modify this workflow, also update:
- `AI-WORKFLOW.md`
- `.issues/README.md`
- `.codex/commands/` and `.claude/commands/` (if applicable)

## Project Structure

- `src/routes/` – UI pages (dashboard, libraries, projects, usage reports)
- `src/server/` – tRPC routes + reporting queries
- `src/jobs/` – sync jobs (GitLab adapter)
- `src/db/` – schema and DB client
- `src/lib/` – shared utilities and usage query definitions
- `drizzle/` – database migrations
- `data/` – local SQLite database

## Common Commands

```bash
bun --bun run dev
bun --bun run build
bun --bun run preview
bun --bun run sync:gitlab
bun --bun run sync:gitlab -- --force
bun run db:migrate
bun run db:view
```

Builds are emitted to `.output/` (Nitro's default). `bun --bun run preview` serves the `.output` build, so run `build` first.
