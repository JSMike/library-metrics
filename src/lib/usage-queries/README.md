# Usage Queries

This folder contains usage query definitions grouped by file. Each file can
export a set of `usageTargets` for a domain or product.

## Structure

- `types.ts` - shared types for usage queries.
- `<domain>.ts` - grouped query definitions (example: `box-model.ts`).
- `index.ts` - aggregates `usageTargets` into `usageQueries`.

## Zoekt vs basic fallback

- Set `searchType: "zoekt"` to enable zoekt search for a query.
- `searchQuery` is the exact string sent to the GitLab search API when zoekt is
  available. You can include `file:` or `-file:` filters directly if desired.
- `regex` is optional. If it is omitted and zoekt is unavailable, the query is
  skipped (no basic fallback scan).
- If `regex` is provided, the basic tree-scan + regex fallback will be used when
  zoekt is not available. The fallback only runs when `extensions` are provided
  (so we don't scan every file).

## Adding a new query set

1) Create a new file in this folder (e.g. `my-product.ts`).
2) Export `usageTargets` from that file.
3) Add the new targets to `usageTargets` in `index.ts`.

## Example query

```ts
{
  queryKey: "import-button",
  queryKeyTitle: "import '@box-model/web/button'",
  searchType: "zoekt",
  searchQuery: "@box-model/web/button",
  regex: "import\\s+.*from\\s+['\\\"]@box-model\\/web\\/button['\\\"]",
  extensions: ["js", "ts", "jsx", "tsx"],
  flags: "g",
}
```
