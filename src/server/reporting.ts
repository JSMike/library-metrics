import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, inArray, not, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import {
  dependency,
  lockDependencySnapshot,
  project,
  projectSnapshot,
  syncRun,
  usageFileResult,
  usageResult,
} from "../db/schema";
import { usageQueries, usageTargets } from "../lib/usage-queries";

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

const buildGitLabFileUrl = (
  baseUrl: string,
  projectPath: string,
  branch: string,
  filePath: string,
) => {
  if (!projectPath || !filePath) {
    return null;
  }
  const trimmed = baseUrl.replace(/\/+$/, "");
  const encodedBranch = encodeURIComponent(branch || "main");
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${trimmed}/${projectPath}/-/blob/${encodedBranch}/${encodedPath}`;
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

const usageTitleIndex = (() => {
  const targetTitles = new Map<string, string>();
  const subTargetTitles = new Map<string, string>();
  const queryTitles = new Map<string, string>();

  for (const query of usageQueries) {
    if (!targetTitles.has(query.targetKey)) {
      targetTitles.set(query.targetKey, query.targetTitle);
    }
    if (query.subTargetKey && !subTargetTitles.has(query.subTargetKey)) {
      subTargetTitles.set(query.subTargetKey, query.subTargetTitle);
    }
    if (!queryTitles.has(query.queryKey)) {
      queryTitles.set(query.queryKey, query.queryKeyTitle);
    }
  }

  return { targetTitles, subTargetTitles, queryTitles };
})();

const normalizeSourcePath = (value: string) => value.trim().toLowerCase();

const usageSourceProjectsIndex = (() => {
  const map = new Map<string, string[]>();
  for (const target of usageTargets) {
    const paths = (target.sourceProjects ?? [])
      .map((path) => normalizeSourcePath(path))
      .filter((path) => path.length > 0);
    if (paths.length > 0) {
      map.set(target.targetKey, paths);
    }
  }
  return map;
})();

const getSourceProjectsForTarget = (targetKey: string) =>
  usageSourceProjectsIndex.get(targetKey) ?? [];

const getSourceTargetKeysForProject = (projectPath: string) => {
  const normalized = normalizeSourcePath(projectPath);
  const keys: string[] = [];
  for (const [targetKey, paths] of usageSourceProjectsIndex.entries()) {
    if (paths.includes(normalized)) {
      keys.push(targetKey);
    }
  }
  return keys;
};

const buildSourceProjectExclusion = (
  targetColumn: typeof usageResult.targetKey,
  projectPathColumn: typeof project.pathWithNamespace,
) => {
  const clauses: Array<ReturnType<typeof and>> = [];
  for (const [targetKey, paths] of usageSourceProjectsIndex.entries()) {
    if (paths.length === 0) {
      continue;
    }
    clauses.push(
      and(
        eq(targetColumn, targetKey),
        inArray(sql`lower(${projectPathColumn})`, paths),
      ),
    );
  }

  if (clauses.length === 0) {
    return null;
  }

  return not(or(...clauses));
};

const getSubTargetSegment = (targetKey: string, subTargetKey?: string | null) => {
  if (!subTargetKey) {
    return "";
  }
  const prefix = `${targetKey}/`;
  return subTargetKey.startsWith(prefix)
    ? subTargetKey.slice(prefix.length)
    : subTargetKey;
};

const getQuerySegment = (
  subTargetKey: string | null,
  queryKey: string,
) => {
  if (!subTargetKey) {
    return queryKey;
  }
  const prefix = `${subTargetKey}/`;
  return queryKey.startsWith(prefix) ? queryKey.slice(prefix.length) : queryKey;
};

const getTargetTitle = (targetKey: string) =>
  usageTitleIndex.targetTitles.get(targetKey) ?? targetKey;

const getSubTargetTitle = (targetKey: string, subTargetKey?: string | null) => {
  if (!subTargetKey) {
    return targetKey;
  }
  return (
    usageTitleIndex.subTargetTitles.get(subTargetKey) ??
    `${targetKey}-${getSubTargetSegment(targetKey, subTargetKey)}`
  );
};

const getQueryTitle = (
  targetKey: string,
  subTargetKey: string | null,
  queryKey: string,
) =>
  usageTitleIndex.queryTitles.get(queryKey) ??
  [
    targetKey,
    getSubTargetSegment(targetKey, subTargetKey),
    getQuerySegment(subTargetKey, queryKey),
  ]
    .filter(Boolean)
    .join("-");

const buildSubTargetKey = (targetKey: string, subTargetKey: string) =>
  `${targetKey}/${subTargetKey}`;

const buildQueryKey = (
  targetKey: string,
  subTargetKey: string,
  queryKey: string,
) => `${targetKey}/${subTargetKey}/${queryKey}`;

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

export const fetchProjectSummary = async () => {
  const runId = await getLatestRunId();
  const baseUrl = getGitLabBaseUrl();
  if (!runId) {
    return { baseUrl, projects: [] as Array<{
      projectId: number;
      projectName: string;
      projectPath: string;
      lastActivityAt: number | null;
    }> };
  }

  const rows = await db
    .select({
      projectId: project.id,
      projectName: project.name,
      projectPath: project.pathWithNamespace,
      lastActivityAt: projectSnapshot.lastActivityAt,
    })
    .from(projectSnapshot)
    .leftJoin(project, eq(projectSnapshot.projectId, project.id))
    .where(eq(projectSnapshot.syncId, runId))
    .orderBy(asc(project.name), asc(project.pathWithNamespace));

  return { baseUrl, projects: rows };
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

  const sourceTargetKeys = getSourceTargetKeysForProject(projectPath);

  let sourceUsage: Array<{
    targetKey: string;
    targetTitle: string;
    subTargetKey: string | null;
    subTargetTitle: string;
    queryKey: string;
    queryKeyTitle: string;
    matchCount: number;
  }> = [];

  if (sourceTargetKeys.length > 0) {
    const rows = await db
      .select({
        targetKey: usageResult.targetKey,
        subTargetKey: usageResult.subTargetKey,
        queryKey: usageResult.queryKey,
        matchCount: sql<number>`sum(${usageResult.matchCount})`,
      })
      .from(usageResult)
      .where(
        and(
          eq(usageResult.syncId, runId),
          eq(usageResult.projectId, projectInfo.projectId),
          inArray(usageResult.targetKey, sourceTargetKeys),
        ),
      )
      .groupBy(
        usageResult.targetKey,
        usageResult.subTargetKey,
        usageResult.queryKey,
      )
      .orderBy(
        asc(usageResult.targetKey),
        asc(usageResult.subTargetKey),
        asc(usageResult.queryKey),
      );

    sourceUsage = rows.map((row) => ({
      targetKey: row.targetKey,
      targetTitle: getTargetTitle(row.targetKey),
      subTargetKey: row.subTargetKey,
      subTargetTitle: getSubTargetTitle(row.targetKey, row.subTargetKey),
      queryKey: row.queryKey,
      queryKeyTitle: getQueryTitle(
        row.targetKey,
        row.subTargetKey,
        row.queryKey,
      ),
      matchCount: row.matchCount,
    }));
  }

  return {
    projectId: projectInfo.projectId,
    projectName: projectInfo.projectName ?? "Unknown",
    projectPath: projectInfo.projectPath ?? "",
    lastActivityAt: projectInfo.lastActivityAt ?? null,
    dependencies,
    sourceUsage,
    gitlabBaseUrl: getGitLabBaseUrl(),
  };
};

export const fetchProjectSourceSubTargetDetail = async (options: {
  projectPath?: string;
  targetKey: string;
  subTargetKey: string;
}) => {
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
      defaultBranch: projectSnapshot.defaultBranch,
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

  const sourceTargetKeys = getSourceTargetKeysForProject(projectPath);
  if (!sourceTargetKeys.includes(options.targetKey)) {
    return null;
  }

  const subTargetKey = buildSubTargetKey(
    options.targetKey,
    options.subTargetKey,
  );

  const rows = await db
    .select({
      queryKey: usageFileResult.queryKey,
      filePath: usageFileResult.filePath,
      matchCount: sql<number>`sum(${usageFileResult.matchCount})`,
    })
    .from(usageFileResult)
    .where(
      and(
        eq(usageFileResult.syncId, runId),
        eq(usageFileResult.projectId, projectInfo.projectId),
        eq(usageFileResult.targetKey, options.targetKey),
        eq(usageFileResult.subTargetKey, subTargetKey),
      ),
    )
    .groupBy(usageFileResult.queryKey, usageFileResult.filePath)
    .orderBy(asc(usageFileResult.queryKey), asc(usageFileResult.filePath));

  const baseUrl = getGitLabBaseUrl();
  const branch = projectInfo.defaultBranch ?? "main";

  const queryMap = new Map<
    string,
    {
      queryKey: string;
      queryKeyTitle: string;
      totalMatches: number;
      files: Array<{
        filePath: string;
        matchCount: number;
        fileUrl: string | null;
      }>;
    }
  >();

  for (const row of rows) {
    const entry =
      queryMap.get(row.queryKey) ??
      {
        queryKey: row.queryKey,
        queryKeyTitle: getQueryTitle(
          options.targetKey,
          subTargetKey,
          row.queryKey,
        ),
        totalMatches: 0,
        files: [],
      };

    entry.files.push({
      filePath: row.filePath,
      matchCount: row.matchCount,
      fileUrl: buildGitLabFileUrl(
        baseUrl,
        projectInfo.projectPath ?? "",
        branch,
        row.filePath,
      ),
    });
    entry.totalMatches += row.matchCount;

    if (!queryMap.has(row.queryKey)) {
      queryMap.set(row.queryKey, entry);
    }
  }

  return {
    projectId: projectInfo.projectId,
    projectName: projectInfo.projectName ?? "Unknown",
    projectPath: projectInfo.projectPath ?? "",
    targetKey: options.targetKey,
    targetTitle: getTargetTitle(options.targetKey),
    subTargetKey,
    subTargetTitle: getSubTargetTitle(options.targetKey, subTargetKey),
    queries: Array.from(queryMap.values()),
  };
};

export const fetchProjectSourceQueryDetail = async (options: {
  projectPath?: string;
  targetKey: string;
  subTargetKey: string;
  queryKey: string;
}) => {
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
      defaultBranch: projectSnapshot.defaultBranch,
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

  const sourceTargetKeys = getSourceTargetKeysForProject(projectPath);
  if (!sourceTargetKeys.includes(options.targetKey)) {
    return null;
  }

  const subTargetKey = buildSubTargetKey(
    options.targetKey,
    options.subTargetKey,
  );
  const queryKey = buildQueryKey(
    options.targetKey,
    options.subTargetKey,
    options.queryKey,
  );

  const rows = await db
    .select({
      filePath: usageFileResult.filePath,
      matchCount: sql<number>`sum(${usageFileResult.matchCount})`,
    })
    .from(usageFileResult)
    .where(
      and(
        eq(usageFileResult.syncId, runId),
        eq(usageFileResult.projectId, projectInfo.projectId),
        eq(usageFileResult.queryKey, queryKey),
      ),
    )
    .groupBy(usageFileResult.filePath)
    .orderBy(asc(usageFileResult.filePath));

  const baseUrl = getGitLabBaseUrl();
  const branch = projectInfo.defaultBranch ?? "main";

  const files = rows.map((row) => ({
    filePath: row.filePath,
    matchCount: row.matchCount,
    fileUrl: buildGitLabFileUrl(
      baseUrl,
      projectInfo.projectPath ?? "",
      branch,
      row.filePath,
    ),
  }));

  return {
    projectId: projectInfo.projectId,
    projectName: projectInfo.projectName ?? "Unknown",
    projectPath: projectInfo.projectPath ?? "",
    targetKey: options.targetKey,
    targetTitle: getTargetTitle(options.targetKey),
    subTargetKey,
    subTargetTitle: getSubTargetTitle(options.targetKey, subTargetKey),
    queryKey,
    queryKeyTitle: getQueryTitle(options.targetKey, subTargetKey, queryKey),
    files,
  };
};

export const fetchUsageSummary = async () => {
  const runId = await getLatestRunId();
  if (!runId) {
    return [];
  }

  const sourceExclusion = buildSourceProjectExclusion(
    usageResult.targetKey,
    project.pathWithNamespace,
  );
  const whereClause = sourceExclusion
    ? and(eq(usageResult.syncId, runId), sourceExclusion)
    : eq(usageResult.syncId, runId);

  const rows = await db
    .select({
      targetKey: usageResult.targetKey,
      subTargetKey: usageResult.subTargetKey,
      queryKey: usageResult.queryKey,
      matchCount: sql<number>`sum(${usageResult.matchCount})`,
      projectCount: sql<number>`count(distinct ${usageResult.projectId})`,
    })
    .from(usageResult)
    .leftJoin(project, eq(usageResult.projectId, project.id))
    .where(whereClause)
    .groupBy(
      usageResult.targetKey,
      usageResult.subTargetKey,
      usageResult.queryKey,
    )
    .orderBy(desc(sql`sum(${usageResult.matchCount})`));

  return rows;
};

export const fetchUsageTargets = async () => {
  const runId = await getLatestRunId();
  if (!runId) {
    return [];
  }

  const sourceExclusion = buildSourceProjectExclusion(
    usageResult.targetKey,
    project.pathWithNamespace,
  );
  const whereClause = sourceExclusion
    ? and(eq(usageResult.syncId, runId), sourceExclusion)
    : eq(usageResult.syncId, runId);

  const rows = await db
    .select({
      targetKey: usageResult.targetKey,
      matchCount: sql<number>`sum(${usageResult.matchCount})`,
      projectCount: sql<number>`count(distinct ${usageResult.projectId})`,
    })
    .from(usageResult)
    .leftJoin(project, eq(usageResult.projectId, project.id))
    .where(whereClause)
    .groupBy(usageResult.targetKey)
    .orderBy(desc(sql`sum(${usageResult.matchCount})`));

  return rows.map((row) => ({
    targetKey: row.targetKey,
    targetTitle: getTargetTitle(row.targetKey),
    matchCount: row.matchCount,
    projectCount: row.projectCount,
  }));
};

export const fetchUsageTargetDetail = async (targetKey: string) => {
  const runId = await getLatestRunId();
  if (!runId) {
    return null;
  }

  const excludePaths = getSourceProjectsForTarget(targetKey);
  const exclusion =
    excludePaths.length > 0
      ? not(inArray(sql`lower(${project.pathWithNamespace})`, excludePaths))
      : null;
  const whereClause = exclusion
    ? and(
        eq(usageResult.syncId, runId),
        eq(usageResult.targetKey, targetKey),
        exclusion,
      )
    : and(eq(usageResult.syncId, runId), eq(usageResult.targetKey, targetKey));

  const rows = await db
    .select({
      subTargetKey: usageResult.subTargetKey,
      queryKey: usageResult.queryKey,
      matchCount: sql<number>`sum(${usageResult.matchCount})`,
      projectCount: sql<number>`count(distinct ${usageResult.projectId})`,
    })
    .from(usageResult)
    .leftJoin(project, eq(usageResult.projectId, project.id))
    .where(whereClause)
    .groupBy(usageResult.subTargetKey, usageResult.queryKey)
    .orderBy(asc(usageResult.subTargetKey), asc(usageResult.queryKey));

  const subTargetMap = new Map<
    string,
    {
      subTargetKey: string;
      subTargetTitle: string;
      queries: Array<{
        queryKey: string;
        queryKeyTitle: string;
        matchCount: number;
        projectCount: number;
      }>;
    }
  >();

  for (const row of rows) {
    const subTargetKey = row.subTargetKey ?? "unknown";
    const entry =
      subTargetMap.get(subTargetKey) ??
      {
        subTargetKey,
        subTargetTitle: getSubTargetTitle(targetKey, subTargetKey),
        queries: [],
      };
    entry.queries.push({
      queryKey: row.queryKey,
      queryKeyTitle: getQueryTitle(targetKey, subTargetKey, row.queryKey),
      matchCount: row.matchCount,
      projectCount: row.projectCount,
    });
    if (!subTargetMap.has(subTargetKey)) {
      subTargetMap.set(subTargetKey, entry);
    }
  }

  return {
    targetKey,
    targetTitle: getTargetTitle(targetKey),
    subTargets: Array.from(subTargetMap.values()),
  };
};

export const fetchUsageSubTargetDetail = async (
  targetKey: string,
  subTargetKeySegment: string,
) => {
  const runId = await getLatestRunId();
  if (!runId) {
    return null;
  }

  const subTargetKey = buildSubTargetKey(targetKey, subTargetKeySegment);
  const excludePaths = getSourceProjectsForTarget(targetKey);
  const exclusion =
    excludePaths.length > 0
      ? not(inArray(sql`lower(${project.pathWithNamespace})`, excludePaths))
      : null;
  const whereClause = exclusion
    ? and(
        eq(usageResult.syncId, runId),
        eq(usageResult.targetKey, targetKey),
        eq(usageResult.subTargetKey, subTargetKey),
        exclusion,
      )
    : and(
        eq(usageResult.syncId, runId),
        eq(usageResult.targetKey, targetKey),
        eq(usageResult.subTargetKey, subTargetKey),
      );

  const rows = await db
    .select({
      queryKey: usageResult.queryKey,
      projectId: project.id,
      projectName: project.name,
      projectPath: project.pathWithNamespace,
      matchCount: sql<number>`sum(${usageResult.matchCount})`,
    })
    .from(usageResult)
    .leftJoin(project, eq(usageResult.projectId, project.id))
    .where(whereClause)
    .groupBy(usageResult.queryKey, project.id, project.name, project.pathWithNamespace)
    .orderBy(asc(usageResult.queryKey), asc(project.name));

  const queryMap = new Map<
    string,
    {
      queryKey: string;
      queryKeyTitle: string;
      matchCount: number;
      projectCount: number;
      projects: Array<{
        projectId: number;
        projectName: string;
        projectPath: string;
        matchCount: number;
      }>;
    }
  >();

  for (const row of rows) {
    const entry =
      queryMap.get(row.queryKey) ??
      {
        queryKey: row.queryKey,
        queryKeyTitle: getQueryTitle(targetKey, subTargetKey, row.queryKey),
        matchCount: 0,
        projectCount: 0,
        projects: [],
      };

    if (row.projectId) {
      entry.projects.push({
        projectId: row.projectId,
        projectName: row.projectName ?? "Unknown",
        projectPath: row.projectPath ?? "",
        matchCount: row.matchCount,
      });
      entry.projectCount += 1;
      entry.matchCount += row.matchCount;
    }

    if (!queryMap.has(row.queryKey)) {
      queryMap.set(row.queryKey, entry);
    }
  }

  return {
    targetKey,
    targetTitle: getTargetTitle(targetKey),
    subTargetKey,
    subTargetTitle: getSubTargetTitle(targetKey, subTargetKey),
    queries: Array.from(queryMap.values()),
  };
};

export const fetchUsageQueryDetail = async (
  targetKey: string,
  subTargetKeySegment: string,
  queryKeySegment: string,
) => {
  const runId = await getLatestRunId();
  if (!runId) {
    return null;
  }

  const subTargetKey = buildSubTargetKey(targetKey, subTargetKeySegment);
  const queryKey = buildQueryKey(targetKey, subTargetKeySegment, queryKeySegment);
  const excludePaths = getSourceProjectsForTarget(targetKey);
  const exclusion =
    excludePaths.length > 0
      ? not(inArray(sql`lower(${project.pathWithNamespace})`, excludePaths))
      : null;
  const whereClause = exclusion
    ? and(
        eq(usageFileResult.syncId, runId),
        eq(usageFileResult.queryKey, queryKey),
        exclusion,
      )
    : and(
        eq(usageFileResult.syncId, runId),
        eq(usageFileResult.queryKey, queryKey),
      );

  const rows = await db
    .select({
      projectId: project.id,
      projectName: project.name,
      projectPath: project.pathWithNamespace,
      defaultBranch: projectSnapshot.defaultBranch,
      filePath: usageFileResult.filePath,
      matchCount: usageFileResult.matchCount,
    })
    .from(usageFileResult)
    .leftJoin(project, eq(usageFileResult.projectId, project.id))
    .leftJoin(
      projectSnapshot,
      and(
        eq(projectSnapshot.projectId, project.id),
        eq(projectSnapshot.syncId, runId),
      ),
    )
    .where(whereClause)
    .orderBy(asc(project.name), asc(usageFileResult.filePath));

  const projectMap = new Map<
    number,
    {
      projectId: number;
      projectName: string;
      projectPath: string;
      defaultBranch: string;
      totalMatches: number;
      files: Array<{
        filePath: string;
        matchCount: number;
        fileUrl: string | null;
      }>;
    }
  >();

  const baseUrl = getGitLabBaseUrl();

  for (const row of rows) {
    if (!row.projectId) {
      continue;
    }
    const existing =
      projectMap.get(row.projectId) ??
      {
        projectId: row.projectId,
        projectName: row.projectName ?? "Unknown",
        projectPath: row.projectPath ?? "",
        defaultBranch: row.defaultBranch ?? "main",
        totalMatches: 0,
        files: [],
      };

    const projectPath = existing.projectPath;
    const branch = existing.defaultBranch || "main";
    const fileUrl = buildGitLabFileUrl(
      baseUrl,
      projectPath,
      branch,
      row.filePath,
    );

    existing.files.push({
      filePath: row.filePath,
      matchCount: row.matchCount,
      fileUrl,
    });
    existing.totalMatches += row.matchCount;

    if (!projectMap.has(row.projectId)) {
      projectMap.set(row.projectId, existing);
    }
  }

  return {
    targetKey,
    targetTitle: getTargetTitle(targetKey),
    subTargetKey,
    subTargetTitle: getSubTargetTitle(targetKey, subTargetKey),
    queryKey,
    queryKeyTitle: getQueryTitle(targetKey, subTargetKey, queryKey),
    projects: Array.from(projectMap.values()),
  };
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

export const getProjectSourceSubTargetDetail = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { projectPath?: string; targetKey: string; subTargetKey: string }) =>
      data,
  )
  .handler(
    async ({ data }) => await fetchProjectSourceSubTargetDetail(data),
  );

export const getProjectSourceQueryDetail = createServerFn({ method: "GET" })
  .inputValidator(
    (data: {
      projectPath?: string;
      targetKey: string;
      subTargetKey: string;
      queryKey: string;
    }) => data,
  )
  .handler(async ({ data }) => await fetchProjectSourceQueryDetail(data));

export const getUsageSummary = createServerFn({ method: "GET" }).handler(
  async () => await fetchUsageSummary(),
);

export const getUsageTargetDetail = createServerFn({ method: "GET" })
  .inputValidator((data: { targetKey: string }) => data)
  .handler(async ({ data }) => await fetchUsageTargetDetail(data.targetKey));

export const getUsageSubTargetDetail = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { targetKey: string; subTargetKey: string }) => data,
  )
  .handler(async ({ data }) =>
    await fetchUsageSubTargetDetail(data.targetKey, data.subTargetKey),
  );

export const getUsageQueryDetail = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { targetKey: string; subTargetKey: string; queryKey: string }) =>
      data,
  )
  .handler(async ({ data }) =>
    await fetchUsageQueryDetail(
      data.targetKey,
      data.subTargetKey,
      data.queryKey,
    ),
  );
