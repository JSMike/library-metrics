# AI Workflow

This document defines the issue tracking and workflow requirements for AI agents working in this repository. All AI tools must follow these conventions.

## Core Principle

**Every task must be tracked in `.issues/`.** This creates a complete audit trail that:
- Documents what was requested, planned, and delivered
- Enables handoffs between agents and sessions
- Provides records for non-technical stakeholders
- Survives beyond ephemeral chat sessions

## Workflow Steps

### 1. Before Starting Work
- Check if the work relates to an existing issue in `.issues/`. Never create duplicates.
- If your tool supports issue commands, use `/issue match <description>`.

### 2. Starting New Work
- Create a new issue folder with `issue.md` and start a plan in `plan.md`.
- If your tool supports issue commands, use `/issue create <title>`.
- Plan file is saved to `.issues/GLM-N/plan.md`.

### 3. Resuming Existing Work
- Read `issue.md` for requirements, `plan.md` for approach, and the latest `summary-N.md` for context.
- If your tool supports issue commands, use `/issue work <id>`.

### 4. After ANY Work (Mandatory)
- **Never skip this step.** Record progress after:
- Creating a new issue
- Updating a plan
- Implementing changes
- Any modifications to issue files
- If your tool supports issue commands, use `/issue session <id>` to create the next `summary-N.md`.

#### Micro-change Exception (Docs/Admin Only)
You may append an **Addendum** to the most recent summary instead of creating a new summary *only* when **all** of the following are true:
- Exactly **one file** changed and **≤ 20 lines** total.
- **No behavior change** (docs/comments/wording/formatting only).
- **No new deps**, **no schema changes**, **no migrations**, **no script/flag changes**.
- **No user-facing output changes** (including logs).
- The change is made **in the same session** and the prior summary has not been used for handoff.

If any condition is not met, create a new `summary-N.md`.

### 5. Submitting for Review
- **Do not mark issues `done` yourself.** When implementation is complete, set status to `review`.
- Create a session summary documenting what was implemented and how to verify it.
- If your tool supports issue commands, use `/issue status <id> review`.

### 6. When Verified Complete
- Only mark `done` after verification confirms the changes work as expected (currently verification comes from the user but may come from specified verification agents in the future).
- Create `summary.md` with a comprehensive record.
- If your tool supports issue commands, use `/issue done <id>` only after receiving confirmation.

## Issue Folder Structure

```
.issues/
├── README.md           # Conventions documentation
├── index.md            # Auto-generated issue index
└── GLM-N/
    ├── issue.md        # Requirements and metadata
    ├── plan.md         # Implementation approach
    ├── summary-1.md    # Session 1 progress
    ├── summary-2.md    # Session 2 progress
    └── summary.md      # Final completion summary
```

## Session Summary Format

```markdown
# Session N

**Date:** YYYY-MM-DD

**Prompt/Ask:** Briefly state the user request that triggered this work.

## Completed
- What was accomplished
- Commits made

## Current Status
- Where the issue stands
- Blockers or concerns

## Plan Coverage
- Plan items addressed in this session (if applicable).

## Files Changed
- `path/to/file` - description

## Verification
- How to verify the changes work
- Commands to run, behaviors to check, expected outcomes

## Next Steps
- What remains (if any)
```

**When submitting for review:** The Verification section is required. Clearly explain how to confirm the changes work as expected.

## Status Values

| Status | Meaning |
|--------|---------|
| idea | Captured thought, not yet scoped |
| backlog | Scoped but not ready to work |
| ready | Ready to work, dependencies met |
| in-progress | Currently being worked on |
| review | Implementation complete, awaiting verification |
| done | Verified working and accepted |

**Important:** Agents must not skip `review`. Only external verification moves an issue from `review` to `done` (see Step 6).

## Optional Commands Reference

If your tool provides `/issue` commands, the following actions map to the workflow steps. Otherwise, perform the equivalent file updates manually.

| Command | Purpose |
|---------|---------|
| `/issue init` | Initialize .issues/ in new project |
| `/issue create <title>` | Create issue + enter plan mode |
| `/issue match <desc>` | Find existing issues |
| `/issue work <id>` | Start/resume work |
| `/issue session <id>` | Record session progress |
| `/issue done <id>` | Mark complete |
| `/issue list [status]` | List issues |
| `/issue show <id>` | View issue details |
| `/issue status <id> <s>` | Update status |
| `/issue plan <id>` | Create/update plan |
| `/issue index` | Regenerate index |
| `/issue delete <id>` | Remove after merge |

## Red Flags

Watch for these workflow violations:
- Making changes without an active issue
- Ending session without session summary
- Creating duplicate issues (didn't run match first)
- Commits without session record
- **Marking issues `done` without verification** — always use `review` first
- Skipping directly from `in-progress` to `done`

## Provider-Agnostic Notes

This workflow applies to all AI tools:
- Follow the `.issues/` folder structure and required files.
- Update `.issues/index.md` when creating or completing issues (or use an index command if your tool provides one).
- See tool-specific entrypoints for optional command usage: `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`.

The `.issues/` folder format is the contract; any tool that can read/write markdown can participate.
