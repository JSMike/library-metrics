import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from '@tanstack/react-router'
import { getProjectDetail } from '@/server/reporting'
import './dependencies.scss'

const SEARCH_MAX_LENGTH = 400

const stripControlChars = (value: string) =>
  value.replace(/[\u0000-\u001f\u007f]/g, '')

const sanitizePath = (value: string) =>
  stripControlChars(value).trim().slice(0, SEARCH_MAX_LENGTH)

const parseSearch = (search: Record<string, unknown>) => ({
  path: typeof search.path === 'string' ? sanitizePath(search.path) : '',
})

const splitDependencyName = (name?: string | null) => {
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

const getSegment = (value?: string | null) => {
  if (!value) {
    return ''
  }
  const parts = value.split('/').filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : value
}

export const Route = createFileRoute('/project')({
  validateSearch: parseSearch,
  loader: async ({ location }) => {
    const { path } = parseSearch(location.search as Record<string, unknown>)
    if (!path) {
      return { detail: null, path }
    }
    const detail = await getProjectDetail({ data: { projectPath: path } })
    return { detail, path }
  },
  component: ProjectDetailPage,
})

const joinGitLabUrl = (baseUrl: string, path: string) => {
  const trimmed = baseUrl.replace(/\/+$/, '')
  const cleanPath = path.replace(/^\/+/, '')
  return `${trimmed}/${cleanPath}`
}

const formatTimestamp = (value?: number | null) =>
  value ? new Date(value).toLocaleString() : '—'

function ProjectDetailPage() {
  const { detail, path } = Route.useLoaderData()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  if (pathname.startsWith('/project/usage')) {
    return <Outlet />
  }

  if (!path) {
    return (
      <div className="dependencies-page">
        <header className="dependencies-header">
          <div>
            <h1>Project</h1>
            <p>Provide a project path to view details.</p>
          </div>
          <Link className="dependencies-link" to="/dependencies">
            Back to dependencies
          </Link>
        </header>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="dependencies-page">
        <header className="dependencies-header">
          <div>
            <h1>Project</h1>
            <p>No project details were found for {path}.</p>
          </div>
          <Link className="dependencies-link" to="/dependencies">
            Back to dependencies
          </Link>
        </header>
      </div>
    )
  }

  const baseUrl = detail.gitlabBaseUrl
  const projectPath = detail.projectPath
  const codeUrl = projectPath ? joinGitLabUrl(baseUrl, projectPath) : null
  const membersUrl = projectPath
    ? joinGitLabUrl(baseUrl, `${projectPath}/-/project_members`)
    : null
  const sourceUsageByTarget = detail.sourceUsage.reduce(
    (acc, row) => {
      const entry =
        acc.get(row.targetKey) ??
        {
          targetKey: row.targetKey,
          targetTitle: row.targetTitle,
          rows: [],
        }
      entry.rows.push(row)
      if (!acc.has(row.targetKey)) {
        acc.set(row.targetKey, entry)
      }
      return acc
    },
    new Map<
      string,
      {
        targetKey: string
        targetTitle: string
        rows: typeof detail.sourceUsage
      }
    >(),
  )

  return (
    <div className="dependencies-page">
      <header className="dependencies-header">
        <div>
          <h1>{detail.projectName}</h1>
          <p>Dependency inventory for the latest sync run.</p>
        </div>
        <Link className="dependencies-link" to="/dependencies">
          Back to dependencies
        </Link>
      </header>

      <div className="dependencies-metadata">
        <div>
          <span className="dependencies-label">Path</span>
          <span>{detail.projectPath || '—'}</span>
        </div>
        <div>
          <span className="dependencies-label">Last activity</span>
          <span>{formatTimestamp(detail.lastActivityAt)}</span>
        </div>
        <div>
          <span className="dependencies-label">GitLab</span>
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
        </div>
      </div>

      {detail.dependencies.length === 0 ? (
        <p>No dependency data for this project.</p>
      ) : (
        <div className="dependencies-table">
          <table>
            <thead>
              <tr>
                <th>Dependency</th>
                <th>Version</th>
              </tr>
            </thead>
            <tbody>
              {detail.dependencies.map((row) => (
                <tr key={`${row.dependencyId}-${row.versionResolved}`}>
                  <td>
                    {(() => {
                      const { scope, lib } = splitDependencyName(
                        row.dependencyName,
                      )
                      if (!lib) {
                        return <span>{row.dependencyName ?? 'Unknown'}</span>
                      }
                      return (
                        <Link
                          to="/dependency"
                          search={{
                            scope: scope || undefined,
                            lib,
                          }}
                        >
                          {row.dependencyName ?? 'Unknown'}
                        </Link>
                      )
                    })()}
                  </td>
                  <td>{row.versionResolved ?? 'Unknown'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail.sourceUsage.length > 0 ? (
        <div>
          <h2>Library Usage (Source Project)</h2>
          <p>
            Usage queries for libraries defined in this project. These results
            are excluded from the usage reports.
          </p>
          {Array.from(sourceUsageByTarget.values()).map((target) => (
            <div key={target.targetKey}>
              <h3>{target.targetTitle}</h3>
              <div className="dependencies-table">
                <table>
                  <thead>
                    <tr>
                      <th>Sub-target</th>
                      <th>Query</th>
                      <th>Matches</th>
                    </tr>
                  </thead>
                  <tbody>
                    {target.rows.map((row) => (
                      <tr
                        key={`${row.targetKey}-${row.subTargetKey ?? ''}-${row.queryKey}`}
                      >
                        <td>
                          {row.subTargetKey ? (
                            <Link
                              to="/project/usage/$targetKey/$subTargetKey"
                              params={{
                                targetKey: row.targetKey,
                                subTargetKey: getSegment(row.subTargetKey),
                              }}
                              search={{ path: detail.projectPath || undefined }}
                            >
                              {row.subTargetTitle}
                            </Link>
                          ) : (
                            <span className="dependencies-muted">—</span>
                          )}
                        </td>
                        <td>
                          {row.subTargetKey ? (
                            <Link
                              to="/project/usage/$targetKey/$subTargetKey/$queryKey"
                              params={{
                                targetKey: row.targetKey,
                                subTargetKey: getSegment(row.subTargetKey),
                                queryKey: getSegment(row.queryKey),
                              }}
                              search={{ path: detail.projectPath || undefined }}
                            >
                              {row.queryKeyTitle}
                            </Link>
                          ) : (
                            <span>{row.queryKeyTitle}</span>
                          )}
                        </td>
                        <td>{row.matchCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
