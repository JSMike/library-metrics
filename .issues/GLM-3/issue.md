# GLM-3: Migrate styles from CSS to SCSS

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | Codex        |
| Complexity   | medium       |
| Created      | 2026-02-01   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Switch the project styling approach from plain `.css` files to `.scss`, updating tooling, imports, and conventions accordingly.

## Context

The project currently relies on plain CSS files for component and route styling. The user prefers SCSS for styling, which requires updating the build pipeline, file structure, and imports.

## Requirements

- Replace existing `.css` stylesheets with `.scss` equivalents.
- Update imports and build tooling to compile SCSS.
- Ensure styling continues to work as-is after the migration.
- Update any documentation or conventions that reference CSS.

## Notes

- Determine whether to keep a global stylesheet (currently `src/styles.css`) and whether to migrate it to `styles.scss`.
- Verify whether any CSS-specific build assumptions exist in Vite/TanStack Start config.
