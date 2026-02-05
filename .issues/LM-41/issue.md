# LM-41: Include package.json next to lockfiles

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | TBD          |
| Complexity   | medium       |
| Created      | 2026-02-04   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Some projects show no libraries because `package.json` files are nested alongside lockfiles rather than at the repo root. We should only include `package.json` files that live in the same directory as a detected lockfile, plus root-level `package.json` when a root lockfile exists.

## Requirements

- Do not scan every `package.json` in a repo.
- Include `package.json` files that are in the same directory as a detected lockfile.
- Keep root-level `package.json` behavior when a root lockfile exists.
- Ensure library extraction uses the filtered package.json list.

## Notes

Motivation: avoid scripts or tooling directories that include unrelated `package.json` files while still supporting nested app/package roots.
