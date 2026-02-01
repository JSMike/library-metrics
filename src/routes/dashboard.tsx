import { createFileRoute } from '@tanstack/react-router'
import { trpcClient } from '@/lib/trpc-client'
import './dashboard.css'

export const Route = createFileRoute('/dashboard')({
  loader: async () => {
    const [latestSyncRun, dependencySummary, usageSummary] = await Promise.all([
      trpcClient.latestSyncRun.query(),
      trpcClient.dependencySummary.query(),
      trpcClient.usageSummary.query(),
    ])

    return { latestSyncRun, dependencySummary, usageSummary }
  },
  component: Dashboard,
})

const formatTimestamp = (value?: number | null) =>
  value ? new Date(value).toLocaleString() : '—'

function Dashboard() {
  const { latestSyncRun, dependencySummary, usageSummary } = Route.useLoaderData()
  const topDependencies = dependencySummary.slice(0, 10)
  const topUsage = usageSummary.slice(0, 10)

  return (
    <div className="dashboard">
      <section>
        <h1>GitLab Metrics</h1>
        <p>Latest sync status.</p>
        {latestSyncRun ? (
          <div className="dashboard-card">
            <div>
              <span className="dashboard-label">Status</span>
              <span>{latestSyncRun.status}</span>
            </div>
            <div>
              <span className="dashboard-label">Started</span>
              <span>{formatTimestamp(latestSyncRun.startedAt)}</span>
            </div>
            <div>
              <span className="dashboard-label">Completed</span>
              <span>{formatTimestamp(latestSyncRun.completedAt)}</span>
            </div>
            {latestSyncRun.note ? (
              <div>
                <span className="dashboard-label">Note</span>
                <span>{latestSyncRun.note}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <p>No sync runs yet.</p>
        )}
      </section>

      <section>
        <h2>Top Dependencies</h2>
        {topDependencies.length === 0 ? (
          <p>No dependency data for the latest run.</p>
        ) : (
          <div className="dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Dependency</th>
                  <th>Version</th>
                  <th>Projects</th>
                </tr>
              </thead>
              <tbody>
                {topDependencies.map((row) => (
                  <tr
                    key={`${row.dependencyId}-${row.versionResolved ?? 'none'}`}
                  >
                    <td>{row.dependencyName ?? 'Unknown'}</td>
                    <td>{row.versionResolved ?? 'Unknown'}</td>
                    <td>{row.projectCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2>Top Usage Queries</h2>
        {topUsage.length === 0 ? (
          <p>No usage data for the latest run.</p>
        ) : (
          <div className="dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Target</th>
                  <th>Sub-target</th>
                  <th>Query</th>
                  <th>Matches</th>
                  <th>Projects</th>
                </tr>
              </thead>
              <tbody>
                {topUsage.map((row) => (
                  <tr
                    key={`${row.targetKey}-${row.subTargetKey ?? ''}-${row.queryKey}`}
                  >
                    <td>{row.targetKey}</td>
                    <td>{row.subTargetKey ?? '—'}</td>
                    <td>{row.queryKey}</td>
                    <td>{row.matchCount}</td>
                    <td>{row.projectCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
