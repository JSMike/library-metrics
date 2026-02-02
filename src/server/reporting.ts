import { createServerFn } from '@tanstack/react-start'

const loadReporting = async () => await import('./reporting.server')

export const getLatestSyncRun = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { fetchLatestSyncRun } = await loadReporting()
    return await fetchLatestSyncRun()
  },
)

export const getLibrarySummary = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { fetchLibrarySummary } = await loadReporting()
    return await fetchLibrarySummary()
  },
)

export const getLibraryDetail = createServerFn({ method: 'GET' })
  .inputValidator((data: { scope?: string; lib?: string }) => data)
  .handler(async ({ data }) => {
    const { fetchLibraryDetail } = await loadReporting()
    return await fetchLibraryDetail(data)
  })

export const getProjectDetail = createServerFn({ method: 'GET' })
  .inputValidator((data: { projectPath?: string }) => data)
  .handler(async ({ data }) => {
    const { fetchProjectDetail } = await loadReporting()
    return await fetchProjectDetail(data)
  })

export const getProjectSourceSubTargetDetail = createServerFn({ method: 'GET' })
  .inputValidator(
    (data: { projectPath?: string; targetKey: string; subTargetKey: string }) =>
      data,
  )
  .handler(async ({ data }) => {
    const { fetchProjectSourceSubTargetDetail } = await loadReporting()
    return await fetchProjectSourceSubTargetDetail(data)
  })

export const getProjectSourceQueryDetail = createServerFn({ method: 'GET' })
  .inputValidator(
    (data: {
      projectPath?: string
      targetKey: string
      subTargetKey: string
      queryKey: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const { fetchProjectSourceQueryDetail } = await loadReporting()
    return await fetchProjectSourceQueryDetail(data)
  })

export const getUsageSummary = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { fetchUsageSummary } = await loadReporting()
    return await fetchUsageSummary()
  },
)

export const getUsageTargetDetail = createServerFn({ method: 'GET' })
  .inputValidator((data: { targetKey: string }) => data)
  .handler(async ({ data }) => {
    const { fetchUsageTargetDetail } = await loadReporting()
    return await fetchUsageTargetDetail(data.targetKey)
  })

export const getUsageSubTargetDetail = createServerFn({ method: 'GET' })
  .inputValidator(
    (data: { targetKey: string; subTargetKey: string }) => data,
  )
  .handler(async ({ data }) => {
    const { fetchUsageSubTargetDetail } = await loadReporting()
    return await fetchUsageSubTargetDetail(data.targetKey, data.subTargetKey)
  })

export const getUsageQueryDetail = createServerFn({ method: 'GET' })
  .inputValidator(
    (data: { targetKey: string; subTargetKey: string; queryKey: string }) =>
      data,
  )
  .handler(async ({ data }) => {
    const { fetchUsageQueryDetail } = await loadReporting()
    return await fetchUsageQueryDetail(
      data.targetKey,
      data.subTargetKey,
      data.queryKey,
    )
  })
