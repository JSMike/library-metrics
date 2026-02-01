import { Link, createFileRoute } from '@tanstack/react-router'
import { getProjectSourceQueryDetail } from '@/server/reporting'
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

export const Route = createFileRoute(
  '/project/usage/$targetKey/$subTargetKey/$queryKey',
)({
  validateSearch: parseSearch,
  loader: async ({ location, params }) => {
    const { path } = parseSearch(location.search as Record<string, unknown>)
    const targetKey = sanitizeSegment(params.targetKey)
    const subTargetKey = sanitizeSegment(params.subTargetKey)
    const queryKey = sanitizeSegment(params.queryKey)
    if (!path || !targetKey || !subTargetKey || !queryKey) {
      return { detail: null, path, targetKey, subTargetKey, queryKey }
    }
    const detail = await getProjectSourceQueryDetail({
      data: {
        projectPath: path,
        targetKey,
        subTargetKey,
        queryKey,
      },
    })
    return { detail, path, targetKey, subTargetKey, queryKey }
  },
  component: ProjectSourceQueryPage,
})

function ProjectSourceQueryPage() {
  const { detail, path, targetKey, subTargetKey } = Route.useLoaderData()

  if (!path || !targetKey || !subTargetKey) {
    return (
      <div className="queries-page">
        <header className="queries-header">
          <div>
            <h1>Project Usage</h1>
            <p>Provide a project path, target, sub-target, and query.</p>
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
            <p>No usage data was found for this query.</p>
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
          <h1>{detail.queryKeyTitle}</h1>
          <p>
            Source usage for {detail.projectName} / {detail.targetTitle}.
          </p>
        </div>
        <div className="queries-links">
          <Link
            to="/project/usage/$targetKey/$subTargetKey"
            params={{ targetKey, subTargetKey }}
            search={{ path }}
          >
            Back to sub-target
          </Link>
          <Link to="/project" search={{ path }}>
            Back to project
          </Link>
        </div>
      </header>

      {detail.files.length === 0 ? (
        <p>No file matches found.</p>
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
              {detail.files.map((file) => (
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
    </div>
  )
}
