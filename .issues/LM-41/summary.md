# Summary

**Issue:** LM-41 - Include package.json next to lockfiles
**Completed:** 2026-02-05

## Outcome
- Package.json files are now limited to those that share a directory with a detected lockfile (including root package.json only when a root lockfile exists).
- Zoekt and tree-scan paths both derive package.json candidates from lockfile locations, and missing package.json files are safely skipped.

## Key Changes
- Added lockfile-adjacent package.json derivation and 404 guard while fetching package.json files.
- Restricted root package.json search results to projects that also have a root lockfile.

## Files Changed
- `src/jobs/sync-gitlab.ts`
- `.issues/LM-41/issue.md`
- `.issues/index.md`

## Verification
- User confirmed the change works as expected.
