import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { trpcClient } from '@/lib/trpc-client'
import './queries.scss'

const DEFAULT_PAGE_SIZE = 50
const PAGE_SIZE_OPTIONS = [50, 100, 200]
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

export const Route = createFileRoute('/queries')({
  validateSearch: parseSearch,
  loader: async () => {
    const usageTargets = await trpcClient.usageTargets.query()
    return { usageTargets }
  },
  component: QueriesPage,
})

function QueriesPage() {
  const { usageTargets } = Route.useLoaderData()
  const { query, page, pageSize } = Route.useSearch()
  const navigate = Route.useNavigate()

  const filteredTargets = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return usageTargets
    }
    return usageTargets.filter((row) =>
      [row.targetTitle, row.targetKey].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    )
  }, [query, usageTargets])

  const totalPages = Math.max(1, Math.ceil(filteredTargets.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const pagedTargets = filteredTargets.slice(start, start + pageSize)
  const rangeStart = start + 1
  const rangeEnd = Math.min(filteredTargets.length, start + pagedTargets.length)

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
    <div className="queries-page">
      <header className="queries-header">
        <div>
          <h1>Usage Queries</h1>
          <p>Browse usage query targets across the latest sync run.</p>
        </div>
        <Link className="queries-link" to="/">
          Back to dashboard
        </Link>
      </header>

      <div className="queries-actions">
        <label className="queries-filter">
          <span>Filter</span>
          <input
            type="text"
            value={query}
            onChange={(event) => updateSearch({ query: event.target.value, page: 1 })}
            placeholder="Search usage targets..."
          />
        </label>
        <label className="queries-filter">
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

      {usageTargets.length === 0 ? (
        <p>No usage data for the latest run.</p>
      ) : filteredTargets.length === 0 ? (
        <p>No usage targets match the current filter.</p>
      ) : (
        <div className="queries-table">
          <table>
            <thead>
              <tr>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {pagedTargets.map((row) => (
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

      {filteredTargets.length > pageSize ? (
        <div className="queries-pagination">
          <span className="queries-pagination-summary">
            Showing {rangeStart} - {rangeEnd} of {filteredTargets.length}
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
