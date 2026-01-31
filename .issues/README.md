# Issue Tracking

This folder contains issue tracking for the repository. Each issue has its own folder with documentation.

## Structure

Each `GLM-N/` folder contains:
- `issue.md` - Requirements and metadata (always present)
- `plan.md` - Implementation approach (created when planning)
- `summary-1.md`, `summary-2.md`, ... - Session progress records (created per work session)
- `summary.md` - Final completion record (created when done)

## Status Values

| Status | Meaning |
|--------|---------|
| idea | Captured thought, not yet scoped |
| backlog | Not yet ready to work |
| ready | Ready to work, dependencies met |
| in-progress | Currently being worked on |
| review | Work complete, pending verification |
| done | Completed and accepted |

## Metadata Fields

| Field | Description |
|-------|-------------|
| Status | Current status (see above) |
| Owner | Agent / TBD / person name |
| Complexity | low/medium / high (see below) |
| Created | Date created (YYYY-MM-DD) |
| Source | Origin category (design-review, bug-report, etc.) |
| External | External ticket reference (optional) |
| Blocks | Issues this blocks (optional) |
| Blocked-by | Issues blocking this (optional) |
| Priority | high / medium / low |

## Complexity & Model Selection

The `Complexity` field indicates the reasoning level required for a task:

| Complexity | Codex | Claude | Use for |
|------------|-------|--------|---------|
| `low/medium` | High | Sonnet | Standard implementation, well-defined tasks |
| `high` | Extra high | Opus | Architecture, complex reasoning, ambiguous requirements |

This helps agents (or humans assigning work) select the appropriate model tier.

## Optional Commands

If your tool supports `/issue` commands, use them to manage the `.issues/` files. Otherwise, make the equivalent file updates manually.

Use `/issue <action>` to manage issues:
- `init` - Initialize this folder structure
- `create <title>` - Create new issue and enter plan mode
- `match <description>` - Find existing issues matching a description
- `work <id>` - Start working on an issue
- `list [status]` - Show issues
- `show <id>` - Display issue details
- `status <id> <status>` - Update status
- `plan <id>` - Create/update plan
- `session <id>` - Record session progress (run at end of each work session)
- `done <id>` - Mark complete with comprehensive summary
- `delete <id>` - Remove issue
- `index` - Regenerate index.md

## Lifecycle

1. Create issue with `/issue create`
2. Plan implementation, add plan.md
3. Work on issue, update status to `in-progress`
4. **After ANY work on an issue, run `/issue session` to record progress** (mandatory)
5. When complete, run `/issue done` for final summary
6. After PR merge, run `/issue delete`

**Important:** Session summaries are mandatory after every unit of work. This includes creating issues, updating plans, implementing changes, or any modifications. Never skip this step.

**Index upkeep:** If you are not using an index command, update `.issues/index.md` when creating or completing issues.
