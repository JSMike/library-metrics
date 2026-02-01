import { createServerFn } from "@tanstack/react-start";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  dependency,
  lockDependencySnapshot,
  syncRun,
  usageResult,
} from "../db/schema";

const getLatestRunId = async () => {
  const rows = await db
    .select({ id: syncRun.id })
    .from(syncRun)
    .orderBy(desc(syncRun.id))
    .limit(1);
  return rows[0]?.id ?? null;
};

export const fetchLatestSyncRun = async () => {
  const rows = await db
    .select({
      id: syncRun.id,
      status: syncRun.status,
      startedAt: syncRun.startedAt,
      completedAt: syncRun.completedAt,
      note: syncRun.note,
    })
    .from(syncRun)
    .orderBy(desc(syncRun.id))
    .limit(1);

  return rows[0] ?? null;
};

export const fetchDependencySummary = async () => {
  const runId = await getLatestRunId();
  if (!runId) {
    return [];
  }

  const rows = await db
    .select({
      dependencyId: dependency.id,
      dependencyName: dependency.name,
      versionResolved: lockDependencySnapshot.versionResolved,
      projectCount: sql<number>`count(distinct ${lockDependencySnapshot.projectId})`,
    })
    .from(lockDependencySnapshot)
    .leftJoin(
      dependency,
      eq(lockDependencySnapshot.dependencyId, dependency.id),
    )
    .where(eq(lockDependencySnapshot.syncId, runId))
    .groupBy(
      dependency.id,
      dependency.name,
      lockDependencySnapshot.versionResolved,
    )
    .orderBy(
      desc(sql`count(distinct ${lockDependencySnapshot.projectId})`),
    );

  return rows;
};

export const fetchUsageSummary = async () => {
  const runId = await getLatestRunId();
  if (!runId) {
    return [];
  }

  const rows = await db
    .select({
      targetKey: usageResult.targetKey,
      subTargetKey: usageResult.subTargetKey,
      queryKey: usageResult.queryKey,
      matchCount: sql<number>`sum(${usageResult.matchCount})`,
      projectCount: sql<number>`count(distinct ${usageResult.projectId})`,
    })
    .from(usageResult)
    .where(eq(usageResult.syncId, runId))
    .groupBy(
      usageResult.targetKey,
      usageResult.subTargetKey,
      usageResult.queryKey,
    )
    .orderBy(desc(sql`sum(${usageResult.matchCount})`));

  return rows;
};

export const getLatestSyncRun = createServerFn({ method: "GET" }).handler(
  async () => await fetchLatestSyncRun(),
);

export const getDependencySummary = createServerFn({ method: "GET" }).handler(
  async () => await fetchDependencySummary(),
);

export const getUsageSummary = createServerFn({ method: "GET" }).handler(
  async () => await fetchUsageSummary(),
);
