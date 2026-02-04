# Reports

This folder contains custom report modules and the report registry.

## How reports work

- Each report is a module (file) that exports a `ReportModule` with:
  - `definition` (id, title, description)
  - `loadData()` (fetches data via tRPC)
  - `Component` (renders the report UI)
- The registry in `src/reports/index.ts` collects all report modules.
- `/reports` lists the available reports using the registry via tRPC.
- `/reports/$reportId` renders the report module for that ID.

## Create a new report (step-by-step)

1) Copy the template

- Copy `src/reports/report-template.tsx` to a new file.
- Rename it to match your report ID.

Example:
- `src/reports/report-template.tsx` -> `src/reports/license-compliance.tsx`

2) Update the report definition

- Set `reportId`, `title`, and `description`.
- `reportId` becomes the URL segment for `/reports/$reportId`.

3) Load data (tRPC)

- Use existing tRPC endpoints (e.g., `trpcClient.librarySummary.query()`).
- If you need new data:
  - Add a fetch function in `src/server/reporting.server.ts`.
  - Expose it in `src/server/trpc.ts`.
  - Call it from `loadData()`.
  - Example: the project/library combination report uses
    `trpcClient.projectLibraryMatrix.query({ libraries: [...] })`.

4) Build the report UI

- Create a presentational component that uses the data you loaded.
- Keep UI-specific styles in `src/routes/reports.scss` or add new classes.

5) Register the report

- Add your report module to the registry:

```ts
// src/reports/index.ts
import { licenseComplianceReport } from './license-compliance'

const reportModules: ReportModule[] = [
  frameworkOverviewReport,
  licenseComplianceReport,
]
```

6) Verify

- Visit `/reports` and check the list.
- Visit `/reports/<reportId>` to see the report.

## Example reports

The `framework-overview` report is a working example that compares framework
usage with a pie chart and table.

Files:
- `src/reports/framework-overview.tsx`
- `src/routes/reports.$reportId.tsx`

The `project-library-combination` report lists projects that use a library
combination and shows resolved versions per project.

Files:
- `src/reports/project-library-combination.tsx`
- `src/server/reporting.server.ts` (`fetchProjectLibraryMatrix`)
