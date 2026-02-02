import { initTRPC } from '@trpc/server'
import {
  fetchLatestSyncRun,
  fetchLibrarySummary,
  fetchProjectSummary,
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

export const appRouter = t.router({
  latestSyncRun: t.procedure.query(() => fetchLatestSyncRun()),
  librarySummary: t.procedure.query(() => fetchLibrarySummary()),
  projectSummary: t.procedure.query(() => fetchProjectSummary()),
  usageSummary: t.procedure.query(() => fetchUsageSummary()),
  usageTargets: t.procedure.query(() => fetchUsageTargets()),
})

export type AppRouter = typeof appRouter
