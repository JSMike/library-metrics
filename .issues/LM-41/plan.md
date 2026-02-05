# Plan

1. Adjust lockfile discovery to capture lockfile directories.
2. Build a filtered package.json list from lockfile directories (plus root lockfile case).
3. Update sync logging and ensure dependency extraction uses the filtered list.
