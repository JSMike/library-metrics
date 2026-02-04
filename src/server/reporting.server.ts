import { and, asc, desc, eq, inArray, isNull, not, or, sql } from "drizzle-orm";
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
import { reportConfig } from "../lib/report-config";
import { reportsList } from "../reports";
import { usageQueries, usageTargets } from "../lib/usage-queries";

const getLatestRunId = async () => {
  const rows = await db
    .select({ id: syncRun.id })
    .from(syncRun)
    .orderBy(desc(syncRun.id))
    .limit(1);
  return rows[0]?.id ?? null;
};

const activeProjectFilter = reportConfig.includeInactiveProjects
  ? null
  : and(
      eq(projectSnapshot.archived, false),
      isNull(projectSnapshot.pendingDeletionAt),
    );

const withActiveProjectSnapshot = (base: ReturnType<typeof and>) =>
  activeProjectFilter ? and(base, activeProjectFilter) : base;

const getEffectiveSyncId = () =>
  sql<number>`coalesce(${projectSnapshot.dataSourceSyncId}, ${projectSnapshot.syncId})`;

const buildProjectDataJoin = (
  runId: number,
  projectIdColumn: any,
  syncIdColumn: any,
) =>
  withActiveProjectSnapshot(
    and(
      eq(projectSnapshot.syncId, runId),
      eq(projectSnapshot.projectId, projectIdColumn),
      eq(syncIdColumn, getEffectiveSyncId()),
    ),
  );

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

const normalizeLibraryList = (libraries: string[]) => {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const library of libraries) {
    const sanitized = sanitizeLookup(library ?? "", 200);
    if (!sanitized) {
      continue;
    }
    const lower = sanitized.toLowerCase();
    if (seen.has(lower)) {
      continue;
    }
    seen.add(lower);
    normalized.push(lower);
  }
  return normalized;
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
  targetColumn:
    | typeof usageResult.targetKey
    | typeof usageFileResult.targetKey,
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

const buildUsageKey = (
  targetKey: string,
  subTargetKey: string | null,
  queryKey: string,
) => `${targetKey}::${subTargetKey ?? ""}::${queryKey}`;

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

export const fetchReportsList = async () => reportsList;

export const fetchLibrarySummary = async () => {
  const runId = await getLatestRunId();
  if (!runId) {
    return [];
  }

  const usageByProject = db
    .select({
      dependencyId: lockDependencySnapshot.dependencyId,
      projectId: lockDependencySnapshot.projectId,
    })
    .from(lockDependencySnapshot)
    .innerJoin(
      projectSnapshot,
      buildProjectDataJoin(
        runId,
        lockDependencySnapshot.projectId,
        lockDependencySnapshot.syncId,
      ),
    )
    .groupBy(
      lockDependencySnapshot.dependencyId,
      lockDependencySnapshot.projectId,
    )
    .as("usage_by_project");

  const usageCountExpression = sql<number>`count(${usageByProject.projectId})`;

  const rows = await db
    .select({
      dependencyId: dependency.id,
      dependencyName: dependency.name,
      usageCount: usageCountExpression,
    })
    .from(usageByProject)
    .leftJoin(
      dependency,
      eq(usageByProject.dependencyId, dependency.id),
    )
    .groupBy(dependency.id, dependency.name)
    .orderBy(
      desc(usageCountExpression),
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
    .innerJoin(project, eq(projectSnapshot.projectId, project.id))
    .innerJoin(
      lockDependencySnapshot,
      buildProjectDataJoin(
        runId,
        lockDependencySnapshot.projectId,
        lockDependencySnapshot.syncId,
      ),
    )
    .where(withActiveProjectSnapshot(and(eq(projectSnapshot.syncId, runId))))
    .groupBy(
      project.id,
      project.name,
      project.pathWithNamespace,
      projectSnapshot.lastActivityAt,
    )
    .orderBy(asc(project.name), asc(project.pathWithNamespace));

  return { baseUrl, projects: rows };
};

export const fetchProjectLibraryMatrix = async (options: {
  libraries: string[];
}) => {
  const runId = await getLatestRunId();
  const baseUrl = getGitLabBaseUrl();
  const libraries = normalizeLibraryList(options.libraries ?? []);

  if (!runId || libraries.length === 0) {
    return { baseUrl, libraries, projects: [] as Array<{
      projectId: number;
      projectName: string | null;
      projectPath: string | null;
      lastActivityAt: number | null;
      libraryVersions: Record<string, string[]>;
    }> };
  }

  const rows = await db
    .select({
      projectId: project.id,
      projectName: project.name,
      projectPath: project.pathWithNamespace,
      lastActivityAt: projectSnapshot.lastActivityAt,
      dependencyName: dependency.name,
      versionResolved: lockDependencySnapshot.versionResolved,
    })
    .from(lockDependencySnapshot)
    .innerJoin(
      dependency,
      eq(lockDependencySnapshot.dependencyId, dependency.id),
    )
    .innerJoin(
      projectSnapshot,
      buildProjectDataJoin(
        runId,
        lockDependencySnapshot.projectId,
        lockDependencySnapshot.syncId,
      ),
    )
    .leftJoin(project, eq(lockDependencySnapshot.projectId, project.id))
    .where(inArray(sql`lower(${dependency.name})`, libraries))
    .groupBy(
      project.id,
      project.name,
      project.pathWithNamespace,
      projectSnapshot.lastActivityAt,
      dependency.name,
      lockDependencySnapshot.versionResolved,
    )
    .orderBy(
      asc(project.name),
      asc(project.pathWithNamespace),
      asc(dependency.name),
      asc(lockDependencySnapshot.versionResolved),
    );

  const projectMap = new Map<number, {
    projectId: number;
    projectName: string | null;
    projectPath: string | null;
    lastActivityAt: number | null;
    libraryVersions: Map<string, Set<string>>;
  }>();

  for (const row of rows) {
    const entry = projectMap.get(row.projectId) ?? {
      projectId: row.projectId,
      projectName: row.projectName ?? null,
      projectPath: row.projectPath ?? null,
      lastActivityAt: row.lastActivityAt ?? null,
      libraryVersions: new Map<string, Set<string>>(),
    };

    const libraryKey = row.dependencyName?.toLowerCase() ?? "";
    if (libraryKey) {
      let versionSet = entry.libraryVersions.get(libraryKey);
      if (!versionSet) {
        versionSet = new Set<string>();
        entry.libraryVersions.set(libraryKey, versionSet);
      }
      if (row.versionResolved) {
        versionSet.add(row.versionResolved);
      }
    }

    if (!projectMap.has(row.projectId)) {
      projectMap.set(row.projectId, entry);
    }
  }

  const projects = Array.from(projectMap.values()).map((entry) => {
    const libraryVersions: Record<string, string[]> = {};
    for (const [libraryKey, versions] of entry.libraryVersions.entries()) {
      libraryVersions[libraryKey] = Array.from(versions).sort(
        compareVersionStrings,
      );
    }
    return {
      projectId: entry.projectId,
      projectName: entry.projectName,
      projectPath: entry.projectPath,
      lastActivityAt: entry.lastActivityAt,
      libraryVersions,
    };
  });

  return { baseUrl, libraries, projects };
};

export const fetchLibraryDetail = async (options: {
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
    .innerJoin(
      projectSnapshot,
      buildProjectDataJoin(
        runId,
        lockDependencySnapshot.projectId,
        lockDependencySnapshot.syncId,
      ),
    )
    .where(
      and(
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
      dataSourceSyncId: projectSnapshot.dataSourceSyncId,
    })
    .from(projectSnapshot)
    .leftJoin(project, eq(projectSnapshot.projectId, project.id))
    .where(
      withActiveProjectSnapshot(
        and(
          eq(projectSnapshot.syncId, runId),
          eq(project.pathWithNamespace, projectPath),
        ),
      ),
    )
    .limit(1);

  const projectInfo = projectRows[0];
  if (!projectInfo) {
    return null;
  }
  const effectiveSyncId = projectInfo.dataSourceSyncId ?? runId;

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
        eq(lockDependencySnapshot.syncId, effectiveSyncId),
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
          eq(usageResult.syncId, effectiveSyncId),
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
      dataSourceSyncId: projectSnapshot.dataSourceSyncId,
    })
    .from(projectSnapshot)
    .leftJoin(project, eq(projectSnapshot.projectId, project.id))
    .where(
      withActiveProjectSnapshot(
        and(
          eq(projectSnapshot.syncId, runId),
          eq(project.pathWithNamespace, projectPath),
        ),
      ),
    )
    .limit(1);

  const projectInfo = projectRows[0];
  if (!projectInfo) {
    return null;
  }
  const effectiveSyncId = projectInfo.dataSourceSyncId ?? runId;

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
        eq(usageFileResult.syncId, effectiveSyncId),
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
      dataSourceSyncId: projectSnapshot.dataSourceSyncId,
    })
    .from(projectSnapshot)
    .leftJoin(project, eq(projectSnapshot.projectId, project.id))
    .where(
      withActiveProjectSnapshot(
        and(
          eq(projectSnapshot.syncId, runId),
          eq(project.pathWithNamespace, projectPath),
        ),
      ),
    )
    .limit(1);

  const projectInfo = projectRows[0];
  if (!projectInfo) {
    return null;
  }
  const effectiveSyncId = projectInfo.dataSourceSyncId ?? runId;

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
        eq(usageFileResult.syncId, effectiveSyncId),
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
  const fileSourceExclusion = buildSourceProjectExclusion(
    usageFileResult.targetKey,
    project.pathWithNamespace,
  );
  let query = db
    .select({
      targetKey: usageResult.targetKey,
      subTargetKey: usageResult.subTargetKey,
      queryKey: usageResult.queryKey,
      matchCount: sql<number>`sum(${usageResult.matchCount})`,
      projectCount: sql<number>`count(distinct ${usageResult.projectId})`,
    })
    .from(usageResult)
    .leftJoin(project, eq(usageResult.projectId, project.id))
    .innerJoin(
      projectSnapshot,
      buildProjectDataJoin(
        runId,
        usageResult.projectId,
        usageResult.syncId,
      ),
    );
  let fileQuery = db
    .select({
      targetKey: usageFileResult.targetKey,
      subTargetKey: usageFileResult.subTargetKey,
      queryKey: usageFileResult.queryKey,
      fileCount: sql<number>`count(distinct ${usageFileResult.projectId} || '::' || ${usageFileResult.filePath})`,
    })
    .from(usageFileResult)
    .leftJoin(project, eq(usageFileResult.projectId, project.id))
    .innerJoin(
      projectSnapshot,
      buildProjectDataJoin(
        runId,
        usageFileResult.projectId,
        usageFileResult.syncId,
      ),
    );

  if (sourceExclusion) {
    query = query.where(sourceExclusion);
  }
  if (fileSourceExclusion) {
    fileQuery = fileQuery.where(fileSourceExclusion);
  }

  const rows = await query
    .groupBy(
      usageResult.targetKey,
      usageResult.subTargetKey,
      usageResult.queryKey,
    )
    .orderBy(desc(sql`sum(${usageResult.matchCount})`));

  const fileRows = await fileQuery.groupBy(
    usageFileResult.targetKey,
    usageFileResult.subTargetKey,
    usageFileResult.queryKey,
  );
  const fileCountMap = new Map<string, number>();
  for (const row of fileRows) {
    fileCountMap.set(
      buildUsageKey(row.targetKey, row.subTargetKey, row.queryKey),
      row.fileCount,
    );
  }

  return rows.map((row) => ({
    ...row,
    fileCount:
      fileCountMap.get(
        buildUsageKey(row.targetKey, row.subTargetKey, row.queryKey),
      ) ?? 0,
  }));
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
  const fileSourceExclusion = buildSourceProjectExclusion(
    usageFileResult.targetKey,
    project.pathWithNamespace,
  );
  let query = db
    .select({
      targetKey: usageResult.targetKey,
      matchCount: sql<number>`sum(${usageResult.matchCount})`,
      projectCount: sql<number>`count(distinct ${usageResult.projectId})`,
    })
    .from(usageResult)
    .leftJoin(project, eq(usageResult.projectId, project.id))
    .innerJoin(
      projectSnapshot,
      buildProjectDataJoin(
        runId,
        usageResult.projectId,
        usageResult.syncId,
      ),
    );
  let fileQuery = db
    .select({
      targetKey: usageFileResult.targetKey,
      fileCount: sql<number>`count(distinct ${usageFileResult.projectId} || '::' || ${usageFileResult.filePath})`,
    })
    .from(usageFileResult)
    .leftJoin(project, eq(usageFileResult.projectId, project.id))
    .innerJoin(
      projectSnapshot,
      buildProjectDataJoin(
        runId,
        usageFileResult.projectId,
        usageFileResult.syncId,
      ),
    );

  if (sourceExclusion) {
    query = query.where(sourceExclusion);
  }
  if (fileSourceExclusion) {
    fileQuery = fileQuery.where(fileSourceExclusion);
  }

  const rows = await query
    .groupBy(usageResult.targetKey)
    .orderBy(desc(sql`sum(${usageResult.matchCount})`));

  const fileRows = await fileQuery.groupBy(usageFileResult.targetKey);
  const fileCountMap = new Map<string, number>();
  for (const row of fileRows) {
    fileCountMap.set(row.targetKey, row.fileCount);
  }

  return rows.map((row) => ({
    targetKey: row.targetKey,
    targetTitle: getTargetTitle(row.targetKey),
    matchCount: row.matchCount,
    projectCount: row.projectCount,
    fileCount: fileCountMap.get(row.targetKey) ?? 0,
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
        eq(usageResult.targetKey, targetKey),
        exclusion,
      )
    : eq(usageResult.targetKey, targetKey);
  const fileExclusion = exclusion
    ? and(
        eq(usageFileResult.targetKey, targetKey),
        exclusion,
      )
    : eq(usageFileResult.targetKey, targetKey);

  const rows = await db
    .select({
      subTargetKey: usageResult.subTargetKey,
      queryKey: usageResult.queryKey,
      matchCount: sql<number>`sum(${usageResult.matchCount})`,
      projectCount: sql<number>`count(distinct ${usageResult.projectId})`,
    })
    .from(usageResult)
    .leftJoin(project, eq(usageResult.projectId, project.id))
    .innerJoin(
      projectSnapshot,
      buildProjectDataJoin(
        runId,
        usageResult.projectId,
        usageResult.syncId,
      ),
    )
    .where(whereClause)
    .groupBy(usageResult.subTargetKey, usageResult.queryKey)
    .orderBy(asc(usageResult.subTargetKey), asc(usageResult.queryKey));

  const fileRows = await db
    .select({
      subTargetKey: usageFileResult.subTargetKey,
      queryKey: usageFileResult.queryKey,
      fileCount: sql<number>`count(distinct ${usageFileResult.projectId} || '::' || ${usageFileResult.filePath})`,
    })
    .from(usageFileResult)
    .leftJoin(project, eq(usageFileResult.projectId, project.id))
    .innerJoin(
      projectSnapshot,
      buildProjectDataJoin(
        runId,
        usageFileResult.projectId,
        usageFileResult.syncId,
      ),
    )
    .where(fileExclusion)
    .groupBy(usageFileResult.subTargetKey, usageFileResult.queryKey);
  const fileCountMap = new Map<string, number>();
  for (const row of fileRows) {
    const normalizedSubTargetKey = row.subTargetKey ?? "unknown";
    fileCountMap.set(
      buildUsageKey(targetKey, normalizedSubTargetKey, row.queryKey),
      row.fileCount,
    );
  }

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
        fileCount: number;
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
      fileCount:
        fileCountMap.get(buildUsageKey(targetKey, subTargetKey, row.queryKey)) ??
        0,
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
        eq(usageResult.targetKey, targetKey),
        eq(usageResult.subTargetKey, subTargetKey),
        exclusion,
      )
    : and(
        eq(usageResult.targetKey, targetKey),
        eq(usageResult.subTargetKey, subTargetKey),
      );
  const fileWhereClause = exclusion
    ? and(
        eq(usageFileResult.targetKey, targetKey),
        eq(usageFileResult.subTargetKey, subTargetKey),
        exclusion,
      )
    : and(
        eq(usageFileResult.targetKey, targetKey),
        eq(usageFileResult.subTargetKey, subTargetKey),
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
    .innerJoin(
      projectSnapshot,
      buildProjectDataJoin(
        runId,
        usageResult.projectId,
        usageResult.syncId,
      ),
    )
    .where(whereClause)
    .groupBy(usageResult.queryKey, project.id, project.name, project.pathWithNamespace)
    .orderBy(asc(usageResult.queryKey), asc(project.name));

  const fileRows = await db
    .select({
      queryKey: usageFileResult.queryKey,
      projectId: project.id,
      fileCount: sql<number>`count(distinct ${usageFileResult.filePath})`,
    })
    .from(usageFileResult)
    .leftJoin(project, eq(usageFileResult.projectId, project.id))
    .innerJoin(
      projectSnapshot,
      buildProjectDataJoin(
        runId,
        usageFileResult.projectId,
        usageFileResult.syncId,
      ),
    )
    .where(fileWhereClause)
    .groupBy(usageFileResult.queryKey, project.id);

  const fileCountByQueryProject = new Map<string, number>();
  const fileCountByQuery = new Map<string, number>();
  for (const row of fileRows) {
    if (!row.projectId) {
      continue;
    }
    const key = `${row.queryKey}::${row.projectId}`;
    fileCountByQueryProject.set(key, row.fileCount);
    fileCountByQuery.set(
      row.queryKey,
      (fileCountByQuery.get(row.queryKey) ?? 0) + row.fileCount,
    );
  }

  const queryMap = new Map<
    string,
    {
      queryKey: string;
      queryKeyTitle: string;
      matchCount: number;
      projectCount: number;
      fileCount: number;
      projects: Array<{
        projectId: number;
        projectName: string;
        projectPath: string;
        matchCount: number;
        fileCount: number;
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
        fileCount: 0,
        projects: [],
      };

    if (row.projectId) {
      const fileCount =
        fileCountByQueryProject.get(`${row.queryKey}::${row.projectId}`) ??
        0;
      entry.projects.push({
        projectId: row.projectId,
        projectName: row.projectName ?? "Unknown",
        projectPath: row.projectPath ?? "",
        matchCount: row.matchCount,
        fileCount,
      });
      entry.projectCount += 1;
      entry.matchCount += row.matchCount;
    }

    if (!queryMap.has(row.queryKey)) {
      queryMap.set(row.queryKey, entry);
    }
  }

  for (const entry of queryMap.values()) {
    entry.fileCount = fileCountByQuery.get(entry.queryKey) ?? 0;
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
        eq(usageFileResult.queryKey, queryKey),
        exclusion,
      )
    : eq(usageFileResult.queryKey, queryKey);

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
    .innerJoin(
      projectSnapshot,
      buildProjectDataJoin(
        runId,
        usageFileResult.projectId,
        usageFileResult.syncId,
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
