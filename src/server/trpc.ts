import { initTRPC } from '@trpc/server'
import {
  fetchDependencySummary,
  fetchLatestSyncRun,
  fetchUsageSummary,
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
  usageSummary: t.procedure.query(() => fetchUsageSummary()),
})

export type AppRouter = typeof appRouter
