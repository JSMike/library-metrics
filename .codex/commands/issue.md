---
description: Manage issues in the .issues/ folder
---

# Issue Management

Manage the issue tracking system in `.issues/`. This command is portable and can bootstrap issue tracking in any repository.

**Usage:** `/issue <action> [arguments]`

## Actions

### init

Initialize the `.issues/` folder structure in a new project.

1. Create `.issues/` directory
2. Create `.issues/README.md` with conventions documentation (template below)
3. Create empty `.issues/index.md` with header

**README.md Template:**
```markdown
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
| Created | Date created (YYYY-MM-DD) |
| Source | Origin category (design-review, bug-report, etc.) |
| External | External ticket reference (optional) |
| Blocks | Issues this blocks (optional) |
| Blocked-by | Issues blocking this (optional) |
| Priority | high / medium / low |

## Commands

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

**Important:** Session summaries are mandatory after every unit of work, not optional. This includes creating issues, updating plans, or any modifications. The audit trail depends on consistent session recording.
```

---

### create <title>

Create a new issue folder with issue.md template, then enter plan mode.

**This is the recommended way to start new work** - it ensures all planning and decisions are captured in the issue folder for audit purposes.

1. Find the next available GLM-N number by scanning existing folders
2. Create `.issues/GLM-N/` directory
3. Create `.issues/GLM-N/issue.md` with template:

```markdown
# GLM-N: <title>

<!-- Metadata -->
| Field        | Value                              |
|--------------|-------------------------------------|
| Status       | backlog                             |
| Owner        | TBD                                 |
| Created      | <today's date YYYY-MM-DD>           |
| Source       |                                     |
| External     |                                     |
| Blocks       |                                     |
| Blocked-by   |                                     |
| Priority     | medium                              |

## Summary
<describe what needs to be done>

## Context
<background information>

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## References
- Related files:
- Related issues:
```

4. Display the created issue path
5. **Enter plan mode** with plan file at `.issues/GLM-N/plan.md`
   - All planning work is captured in the issue folder
   - This becomes the complete audit trail

---

### match <description>

Search for existing issues that match a description. **Use this before starting new work** to avoid creating duplicate issues.

1. Read all `.issues/GLM-*/issue.md` files
2. Compare Summary and Title against the provided description
3. Return matching issues with relevance indication
4. If match found, suggest `/issue work <id>` to continue that issue

Example output:
```
Found 2 potential matches:

GLM-8: Button hover states fail contrast (high match)
  Status: ready | Priority: high
  → Use `/issue work GLM-8` to continue this issue

GLM-3: Stat delta colors need AA audit (partial match)
  Status: ready | Priority: medium

No match? Use `/issue create "<title>"` to create new issue.
```

---

### work <id>

Start working on an existing issue.

1. Read `.issues/<id>/issue.md` and display acceptance criteria
2. If status is `ready`, update to `in-progress`
3. If status is `in-progress`, show current progress from plan.md
4. Display reminder: "When complete, run `/issue done <id>`"
5. If plan.md doesn't exist, offer to enter plan mode

This action helps agents pick up existing work rather than starting fresh.

---

### list [status]

Show issues, optionally filtered by status.

1. Scan all `.issues/GLM-*/issue.md` files
2. Parse metadata table from each
3. If status filter provided, only show matching issues
4. Display as table grouped by status:

```
## In Progress
| ID | Title | Owner | Priority |
|----|-------|-------|----------|
| GLM-1 | Issue title | Agent | high |

## Ready
...
```

---

### show <id>

Display full details of an issue.

1. Read `.issues/<id>/issue.md`
2. If exists, also summarize `plan.md` and `summary.md`
3. Display the content

---

### status <id> <new-status>

Update the status field of an issue.

1. Read `.issues/<id>/issue.md`
2. Update the Status field in the metadata table
3. Valid statuses: backlog, ready, in-progress, review, done
4. Save the file

---

### plan <id>

Create or update plan.md for an issue.

1. If `.issues/<id>/plan.md` doesn't exist, create with template:

```markdown
# Plan: <id> - <title from issue.md>

<!-- Plan Metadata -->
| Field        | Value                              |
|--------------|-------------------------------------|
| Created      | <today's date>                      |
| Author       | Agent                               |
| Approach     | Proposed                            |

## Approach
<describe implementation strategy>

## Files to Modify
- `path/to/file` - description

## Implementation Steps
1. [ ] Step one
2. [ ] Step two
3. [ ] Step three

## Risks & Considerations
-

## Alternatives Considered
```

2. If issue status is `ready`, update to `in-progress`
3. Display the plan path

---

### done <id>

Mark issue as complete with a **comprehensive summary** that serves as the audit record.

**Important:** The summary.md becomes the permanent record of what was actually done. It should be detailed enough for non-technical stakeholders to understand the work completed.

1. Create `.issues/<id>/summary.md` with comprehensive content:

```markdown
# Summary: <id> - <title from issue.md>

## Completed
<today's date> by Agent

## What Was Done
<Detailed description of the implementation - not just "done" but what specifically was built/changed/fixed>

## Files Changed
- `path/to/file.ts` - <specific description of changes>
- `path/to/file.scss` - <specific description of changes>
<List ALL files that were modified with meaningful descriptions>

## Key Decisions Made
- <Any decisions made during implementation>
- <Trade-offs chosen>
- <Why certain approaches were taken>

## Deviations from Plan
- <If anything was done differently than originally planned, explain why>

## Acceptance Criteria Results
- [x] Criterion 1 - <how it was verified>
- [x] Criterion 2 - <how it was verified>
- [x] Criterion 3 - <how it was verified>

## Artifacts
- Branch: <branch name>
- PR: <PR number/link>
- Commits: <commit hashes>

## Notes
<Any additional context for future reference>
```

2. Update issue.md status to `done`
3. Display confirmation with link to summary.md

---

### session <id>

Record progress after completing work on an issue. **This is mandatory after any work** - creating issues, updating plans, implementing changes, or any other modifications. Never skip this step.

1. Find the next session number by scanning existing `summary-N.md` files in `.issues/<id>/`
2. Create `.issues/<id>/summary-N.md` with:

```markdown
# Session N

**Date:** <today's date YYYY-MM-DD>

## Completed
- <What was accomplished in this session>
- <Specific tasks completed>
- <Commits made>

## Current Status
- <Where the issue stands now>
- <What acceptance criteria are complete>
- <Any blockers or concerns>

## Files Changed
- `path/to/file.ts` - <description of changes>
- `path/to/file.scss` - <description of changes>

## Next Steps
- <What remains to be done>
- <Recommended next actions>
```

3. Display confirmation with session file path
4. Remind: "Run `/issue done <id>` when all work is complete"

---

### delete <id>

Remove an issue folder after PR merge.

1. Confirm the issue exists and status is `done`
2. Delete the entire `.issues/<id>/` folder
3. Run `index` action to regenerate index.md
4. Display confirmation

---

### index

Regenerate the index.md file from all issues.

1. Scan all `.issues/GLM-*/issue.md` files
2. Parse metadata from each
3. Generate `.issues/index.md`:

```markdown
# Issue Index

Generated: <today's date>

## By Status

### In Progress
| ID | Title | Owner | Blocked By |
|----|-------|-------|------------|
| [GLM-1](./GLM-1/issue.md) | Title | Owner | - |

### Ready
| ID | Title | Owner | Priority |
|----|-------|-------|----------|

### Backlog
| ID | Title | Owner | Priority |
|----|-------|-------|----------|

### Review
| ID | Title | Owner | PR |
|----|-------|-------|-----|

### Done
| ID | Title | Completed |
|----|-------|-----------|
```

4. Display count of issues by status
