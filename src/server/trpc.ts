import { initTRPC } from '@trpc/server'
import {
  fetchDependencySummary,
  fetchLatestSyncRun,
  fetchProjectSummary,
  fetchUsageSummary,
  fetchUsageTargets,
} from './reporting'

export type TrpcContext = {
  request: Request
}

export const createTrpcContext = (opts: { request: Request }): TrpcContext => ({
  request: opts.request,
})

const t = initTRPC.context<TrpcContext>().create()

export const appRouter = t.router({
  latestSyncRun: t.procedure.query(() => fetchLatestSyncRun()),
  dependencySummary: t.procedure.query(() => fetchDependencySummary()),
  projectSummary: t.procedure.query(() => fetchProjectSummary()),
  usageSummary: t.procedure.query(() => fetchUsageSummary()),
  usageTargets: t.procedure.query(() => fetchUsageTargets()),
})

export type AppRouter = typeof appRouter
