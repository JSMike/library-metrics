# Plan

1. Add a helper to resolve `App Code` from group ancestry + `saml_group_links_json`.
2. Extend reporting queries to return `appCode` alongside project fields.
3. Add an `App Code` column to all project tables and render the resolved value.
4. Document the new column behavior and fallback logic.
