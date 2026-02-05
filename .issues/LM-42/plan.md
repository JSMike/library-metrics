# Plan

1. Update usage query/target types to allow `targetDependency: true`.
2. Adjust sync filtering to bypass dependency checks when using zoekt and the flag is set.
3. Ensure usage scans only run against projects discovered by zoekt when bypassed.
4. Add logging/guards for non-zoekt usage of the flag.
