import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from '@tanstack/react-router'
import { useMemo } from 'react'
import { trpcClient } from '@/lib/trpc-client'
import './reports.scss'

const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZE_OPTIONS = [25, 50, 100]
const QUERY_MAX_LENGTH = 200

const stripControlChars = (value: string) =>
  value.replace(/[\u0000-\u001f\u007f]/g, '')

const sanitizeQuery = (value: string) =>
  stripControlChars(value).trim().slice(0, QUERY_MAX_LENGTH)

const parsePositiveInt = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  const floored = Math.floor(parsed)
  return floored > 0 ? floored : fallback
}

const parseSearch = (search: Record<string, unknown>) => {
  const query =
    typeof search.query === 'string' ? sanitizeQuery(search.query) : ''
  const page = parsePositiveInt(search.page, 1)
  const pageSizeCandidate = parsePositiveInt(
    search.pageSize,
    DEFAULT_PAGE_SIZE,
  )
  const pageSize = PAGE_SIZE_OPTIONS.includes(pageSizeCandidate)
    ? pageSizeCandidate
    : DEFAULT_PAGE_SIZE
  return { query, page, pageSize }
}

export const Route = createFileRoute('/reports')({
  validateSearch: parseSearch,
  loader: async () => {
    const reportsList = await trpcClient.reportsList.query()
    return { reportsList }
  },
  component: ReportsPage,
})

function ReportsPage() {
  const { reportsList } = Route.useLoaderData()
  const { query, page, pageSize } = Route.useSearch()
  const navigate = Route.useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  if (pathname !== '/reports' && pathname.startsWith('/reports/')) {
    return <Outlet />
  }

  const filteredReports = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return reportsList
    }
    return reportsList.filter((report) =>
      [report.title, report.description, report.reportId].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    )
  }, [query, reportsList])

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const pagedReports = filteredReports.slice(start, start + pageSize)
  const rangeStart = start + 1
  const rangeEnd = Math.min(filteredReports.length, start + pagedReports.length)

  const updateSearch = (
    next: Partial<{ query: string; page: number; pageSize: number }>,
  ) => {
    navigate({
      search: (prev) => {
        const merged = { ...prev, ...next }
        const nextQuery = sanitizeQuery(merged.query ?? '')
        const nextPageSizeCandidate = parsePositiveInt(
          merged.pageSize,
          DEFAULT_PAGE_SIZE,
        )
        const nextPageSize = PAGE_SIZE_OPTIONS.includes(nextPageSizeCandidate)
          ? nextPageSizeCandidate
          : DEFAULT_PAGE_SIZE
        const nextPage = parsePositiveInt(merged.page, 1)

        return {
          query: nextQuery || undefined,
          page: nextPage > 1 ? nextPage : undefined,
          pageSize:
            nextPageSize !== DEFAULT_PAGE_SIZE ? nextPageSize : undefined,
        }
      },
      replace: true,
    })
  }

  return (
    <div className="reports-page">
      <header className="reports-header">
        <div>
          <h1>Reports</h1>
          <p>Browse available custom reports.</p>
        </div>
        <Link className="reports-link" to="/">
          Back to dashboard
        </Link>
      </header>

      <div className="reports-actions">
        <label className="reports-filter">
          <span>Filter</span>
          <input
            type="text"
            value={query}
            onChange={(event) => updateSearch({ query: event.target.value, page: 1 })}
            placeholder="Search reports..."
          />
        </label>
        <label className="reports-filter">
          <span>Page size</span>
          <select
            value={pageSize}
            onChange={(event) =>
              updateSearch({
                pageSize: Number(event.target.value),
                page: 1,
              })
            }
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      {reportsList.length === 0 ? (
        <p>No reports configured yet.</p>
      ) : filteredReports.length === 0 ? (
        <p>No reports match the current filter.</p>
      ) : (
        <div className="reports-table">
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

      {filteredReports.length > pageSize ? (
        <div className="reports-pagination">
          <span className="reports-pagination-summary">
            Showing {rangeStart} - {rangeEnd} of {filteredReports.length}
          </span>
          <button
            type="button"
            onClick={() => updateSearch({ page: Math.max(1, currentPage - 1) })}
            disabled={currentPage <= 1}
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => updateSearch({ page: Math.min(totalPages, currentPage + 1) })}
            disabled={currentPage >= totalPages}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}
