# Plan

1. Add GitLab search-based discovery for lockfiles/manifests (exclude node_modules) to build a project ID set.
2. Apply include/exclude group scoping and dedupe projects before the sync scan.
3. Add a fallback path when search fails or returns zero results.
