# LM-44: Create AI workflow starter repo

<!-- Metadata -->
| Field        | Value        |
|--------------|--------------|
| Status       | done         |
| Owner        | TBD          |
| Complexity   | low          |
| Created      | 2026-02-06   |
| Source       | user-request |
| External     |              |
| Blocks       |              |
| Blocked-by   |              |
| Priority     | medium       |

## Summary

Seed a new repo at `../ai-workflow-starter` with the AI workflow documentation, starter issue tracking structure, and a first issue that records the original user prompt. Ensure all copied files are generic and suitable for a blank starter project.

## Requirements

- Copy the workflow docs and agent instructions (AI-WORKFLOW.md, AI-README.md, AGENTS.md).
- Create `.issues/` with README, index, and ISSUE-1 containing the original prompt.
- Copy `.codex/commands/` and `.claude/commands/` command docs and update references to `ISSUE-N`.
- Add a basic README describing the starter repo.
- Keep contents generic (no library-metrics-specific references).
