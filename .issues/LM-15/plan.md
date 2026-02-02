# Plan

1. Split server-only reporting logic into a `reporting.server.ts` module that owns DB access.
2. Replace `src/server/reporting.ts` with client-safe `createServerFn` wrappers that lazy-load server functions.
3. Update server-only consumers (tRPC) to import from the new server module.
4. Sanity-check build path and ensure no client imports of `bun:sqlite` remain.
