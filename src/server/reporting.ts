import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  dependency,
  lockDependencySnapshot,
  project,
  projectSnapshot,
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

const getGitLabBaseUrl = () => {
  const value = process.env.GITLAB_BASE_URL;
  return value && value.trim().length > 0 ? value : "https://gitlab.com";
};

const stripControlChars = (value: string) =>
  value.replace(/[\u0000-\u001f\u007f]/g, "");

const sanitizeLookup = (value: string, maxLength: number) =>
  stripControlChars(value).trim().slice(0, maxLength);

const normalizeDependencyName = (
  scope: string | undefined,
  lib: string | undefined,
) => {
  const normalizedLib = sanitizeLookup(lib ?? "", 200);
  if (!normalizedLib) {
    return null;
  }
  const normalizedScope = sanitizeLookup(scope ?? "", 200).replace(/^@/, "");
  if (!normalizedScope) {
    if (normalizedLib.startsWith("@") && normalizedLib.includes("/")) {
      return normalizedLib;
    }
    return normalizedLib;
  }
  return `@${normalizedScope}/${normalizedLib}`;
};

const normalizeProjectPath = (path: string | undefined) => {
  const normalized = sanitizeLookup(path ?? "", 400);
  return normalized.length > 0 ? normalized : null;
};

type SemverParts = {
  major: number;
  minor: number;
  patch: number;
  prerelease: Array<string | number>;
};

const semverRegex =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;

const parseSemver = (value: string): SemverParts | null => {
  const match = value.trim().match(semverRegex);
  if (!match) {
    return null;
  }
  const [, major, minor, patch, prerelease] = match;
  const parts =
    prerelease?.split(".").map((part) => {
      const parsed = Number(part);
      return Number.isFinite(parsed) && `${parsed}` === part ? parsed : part;
    }) ?? [];
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: parts,
  };
};

const compareIdentifiers = (a: string | number, b: string | number) => {
  const aIsNumber = typeof a === "number";
  const bIsNumber = typeof b === "number";
  if (aIsNumber && bIsNumber) {
    return a - b;
  }
  if (aIsNumber) {
    return -1;
  }
  if (bIsNumber) {
    return 1;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
};

const compareSemver = (a: SemverParts, b: SemverParts) => {
  if (a.major !== b.major) {
    return a.major - b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }
  if (a.patch !== b.patch) {
    return a.patch - b.patch;
  }

  const aPre = a.prerelease;
  const bPre = b.prerelease;
  if (aPre.length === 0 && bPre.length === 0) {
    return 0;
  }
  if (aPre.length === 0) {
    return 1;
  }
  if (bPre.length === 0) {
    return -1;
  }

  const length = Math.min(aPre.length, bPre.length);
  for (let index = 0; index < length; index += 1) {
    const diff = compareIdentifiers(aPre[index]!, bPre[index]!);
    if (diff !== 0) {
      return diff;
    }
  }
  return aPre.length - bPre.length;
};

const compareVersionStrings = (left: string, right: string) => {
  const leftSemver = parseSemver(left);
  const rightSemver = parseSemver(right);
  if (leftSemver && rightSemver) {
    return compareSemver(leftSemver, rightSemver);
  }
  if (leftSemver) {
    return -1;
  }
  if (rightSemver) {
    return 1;
  }
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
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
      usageCount: sql<number>`count(distinct ${lockDependencySnapshot.projectId})`,
    })
    .from(lockDependencySnapshot)
    .leftJoin(
      dependency,
      eq(lockDependencySnapshot.dependencyId, dependency.id),
    )
    .where(eq(lockDependencySnapshot.syncId, runId))
    .groupBy(dependency.id, dependency.name)
    .orderBy(
      desc(sql`count(distinct ${lockDependencySnapshot.projectId})`),
      asc(dependency.name),
    );

  return rows;
};

export const fetchDependencyDetail = async (options: {
  scope?: string;
  lib?: string;
}) => {
  const runId = await getLatestRunId();
  if (!runId) {
    return null;
  }

  const dependencyName = normalizeDependencyName(options.scope, options.lib);
  if (!dependencyName) {
    return null;
  }

  const dependencyRows = await db
    .select({
      dependencyId: dependency.id,
      dependencyName: dependency.name,
    })
    .from(dependency)
    .where(eq(dependency.name, dependencyName))
    .limit(1);

  const dependencyInfo = dependencyRows[0];
  if (!dependencyInfo) {
    return null;
  }

  const rows = await db
    .select({
      versionResolved: lockDependencySnapshot.versionResolved,
      projectId: project.id,
      projectName: project.name,
      projectPath: project.pathWithNamespace,
    })
    .from(lockDependencySnapshot)
    .leftJoin(project, eq(lockDependencySnapshot.projectId, project.id))
    .where(
      and(
        eq(lockDependencySnapshot.syncId, runId),
        eq(lockDependencySnapshot.dependencyId, dependencyInfo.dependencyId),
      ),
    )
    .groupBy(
      lockDependencySnapshot.versionResolved,
      project.id,
      project.name,
      project.pathWithNamespace,
    );

  const versionMap = new Map<
    string,
    {
      version: string;
      projects: Array<{
        projectId: number;
        projectName: string;
        projectPath: string;
      }>;
    }
  >();

  for (const row of rows) {
    const version = row.versionResolved ?? "Unknown";
    const existing = versionMap.get(version);
    const projectEntry = row.projectId
      ? {
          projectId: row.projectId,
          projectName: row.projectName ?? "Unknown",
          projectPath: row.projectPath ?? "",
        }
      : null;

    if (existing) {
      if (
        projectEntry &&
        !existing.projects.some(
          (project) => project.projectId === projectEntry.projectId,
        )
      ) {
        existing.projects.push(projectEntry);
      }
    } else {
      versionMap.set(version, {
        version,
        projects: projectEntry ? [projectEntry] : [],
      });
    }
  }

  const versions = Array.from(versionMap.values())
    .map((entry) => ({
      version: entry.version,
      usageCount: entry.projects.length,
      projects: entry.projects,
    }))
    .sort((a, b) => compareVersionStrings(a.version, b.version));

  return {
    dependencyId: dependencyInfo.dependencyId,
    dependencyName: dependencyInfo.dependencyName ?? "Unknown",
    versions,
    gitlabBaseUrl: getGitLabBaseUrl(),
  };
};

export const fetchProjectDetail = async (options: { projectPath?: string }) => {
  const runId = await getLatestRunId();
  if (!runId) {
    return null;
  }

  const projectPath = normalizeProjectPath(options.projectPath);
  if (!projectPath) {
    return null;
  }

  const projectRows = await db
    .select({
      projectId: project.id,
      projectName: project.name,
      projectPath: project.pathWithNamespace,
      lastActivityAt: projectSnapshot.lastActivityAt,
    })
    .from(projectSnapshot)
    .leftJoin(project, eq(projectSnapshot.projectId, project.id))
    .where(
      and(
        eq(projectSnapshot.syncId, runId),
        eq(project.pathWithNamespace, projectPath),
      ),
    )
    .limit(1);

  const projectInfo = projectRows[0];
  if (!projectInfo) {
    return null;
  }

  const dependencies = await db
    .select({
      dependencyId: dependency.id,
      dependencyName: dependency.name,
      versionResolved: lockDependencySnapshot.versionResolved,
    })
    .from(lockDependencySnapshot)
    .leftJoin(dependency, eq(lockDependencySnapshot.dependencyId, dependency.id))
    .where(
      and(
        eq(lockDependencySnapshot.syncId, runId),
        eq(lockDependencySnapshot.projectId, projectInfo.projectId),
      ),
    )
    .groupBy(
      dependency.id,
      dependency.name,
      lockDependencySnapshot.versionResolved,
    )
    .orderBy(asc(dependency.name), asc(lockDependencySnapshot.versionResolved));

  return {
    projectId: projectInfo.projectId,
    projectName: projectInfo.projectName ?? "Unknown",
    projectPath: projectInfo.projectPath ?? "",
    lastActivityAt: projectInfo.lastActivityAt ?? null,
    dependencies,
    gitlabBaseUrl: getGitLabBaseUrl(),
  };
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

export const getDependencyDetail = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { scope?: string; lib?: string }) => data,
  )
  .handler(async ({ data }) => await fetchDependencyDetail(data));

export const getProjectDetail = createServerFn({ method: "GET" })
  .inputValidator((data: { projectPath?: string }) => data)
  .handler(async ({ data }) => await fetchProjectDetail(data));

export const getUsageSummary = createServerFn({ method: "GET" }).handler(
  async () => await fetchUsageSummary(),
);
