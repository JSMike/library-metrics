import { Link, createFileRoute } from '@tanstack/react-router'
import { getUsageTargetDetail } from '@/server/reporting'
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

export const Route = createFileRoute('/queries/$targetKey')({
  loader: async ({ params }) => {
    const targetKey = sanitizeSegment(params.targetKey)
    if (!targetKey) {
      return { detail: null, targetKey }
    }
    const detail = await getUsageTargetDetail({
      data: {
        targetKey,
      },
    })
    return { detail, targetKey }
  },
  component: TargetDetailPage,
})

function TargetDetailPage() {
  const { detail, targetKey } = Route.useLoaderData()

  if (!targetKey) {
    return (
      <div className="queries-page">
        <header className="queries-header">
          <div>
            <h1>Usage Queries</h1>
            <p>Provide a target key to view usage details.</p>
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
            <p>No usage data was found for {targetKey}.</p>
          </div>
          <Link className="queries-link" to="/queries">
            Back to queries
          </Link>
        </header>
      </div>
    )
  }

  return (
    <div className="queries-page">
      <header className="queries-header">
        <div>
          <h1>{detail.targetTitle}</h1>
          <p>Usage queries grouped by sub-target.</p>
        </div>
        <div className="queries-links">
          <Link to="/queries">All queries</Link>
          <Link to="/">Dashboard</Link>
        </div>
      </header>

      {detail.subTargets.length === 0 ? (
        <p>No usage data for this target.</p>
      ) : (
        <div className="queries-sections">
          {detail.subTargets.map((subTarget) => {
            const subTargetSegment = getSegment(subTarget.subTargetKey)
            return (
              <section className="queries-section" key={subTarget.subTargetKey}>
                <div className="queries-section-header">
                  <h2>
                    <Link
                      to="/queries/$targetKey/$subTargetKey"
                      params={{ targetKey, subTargetKey: subTargetSegment }}
                    >
                      {subTarget.subTargetTitle}
                    </Link>
                  </h2>
                </div>
                {subTarget.queries.length === 0 ? (
                  <p className="queries-muted">No queries found for this sub-target.</p>
                ) : (
                  <div className="queries-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Query</th>
                          <th>Matches</th>
                          <th>Projects</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subTarget.queries.map((query) => {
                          const querySegment = getSegment(query.queryKey)
                          return (
                            <tr key={query.queryKey}>
                              <td>
                                <Link
                                  to="/queries/$targetKey/$subTargetKey/$queryKey"
                                  params={{
                                    targetKey,
                                    subTargetKey: subTargetSegment,
                                    queryKey: querySegment,
                                  }}
                                >
                                  {query.queryKeyTitle}
                                </Link>
                              </td>
                              <td>{query.matchCount}</td>
                              <td>{query.projectCount}</td>
                            </tr>
                          )
                        })}
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
