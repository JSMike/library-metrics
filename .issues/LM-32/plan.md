# Plan

1. Define zoekt search configuration (env or auto-detect) and implement query builders for lockfile/root package.json discovery.
2. Use zoekt results to build a minimal project list, fetch project metadata only for matching projects, and skip full tree scans when zoekt is enabled.
3. Update usage scanning to seed candidate files via zoekt queries per usage definition, falling back to existing tree scans when zoekt is unavailable.
