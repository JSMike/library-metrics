import { Link, createFileRoute } from '@tanstack/react-router'
import { getLibraryDetail } from '@/server/reporting'
import './libraries.scss'

const SEARCH_MAX_LENGTH = 200

const stripControlChars = (value: string) =>
  value.replace(/[\u0000-\u001f\u007f]/g, '')

const sanitizeSegment = (value: string) =>
  stripControlChars(value).trim().slice(0, SEARCH_MAX_LENGTH)

const parseSearch = (search: Record<string, unknown>) => ({
  scope:
    typeof search.scope === 'string' ? sanitizeSegment(search.scope) : '',
  lib: typeof search.lib === 'string' ? sanitizeSegment(search.lib) : '',
})

export const Route = createFileRoute('/library')({
  validateSearch: parseSearch,
  loader: async ({ location }) => {
    const { scope, lib } = parseSearch(location.search as Record<string, unknown>)
    if (!lib) {
      return { detail: null, scope, lib }
    }
    const detail = await getLibraryDetail({
      data: {
        scope: scope || undefined,
        lib,
      },
    })
    return { detail, scope, lib }
  },
  component: LibraryDetailPage,
})

const joinGitLabUrl = (baseUrl: string, path: string) => {
  const trimmed = baseUrl.replace(/\/+$/, '')
  const cleanPath = path.replace(/^\/+/, '')
  return `${trimmed}/${cleanPath}`
}

function LibraryDetailPage() {
  const { detail, scope, lib } = Route.useLoaderData()

  if (!lib) {
    return (
      <div className="libraries-page">
        <header className="libraries-header">
          <div>
            <h1>Library</h1>
            <p>Provide a library scope and name to view details.</p>
          </div>
          <Link className="libraries-link" to="/libraries">
            Back to libraries
          </Link>
        </header>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="libraries-page">
        <header className="libraries-header">
          <div>
            <h1>Library</h1>
            <p>
              No library details were found for{' '}
              {scope ? `@${scope}/` : ''}
              {lib}.
            </p>
          </div>
          <Link className="libraries-link" to="/libraries">
            Back to libraries
          </Link>
        </header>
      </div>
    )
  }

  const baseUrl = detail.gitlabBaseUrl

  return (
    <div className="libraries-page">
      <header className="libraries-header">
        <div>
          <h1>{detail.dependencyName}</h1>
          <p>Version usage across the latest sync run.</p>
        </div>
        <Link className="libraries-link" to="/libraries">
          Back to libraries
        </Link>
      </header>

      {detail.versions.length === 0 ? (
        <p>No version data for this library.</p>
      ) : (
        <div className="libraries-table">
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Usage</th>
                <th>Projects</th>
                <th>Links</th>
              </tr>
            </thead>
            <tbody>
              {detail.versions.map((version) => (
                <tr key={version.version}>
                  <td>{version.version}</td>
                  <td>{version.usageCount}</td>
                  <td>
                    {version.projects.length === 0 ? (
                      <span className="libraries-muted">—</span>
                    ) : (
                      <ul className="libraries-projects">
                        {version.projects.map((project) => (
                          <li key={project.projectId}>
                            <Link
                              to="/project"
                              search={{
                                path: project.projectPath || undefined,
                              }}
                            >
                              {project.projectName}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>
                    {version.projects.length === 0 ? (
                      <span className="libraries-muted">—</span>
                    ) : (
                      <ul className="libraries-projects">
                        {version.projects.map((project) => {
                          const projectPath = project.projectPath ?? ''
                          const codeUrl = projectPath
                            ? joinGitLabUrl(baseUrl, projectPath)
                            : null
                          const membersUrl = projectPath
                            ? joinGitLabUrl(
                                baseUrl,
                                `${projectPath}/-/project_members`,
                              )
                            : null
                          return (
                            <li key={project.projectId}>
                              <span className="libraries-links">
                                {codeUrl ? (
                                  <a href={codeUrl} target="_blank" rel="noreferrer">
                                    Code
                                  </a>
                                ) : (
                                  <span className="libraries-muted">—</span>
                                )}
                                {membersUrl ? (
                                  <a
                                    href={membersUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Members
                                  </a>
                                ) : null}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
