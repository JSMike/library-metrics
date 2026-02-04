import { Link } from '@tanstack/react-router'
import { trpcClient } from '@/lib/trpc-client'
import type { ReportDefinition, ReportModule } from './types'

type LibrarySummaryRow = {
  dependencyName: string | null
  usageCount: number
}

type FrameworkRow = {
  name: string
  library: string
  count: number
  color: string
}

type FrameworkOverviewData = {
  rows: FrameworkRow[]
  total: number
  gradient: string
}

const CHART_COLORS = ['#1f4b99', '#20a27d', '#f59e0b', '#ef4444', '#64748b']

const definition: ReportDefinition = {
  reportId: 'framework-overview',
  title: 'Framework Overview',
  description:
    'Compare front-end framework adoption across projects in the latest sync.',
}

const buildFrameworkOverview = (librarySummary: LibrarySummaryRow[]) => {
  const summaryMap = new Map(
    librarySummary
      .filter((row) => row.dependencyName)
      .map((row) => [row.dependencyName?.toLowerCase() ?? '', row.usageCount]),
  )

  // REPORT TEMPLATE: define the frameworks you want to track.
  // Add/remove entries or rename display labels as needed.
  const frameworks = [
    { library: '@angular/core', name: 'Angular' },
    { library: 'react', name: 'React' },
    { library: 'vue', name: 'Vue' },
  ]

  return frameworks.map((framework, index) => ({
    ...framework,
    count: summaryMap.get(framework.library.toLowerCase()) ?? 0,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }))
}

const splitLibraryName = (name?: string | null) => {
  const value = name?.trim() ?? ''
  if (!value) {
    return { scope: '', lib: '' }
  }
  if (value.startsWith('@')) {
    const slashIndex = value.indexOf('/')
    if (slashIndex > 1) {
      return {
        scope: value.slice(1, slashIndex),
        lib: value.slice(slashIndex + 1),
      }
    }
  }
  return { scope: '', lib: value }
}

const buildPieGradient = (rows: FrameworkRow[]) => {
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  if (total <= 0) {
    return { gradient: 'conic-gradient(#e5e7eb 0deg 360deg)', total: 0 }
  }

  let current = 0
  const slices = rows.map((row) => {
    const start = (current / total) * 360
    const end = ((current + row.count) / total) * 360
    current += row.count
    return `${row.color} ${start}deg ${end}deg`
  })

  return { gradient: `conic-gradient(${slices.join(', ')})`, total }
}

const loadData = async (): Promise<FrameworkOverviewData> => {
  const librarySummary = await trpcClient.librarySummary.query()
  const rows = buildFrameworkOverview(librarySummary)
  const { gradient, total } = buildPieGradient(rows)
  return { rows, total, gradient }
}

const FrameworkOverviewReport = ({
  data,
}: {
  data: FrameworkOverviewData
  definition: ReportDefinition
}) => (
  <section className="report-template">
    <div className="report-intro">
      <h2>Framework overview</h2>
      <p>
        This template compares framework usage across projects. Customize the
        framework list in <code>src/reports/framework-overview.tsx</code> to
        reflect the libraries you care about.
      </p>
    </div>

    <div className="report-chart-grid">
      <div className="report-pie" style={{ backgroundImage: data.gradient }}>
        <div className="report-pie-center">
          <span className="report-pie-value">{data.total}</span>
          <span className="report-pie-label">projects</span>
        </div>
      </div>
      <div className="report-legend">
        {data.rows.map((row) => (
          <div className="report-legend-item" key={row.library}>
            <span
              className="report-legend-swatch"
              style={{ backgroundColor: row.color }}
            />
            <div>
              <strong>{row.name}</strong>
              <div className="report-legend-meta">{row.count} projects</div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="reports-table">
      <table>
        <thead>
          <tr>
            <th>Framework</th>
            <th>Library</th>
            <th>Projects</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => {
            const { scope, lib } = splitLibraryName(row.library)
            const canLink = Boolean(lib)
            const linkProps = canLink
              ? {
                  to: '/library',
                  search: {
                    scope: scope || undefined,
                    lib,
                  },
                }
              : null
            return (
              <tr key={row.library}>
                <td>
                  {linkProps ? (
                    <Link {...linkProps}>{row.name}</Link>
                  ) : (
                    row.name
                  )}
                </td>
                <td>
                  {linkProps ? (
                    <Link {...linkProps}>{row.library}</Link>
                  ) : (
                    row.library
                  )}
                </td>
                <td>{row.count}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  </section>
)

export const frameworkOverviewReport: ReportModule<FrameworkOverviewData> = {
  definition,
  loadData,
  Component: FrameworkOverviewReport,
}
