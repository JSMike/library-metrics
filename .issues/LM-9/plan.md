# Plan: LM-9 - Add archive-based usage scanning

<!-- Plan Metadata -->

| Field    | Value      |
| -------- | ---------- |
| Created  | 2026-02-01 |
| Author   | Codex      |
| Approach | Draft      |

## Goal

Reduce API calls during usage scanning by downloading a repository archive and scanning files locally.

## Work Breakdown

### 1. Design archive workflow
- Decide archive format and extraction method.
- Define temp storage and cleanup strategy.
- Decide opt-in flag or default behavior.

### 2. Implement archive download + scan
- Add GitLab archive download helper with rate-limited endpoint handling.
- Extract archive and reuse existing query/extension filtering.

### 3. Integrate and fallback
- Wire archive scan into sync flow with fallback to per-file fetch.
- Add configuration flags and documentation.

### 4. Verification
- Run sync and confirm usage scans complete with fewer API calls.
