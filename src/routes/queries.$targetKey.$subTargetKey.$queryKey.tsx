import { Link, createFileRoute } from '@tanstack/react-router'
import { getUsageQueryDetail } from '@/server/reporting'
import './queries.scss'

const SEGMENT_MAX_LENGTH = 200

const stripControlChars = (value: string) =>
  value.replace(/[\u0000-\u001f\u007f]/g, '')

const sanitizeSegment = (value: string) =>
  stripControlChars(value).trim().slice(0, SEGMENT_MAX_LENGTH)

export const Route = createFileRoute(
  '/queries/$targetKey/$subTargetKey/$queryKey',
)({
  loader: async ({ params }) => {
    const targetKey = sanitizeSegment(params.targetKey)
    const subTargetKey = sanitizeSegment(params.subTargetKey)
    const queryKey = sanitizeSegment(params.queryKey)
    if (!targetKey || !subTargetKey || !queryKey) {
      return { detail: null, targetKey, subTargetKey, queryKey }
    }
    const detail = await getUsageQueryDetail({
      data: {
        targetKey,
        subTargetKey,
        queryKey,
      },
    })
    return { detail, targetKey, subTargetKey, queryKey }
  },
  component: QueryDetailPage,
})

function QueryDetailPage() {
  const { detail, targetKey, subTargetKey, queryKey } = Route.useLoaderData()

  if (!targetKey || !subTargetKey || !queryKey) {
    return (
      <div className="queries-page">
        <header className="queries-header">
          <div>
            <h1>Usage Queries</h1>
            <p>Provide a target, sub-target, and query key to view details.</p>
          </div>
          <Link className="queries-link" to="/queries">
            Back to queries
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
            <h1>Usage Queries</h1>
            <p>No usage data was found for this query.</p>
          </div>
          <div className="queries-links">
            <Link to="/queries/$targetKey/$subTargetKey" params={{ targetKey, subTargetKey }}>
              Back to sub-target
            </Link>
            <Link to="/queries">All queries</Link>
          </div>
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
            File-level matches for {detail.targetTitle} / {detail.subTargetTitle}.
          </p>
        </div>
        <div className="queries-links">
          <Link to="/queries/$targetKey/$subTargetKey" params={{ targetKey, subTargetKey }}>
            Back to sub-target
          </Link>
          <Link to="/queries/$targetKey" params={{ targetKey }}>
            Back to target
          </Link>
          <Link to="/queries">All queries</Link>
        </div>
      </header>

      {detail.projects.length === 0 ? (
        <p>No usage data for this query.</p>
      ) : (
        <div className="queries-sections">
          {detail.projects.map((project) => (
            <section className="queries-section" key={project.projectId}>
              <div className="queries-section-header">
                <h2>
                  <Link
                    to="/project"
                    search={{ path: project.projectPath || undefined }}
                  >
                    {project.projectName}
                  </Link>
                </h2>
                <span className="queries-meta">
                  {project.totalMatches} total matches
                </span>
              </div>
              {project.files.length === 0 ? (
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
                      {project.files.map((file) => (
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
