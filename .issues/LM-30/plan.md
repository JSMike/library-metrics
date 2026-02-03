# Plan

1. Extend usage query definitions with an optional search text, and implement group search to build per-query file candidates.
2. Update usage scanning to use search candidates, falling back to tree scans when needed.
3. Update usage reporting to include file counts (distinct files) alongside project counts and matches, and adjust UI displays where relevant.
