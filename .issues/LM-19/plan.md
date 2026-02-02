# Plan

1. Add a reporting helper that maps each project in the latest run to its effective data sync ID.
2. Update library and usage queries to join through the effective sync ID instead of the latest run ID.
3. Update project detail queries to use the effective sync ID for dependencies and usage.
4. Verify report outputs after a non-force sync.
