import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { trpcClient } from '@/lib/trpc-client'
import './dependencies.scss'

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

const joinGitLabUrl = (baseUrl: string, path: string) => {
  const trimmed = baseUrl.replace(/\/+$/, '')
  const cleanPath = path.replace(/^\/+/, '')
  return `${trimmed}/${cleanPath}`
}

const formatTimestamp = (value?: number | null) =>
  value ? new Date(value).toLocaleString() : '—'

export const Route = createFileRoute('/projects')({
  validateSearch: parseSearch,
  loader: async () => {
    const projectSummary = await trpcClient.projectSummary.query()
    return { projectSummary }
  },
  component: ProjectsPage,
})

function ProjectsPage() {
  const { projectSummary } = Route.useLoaderData()
  const { query, page, pageSize } = Route.useSearch()
  const navigate = Route.useNavigate()

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return projectSummary.projects
    }
    return projectSummary.projects.filter((row) =>
      (row.projectName ?? '').toLowerCase().includes(normalized),
    )
  }, [projectSummary.projects, query])

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const pagedProjects = filteredProjects.slice(start, start + pageSize)

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
          pageSize: nextPageSize !== DEFAULT_PAGE_SIZE ? nextPageSize : undefined,
        }
      },
      replace: true,
    })
  }

  return (
    <div className="dependencies-page">
      <header className="dependencies-header">
        <div>
          <h1>Projects</h1>
          <p>Browse all projects across the latest sync run.</p>
        </div>
        <Link className="dependencies-link" to="/">
          Back to dashboard
        </Link>
      </header>

      <div className="dependencies-actions">
        <label className="dependencies-filter">
          <span>Filter</span>
          <input
            type="text"
            value={query}
            onChange={(event) =>
              updateSearch({ query: event.target.value, page: 1 })
            }
            placeholder="Search projects..."
          />
        </label>
        <label className="dependencies-filter">
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

      {projectSummary.projects.length === 0 ? (
        <p>No project data for the latest run.</p>
      ) : filteredProjects.length === 0 ? (
        <p>No projects match the current filter.</p>
      ) : (
        <div className="dependencies-table">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Last activity</th>
                <th>GitLab</th>
              </tr>
            </thead>
            <tbody>
              {pagedProjects.map((row) => {
                const projectPath = row.projectPath ?? ''
                const codeUrl = projectPath
                  ? joinGitLabUrl(projectSummary.baseUrl, projectPath)
                  : null
                const membersUrl = projectPath
                  ? joinGitLabUrl(
                      projectSummary.baseUrl,
                      `${projectPath}/-/project_members`,
                    )
                  : null
                return (
                  <tr key={row.projectId}>
                    <td>
                      {projectPath ? (
                        <Link to="/project" search={{ path: projectPath }}>
                          {row.projectName ?? 'Unknown'}
                        </Link>
                      ) : (
                        <span>{row.projectName ?? 'Unknown'}</span>
                      )}
                    </td>
                    <td>{formatTimestamp(row.lastActivityAt)}</td>
                    <td>
                      <span className="dependencies-links">
                        {codeUrl ? (
                          <a href={codeUrl} target="_blank" rel="noreferrer">
                            Code
                          </a>
                        ) : (
                          <span className="dependencies-muted">—</span>
                        )}
                        {membersUrl ? (
                          <a href={membersUrl} target="_blank" rel="noreferrer">
                            Members
                          </a>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {filteredProjects.length > pageSize ? (
        <div className="dependencies-pagination">
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
