# Summary

**Date:** 2026-02-02

## Overview
Renamed the project to “library-metrics”, updated all dependency UI/routes to “libraries”, aligned tRPC naming (`librarySummary`), and renamed the default SQLite filename to `library-metrics.sqlite`, including docs and tracked DB file.

## Completed Work
- Updated routes and navigation from `/dependencies` + `/dependency` to `/libraries` + `/library` with new page components and links.
- Replaced dependency wording with library terminology across dashboard, library list/detail pages, and shared layouts while preserving internal schema/lockfile dependency terms.
- Updated CSS class names by renaming `dependencies.scss` to `libraries.scss` and adjusting imports/usages across pages.
- Renamed tRPC procedure to `librarySummary` and updated callers.
- Renamed DB filename defaults and documentation to `library-metrics.sqlite` and moved the tracked DB file.
- Updated project metadata (package name, manifest name, page title, README/AI-README references).

## Files Changed
- `.env.example` - default `DB_FILE_NAME` updated.
- `package.json` - project name and db:view path updated.
- `bun.lock` - package name updated.
- `README.md` - library wording and sqlite filename updates.
- `AI-README.md` - repo name + librarySummary reference.
- `public/manifest.json` - app name updated.
- `drizzle.config.ts` - default DB filename update.
- `scripts/db-migrate.ts` - default DB filename update.
- `src/db/client.ts` - default DB filename update.
- `src/components/Header.tsx` - nav link to Libraries.
- `src/routes/__root.tsx` - document title updated.
- `src/routes/dashboard.tsx` - Libraries section + librarySummary usage.
- `src/routes/libraries.tsx` - new libraries list route.
- `src/routes/library.tsx` - new library detail route.
- `src/routes/libraries.scss` - renamed styles/classes.
- `src/routes/projects.tsx` - updated shared class names.
- `src/routes/project.tsx` - updated shared class names + libraries wording.
- `src/server/reporting.ts` - librarySummary/libraryDetail naming.
- `src/server/trpc.ts` - librarySummary router key.
- `src/routeTree.gen.ts` - updated routes for /libraries.
- `data/library-metrics.sqlite` - renamed tracked DB file.

## Verification
- User confirmed “everything is working as intended now” on 2026-02-02.

## Notes
- If a stale `data/gitlab-metrics.sqlite` appears, delete it and re-run `bun run db:migrate` to ensure the schema is applied to `library-metrics.sqlite`.
