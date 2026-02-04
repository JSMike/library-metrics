import { trpcClient } from '@/lib/trpc-client'
import type { ReportDefinition, ReportModule } from './types'

// REPORT TEMPLATE
// 1) Copy this file and rename it to match your report ID.
//    Example: src/reports/license-compliance.tsx
// 2) Update the `definition` values and the `loadData` function.
// 3) Build a presentational component that renders your report.
// 4) Register the report in src/reports/index.ts.

const definition: ReportDefinition = {
  reportId: 'example-report',
  title: 'Example Report',
  description: 'Describe what this report does.',
}

type ExampleData = {
  total: number
}

const loadData = async (): Promise<ExampleData> => {
  // Fetch any data you need via tRPC.
  // If a new data endpoint is required, add it in:
  //   1) src/server/reporting.server.ts (create a fetch function)
  //   2) src/server/trpc.ts (expose it on the router)
  // Then call it here via trpcClient.
  const librarySummary = await trpcClient.librarySummary.query()
  return { total: librarySummary.length }
}

const ExampleReport = ({ data }: { data: ExampleData; definition: ReportDefinition }) => (
  <section>
    <h2>Example Report</h2>
    <p>Total libraries: {data.total}</p>
  </section>
)

export const reportTemplate: ReportModule<ExampleData> = {
  definition,
  loadData,
  Component: ExampleReport,
}
