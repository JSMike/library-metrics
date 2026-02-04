import { TRPCError, initTRPC } from '@trpc/server'
import {
  fetchLatestSyncRun,
  fetchLibrarySummary,
  fetchProjectSummary,
  fetchProjectLibraryMatrix,
  fetchReportsList,
  fetchUsageSummary,
  fetchUsageTargets,
} from './reporting.server'

export type TrpcContext = {
  request: Request
}

export const createTrpcContext = (opts: { request: Request }): TrpcContext => ({
  request: opts.request,
})

const t = initTRPC.context<TrpcContext>().create()

const parseProjectLibraryMatrixInput = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Expected input with a libraries array.',
    })
  }
  const input = value as { libraries?: unknown }
  if (!Array.isArray(input.libraries)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Expected libraries to be an array of strings.',
    })
  }
  const libraries = input.libraries.filter(
    (library): library is string => typeof library === 'string',
  )
  return { libraries }
}

export const appRouter = t.router({
  latestSyncRun: t.procedure.query(() => fetchLatestSyncRun()),
  librarySummary: t.procedure.query(() => fetchLibrarySummary()),
  projectSummary: t.procedure.query(() => fetchProjectSummary()),
  projectLibraryMatrix: t.procedure
    .input(parseProjectLibraryMatrixInput)
    .query(({ input }) => fetchProjectLibraryMatrix(input)),
  reportsList: t.procedure.query(() => fetchReportsList()),
  usageSummary: t.procedure.query(() => fetchUsageSummary()),
  usageTargets: t.procedure.query(() => fetchUsageTargets()),
})

export type AppRouter = typeof appRouter
