import {
  Link,
  createFileRoute,
  type SearchSchemaInput,
} from '@tanstack/react-router'
import { useMemo } from 'react'
import { trpcClient } from '@/lib/trpc-client'
import './libraries.scss'

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

type LibrariesSearchInput = SearchSchemaInput & {
  query?: string
  page?: number
  pageSize?: number
}

const parseSearch = (search: LibrariesSearchInput) => {
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

export const Route = createFileRoute('/libraries')({
  validateSearch: parseSearch,
  loader: async () => {
    const librarySummary = await trpcClient.librarySummary.query()
    return { librarySummary }
  },
  component: LibrariesPage,
})

function LibrariesPage() {
  const { librarySummary } = Route.useLoaderData()
  const { query, page, pageSize } = Route.useSearch()
  const navigate = Route.useNavigate()

  const filteredLibraries = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return librarySummary
    }
    return librarySummary.filter((row) =>
      (row.dependencyName ?? '').toLowerCase().includes(normalized),
    )
  }, [librarySummary, query])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLibraries.length / pageSize),
  )
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const pagedLibraries = filteredLibraries.slice(start, start + pageSize)
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
    <div className="libraries-page">
      <header className="libraries-header">
        <div>
          <h1>Libraries</h1>
          <p>Browse all libraries across the latest sync run.</p>
        </div>
        <Link className="libraries-link" to="/">
          Back to dashboard
        </Link>
      </header>

      <div className="libraries-actions">
        <label className="libraries-filter">
          <span>Filter</span>
          <input
            type="text"
            value={query}
            onChange={(event) =>
              updateSearch({ query: event.target.value, page: 1 })
            }
            placeholder="Search libraries..."
          />
        </label>
        <label className="libraries-filter">
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

      {librarySummary.length === 0 ? (
        <p>No library data for the latest run.</p>
      ) : filteredLibraries.length === 0 ? (
        <p>No libraries match the current filter.</p>
      ) : (
        <div className="libraries-table">
          <table>
            <thead>
              <tr>
                <th>Library</th>
                <th>Usage</th>
              </tr>
            </thead>
            <tbody>
              {pagedLibraries.map((row) => {
                const { scope, lib } = splitLibraryName(row.dependencyName)
                const canLink = Boolean(lib)
                return (
                  <tr key={row.dependencyId}>
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

      {filteredLibraries.length > pageSize ? (
        <div className="libraries-pagination">
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
            onClick={() =>
              updateSearch({ page: Math.min(totalPages, currentPage + 1) })
            }
            disabled={currentPage >= totalPages}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  )
}
