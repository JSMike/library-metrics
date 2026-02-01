import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { trpcClient } from '@/lib/trpc-client'
import './dashboard.scss'

export const dashboardLoader = async () => {
  const [latestSyncRun, dependencySummary, usageTargets] = await Promise.all([
    trpcClient.latestSyncRun.query(),
    trpcClient.dependencySummary.query(),
    trpcClient.usageTargets.query(),
  ])

  return { latestSyncRun, dependencySummary, usageTargets }
}

type DashboardData = Awaited<ReturnType<typeof dashboardLoader>>

export const Route = createFileRoute('/dashboard')({
  loader: dashboardLoader,
  component: DashboardRoute,
})

const formatTimestamp = (value?: number | null) =>
  value ? new Date(value).toLocaleString() : '—'

const PAGE_SIZE = 10

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

export function DashboardPage({
  latestSyncRun,
  dependencySummary,
  usageTargets,
}: DashboardData) {
  const [dependencyFilter, setDependencyFilter] = useState('')
  const [dependencyPage, setDependencyPage] = useState(1)
  const [usagePage, setUsagePage] = useState(1)

  const filteredDependencies = useMemo(() => {
    const normalized = dependencyFilter.trim().toLowerCase()
    if (!normalized) {
      return dependencySummary
    }
    return dependencySummary.filter((row) =>
      (row.dependencyName ?? '').toLowerCase().includes(normalized),
    )
  }, [dependencyFilter, dependencySummary])

  useEffect(() => {
    setDependencyPage(1)
  }, [dependencyFilter])

  const totalDependencyPages = Math.max(
    1,
    Math.ceil(filteredDependencies.length / PAGE_SIZE),
  )
  const currentDependencyPage = Math.min(dependencyPage, totalDependencyPages)
  const dependencyStart = (currentDependencyPage - 1) * PAGE_SIZE
  const pagedDependencies = filteredDependencies.slice(
    dependencyStart,
    dependencyStart + PAGE_SIZE,
  )
  const totalUsagePages = Math.max(
    1,
    Math.ceil(usageTargets.length / PAGE_SIZE),
  )
  const currentUsagePage = Math.min(usagePage, totalUsagePages)
  const usageStart = (currentUsagePage - 1) * PAGE_SIZE
  const pagedUsageTargets = usageTargets.slice(
    usageStart,
    usageStart + PAGE_SIZE,
  )

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
        <div className="dashboard-section-header">
          <h2>Dependencies</h2>
          <Link className="dashboard-link" to="/dependencies">
            See all dependencies
          </Link>
        </div>
        <div className="dashboard-controls">
          <label className="dashboard-filter">
            <span>Filter</span>
            <input
              type="text"
              value={dependencyFilter}
              onChange={(event) => setDependencyFilter(event.target.value)}
              placeholder="Search dependencies..."
            />
          </label>
        </div>
        {dependencySummary.length === 0 ? (
          <p>No dependency data for the latest run.</p>
        ) : filteredDependencies.length === 0 ? (
          <p>No dependencies match the current filter.</p>
        ) : (
          <div className="dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Dependency</th>
                  <th>Usage</th>
                </tr>
              </thead>
              <tbody>
                {pagedDependencies.map((row) => {
                  const { scope, lib } = splitDependencyName(row.dependencyName)
                  const canLink = Boolean(lib)
                  return (
                    <tr key={`${row.dependencyId}`}>
                      <td>
                        {canLink ? (
                          <Link
                            to="/dependency"
                            search={{
                              scope: scope || undefined,
                              lib,
                            }}
                          >
                            {row.dependencyName ?? 'Unknown'}
                          </Link>
                        ) : (
                          <span>{row.dependencyName ?? 'Unknown'}</span>
                        )}
                      </td>
                      <td>{row.usageCount}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {filteredDependencies.length > PAGE_SIZE ? (
          <div className="dashboard-pagination">
            <button
              type="button"
              onClick={() => setDependencyPage((page) => Math.max(1, page - 1))}
              disabled={currentDependencyPage <= 1}
            >
              Previous
            </button>
            <span>
              Page {currentDependencyPage} of {totalDependencyPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setDependencyPage((page) =>
                  Math.min(totalDependencyPages, page + 1),
                )
              }
              disabled={currentDependencyPage >= totalDependencyPages}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>

      <section>
        <div className="dashboard-section-header">
          <h2>Usage Queries</h2>
          <Link className="dashboard-link" to="/queries">
            See all queries
          </Link>
        </div>
        {usageTargets.length === 0 ? (
          <p>No usage data for the latest run.</p>
        ) : (
          <div className="dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {pagedUsageTargets.map((row) => (
                  <tr key={row.targetKey}>
                    <td>
                      <Link
                        to="/queries/$targetKey"
                        params={{ targetKey: row.targetKey }}
                      >
                        {row.targetTitle}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {usageTargets.length > PAGE_SIZE ? (
          <div className="dashboard-pagination">
            <button
              type="button"
              onClick={() => setUsagePage((page) => Math.max(1, page - 1))}
              disabled={currentUsagePage <= 1}
            >
              Previous
            </button>
            <span>
              Page {currentUsagePage} of {totalUsagePages}
            </span>
            <button
              type="button"
              onClick={() =>
                setUsagePage((page) =>
                  Math.min(totalUsagePages, page + 1),
                )
              }
              disabled={currentUsagePage >= totalUsagePages}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

function DashboardRoute() {
  const data = Route.useLoaderData()
  return <DashboardPage {...data} />
}
