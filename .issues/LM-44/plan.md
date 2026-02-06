# Plan: LM-44 - Create AI workflow starter repo

<!-- Plan Metadata -->
| Field        | Value                |
|--------------|----------------------|
| Created      | 2026-02-06           |
| Author       | Codex                |
| Approach     | Implemented          |

## Approach

- Create `../ai-workflow-starter` and seed it with workflow docs and starter templates.
- Normalize identifiers and paths to `ISSUE-N` and remove repo-specific references.
- Add a starter README and create ISSUE-1 with the original prompt.

## Files to Modify

- `../ai-workflow-starter/AI-WORKFLOW.md` - generic workflow docs
- `../ai-workflow-starter/AI-README.md` - starter conventions template
- `../ai-workflow-starter/AGENTS.md` - agent instructions
- `../ai-workflow-starter/.issues/README.md` - issue conventions
- `../ai-workflow-starter/.issues/index.md` - index with ISSUE-1
- `../ai-workflow-starter/.issues/ISSUE-1/issue.md` - original prompt
- `../ai-workflow-starter/.codex/commands/*` - update ISSUE-N references
- `../ai-workflow-starter/.claude/commands/*` - update ISSUE-N references
- `../ai-workflow-starter/README.md` - repo overview

## Implementation Steps

1. Create the starter repo and copy workflow docs + command docs.
2. Update identifiers and text to generic ISSUE-N naming.
3. Create `.issues` structure with ISSUE-1 and index.
4. Add starter README.

## Risks & Considerations

- Requires writing outside the current repo; may need escalation if changes are required.

## Alternatives Considered

- Provide a minimal subset of files only (rejected in favor of a complete starter kit).
