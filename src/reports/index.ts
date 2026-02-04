import type { ReportDefinition, ReportModule } from './types'
import { frameworkOverviewReport } from './framework-overview'
import { projectLibraryCombinationReport } from './project-library-combination'

const reportModules: ReportModule[] = [
  frameworkOverviewReport,
  projectLibraryCombinationReport,
]

export const reportsList: ReportDefinition[] = reportModules.map(
  (report) => report.definition,
)

export const getReportModule = (reportId: string) =>
  reportModules.find((report) => report.definition.reportId === reportId) ?? null

export type { ReportDefinition, ReportModule }
