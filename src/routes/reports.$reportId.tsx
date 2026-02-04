import { Link, createFileRoute } from '@tanstack/react-router'
import { getReportModule, type ReportDefinition } from '@/reports'
import './reports.scss'

const SEGMENT_MAX_LENGTH = 200

const stripControlChars = (value: string) =>
  value.replace(/[\u0000-\u001f\u007f]/g, '')

const sanitizeSegment = (value: string) =>
  stripControlChars(value).trim().slice(0, SEGMENT_MAX_LENGTH)

type ReportLoaderData = {
  reportId: string
  report: ReportDefinition | null
  reportData: unknown
}

export const Route = createFileRoute('/reports/$reportId')({
  loader: async ({ params }): Promise<ReportLoaderData> => {
    const reportId = sanitizeSegment(params.reportId)
    if (!reportId) {
      return { reportId: '', report: null, reportData: null }
    }
    const reportModule = getReportModule(reportId)
    if (!reportModule) {
      return { reportId, report: null, reportData: null }
    }
    const reportData = await reportModule.loadData()
    return { reportId, report: reportModule.definition, reportData }
  },
  component: ReportDetailPage,
})

function ReportDetailPage() {
  const { reportId, report, reportData } = Route.useLoaderData()

  if (!reportId) {
    return (
      <div className="reports-page">
        <header className="reports-header">
          <div>
            <h1>Reports</h1>
            <p>Provide a report identifier to view details.</p>
          </div>
          <Link className="reports-link" to="/reports">
            Back to reports
          </Link>
        </header>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="reports-page">
        <header className="reports-header">
          <div>
            <h1>Reports</h1>
            <p>No report was found for "{reportId}".</p>
          </div>
          <Link className="reports-link" to="/reports">
            Back to reports
          </Link>
        </header>
      </div>
    )
  }

  const reportModule = getReportModule(reportId)
  if (!reportModule) {
    return (
      <div className="reports-page">
        <header className="reports-header">
          <div>
            <h1>Reports</h1>
            <p>No report module was found for "{reportId}".</p>
          </div>
          <Link className="reports-link" to="/reports">
            Back to reports
          </Link>
        </header>
      </div>
    )
  }

  const ReportComponent = reportModule.Component as React.ComponentType<{
    data: unknown
    definition: ReportDefinition
  }>

  return (
    <div className="reports-page">
      <header className="reports-header">
        <div>
          <h1>{report.title}</h1>
          <p>{report.description}</p>
        </div>
        <div className="reports-links">
          <Link to="/reports">All reports</Link>
          <Link to="/">Dashboard</Link>
        </div>
      </header>

      <ReportComponent data={reportData} definition={report} />
    </div>
  )
}
