# Plan

1. Update DB client to resolve relative DB paths against the project root when preview runs from `.output`.
2. Keep absolute paths untouched and default to current behavior in dev.
3. Verify preview starts with the default `.env`.
