# Plan

1. Normalize pnpm importer dependency values to strings during parse (favor `version`, fallback to `specifier`).
2. Update `extractPnpmVersion` to accept unknown input and bail on non-strings.
3. Verify sync no longer throws when pnpm importer values are objects.
