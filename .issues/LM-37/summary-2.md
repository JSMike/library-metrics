# Session 2

**Date:** 2026-02-04

**Prompt/Ask:** Record answers about storage strategy, filtering, and SAML link scope for LM-37.

## Completed
- Documented decisions: store members as current-state only, require active + access_level >= 30, scope SAML links to groups with projects, and prefer JSON storage unless relational joins are needed.

## Current Status
- LM-37 remains backlog; requirements clarified.

## Plan Coverage
- N/A (requirements clarified).

## Files Changed
- `.issues/LM-37/issue.md` - recorded answers to open questions.

## Verification
- None.

## Next Steps
- When moving to implementation, decide schema approach (JSON vs relational) based on query needs.
