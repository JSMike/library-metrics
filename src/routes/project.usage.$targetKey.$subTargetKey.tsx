import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from '@tanstack/react-router'
import { getProjectSourceSubTargetDetail } from '@/server/reporting'
import './queries.scss'

const SEARCH_MAX_LENGTH = 400
const SEGMENT_MAX_LENGTH = 200

const stripControlChars = (value: string) =>
  value.replace(/[\u0000-\u001f\u007f]/g, '')

const sanitizePath = (value: string) =>
  stripControlChars(value).trim().slice(0, SEARCH_MAX_LENGTH)

const sanitizeSegment = (value: string) =>
  stripControlChars(value).trim().slice(0, SEGMENT_MAX_LENGTH)

const parseSearch = (search: Record<string, unknown>) => ({
  path: typeof search.path === 'string' ? sanitizePath(search.path) : '',
})

const getSegment = (value: string) => {
  const parts = value.split('/').filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : value
}

export const Route = createFileRoute(
  '/project/usage/$targetKey/$subTargetKey',
)({
  validateSearch: parseSearch,
  loader: async ({ location, params }) => {
    const { path } = parseSearch(location.search as Record<string, unknown>)
    const targetKey = sanitizeSegment(params.targetKey)
    const subTargetKey = sanitizeSegment(params.subTargetKey)
    if (!path || !targetKey || !subTargetKey) {
      return { detail: null, path, targetKey, subTargetKey }
    }
    const detail = await getProjectSourceSubTargetDetail({
      data: {
        projectPath: path,
        targetKey,
        subTargetKey,
      },
    })
    return { detail, path, targetKey, subTargetKey }
  },
  component: ProjectSourceSubTargetPage,
})

function ProjectSourceSubTargetPage() {
  const { detail, path, targetKey, subTargetKey } = Route.useLoaderData()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const isQueryRoute =
    Boolean(targetKey && subTargetKey) &&
    pathname.startsWith(`/project/usage/${targetKey}/${subTargetKey}/`)

  if (isQueryRoute) {
    return <Outlet />
  }

  if (!path || !targetKey || !subTargetKey) {
    return (
      <div className="queries-page">
        <header className="queries-header">
          <div>
            <h1>Project Usage</h1>
            <p>Provide a project path, target, and sub-target.</p>
          </div>
          <Link className="queries-link" to="/project" search={{ path }}>
            Back to project
          </Link>
        </header>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="queries-page">
        <header className="queries-header">
          <div>
            <h1>Project Usage</h1>
            <p>No usage data was found for this sub-target.</p>
          </div>
          <Link className="queries-link" to="/project" search={{ path }}>
            Back to project
          </Link>
        </header>
      </div>
    )
  }

  return (
    <div className="queries-page">
      <header className="queries-header">
        <div>
          <h1>{detail.subTargetTitle}</h1>
          <p>
            Source usage for {detail.projectName} / {detail.targetTitle}.
          </p>
        </div>
        <div className="queries-links">
          <Link to="/project" search={{ path }}>
            Back to project
          </Link>
        </div>
      </header>

      {detail.queries.length === 0 ? (
        <p>No usage data for this sub-target.</p>
      ) : (
        <div className="queries-sections">
          {detail.queries.map((query) => (
            <section className="queries-section" key={query.queryKey}>
              <div className="queries-section-header">
                <h2>
                  <Link
                    to="/project/usage/$targetKey/$subTargetKey/$queryKey"
                    params={{
                      targetKey,
                      subTargetKey,
                      queryKey: getSegment(query.queryKey),
                    }}
                    search={{ path }}
                  >
                    {query.queryKeyTitle}
                  </Link>
                </h2>
                <span className="queries-meta">
                  {query.totalMatches} matches
                </span>
              </div>
              {query.files.length === 0 ? (
                <p className="queries-muted">No file matches found.</p>
              ) : (
                <div className="queries-table">
                  <table>
                    <thead>
                      <tr>
                        <th>File</th>
                        <th>Matches</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.files.map((file) => (
                        <tr key={file.filePath}>
                          <td>
                            {file.fileUrl ? (
                              <a href={file.fileUrl} target="_blank" rel="noreferrer">
                                {file.filePath}
                              </a>
                            ) : (
                              file.filePath
                            )}
                          </td>
                          <td>{file.matchCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
