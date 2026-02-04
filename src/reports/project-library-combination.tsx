import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { trpcClient } from '@/lib/trpc-client'
import type { ReportDefinition, ReportModule } from './types'

// REPORT TEMPLATE: duplicate this file for other library combinations.
// Update REPORT_LIBRARIES + REPORT_DEFINITION to customize this report.

const REPORT_DEFINITION: ReportDefinition = {
  reportId: 'project-library-combination',
  title: 'Project Library Combination',
  description:
    'List projects using a specific combination of libraries with versions and activity.',
}

// REPORT TEMPLATE: define the libraries you want to compare.
// Use package names as stored in the lockfile (lowercase for npm packages).
// The table columns will follow this order.
const REPORT_LIBRARIES = [
  // `library` = package name to match, `name` = column label.
  // `required` (optional) = true means the project must include this library.
  { library: 'react', name: 'React', required: true },
  { library: 'vite', name: 'Vite' },
  { library: 'nx', name: 'Nx' },
]

const REPORT_LIBRARY_CONFIGS = REPORT_LIBRARIES.map((item) => ({
  ...item,
  key: item.library.toLowerCase(),
  required: Boolean(item.required),
}))

type ProjectLibraryMatrix = {
  baseUrl: string
  libraries: string[]
  projects: Array<{
    projectId: number
    projectName: string | null
    projectPath: string | null
    lastActivityAt: number | string | Date | null
    libraryVersions: Record<string, string[]>
  }>
}

const loadData = async (): Promise<ProjectLibraryMatrix> =>
  trpcClient.projectLibraryMatrix.query({
    libraries: REPORT_LIBRARY_CONFIGS.map((item) => item.key),
  })

const joinGitLabUrl = (baseUrl: string, path: string) => {
  const trimmed = baseUrl.replace(/\/+$/, '')
  const cleanPath = path.replace(/^\/+/, '')
  return `${trimmed}/${cleanPath}`
}

const formatTimestamp = (value?: number | string | Date | null) =>
  value ? new Date(value).toLocaleString() : '—'

const versionCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

const getActivityValue = (value?: number | string | Date | null) => {
  if (!value) {
    return null
  }
  if (value instanceof Date) {
    return value.getTime()
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return value
}

const ProjectLibraryCombinationReport = ({
  data,
}: {
  data: ProjectLibraryMatrix
  definition: ReportDefinition
}) => {
  const [sortKey, setSortKey] = useState<string>('project')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const libraryConfigs = REPORT_LIBRARY_CONFIGS
  const libraries = libraryConfigs.map((library) => library.key)
  const requiredLibraries = libraryConfigs
    .filter((library) => library.required)
    .map((library) => library.key)

  const filteredProjects = useMemo(() => {
    return data.projects.filter((project) => {
      const hasAnyLibrary = libraries.some(
        (libraryKey) =>
          (project.libraryVersions[libraryKey] ?? []).length > 0,
      )
      if (!hasAnyLibrary) {
        return false
      }
      if (requiredLibraries.length === 0) {
        return true
      }
      return requiredLibraries.every(
        (libraryKey) =>
          (project.libraryVersions[libraryKey] ?? []).length > 0,
      )
    })
  }, [data.projects, libraries, requiredLibraries])

  const sortedProjects = useMemo(() => {
    const sorted = [...filteredProjects].sort((left, right) => {
      if (sortKey === 'project') {
        return versionCollator.compare(
          left.projectName ?? left.projectPath ?? '',
          right.projectName ?? right.projectPath ?? '',
        )
      }
      if (sortKey === 'activity') {
        const leftValue = getActivityValue(left.lastActivityAt)
        const rightValue = getActivityValue(right.lastActivityAt)
        if (leftValue === null && rightValue === null) {
          return 0
        }
        if (leftValue === null) {
          return 1
        }
        if (rightValue === null) {
          return -1
        }
        return leftValue - rightValue
      }
      if (libraries.includes(sortKey)) {
        const leftVersions = left.libraryVersions[sortKey] ?? []
        const rightVersions = right.libraryVersions[sortKey] ?? []
        const leftValue = leftVersions.join(', ')
        const rightValue = rightVersions.join(', ')
        if (!leftValue && !rightValue) {
          return 0
        }
        if (!leftValue) {
          return 1
        }
        if (!rightValue) {
          return -1
        }
        return versionCollator.compare(leftValue, rightValue)
      }
      return 0
    })

    return sortDirection === 'desc' ? sorted.reverse() : sorted
  }, [filteredProjects, libraries, sortDirection, sortKey])

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  const getSortLabel = (key: string) =>
    sortKey === key ? (sortDirection === 'asc' ? ' ^' : ' v') : ''

  const getAriaSort = (key: string) =>
    sortKey === key
      ? sortDirection === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none'

  return (
    <section className="report-template">
      <div className="report-intro">
        <h2>Projects using a library combination</h2>
        <p>
          This report shows versions for each library in the combination, along
          with project activity. Update the library list in
          <code>src/reports/project-library-combination.tsx</code> to reuse it for
          other combinations.
        </p>
      </div>

      <div className="reports-table">
        <table>
          <thead>
            <tr>
              <th aria-sort={getAriaSort('project')}>
                <button
                  type="button"
                  className="reports-sort-button"
                  onClick={() => toggleSort('project')}
                >
                  Project Name
                  <span className="reports-sort-indicator">
                    {getSortLabel('project')}
                  </span>
                </button>
              </th>
              {libraryConfigs.map((libraryConfig) => (
                <th
                  key={libraryConfig.key}
                  aria-sort={getAriaSort(libraryConfig.key)}
                >
                  <button
                    type="button"
                    className="reports-sort-button"
                    onClick={() => toggleSort(libraryConfig.key)}
                  >
                    {libraryConfig.name ?? libraryConfig.key}
                    <span className="reports-sort-indicator">
                      {getSortLabel(libraryConfig.key)}
                    </span>
                  </button>
                </th>
              ))}
              <th aria-sort={getAriaSort('activity')}>
                <button
                  type="button"
                  className="reports-sort-button"
                  onClick={() => toggleSort('activity')}
                >
                  Last activity date
                  <span className="reports-sort-indicator">
                    {getSortLabel('activity')}
                  </span>
                </button>
              </th>
              <th>Links</th>
            </tr>
          </thead>
          <tbody>
            {sortedProjects.map((projectRow) => {
              const projectPath = projectRow.projectPath ?? ''
              const codeUrl = projectPath
                ? joinGitLabUrl(data.baseUrl, projectPath)
                : null
              const membersUrl = projectPath
                ? joinGitLabUrl(data.baseUrl, `${projectPath}/-/project_members`)
                : null
              return (
                <tr key={projectRow.projectId}>
                  <td>
                    {projectPath ? (
                      <Link to="/project" search={{ path: projectPath }}>
                        {projectRow.projectName ?? projectPath}
                      </Link>
                    ) : (
                      <span>{projectRow.projectName ?? 'Unknown'}</span>
                    )}
                  </td>
                  {libraryConfigs.map((libraryConfig) => {
                    const libraryKey = libraryConfig.key
                    const versions = projectRow.libraryVersions[libraryKey] ?? []
                    return (
                      <td key={`${projectRow.projectId}-${libraryKey}`}>
                        {versions.length > 0
                          ? versions.join(', ')
                          : libraryConfig.required
                            ? '—'
                            : '--'}
                      </td>
                    )
                  })}
                  <td>{formatTimestamp(projectRow.lastActivityAt)}</td>
                  <td>
                    <span className="reports-links">
                      {codeUrl ? (
                        <a href={codeUrl} target="_blank" rel="noreferrer">
                          Code
                        </a>
                      ) : (
                        <span className="reports-muted">—</span>
                      )}
                      {membersUrl ? (
                        <a href={membersUrl} target="_blank" rel="noreferrer">
                          Members
                        </a>
                      ) : null}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export const projectLibraryCombinationReport: ReportModule<ProjectLibraryMatrix> = {
  definition: REPORT_DEFINITION,
  loadData,
  Component: ProjectLibraryCombinationReport,
}
