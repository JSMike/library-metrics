# Plan: LM-3 - Migrate styles from CSS to SCSS

<!-- Plan Metadata -->

| Field    | Value      |
| -------- | ---------- |
| Created  | 2026-02-01 |
| Author   | Codex      |
| Approach | Draft      |

## Goal

Move the codebase to SCSS-based styles while preserving existing styling behavior.

## Work Breakdown

### 1. Audit current styles
- Inventory existing `.css` files and their import points.
- Identify global vs component/route-level styles.

### 2. Tooling updates
- Add SCSS support to Vite (if not already present).
- Ensure TanStack Start setup resolves `.scss` imports correctly.

### 3. File migration
- Rename `.css` files to `.scss` equivalents.
- Update all imports to point to `.scss`.
- Migrate any global stylesheets and adjust references in root route.

### 4. Verification
- Run the dev server and confirm styles are applied.
- Validate there are no missing stylesheet references or build errors.
