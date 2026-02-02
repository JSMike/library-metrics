# Plan

1. Add a build-time script to copy the SQLite DB (and WAL/SHM if present) into `.output`.
2. Update the build script to run the copy step after Vite completes.
3. Document verification steps in the session summary.
