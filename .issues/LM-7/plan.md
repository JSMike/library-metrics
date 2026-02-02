# Plan: LM-7 - Link parent references in usage report headers

<!-- Plan Metadata -->

| Field    | Value      |
| -------- | ---------- |
| Created  | 2026-02-01 |
| Author   | Codex      |
| Approach | Draft      |

## Goal

Make usage report header context link back to parent pages and fix project usage query context to use the sub-target.

## Work Breakdown

### 1. Project usage pages
- Update the project source sub-target header to link the project name to `/project`.
- Update the project source query header to link the project and sub-target and use the sub-target title.

### 2. Global usage pages
- Update global usage sub-target header to link the target title back to the target page.
- Update global usage query header to link the target and sub-target back to their pages.

### 3. Verification
- Confirm header links navigate to expected parent pages.
- Confirm the project usage query header shows the sub-target title.
