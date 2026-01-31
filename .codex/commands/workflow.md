---
description: Issue tracking workflow guidance and verification
---

# Workflow Assistant

Helps ensure the issue tracking workflow is followed correctly. Every task in this repository must be tracked in `.issues/`.

**Usage:** `/workflow [action]`

## Actions

### (no action) - Overview

Display the complete workflow with current context. Show:
1. Any in-progress issues from `.issues/index.md`
2. The workflow steps
3. Reminders about mandatory session summaries

---

### start

Begin work properly. Follow this checklist:

1. **Understand the request** - What is the user asking for?

2. **Check for existing issues:**
   ```
   /issue match <description of the work>
   ```
   - If match found → Use `/issue work <id>` to continue
   - If no match → Use `/issue create <title>` to start new

3. **If continuing existing issue:**
   - Read the issue.md for requirements
   - Read the plan.md for approach
   - Read the latest summary-N.md for where we left off
   - Update status to `in-progress` if not already

4. **If creating new issue:**
   - `/issue create` will enter plan mode automatically
   - Plan file is at `.issues/GLM-N/plan.md`
   - Fill in issue.md with requirements and acceptance criteria

5. **Confirm tracking:**
   - Display: "Working on GLM-N: <title>"
   - Display: "Remember to run `/issue session GLM-N` after completing work"

---

### check

Verify the workflow is being followed. Check:

1. **Is there an active issue?**
   - Scan `.issues/*/issue.md` for `in-progress` status
   - If none, warn: "No issue in progress - run `/workflow start`"

2. **Is the current work related to an issue?**
   - Compare recent file changes to issue acceptance criteria
   - Warn if work appears untracked

3. **Are session summaries up to date?**
   - Check if commits exist since last summary-N.md
   - Warn: "Commits found since last session summary - run `/issue session <id>`"

4. **Checklist output:**
   ```
   Workflow Check:
   [x] Issue exists: GLM-18
   [x] Status: in-progress
   [x] Plan exists: yes
   [ ] Session summary current: NO - 2 commits since summary-2.md

   Action needed: Run `/issue session GLM-18`
   ```

---

### end

Prepare to end the current session. Mandatory steps:

1. **Identify active issue(s):**
   - List all issues with `in-progress` status

2. **For each active issue:**
   - Prompt to create session summary:
     ```
     /issue session <id>
     ```
   - Session summary must include:
     - What was completed
     - Current status
     - Files changed
     - Next steps

3. **Verify all work is committed:**
   - Check `git status` for uncommitted changes
   - Warn if changes exist that should be committed

4. **Confirm completion:**
   - Display: "Session summaries created for: GLM-N, GLM-M"
   - Display: "Safe to end session"

---

### help

Show quick reference for issue commands:

```
Issue Workflow Commands:

Starting work:
  /issue match <desc>     Find existing issues
  /issue create <title>   Create new issue + enter plan mode
  /issue work <id>        Continue existing issue

During work:
  /issue show <id>        View issue details
  /issue status <id> <s>  Update status
  /issue plan <id>        Create/update plan

Recording progress:
  /issue session <id>     Record session summary (MANDATORY)
  /issue done <id>        Mark complete with final summary

Maintenance:
  /issue list [status]    List issues
  /issue index            Regenerate index
  /issue delete <id>      Remove after PR merge
```

---

## Workflow Diagram

```
User Request
     │
     ▼
┌─────────────────┐
│ /issue match    │ ─── Match found? ──→ /issue work <id>
└────────┬────────┘                              │
         │ No match                              │
         ▼                                       │
┌─────────────────┐                              │
│ /issue create   │                              │
│ (enters plan    │                              │
│  mode)          │                              │
└────────┬────────┘                              │
         │                                       │
         ▼                                       ▼
┌─────────────────────────────────────────────────┐
│                  Do Work                        │
│  - Implement changes                            │
│  - Update plan checkboxes                       │
│  - Commit code                                  │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│  /issue session <id>  (MANDATORY)               │
│  - Record what was done                         │
│  - Note current status                          │
│  - List files changed                           │
│  - Define next steps                            │
└────────────────────┬────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
   More work?              All done?
         │                       │
         │                       ▼
         │              ┌─────────────────┐
         │              │ /issue done <id>│
         │              └────────┬────────┘
         │                       │
         └───────────────────────┘
```

---

## Common Scenarios

### "User asks to fix a bug"
1. `/issue match bug description` - check if already tracked
2. If found: `/issue work GLM-N`
3. If not: `/issue create "Fix: bug description"`
4. Implement fix
5. `/issue session GLM-N` - record the fix
6. If complete: `/issue done GLM-N`

### "User asks to add a feature"
1. `/issue match feature description`
2. If not found: `/issue create "Add: feature name"`
3. Plan mode activates - design the approach
4. Implement in iterations
5. `/issue session GLM-N` after each work block
6. `/issue done GLM-N` when feature complete

### "Resuming work from previous session"
1. Check `.issues/index.md` for in-progress issues
2. `/issue work GLM-N` to see context
3. Read latest `summary-N.md` for where we left off
4. Continue implementation
5. `/issue session GLM-N` before ending

### "Quick idea to capture"
1. `/issue create "Idea: brief description"`
2. Fill in minimal details in issue.md
3. Set status to `idea` or `backlog`
4. `/issue session GLM-N` to record creation
5. Return later to flesh out

---

## Red Flags

Watch for these workflow violations:

- **Making changes without an active issue** - Always have a GLM-N
- **Ending session without session summary** - Never skip `/issue session`
- **Creating duplicate issues** - Always `/issue match` first
- **Work not reflected in issue folder** - Plans and summaries must be updated
- **Commits without session record** - Each commit session needs a summary
