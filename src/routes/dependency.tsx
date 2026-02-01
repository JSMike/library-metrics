import { Link, createFileRoute } from '@tanstack/react-router'
import { getDependencyDetail } from '@/server/reporting'
import './dependencies.css'

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

export const Route = createFileRoute('/dependency')({
  validateSearch: parseSearch,
  loader: async ({ location }) => {
    const { scope, lib } = parseSearch(location.search as Record<string, unknown>)
    if (!lib) {
      return { detail: null, scope, lib }
    }
    const detail = await getDependencyDetail({
      data: {
        scope: scope || undefined,
        lib,
      },
    })
    return { detail, scope, lib }
  },
  component: DependencyDetailPage,
})

const joinGitLabUrl = (baseUrl: string, path: string) => {
  const trimmed = baseUrl.replace(/\/+$/, '')
  const cleanPath = path.replace(/^\/+/, '')
  return `${trimmed}/${cleanPath}`
}

function DependencyDetailPage() {
  const { detail, scope, lib } = Route.useLoaderData()

  if (!lib) {
    return (
      <div className="dependencies-page">
        <header className="dependencies-header">
          <div>
            <h1>Dependency</h1>
            <p>Provide a dependency scope and library name to view details.</p>
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
            <h1>Dependency</h1>
            <p>No dependency details were found for {scope ? `@${scope}/` : ''}{lib}.</p>
          </div>
          <Link className="dependencies-link" to="/dependencies">
            Back to dependencies
          </Link>
        </header>
      </div>
    )
  }

  const baseUrl = detail.gitlabBaseUrl

  return (
    <div className="dependencies-page">
      <header className="dependencies-header">
        <div>
          <h1>{detail.dependencyName}</h1>
          <p>Version usage across the latest sync run.</p>
        </div>
        <Link className="dependencies-link" to="/dependencies">
          Back to dependencies
        </Link>
      </header>

      {detail.versions.length === 0 ? (
        <p>No version data for this dependency.</p>
      ) : (
        <div className="dependencies-table">
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Usage</th>
                <th>Projects</th>
              </tr>
            </thead>
            <tbody>
              {detail.versions.map((version) => (
                <tr key={version.version}>
                  <td>{version.version}</td>
                  <td>{version.usageCount}</td>
                  <td>
                    {version.projects.length === 0 ? (
                      <span className="dependencies-muted">—</span>
                    ) : (
                      <ul className="dependencies-projects">
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
                            {project.projectPath ? (
                              <a
                                className="dependencies-inline-link"
                                href={joinGitLabUrl(baseUrl, project.projectPath)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                GitLab
                              </a>
                            ) : null}
                          </li>
                        ))}
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
