import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { trpcClient } from '@/lib/trpc-client'
import './dashboard.scss'

export const dashboardLoader = async () => {
  const [
    latestSyncRun,
    librarySummary,
    projectSummary,
    usageTargets,
    reportsList,
  ] = await Promise.all([
    trpcClient.latestSyncRun.query(),
    trpcClient.librarySummary.query(),
    trpcClient.projectSummary.query(),
    trpcClient.usageTargets.query(),
    trpcClient.reportsList.query(),
  ])

  return {
    latestSyncRun,
    librarySummary,
    projectSummary,
    usageTargets,
    reportsList,
  }
}

type DashboardData = Awaited<ReturnType<typeof dashboardLoader>>

export const Route = createFileRoute('/dashboard')({
  loader: dashboardLoader,
  component: DashboardRoute,
})

const formatTimestamp = (value?: number | null) =>
  value ? new Date(value).toLocaleString() : '—'

const PAGE_SIZE = 10

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

export function DashboardPage({
  latestSyncRun,
  librarySummary,
  projectSummary,
  usageTargets,
  reportsList,
}: DashboardData) {
  const [libraryFilter, setLibraryFilter] = useState('')
  const [libraryPage, setLibraryPage] = useState(1)
  const [usagePage, setUsagePage] = useState(1)
  const [reportsPage, setReportsPage] = useState(1)
  const [librarySortKey, setLibrarySortKey] = useState<
    'library' | 'usage' | null
  >(null)
  const [librarySortDirection, setLibrarySortDirection] = useState<
    'asc' | 'desc'
  >('asc')

  const filteredLibraries = useMemo(() => {
    const normalized = libraryFilter.trim().toLowerCase()
    if (!normalized) {
      return librarySummary
    }
    return librarySummary.filter((row) =>
      (row.dependencyName ?? '').toLowerCase().includes(normalized),
    )
  }, [libraryFilter, librarySummary])

  const sortedLibraries = useMemo(() => {
    if (!librarySortKey) {
      return filteredLibraries
    }
    const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: 'base',
    })
    const sorted = [...filteredLibraries].sort((left, right) => {
      if (librarySortKey === 'usage') {
        const usageDiff = (left.usageCount ?? 0) - (right.usageCount ?? 0)
        if (usageDiff !== 0) {
          return usageDiff
        }
      }
      const nameDiff = collator.compare(
        left.dependencyName ?? '',
        right.dependencyName ?? '',
      )
      if (nameDiff !== 0) {
        return nameDiff
      }
      return left.dependencyId - right.dependencyId
    })
    return librarySortDirection === 'desc' ? sorted.reverse() : sorted
  }, [filteredLibraries, librarySortDirection, librarySortKey])

  useEffect(() => {
    setLibraryPage(1)
  }, [libraryFilter])

  const totalLibraryPages = Math.max(
    1,
    Math.ceil(sortedLibraries.length / PAGE_SIZE),
  )
  const currentLibraryPage = Math.min(libraryPage, totalLibraryPages)
  const libraryStart = (currentLibraryPage - 1) * PAGE_SIZE
  const pagedLibraries = sortedLibraries.slice(
    libraryStart,
    libraryStart + PAGE_SIZE,
  )
  const libraryRangeStart = libraryStart + 1
  const libraryRangeEnd = Math.min(
    sortedLibraries.length,
    libraryStart + pagedLibraries.length,
  )
  const totalLibraries = sortedLibraries.length

  const toggleLibrarySort = (key: 'library' | 'usage') => {
    if (librarySortKey === key) {
      setLibrarySortDirection((direction) =>
        direction === 'asc' ? 'desc' : 'asc',
      )
      setLibraryPage(1)
      return
    }
    setLibrarySortKey(key)
    setLibrarySortDirection('asc')
    setLibraryPage(1)
  }

  const getLibrarySortLabel = (key: 'library' | 'usage') =>
    librarySortKey === key
      ? librarySortDirection === 'asc'
        ? ' ^'
        : ' v'
      : ''
  const getLibraryAriaSort = (key: 'library' | 'usage') =>
    librarySortKey === key
      ? librarySortDirection === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none'
  const totalUsagePages = Math.max(
    1,
    Math.ceil(usageTargets.length / PAGE_SIZE),
  )
  const currentUsagePage = Math.min(usagePage, totalUsagePages)
  const usageStart = (currentUsagePage - 1) * PAGE_SIZE
  const pagedUsageTargets = usageTargets.slice(
    usageStart,
    usageStart + PAGE_SIZE,
  )
  const usageRangeStart = usageStart + 1
  const usageRangeEnd = Math.min(
    usageTargets.length,
    usageStart + pagedUsageTargets.length,
  )
  const totalReportsPages = Math.max(
    1,
    Math.ceil(reportsList.length / PAGE_SIZE),
  )
  const currentReportsPage = Math.min(reportsPage, totalReportsPages)
  const reportsStart = (currentReportsPage - 1) * PAGE_SIZE
  const pagedReports = reportsList.slice(
    reportsStart,
    reportsStart + PAGE_SIZE,
  )
  const reportsRangeStart = reportsStart + 1
  const reportsRangeEnd = Math.min(
    reportsList.length,
    reportsStart + pagedReports.length,
  )

  return (
    <div className="dashboard">
      <section>
        <h1>Library Metrics</h1>
        <p>Latest sync status.</p>
        {latestSyncRun ? (
          <div className="dashboard-card">
            <div>
              <span className="dashboard-label">Status</span>
              <span>{latestSyncRun.status}</span>
            </div>
            <div>
              <span className="dashboard-label">Started</span>
              <span>{formatTimestamp(latestSyncRun.startedAt)}</span>
            </div>
            <div>
              <span className="dashboard-label">Completed</span>
              <span>{formatTimestamp(latestSyncRun.completedAt)}</span>
            </div>
            {latestSyncRun.note ? (
              <div>
                <span className="dashboard-label">Note</span>
                <span>{latestSyncRun.note}</span>
              </div>
            ) : null}
            <div>
              <span className="dashboard-label">Projects</span>
              <span>{projectSummary.projects.length}</span>
            </div>
            <div>
              <span className="dashboard-label">Libraries</span>
              <span>{librarySummary.length}</span>
            </div>
          </div>
        ) : (
          <p>No sync runs yet.</p>
        )}
      </section>

      <section>
        <div className="dashboard-section-header">
          <h2>Libraries</h2>
          <Link className="dashboard-link" to="/libraries">
            See all libraries
          </Link>
        </div>
        <div className="dashboard-controls">
          <label className="dashboard-filter">
            <span>Filter</span>
            <input
              type="text"
              value={libraryFilter}
              onChange={(event) => setLibraryFilter(event.target.value)}
              placeholder="Search libraries..."
            />
          </label>
        </div>
        {librarySummary.length === 0 ? (
          <p>No library data for the latest run.</p>
        ) : filteredLibraries.length === 0 ? (
          <p>No libraries match the current filter.</p>
        ) : (
          <div className="dashboard-table">
            <table>
              <thead>
                <tr>
                  <th aria-sort={getLibraryAriaSort('library')}>
                    <button
                      type="button"
                      className="table-sort-button"
                      onClick={() => toggleLibrarySort('library')}
                    >
                      Library
                      <span className="table-sort-indicator">
                        {getLibrarySortLabel('library')}
                      </span>
                    </button>
                  </th>
                  <th aria-sort={getLibraryAriaSort('usage')}>
                    <button
                      type="button"
                      className="table-sort-button"
                      onClick={() => toggleLibrarySort('usage')}
                    >
                      Usage
                      <span className="table-sort-indicator">
                        {getLibrarySortLabel('usage')}
                      </span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagedLibraries.map((row) => {
                  const { scope, lib } = splitLibraryName(row.dependencyName)
                  const canLink = Boolean(lib)
                  return (
                    <tr key={`${row.dependencyId}`}>
                      <td>
                        {canLink ? (
                          <Link
                            to="/library"
                            search={{
                              scope: scope || undefined,
                              lib,
                            }}
                          >
                            {row.dependencyName ?? 'Unknown'}
                          </Link>
                        ) : (
                          <span>{row.dependencyName ?? 'Unknown'}</span>
                        )}
                      </td>
                      <td>{row.usageCount}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {sortedLibraries.length > PAGE_SIZE ? (
          <div className="dashboard-pagination">
            <span className="dashboard-pagination-summary">
              Showing {libraryRangeStart} - {libraryRangeEnd} of{' '}
              {totalLibraries}
            </span>
            <button
              type="button"
              onClick={() => setLibraryPage((page) => Math.max(1, page - 1))}
              disabled={currentLibraryPage <= 1}
            >
              Previous
            </button>
            <span>
              Page {currentLibraryPage} of {totalLibraryPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setLibraryPage((page) =>
                  Math.min(totalLibraryPages, page + 1),
                )
              }
              disabled={currentLibraryPage >= totalLibraryPages}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>

      <section>
        <div className="dashboard-section-header">
          <h2>Usage Queries</h2>
          <Link className="dashboard-link" to="/queries">
            See all queries
          </Link>
        </div>
        {usageTargets.length === 0 ? (
          <p>No usage data for the latest run.</p>
        ) : (
          <div className="dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {pagedUsageTargets.map((row) => (
                  <tr key={row.targetKey}>
                    <td>
                      <Link
                        to="/queries/$targetKey"
                        params={{ targetKey: row.targetKey }}
                      >
                        {row.targetTitle}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {usageTargets.length > PAGE_SIZE ? (
          <div className="dashboard-pagination">
            <span className="dashboard-pagination-summary">
              Showing {usageRangeStart} - {usageRangeEnd} of {usageTargets.length}
            </span>
            <button
              type="button"
              onClick={() => setUsagePage((page) => Math.max(1, page - 1))}
              disabled={currentUsagePage <= 1}
            >
              Previous
            </button>
            <span>
              Page {currentUsagePage} of {totalUsagePages}
            </span>
            <button
              type="button"
              onClick={() =>
                setUsagePage((page) =>
                  Math.min(totalUsagePages, page + 1),
                )
              }
              disabled={currentUsagePage >= totalUsagePages}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>

      <section>
        <div className="dashboard-section-header">
          <h2>Reports</h2>
          <Link className="dashboard-link" to="/reports">
            See all reports
          </Link>
        </div>
        {reportsList.length === 0 ? (
          <p>No reports configured yet.</p>
        ) : (
          <div className="dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {pagedReports.map((report) => (
                  <tr key={report.reportId}>
                    <td>
                      <Link
                        to="/reports/$reportId"
                        params={{ reportId: report.reportId }}
                      >
                        {report.title}
                      </Link>
                    </td>
                    <td>{report.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {reportsList.length > PAGE_SIZE ? (
          <div className="dashboard-pagination">
            <span className="dashboard-pagination-summary">
              Showing {reportsRangeStart} - {reportsRangeEnd} of{' '}
              {reportsList.length}
            </span>
            <button
              type="button"
              onClick={() =>
                setReportsPage((page) => Math.max(1, page - 1))
              }
              disabled={currentReportsPage <= 1}
            >
              Previous
            </button>
            <span>
              Page {currentReportsPage} of {totalReportsPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setReportsPage((page) =>
                  Math.min(totalReportsPages, page + 1),
                )
              }
              disabled={currentReportsPage >= totalReportsPages}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function DashboardRoute() {
  const data = Route.useLoaderData()
  return <DashboardPage {...data} />
}
