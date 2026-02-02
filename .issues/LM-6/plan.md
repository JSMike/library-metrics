# Plan: LM-6 - Make /projects search optional for header link

<!-- Plan Metadata -->

| Field    | Value      |
| -------- | ---------- |
| Created  | 2026-02-01 |
| Author   | Codex      |
| Approach | Draft      |

## Goal

Ensure the `/projects` and `/dependencies` routes do not require `search` parameters in links.

## Work Breakdown

### 1. Adjust route search typing
- Update the `/projects` and `/dependencies` route `validateSearch` input to use `SearchSchemaInput` so search params are optional.

### 2. Verification
- Confirm the TypeScript errors in `Header.tsx` are resolved.
