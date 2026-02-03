import { Link, createFileRoute } from '@tanstack/react-router'
import { getUsageSubTargetDetail } from '@/server/reporting'
import './queries.scss'

const SEGMENT_MAX_LENGTH = 200

const stripControlChars = (value: string) =>
  value.replace(/[\u0000-\u001f\u007f]/g, '')

const sanitizeSegment = (value: string) =>
  stripControlChars(value).trim().slice(0, SEGMENT_MAX_LENGTH)

const getSegment = (value: string) => {
  const parts = value.split('/').filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : value
}

export const Route = createFileRoute('/queries/$targetKey/$subTargetKey')({
  loader: async ({ params }) => {
    const targetKey = sanitizeSegment(params.targetKey)
    const subTargetKey = sanitizeSegment(params.subTargetKey)
    if (!targetKey || !subTargetKey) {
      return { detail: null, targetKey, subTargetKey }
    }
    const detail = await getUsageSubTargetDetail({
      data: {
        targetKey,
        subTargetKey,
      },
    })
    return { detail, targetKey, subTargetKey }
  },
  component: SubTargetDetailPage,
})

function SubTargetDetailPage() {
  const { detail, targetKey, subTargetKey } = Route.useLoaderData()

  if (!targetKey || !subTargetKey) {
    return (
      <div className="queries-page">
        <header className="queries-header">
          <div>
            <h1>Usage Queries</h1>
            <p>Provide a target and sub-target to view usage details.</p>
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
            <p>No usage data was found for this sub-target.</p>
          </div>
          <div className="queries-links">
            <Link to="/queries/$targetKey" params={{ targetKey }}>
              Back to target
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
          <h1>{detail.subTargetTitle}</h1>
          <p>
            Projects matched for{' '}
            <Link to="/queries/$targetKey" params={{ targetKey }}>
              {detail.targetTitle}
            </Link>{' '}
            / {detail.subTargetTitle}.
          </p>
        </div>
        <div className="queries-links">
          <Link to="/queries/$targetKey" params={{ targetKey }}>
            Back to target
          </Link>
          <Link to="/queries">All queries</Link>
        </div>
      </header>

      {detail.queries.length === 0 ? (
        <p>No usage data for this sub-target.</p>
      ) : (
        <div className="queries-sections">
          {detail.queries.map((query) => {
            const querySegment = getSegment(query.queryKey)
            return (
              <section className="queries-section" key={query.queryKey}>
                <div className="queries-section-header">
                  <h2>
                    <Link
                      to="/queries/$targetKey/$subTargetKey/$queryKey"
                      params={{
                        targetKey,
                        subTargetKey,
                        queryKey: querySegment,
                      }}
                    >
                      {query.queryKeyTitle}
                    </Link>
                </h2>
                  <span className="queries-meta">
                    {query.matchCount} matches / {query.projectCount} projects /{' '}
                    {query.fileCount} files
                  </span>
                </div>
                {query.projects.length === 0 ? (
                  <p className="queries-muted">No projects matched this query.</p>
                ) : (
                  <div className="queries-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Matches</th>
                          <th>Files</th>
                        </tr>
                      </thead>
                      <tbody>
                        {query.projects.map((project) => (
                          <tr key={project.projectId}>
                            <td>
                              <Link
                                to="/project"
                                search={{
                                  path: project.projectPath || undefined,
                                }}
                              >
                                {project.projectName}
                              </Link>
                            </td>
                            <td>{project.matchCount}</td>
                            <td>{project.fileCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
