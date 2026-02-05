import "dotenv/config";
import { desc, eq } from "drizzle-orm";
import * as yarnLockfile from "@yarnpkg/lockfile";
import { parse as parseYaml } from "yaml";
import { db, sqlite } from "../db/client";
import {
  dependency,
  fileKinds,
  gitlabGroup,
  lockDependencySnapshot,
  packageSnapshot,
  project,
  projectDependencySnapshot,
  projectFileSnapshot,
  projectMemberSnapshot,
  projectSnapshot,
  syncRun,
  usageResult,
  usageFileResult,
} from "../db/schema";
import {
  fetchAllPages,
  fetchJson,
  getGitLabConfig,
  type GitLabCommitResponse,
  type GitLabGroupResponse,
  type GitLabProjectResponse,
  createRateLimiter,
  type RateLimiter,
} from "../lib/gitlab";
import { Throttler } from "../lib/throttle";
import { usageQueries, usageTargets } from "../lib/usage-queries";

type SyncRunStatus = "started" | "completed" | "failed" | "partial";

type GitLabTreeEntry = {
  path: string;
  type: "blob" | "tree";
};

type GitLabSearchBlobResponse = {
  project_id?: number;
  path?: string;
  filename?: string;
};

type GitLabFileResponse = {
  file_path: string;
  encoding: string;
  content: string;
  blob_id?: string;
};

type GitLabProjectMemberResponse = {
  id: number;
  username: string;
  name: string;
  state?: string | null;
  access_level?: number | null;
};

type ParsedPackage = {
  path: string;
  raw: string;
  json: Record<string, unknown> | null;
};

type ParsedLockfile = {
  path: string;
  raw: string;
  json: Record<string, unknown> | null;
  blobSha?: string;
  kind?: (typeof fileKinds)[number];
  parsed?: {
    yarnSelectorMap?: Map<string, string>;
    pnpmImporterMap?: Map<string, Map<string, string>>;
  };
};

type DependencyEntry = {
  name: string;
  versionSpec: string;
  depType: "prod" | "dev" | "peer" | "optional";
};

const lockfileNames = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
] as const;

const MINIMUM_MEMBER_ACCESS_LEVEL = 30;
const MEMBER_ACTIVE_STATE = "active";

const zoektLockfileSearchQuery =
  "file:(package-lock\\.json|npm-shrinkwrap\\.json|yarn\\.lock|pnpm-lock\\.yaml|bun\\.lockb?|deno\\.lock) -file:node_modules";
const zoektRootPackageJsonSearchQuery =
  "file:^package.json$ -file:node_modules";
const usageSearchExcludeFile = "-file:node_modules";
const blobSearchType = "zoekt";

const buildUsageSearchQuery = (searchText: string, extensions: string[]) => {
  const extPattern = extensions.map((ext) => ext.toLowerCase()).join("|");
  const fileFilter = extPattern ? `file:\\.(${extPattern})$` : "";
  return `${searchText} ${fileFilter} ${usageSearchExcludeFile}`.trim();
};

const lockfileKindMap: Record<string, (typeof fileKinds)[number]> = {
  "package-lock.json": "package_lock",
  "pnpm-lock.yaml": "pnpm_lock",
  "yarn.lock": "yarn_lock",
  "bun.lock": "bun_lock",
  "bun.lockb": "bun_lockb",
};

const decodeBase64 = (value: string) =>
  Buffer.from(value, "base64").toString("utf8");

const parseJson = (raw: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const getDirname = (path: string) => {
  const parts = path.split("/");
  if (parts.length <= 1) {
    return "";
  }
  parts.pop();
  return parts.join("/");
};

const isNodeModulesPath = (path: string) =>
  path.split("/").includes("node_modules");

const isRootPath = (path: string) => !path.includes("/");

const isNotFoundError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const status = (error as { status?: number }).status;
  return status === 404;
};

const isBlobSearchUnsupported = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const status = (error as { status?: number }).status;
  if (status !== 400) {
    return false;
  }
  const body = (error as { body?: string }).body;
  if (typeof body !== "string") {
    return false;
  }
  const normalized = body.toLowerCase();
  return (
    normalized.includes("scope supported only with advanced search") ||
    normalized.includes("exact code search") ||
    normalized.includes("search_type") ||
    normalized.includes("zoekt")
  );
};

const resolveLockfileCandidates = (
  packagePath: string,
  lockfilePaths: Set<string>,
): string[] => {
  const dir = getDirname(packagePath);
  const candidates: string[] = [];
  for (const lockfileName of lockfileNames) {
    const directPath = dir ? `${dir}/${lockfileName}` : lockfileName;
    if (lockfilePaths.has(directPath)) {
      candidates.push(directPath);
    }
  }
  for (const lockfileName of lockfileNames) {
    if (lockfilePaths.has(lockfileName)) {
      if (!candidates.includes(lockfileName)) {
        candidates.push(lockfileName);
      }
    }
  }
  return candidates;
};

const buildPackageJsonPathsFromLockfiles = (
  lockfilePaths: Set<string>,
  existingPackageJsonPaths?: Set<string>,
) => {
  const dirs = new Set<string>();
  for (const lockfilePath of lockfilePaths) {
    dirs.add(getDirname(lockfilePath));
  }
  const candidates = new Set<string>();
  for (const dir of dirs) {
    candidates.add(dir ? `${dir}/package.json` : "package.json");
  }
  let result = Array.from(candidates);
  if (existingPackageJsonPaths) {
    result = result.filter((path) => existingPackageJsonPaths.has(path));
  }
  return result;
};

const extractDependencies = (
  pkg: Record<string, unknown> | null,
): DependencyEntry[] => {
  if (!pkg) {
    return [];
  }

  const entries: DependencyEntry[] = [];
  const addEntries = (
    deps: Record<string, string> | undefined,
    depType: DependencyEntry["depType"],
  ) => {
    if (!deps) {
      return;
    }
    for (const [name, versionSpec] of Object.entries(deps)) {
      if (!versionSpec) {
        continue;
      }
      entries.push({ name, versionSpec, depType });
    }
  };

  addEntries(pkg.dependencies as Record<string, string> | undefined, "prod");
  addEntries(pkg.devDependencies as Record<string, string> | undefined, "dev");
  addEntries(
    pkg.peerDependencies as Record<string, string> | undefined,
    "peer",
  );
  addEntries(
    pkg.optionalDependencies as Record<string, string> | undefined,
    "optional",
  );

  return entries;
};

const resolveJsonLockfileVersion = (
  lockfile: Record<string, unknown> | null,
  depName: string,
): string | null => {
  if (!lockfile) {
    return null;
  }

  const packages = lockfile.packages as
    | Record<string, { version?: string }>
    | undefined;

  if (packages) {
    const nodeKey = `node_modules/${depName}`;
    const entry = packages[nodeKey];
    if (entry?.version) {
      return entry.version;
    }
  }

  const deps = lockfile.dependencies as
    | Record<string, { version?: string }>
    | undefined;

  if (deps?.[depName]?.version) {
    return deps[depName].version ?? null;
  }

  return null;
};

const normalizePnpmImporterValue = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }
  if (value && typeof value === "object") {
    const maybeVersion = (value as { version?: unknown }).version;
    if (typeof maybeVersion === "string") {
      return maybeVersion;
    }
    const maybeSpecifier = (value as { specifier?: unknown }).specifier;
    if (typeof maybeSpecifier === "string") {
      return maybeSpecifier;
    }
  }
  return null;
};

const parsePnpmImporterMap = (raw: string) => {
  try {
    const data = parseYaml(raw) as {
      importers?: Record<
        string,
        {
          dependencies?: Record<string, unknown>;
          devDependencies?: Record<string, unknown>;
          optionalDependencies?: Record<string, unknown>;
          peerDependencies?: Record<string, unknown>;
        }
      >;
    };
    const importers = data.importers ?? {};
    const map = new Map<string, Map<string, string>>();
    for (const [importerKey, importer] of Object.entries(importers)) {
      const deps = {
        ...(importer.dependencies ?? {}),
        ...(importer.devDependencies ?? {}),
        ...(importer.optionalDependencies ?? {}),
        ...(importer.peerDependencies ?? {}),
      };
      const depMap = new Map<string, string>();
      for (const [name, version] of Object.entries(deps)) {
        const normalized = normalizePnpmImporterValue(version);
        if (!normalized) {
          continue;
        }
        depMap.set(name, normalized);
      }
      map.set(importerKey, depMap);
    }
    return map;
  } catch {
    return new Map<string, Map<string, string>>();
  }
};

const parseYarnSelectorMap = (raw: string) => {
  const parsed = yarnLockfile.parse(raw);
  if (parsed.type !== "success") {
    return new Map<string, string>();
  }
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(parsed.object ?? {})) {
    if (!value || typeof value !== "object") {
      continue;
    }
    const version = (value as { version?: string }).version;
    if (!version) {
      continue;
    }
    const selectors = key
      .split(/,\s*/)
      .map((selector) => selector.trim().replace(/^"|"$/g, ""));
    for (const selector of selectors) {
      map.set(selector, version);
    }
  }
  return map;
};

const extractPnpmVersion = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  if (
    value.startsWith("link:") ||
    value.startsWith("workspace:") ||
    value.startsWith("file:")
  ) {
    return null;
  }
  const match = value.match(/^([^\s()]+)/);
  return match ? match[1] : null;
};

const resolveLockedVersion = (
  lockfile: ParsedLockfile | null,
  depName: string,
  versionSpec: string,
  packagePath: string,
) => {
  if (!lockfile) {
    return null;
  }

  switch (lockfile.kind) {
    case "package_lock":
    case "bun_lock":
      return resolveJsonLockfileVersion(lockfile.json, depName);
    case "yarn_lock": {
      const map = lockfile.parsed?.yarnSelectorMap;
      if (!map) {
        return null;
      }
      return map.get(`${depName}@${versionSpec}`) ?? null;
    }
    case "pnpm_lock": {
      const importerKey = getDirname(packagePath) || ".";
      const importerMap = lockfile.parsed?.pnpmImporterMap;
      const deps = importerMap?.get(importerKey);
      if (!deps) {
        return null;
      }
      const value = deps.get(depName);
      return value ? extractPnpmVersion(value) : null;
    }
    default:
      return null;
  }
};

const getLockfileCommitDate = async (
  config: ReturnType<typeof getGitLabConfig>,
  throttler: Throttler,
  rateLimiter: RateLimiter,
  projectId: number,
  ref: string | null,
  filePath: string,
  cache: Map<string, Date | null>,
) => {
  const cacheKey = `${projectId}:${ref ?? "default"}:${filePath}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  if (!ref) {
    cache.set(cacheKey, null);
    return null;
  }
  const { data } = await fetchJson<GitLabCommitResponse[]>(
    config,
    throttler,
    rateLimiter,
    `/projects/${projectId}/repository/commits?path=${encodeURIComponent(
      filePath,
    )}&ref_name=${encodeURIComponent(ref)}&per_page=1`,
  );
  const commit = data[0];
  const dateValue = commit?.committed_date ?? commit?.created_at;
  const date = dateValue ? new Date(dateValue) : null;
  cache.set(cacheKey, date);
  return date;
};

const selectLatestLockfilePath = async (
  config: ReturnType<typeof getGitLabConfig>,
  throttler: Throttler,
  rateLimiter: RateLimiter,
  projectId: number,
  ref: string | null,
  candidates: string[],
  cache: Map<string, Date | null>,
) => {
  if (candidates.length === 0) {
    return null;
  }
  if (candidates.length === 1) {
    return candidates[0];
  }
  let bestPath = candidates[0];
  let bestDate = await getLockfileCommitDate(
    config,
    throttler,
    rateLimiter,
    projectId,
    ref,
    bestPath,
    cache,
  );
  for (const path of candidates.slice(1)) {
    const date = await getLockfileCommitDate(
      config,
      throttler,
      rateLimiter,
      projectId,
      ref,
      path,
      cache,
    );
    if (date && (!bestDate || date > bestDate)) {
      bestDate = date;
      bestPath = path;
    }
  }
  return bestPath;
};

const stripVersionSpec = (versionSpec: string) => {
  const raw = versionSpec.trim();
  if (!raw) {
    return null;
  }
  if (
    raw.startsWith("workspace:") ||
    raw.startsWith("link:") ||
    raw.startsWith("file:") ||
    raw.startsWith("git+") ||
    raw.startsWith("http")
  ) {
    return null;
  }
  const first = raw.split("||")[0]?.trim() ?? raw;
  const cleaned = first.replace(/^[~^=<>v]+/, "");
  const match = cleaned.match(/[0-9]+(\.[0-9]+){0,2}(-[0-9A-Za-z.-]+)?/);
  return match ? match[0] : cleaned || null;
};

const toRegex = (query: (typeof usageQueries)[number]) => {
  const pattern = query.regex?.trim();
  if (!pattern) {
    return null;
  }
  const flags = query.flags
    ? query.flags.includes("g")
      ? query.flags
      : `${query.flags}g`
    : "g";
  return new RegExp(pattern, flags);
};

const countMatches = (regex: RegExp, text: string) => {
  let count = 0;
  regex.lastIndex = 0;
  let match = regex.exec(text);
  while (match) {
    count += 1;
    if (match[0] === "") {
      regex.lastIndex += 1;
    }
    match = regex.exec(text);
  }
  return count;
};

const getExtension = (path: string) => {
  const lower = path.toLowerCase();
  const idx = lower.lastIndexOf(".");
  if (idx === -1) {
    return "";
  }
  return lower.slice(idx + 1);
};

const normalizeGroupPath = (path: string) =>
  path.trim().replace(/^\/+|\/+$/g, "").toLowerCase();

const isPathMatch = (candidate: string, target: string) =>
  candidate === target || candidate.startsWith(`${target}/`);

const buildGroupFilter = (includePaths: string[], excludePaths: string[]) => {
  const includes = includePaths
    .map(normalizeGroupPath)
    .filter((value) => value.length > 0);
  const excludes = excludePaths
    .map(normalizeGroupPath)
    .filter((value) => value.length > 0);

  const isIncluded = (path: string) => {
    const normalized = normalizeGroupPath(path);
    const inScope =
      includes.length === 0 ||
      includes.some((includePath) => isPathMatch(normalized, includePath));
    if (!inScope) {
      return false;
    }
    return !excludes.some((excludePath) =>
      isPathMatch(normalized, excludePath),
    );
  };

  return { includes, excludes, isIncluded };
};

const selectRootGroups = (groups: GitLabGroupResponse[]) => {
  const normalizedPaths = groups.map((group) =>
    normalizeGroupPath(group.full_path),
  );
  return groups.filter((group, idx) => {
    const normalized = normalizedPaths[idx];
    return !normalizedPaths.some(
      (other, otherIdx) =>
        otherIdx !== idx && isPathMatch(normalized, other),
    );
  });
};

const buildGroupMap = async () => {
  const rows = await db
    .select({
      id: gitlabGroup.id,
      gitlabId: gitlabGroup.gitlabId,
    })
    .from(gitlabGroup);
  const map = new Map<number, number>();
  for (const row of rows) {
    map.set(row.gitlabId, row.id);
  }
  return map;
};

const ensureGroup = async (
  groupInfo: GitLabGroupResponse,
  groupMap: Map<number, number>,
  parentGroupId?: number | null,
) => {
  const existingId = groupMap.get(groupInfo.id);
  if (existingId) {
    await db
      .update(gitlabGroup)
      .set({
        path: groupInfo.full_path,
        name: groupInfo.name,
        webUrl: groupInfo.web_url ?? null,
        parentGroupId: parentGroupId ?? null,
      })
      .where(eq(gitlabGroup.id, existingId));
    return existingId;
  }

  await db.insert(gitlabGroup).values({
    gitlabId: groupInfo.id,
    parentGroupId: parentGroupId ?? null,
    path: groupInfo.full_path,
    name: groupInfo.name,
    webUrl: groupInfo.web_url ?? null,
  });

  const row = sqlite.query("select last_insert_rowid() as id").get() as {
    id: number;
  };
  groupMap.set(groupInfo.id, row.id);
  return row.id;
};

const buildProjectMap = async () => {
  const rows = await db
    .select({
      id: project.id,
      gitlabId: project.gitlabId,
    })
    .from(project);

  const map = new Map<number, number>();
  for (const row of rows) {
    map.set(row.gitlabId, row.id);
  }
  return map;
};

const ensureProject = async (
  groupId: number,
  projectInfo: GitLabProjectResponse,
  projectMap: Map<number, number>,
) => {
  const existingId = projectMap.get(projectInfo.id);
  if (existingId) {
    await db
      .update(project)
      .set({
        pathWithNamespace: projectInfo.path_with_namespace,
        name: projectInfo.name,
        groupId,
      })
      .where(eq(project.id, existingId));
    return existingId;
  }

  await db.insert(project).values({
    gitlabId: projectInfo.id,
    groupId,
    pathWithNamespace: projectInfo.path_with_namespace,
    name: projectInfo.name,
  });

  const row = sqlite.query("select last_insert_rowid() as id").get() as {
    id: number;
  };
  projectMap.set(projectInfo.id, row.id);
  return row.id;
};

const fetchLatestCommit = async (
  config: ReturnType<typeof getGitLabConfig>,
  throttler: Throttler,
  rateLimiter: RateLimiter,
  projectId: number,
  ref: string | null,
): Promise<GitLabCommitResponse | null> => {
  if (!ref) {
    return null;
  }

  const { data } = await fetchJson<GitLabCommitResponse[]>(
    config,
    throttler,
    rateLimiter,
    `/projects/${projectId}/repository/commits?ref_name=${encodeURIComponent(ref)}&per_page=1`,
  );

  return data[0] ?? null;
};

const fetchProjectMembers = async (
  config: ReturnType<typeof getGitLabConfig>,
  throttler: Throttler,
  rateLimiter: RateLimiter,
  projectId: number,
) =>
  fetchAllPages<GitLabProjectMemberResponse>(
    config,
    throttler,
    rateLimiter,
    `/projects/${projectId}/members`,
  );


const loadPreviousSnapshot = async (projectId: number) => {
  const rows = await db
    .select({
      syncId: projectSnapshot.syncId,
      latestCommitSha: projectSnapshot.latestCommitSha,
      dataSourceSyncId: projectSnapshot.dataSourceSyncId,
    })
    .from(projectSnapshot)
    .where(eq(projectSnapshot.projectId, projectId))
    .orderBy(desc(projectSnapshot.syncId))
    .limit(1);

  return rows[0];
};

const loadDependencyMap = async () => {
  const rows = await db
    .select({ id: dependency.id, name: dependency.name })
    .from(dependency);
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.name, row.id);
  }
  return map;
};

const parseDependencyName = (name: string) => {
  if (name.startsWith("@")) {
    const [scope, shortName] = name.split("/");
    return {
      scope: scope ?? null,
      shortName: shortName ?? name,
    };
  }
  return { scope: null, shortName: name };
};

const getDependencyId = async (
  name: string,
  dependencyMap: Map<string, number>,
) => {
  const existing = dependencyMap.get(name);
  if (existing) {
    return existing;
  }

  const { scope, shortName } = parseDependencyName(name);
  await db.insert(dependency).values({
    name,
    scope,
    shortName,
  });

  const row = sqlite.query("select last_insert_rowid() as id").get() as {
    id: number;
  };
  dependencyMap.set(name, row.id);
  return row.id;
};

const fetchRepositoryTree = async (
  config: ReturnType<typeof getGitLabConfig>,
  throttler: Throttler,
  rateLimiter: RateLimiter,
  projectId: number,
  ref: string | null,
) => {
  if (!ref) {
    return [];
  }
  return fetchAllPages<GitLabTreeEntry>(
    config,
    throttler,
    rateLimiter,
    `/projects/${projectId}/repository/tree?ref=${encodeURIComponent(ref)}&recursive=true`,
  );
};

const fetchFile = async (
  config: ReturnType<typeof getGitLabConfig>,
  throttler: Throttler,
  rateLimiter: RateLimiter,
  projectId: number,
  ref: string | null,
  filePath: string,
): Promise<ParsedPackage & { blobSha?: string }> => {
  if (!ref) {
    return { path: filePath, raw: "", json: null };
  }
  const encodedPath = encodeURIComponent(filePath);
  const { data } = await fetchJson<GitLabFileResponse>(
    config,
    throttler,
    rateLimiter,
    `/projects/${projectId}/repository/files/${encodedPath}?ref=${encodeURIComponent(ref)}`,
  );
  const isBinaryLock = filePath.endsWith(".lockb");
  const raw =
    data.encoding === "base64"
      ? isBinaryLock
        ? data.content
        : decodeBase64(data.content)
      : "";
  const json = raw && !isBinaryLock ? parseJson(raw) : null;
  return {
    path: filePath,
    raw,
    json,
    blobSha: data.blob_id,
  };
};

const storeProjectFile = async (
  projectId: number,
  syncId: number,
  file: ParsedPackage,
  kind: (typeof fileKinds)[number],
  ref: string | null,
  blobSha?: string,
) => {
  await db.insert(projectFileSnapshot).values({
    projectId,
    syncId,
    path: file.path,
    ref,
    blobSha: blobSha ?? null,
    kind,
    contentJson: file.json,
    contentRaw: file.raw,
    fetchedAt: new Date(),
  });
};

const createSyncRun = async (note?: string): Promise<number> => {
  await db.insert(syncRun).values({
    source: "gitlab",
    status: "started",
    note,
  });

  const row = sqlite.query("select last_insert_rowid() as id").get() as {
    id: number;
  };

  return row.id;
};

const updateSyncRun = async (runId: number, status: SyncRunStatus) => {
  await db
    .update(syncRun)
    .set({
      status,
      completedAt: status === "started" ? undefined : new Date(),
    })
    .where(eq(syncRun.id, runId));
};

const runSync = async () => {
  const runStartedAt = Date.now();
  const forceResync =
    process.argv.includes("--force") || process.env.SYNC_FORCE === "1";
  const verboseEnabled =
    process.argv.includes("--verbose") || process.env.SYNC_VERBOSE === "1";
  const debugEnabled = process.env.SYNC_DEBUG === "1" || verboseEnabled;
  const scanLogInterval = verboseEnabled ? 10 : 100;
  const timestamp = () =>
    new Date().toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  const logInfo = (message: string, ...args: unknown[]) => {
    console.log(`[${timestamp()}] ${message}`, ...args);
  };
  const logWarn = (message: string, ...args: unknown[]) => {
    console.warn(`[${timestamp()}] ${message}`, ...args);
  };
  const logError = (message: string, ...args: unknown[]) => {
    console.error(`[${timestamp()}] ${message}`, ...args);
  };
  const debug = (...args: string[]) => {
    if (debugEnabled) {
      logInfo(...args);
    }
  };
  const pageLogInterval = verboseEnabled ? 1 : debugEnabled ? 5 : 0;
  const buildPageLogOptions = (label: string) =>
    pageLogInterval > 0
      ? { label, log: debug, logEveryPages: pageLogInterval }
      : undefined;
  const forceLabel = forceResync ? " (force)" : "";
  const startDate = new Date(runStartedAt);
  logInfo(
    `[sync] start${forceLabel} ${startDate.toLocaleDateString()} UTC ${startDate.toISOString()}`,
  );
  const config = getGitLabConfig();
  const throttler = new Throttler({
    concurrency: config.concurrency,
    minDelayMs: config.delayMs,
  });
  const rateLimiter = createRateLimiter();
  const runId = await createSyncRun("manual run");
  const dependencyMap = await loadDependencyMap();
  let hadErrors = false;

  try {
    const groupMap = await buildGroupMap();
    const groupGitlabIdByRow = new Map<number, number>();
    for (const [gitlabId, rowId] of groupMap.entries()) {
      groupGitlabIdByRow.set(rowId, gitlabId);
    }
    const samlLinksFetched = new Set<number>();
    const samlLinksFailed = new Set<number>();
    const groupFilter = buildGroupFilter(
      config.groupIncludePaths,
      config.groupExcludePaths,
    );
    if (groupFilter.includes.length > 0) {
      logInfo(
        `[sync] group include scope: ${groupFilter.includes.join(", ")}`,
      );
    }
    if (groupFilter.excludes.length > 0) {
      logInfo(
        `[sync] group exclude scope: ${groupFilter.excludes.join(", ")}`,
      );
    }

    const isTopLevelIncluded = (path: string) => {
      const normalized = normalizeGroupPath(path);
      if (
        groupFilter.excludes.some((excludePath) =>
          isPathMatch(normalized, excludePath),
        )
      ) {
        return false;
      }
      if (groupFilter.includes.length === 0) {
        return true;
      }
      return groupFilter.includes.some((includePath) =>
        isPathMatch(includePath, normalized),
      );
    };

    const loadGroupContext = async (topLevelOnly: boolean) => {
      const groupPath = topLevelOnly
        ? "/groups?top_level_only=true"
        : "/groups";
      const groupLogLabel = topLevelOnly ? "groups (top-level)" : "groups";
      const discoveredGroups = await fetchAllPages<GitLabGroupResponse>(
        config,
        throttler,
        rateLimiter,
        groupPath,
        buildPageLogOptions(groupLogLabel),
      );
      const groupById = new Map<number, GitLabGroupResponse>();
      for (const group of discoveredGroups) {
        groupById.set(group.id, group);
      }
      const groupByPath = new Map<string, GitLabGroupResponse>();
      for (const group of groupById.values()) {
        groupByPath.set(normalizeGroupPath(group.full_path), group);
      }

      for (const includePath of config.groupIncludePaths) {
        const normalizedInclude = normalizeGroupPath(includePath);
        if (groupByPath.has(normalizedInclude)) {
          continue;
        }
        try {
          const { data: groupInfo } = await fetchJson<GitLabGroupResponse>(
            config,
            throttler,
            rateLimiter,
            `/groups/${encodeURIComponent(includePath)}`,
          );
          if (!groupById.has(groupInfo.id)) {
            groupById.set(groupInfo.id, groupInfo);
            groupByPath.set(
              normalizeGroupPath(groupInfo.full_path),
              groupInfo,
            );
          }
        } catch (error) {
          logWarn(`[sync] unable to resolve group ${includePath}:`, error);
        }
      }

      const allGroups = Array.from(groupById.values());
      const matchesScope = topLevelOnly
        ? isTopLevelIncluded
        : groupFilter.isIncluded;
      const scopedGroups = allGroups.filter((group) =>
        matchesScope(group.full_path),
      );
      const sortedGroups = [...scopedGroups].sort((left, right) => {
        const leftDepth = left.full_path.split("/").length;
        const rightDepth = right.full_path.split("/").length;
        if (leftDepth !== rightDepth) {
          return leftDepth - rightDepth;
        }
        return left.full_path.localeCompare(right.full_path);
      });

      for (const groupInfo of sortedGroups) {
        const parentGroupId = groupInfo.parent_id
          ? groupMap.get(groupInfo.parent_id) ?? null
          : null;
        const rowId = await ensureGroup(groupInfo, groupMap, parentGroupId);
        groupGitlabIdByRow.set(rowId, groupInfo.id);
      }

      if (scopedGroups.length === 0) {
        logWarn(
          "[sync] no groups matched the current scope; adjust include/exclude settings if needed",
        );
      }

      const rootGroups =
        scopedGroups.length > 0 ? selectRootGroups(scopedGroups) : [];
      if (rootGroups.length > 0) {
        logInfo(
          `[sync] discovered ${scopedGroups.length} groups (${rootGroups.length} root groups)`,
        );
      }

      return { groupById, groupByPath, scopedGroups, rootGroups };
    };

    let useZoektSearch = true;
    let groupContext = await loadGroupContext(true);
    let { rootGroups } = groupContext;
    const groupInfoCache = new Map<number, GitLabGroupResponse | null>();
    const groupRowCache = new Map<number, number | null>();

    const fetchGroupInfoById = async (groupId: number) => {
      if (groupInfoCache.has(groupId)) {
        return groupInfoCache.get(groupId) ?? null;
      }
      try {
        const { data } = await fetchJson<GitLabGroupResponse>(
          config,
          throttler,
          rateLimiter,
          `/groups/${groupId}`,
        );
        groupInfoCache.set(groupId, data);
        return data;
      } catch (error) {
        logWarn(`[sync] failed to load group ${groupId}`, error);
        groupInfoCache.set(groupId, null);
        return null;
      }
    };

    const ensureGroupChain = async (
      groupId: number,
      visited = new Set<number>(),
    ): Promise<number | null> => {
      if (groupRowCache.has(groupId)) {
        return groupRowCache.get(groupId) ?? null;
      }
      if (visited.has(groupId)) {
        return groupMap.get(groupId) ?? null;
      }
      visited.add(groupId);
      const groupInfo = await fetchGroupInfoById(groupId);
      if (!groupInfo) {
        groupRowCache.set(groupId, null);
        return null;
      }
      const parentRowId = groupInfo.parent_id
        ? await ensureGroupChain(groupInfo.parent_id, visited)
        : null;
      const rowId = await ensureGroup(groupInfo, groupMap, parentRowId);
      groupGitlabIdByRow.set(rowId, groupInfo.id);
      groupRowCache.set(groupId, rowId);
      return rowId;
    };

    const searchQueries = [
      {
        label: "lockfile",
        query: zoektLockfileSearchQuery,
      },
      {
        label: "root package.json",
        query: zoektRootPackageJsonSearchQuery,
        acceptPath: (path: string) => path === "package.json" && isRootPath(path),
      },
    ] as const;
    const shouldIncludeProject = (projectInfo: GitLabProjectResponse) =>
      groupFilter.isIncluded(projectInfo.path_with_namespace);

    const projectMap = await buildProjectMap();
    const projectById = new Map<number, GitLabProjectResponse>();
    const projectFallbackGroup = new Map<number, number>();
    const projectFallbackGroupGitlabId = new Map<number, number>();
    const searchProjectIds = new Set<number>();
    const fallbackGroups = new Set<number>();
    const searchLockfilePathsByProject = new Map<number, Set<string>>();
    const searchPackageJsonPathsByProject = new Map<number, Set<string>>();
    const addSearchPath = (
      map: Map<number, Set<string>>,
      projectId: number,
      path: string,
    ) => {
      let paths = map.get(projectId);
      if (!paths) {
        paths = new Set<string>();
        map.set(projectId, paths);
      }
      paths.add(path);
    };
    let zoektFailed = false;

    if (useZoektSearch) {
      for (const groupInfo of rootGroups) {
        if (zoektFailed) {
          break;
        }
        for (const searchQuery of searchQueries) {
          if (zoektFailed) {
            break;
          }
          const searchPath = `/groups/${groupInfo.id}/search?scope=blobs&search=${encodeURIComponent(
            searchQuery.query,
          )}&search_type=${encodeURIComponent(blobSearchType)}`;
          try {
            const results = await fetchAllPages<GitLabSearchBlobResponse>(
              config,
              throttler,
              rateLimiter,
              searchPath,
              buildPageLogOptions(
                `search ${searchQuery.label} ${groupInfo.full_path}`,
              ),
            );
            for (const result of results) {
              if (!result.path) {
                continue;
              }
              if (isNodeModulesPath(result.path)) {
                continue;
              }
              if (
                "acceptPath" in searchQuery &&
                searchQuery.acceptPath &&
                !searchQuery.acceptPath(result.path)
              ) {
                continue;
              }
              if (typeof result.project_id === "number") {
                const projectId = result.project_id;
                if (searchQuery.label === "lockfile") {
                  searchProjectIds.add(projectId);
                  addSearchPath(
                    searchLockfilePathsByProject,
                    projectId,
                    result.path,
                  );
                } else if (searchQuery.label === "root package.json") {
                  const lockfiles =
                    searchLockfilePathsByProject.get(projectId) ?? null;
                  const hasRootLockfile =
                    lockfiles && Array.from(lockfiles).some(isRootPath);
                  if (!hasRootLockfile) {
                    continue;
                  }
                  searchProjectIds.add(projectId);
                  addSearchPath(
                    searchPackageJsonPathsByProject,
                    projectId,
                    result.path,
                  );
                }
              }
            }
          } catch (error) {
            zoektFailed = true;
            if (isBlobSearchUnsupported(error)) {
              logWarn(
                `[sync] zoekt search unavailable for group ${groupInfo.full_path} (${searchQuery.label}); falling back to basic search.`,
              );
            } else {
              logWarn(
                `[sync] zoekt search failed for group ${groupInfo.full_path} (${searchQuery.label})`,
                error,
              );
            }
          }
        }
      }
    }

    if (zoektFailed) {
      useZoektSearch = false;
      logWarn(
        "[sync] falling back to full group discovery and basic tree scanning.",
      );
      groupContext = await loadGroupContext(false);
      rootGroups = groupContext.rootGroups;
      searchProjectIds.clear();
      searchLockfilePathsByProject.clear();
      searchPackageJsonPathsByProject.clear();
      fallbackGroups.clear();
    }

    if (searchProjectIds.size === 0 && rootGroups.length > 0) {
      logWarn(
        "[sync] search returned no projects; falling back to group project listing (zoekt search may be unavailable)",
      );
      if (useZoektSearch) {
        useZoektSearch = false;
        groupContext = await loadGroupContext(false);
        rootGroups = groupContext.rootGroups;
        searchLockfilePathsByProject.clear();
        searchPackageJsonPathsByProject.clear();
      }
      for (const groupInfo of rootGroups) {
        fallbackGroups.add(groupInfo.id);
      }
    }

    if (fallbackGroups.size > 0) {
      logWarn(
        `[sync] falling back to group project listing for ${fallbackGroups.size} groups`,
      );
    }

    for (const groupInfo of rootGroups) {
      if (!fallbackGroups.has(groupInfo.id)) {
        continue;
      }
      const parentGroupId = groupInfo.parent_id
        ? groupMap.get(groupInfo.parent_id) ?? null
        : null;
      const groupRowId = await ensureGroup(
        groupInfo,
        groupMap,
        parentGroupId,
      );
      groupGitlabIdByRow.set(groupRowId, groupInfo.id);
      const groupProjects = await fetchAllPages<GitLabProjectResponse>(
        config,
        throttler,
        rateLimiter,
        `/groups/${groupInfo.id}/projects?include_subgroups=true`,
        buildPageLogOptions(`group ${groupInfo.full_path} projects`),
      );
      logInfo(
        `[sync] group "${groupInfo.full_path}" (${groupInfo.id}) - ${groupProjects.length} projects`,
      );
      for (const projectInfo of groupProjects) {
        if (!shouldIncludeProject(projectInfo)) {
          continue;
        }
        if (projectById.has(projectInfo.id)) {
          continue;
        }
        projectById.set(projectInfo.id, projectInfo);
        projectFallbackGroup.set(projectInfo.id, groupRowId);
        projectFallbackGroupGitlabId.set(projectInfo.id, groupInfo.id);
      }
    }

    if (searchProjectIds.size === 0 && fallbackGroups.size === 0) {
      logWarn("[sync] search returned no projects for the current scope");
    }

    const searchProjectList = Array.from(searchProjectIds);
    for (const [index, projectId] of searchProjectList.entries()) {
      if (projectById.has(projectId)) {
        continue;
      }
      if (debugEnabled && (index + 1) % scanLogInterval === 0) {
        debug(
          `[sync] fetched ${index + 1}/${searchProjectList.length} project records`,
        );
      }
      try {
        const { data: projectInfo } = await fetchJson<GitLabProjectResponse>(
          config,
          throttler,
          rateLimiter,
          `/projects/${projectId}`,
        );
        if (!shouldIncludeProject(projectInfo)) {
          continue;
        }
        projectById.set(projectInfo.id, projectInfo);
      } catch (error) {
        hadErrors = true;
        logWarn(`[sync] failed to load project ${projectId}`, error);
      }
    }

    const searchFallbackTriggered =
      searchProjectIds.size === 0 && rootGroups.length > 0;

    const projects = Array.from(projectById.values()).sort((left, right) =>
      left.path_with_namespace.localeCompare(right.path_with_namespace),
    );
    const totalProjects = projects.length;
    logInfo(`[sync] total projects in scope: ${totalProjects}`);

    const usageSearchMatches = new Map<
      string,
      Map<number, Map<string, number>>
    >();
    const usageSearchTargetsByProject = new Map<number, Set<string>>();
    const usageSearchFailures = new Set<string>();
    let usageSearchDisabled = false;
    const usageSearchableQueries = usageQueries
      .map((query) => ({
        ...query,
        zoektSearchText:
          query.searchQuery?.trim() ?? query.searchText?.trim() ?? "",
      }))
      .filter(
        (query) =>
          query.searchType === "zoekt" && query.zoektSearchText.length > 0,
      );

    for (const query of usageQueries) {
      if (query.searchType !== "zoekt") {
        continue;
      }
      const zoektText =
        query.searchQuery?.trim() ?? query.searchText?.trim() ?? "";
      if (!zoektText) {
        usageSearchFailures.add(query.queryKey);
      }
    }

    if (useZoektSearch && usageSearchableQueries.length > 0) {
      if (searchFallbackTriggered) {
        usageSearchDisabled = true;
        logWarn(
          "[sync] usage search disabled (search returned no projects); falling back to tree scans.",
        );
      }
      if (rootGroups.length === 0) {
        for (const query of usageSearchableQueries) {
          usageSearchFailures.add(query.queryKey);
        }
      } else {
        for (const query of usageSearchableQueries) {
          if (usageSearchDisabled) {
            break;
          }
          let queryHadError = false;
          const searchText = query.zoektSearchText?.trim();
          if (!searchText) {
            usageSearchFailures.add(query.queryKey);
            continue;
          }
          const extensions = query.extensions ?? [];
          const extensionSet = new Set(
            extensions.map((ext) => ext.toLowerCase()),
          );
          const searchQuery =
            query.searchQuery && query.searchQuery.trim().length > 0
              ? query.searchQuery.trim()
              : buildUsageSearchQuery(searchText, Array.from(extensionSet));
          for (const groupInfo of rootGroups) {
            if (usageSearchDisabled || queryHadError) {
              break;
            }
            const searchPath = `/groups/${groupInfo.id}/search?scope=blobs&search=${encodeURIComponent(
              searchQuery,
            )}&search_type=${encodeURIComponent(blobSearchType)}`;
            try {
              const results = await fetchAllPages<GitLabSearchBlobResponse>(
                config,
                throttler,
                rateLimiter,
                searchPath,
                buildPageLogOptions(
                  `usage ${query.queryKey} ${groupInfo.full_path}`,
                ),
              );
              for (const result of results) {
                if (!result.path) {
                  continue;
                }
                if (isNodeModulesPath(result.path)) {
                  continue;
                }
                if (extensionSet.size > 0) {
                  const ext = getExtension(result.path);
                  if (!extensionSet.has(ext)) {
                    continue;
                  }
                }
                if (typeof result.project_id !== "number") {
                  continue;
                }
                const projectId = result.project_id;
                const targetSet =
                  usageSearchTargetsByProject.get(projectId) ??
                  new Set<string>();
                targetSet.add(query.targetKey);
                usageSearchTargetsByProject.set(projectId, targetSet);
                let queryMap = usageSearchMatches.get(query.queryKey);
                if (!queryMap) {
                  queryMap = new Map<number, Map<string, number>>();
                  usageSearchMatches.set(query.queryKey, queryMap);
                }
                let fileMap = queryMap.get(projectId);
                if (!fileMap) {
                  fileMap = new Map<string, number>();
                  queryMap.set(projectId, fileMap);
                }
                fileMap.set(result.path, (fileMap.get(result.path) ?? 0) + 1);
              }
            } catch (error) {
              if (isBlobSearchUnsupported(error)) {
                usageSearchDisabled = true;
                useZoektSearch = false;
                logWarn(
                  "[sync] usage search disabled (zoekt not available); falling back to basic tree scans.",
                );
                break;
              }
              queryHadError = true;
              logWarn(
                `[sync] usage search failed for ${query.queryKey} (${groupInfo.full_path})`,
                error,
              );
            }
          }
          if (queryHadError) {
            usageSearchFailures.add(query.queryKey);
          }
        }
      }
    }

    if (usageSearchDisabled) {
      usageSearchMatches.clear();
      for (const query of usageSearchableQueries) {
        usageSearchFailures.add(query.queryKey);
      }
    }

    const normalizeSamlLinks = (
      links: NonNullable<GitLabGroupResponse["saml_group_links"]>,
    ) =>
      links
        .filter(
          (link) =>
            typeof link.name === "string" &&
            link.name.trim().length > 0 &&
            typeof link.access_level === "number",
        )
        .map((link) => ({
          name: link.name!.trim(),
          access_level: link.access_level!,
        }));

    const ensureGroupSamlLinks = async (
      gitlabGroupId: number | null,
      groupRowId: number,
    ) => {
      if (!gitlabGroupId) {
        return;
      }
      if (
        samlLinksFetched.has(gitlabGroupId) ||
        samlLinksFailed.has(gitlabGroupId)
      ) {
        return;
      }

      try {
        const groupInfo = await fetchGroupInfoById(gitlabGroupId);
        if (!groupInfo || !Array.isArray(groupInfo.saml_group_links)) {
          samlLinksFetched.add(gitlabGroupId);
          return;
        }
        const normalized = normalizeSamlLinks(groupInfo.saml_group_links);
        if (normalized.length === 0) {
          samlLinksFetched.add(gitlabGroupId);
          return;
        }
        await db
          .update(gitlabGroup)
          .set({
            samlGroupLinksJson: normalized,
          })
          .where(eq(gitlabGroup.id, groupRowId));
        samlLinksFetched.add(gitlabGroupId);
      } catch (error) {
        samlLinksFailed.add(gitlabGroupId);
        logWarn(
          `[sync] failed to load saml group links for group ${gitlabGroupId}`,
          error,
        );
      }
    };

    const syncProjectMembers = async (
      projectId: number,
      gitlabProjectId: number,
      projectLabel: string,
    ) => {
      try {
        const members = await fetchProjectMembers(
          config,
          throttler,
          rateLimiter,
          gitlabProjectId,
        );
        const filteredMembers = members.filter((member) => {
          const accessLevel = member.access_level ?? 0;
          const state = member.state ?? "";
          return (
            accessLevel >= MINIMUM_MEMBER_ACCESS_LEVEL &&
            state === MEMBER_ACTIVE_STATE
          );
        });

        await db
          .delete(projectMemberSnapshot)
          .where(eq(projectMemberSnapshot.projectId, projectId));

        if (filteredMembers.length > 0) {
          await db.insert(projectMemberSnapshot).values(
            filteredMembers.map((member) => ({
              projectId,
              syncId: runId,
              username: member.username ?? null,
              name: member.name ?? null,
              accessLevel: member.access_level ?? null,
            })),
          );
        }
        debug(
          `[sync] ${projectLabel} members stored (${filteredMembers.length}/${members.length})`,
        );
      } catch (error) {
        logWarn(`[sync] ${projectLabel} members fetch failed`, error);
      }
    };

    let completedProjects = 0;

    for (const [index, projectInfo] of projects.entries()) {
      const projectLabel = projectInfo.path_with_namespace;
      logInfo(
        `[sync] (${index + 1}/${totalProjects}) syncing ${projectLabel}`,
      );
      let projectStatus = "ok";
      try {
        const projectStartedAt = Date.now();
        const fallbackGroupId = projectFallbackGroup.get(projectInfo.id) ?? null;
        const fallbackGroupGitlabId =
          projectFallbackGroupGitlabId.get(projectInfo.id) ?? null;
        const namespace = projectInfo.namespace ?? null;
        let projectGroupId = fallbackGroupId;
        let projectGitlabGroupId = fallbackGroupGitlabId;
        if (namespace && namespace.kind !== "user") {
          projectGitlabGroupId = namespace.id;
          if (!projectGroupId) {
            projectGroupId = await ensureGroupChain(namespace.id);
          }
        }
        if (!projectGitlabGroupId && projectGroupId) {
          projectGitlabGroupId = groupGitlabIdByRow.get(projectGroupId) ?? null;
        }
        if (!projectGroupId) {
          logWarn(`[sync] skipping ${projectLabel}: missing group mapping`);
          projectStatus = "skipped";
          continue;
        }
        const projectId = await ensureProject(
          projectGroupId,
          projectInfo,
          projectMap,
        );
        await ensureGroupSamlLinks(projectGitlabGroupId, projectGroupId);
        await syncProjectMembers(projectId, projectInfo.id, projectLabel);
        const latestCommit = await fetchLatestCommit(
          config,
          throttler,
          rateLimiter,
          projectInfo.id,
          projectInfo.default_branch,
        );
        const previousSnapshot = await loadPreviousSnapshot(projectId);
        const latestCommitSha = latestCommit?.id ?? null;
        const latestCommitAt = latestCommit?.committed_date
          ? new Date(latestCommit.committed_date)
          : latestCommit?.created_at
            ? new Date(latestCommit.created_at)
            : null;
        const pendingDeletionRaw =
          projectInfo.marked_for_deletion_on ??
          projectInfo.marked_for_deletion_at ??
          null;
        const pendingDeletionAt = pendingDeletionRaw
          ? new Date(pendingDeletionRaw)
          : null;

        const isSameCommit =
          previousSnapshot &&
          latestCommitSha &&
          previousSnapshot.latestCommitSha === latestCommitSha;

        const shouldSkip = Boolean(isSameCommit) && !forceResync;
        if (shouldSkip) {
          projectStatus = "skipped";
        }
        const dataSourceSyncId = shouldSkip
          ? previousSnapshot.dataSourceSyncId ?? previousSnapshot.syncId
          : runId;

        await db.insert(projectSnapshot).values({
          projectId,
          syncId: runId,
          defaultBranch: projectInfo.default_branch ?? "",
          archived: projectInfo.archived ?? false,
          pendingDeletionAt,
          visibility: projectInfo.visibility ?? null,
          lastActivityAt: projectInfo.last_activity_at
            ? new Date(projectInfo.last_activity_at)
            : null,
          metadataJson: null,
          ref: projectInfo.default_branch ?? null,
          latestCommitSha,
          latestCommitAt,
          dataSourceSyncId,
          isUnchanged: Boolean(isSameCommit),
          checkedAt: new Date(),
        });

        if (shouldSkip) {
          continue;
        }

        let treeEntries: GitLabTreeEntry[] = [];
        let packageJsonPaths: string[] = [];
        let lockfilePaths = new Set<string>();

        if (useZoektSearch) {
          lockfilePaths = new Set(
            searchLockfilePathsByProject.get(projectInfo.id) ?? [],
          );
          packageJsonPaths = buildPackageJsonPathsFromLockfiles(lockfilePaths);
        } else {
          const treeStart = Date.now();
          debug(`[sync] ${projectLabel} fetching repository tree`);
          treeEntries = await fetchRepositoryTree(
            config,
            throttler,
            rateLimiter,
            projectInfo.id,
            projectInfo.default_branch,
          );
          debug(
            `[sync] ${projectLabel} repository tree fetched (${treeEntries.length} entries, ${((Date.now() - treeStart) / 1000).toFixed(1)}s)`,
          );

          lockfilePaths = new Set(
            treeEntries
              .filter(
                (entry) =>
                  entry.type === "blob" &&
                  lockfileNames.some((name) => entry.path.endsWith(name)) &&
                  !isNodeModulesPath(entry.path),
              )
              .map((entry) => entry.path),
          );

          const existingPackageJsonPaths = new Set(
            treeEntries
              .filter(
                (entry) =>
                  entry.type === "blob" &&
                  entry.path.endsWith("package.json") &&
                  !isNodeModulesPath(entry.path),
              )
              .map((entry) => entry.path),
          );
          packageJsonPaths = buildPackageJsonPathsFromLockfiles(
            lockfilePaths,
            existingPackageJsonPaths,
          );
        }

        debug(
          `[sync] ${projectLabel} package.json files: ${packageJsonPaths.length}`,
        );
        debug(`[sync] ${projectLabel} lockfiles: ${lockfilePaths.size}`);

        const lockfileCache = new Map<string, ParsedLockfile>();
        const lockfileCommitCache = new Map<string, Date | null>();
        const projectDependencyNames = new Set<string>();
        const queriesByExtension = new Map<string, typeof usageQueries>();
        const queryMatchers = new Map<string, RegExp>();

        const usageCounts = new Map<
          string,
          {
            queryKey: string;
            targetKey: string;
            subTargetKey: string;
            count: number;
          }
        >();
        const fileUsageRows: Array<{
          projectId: number;
          syncId: number;
          targetKey: string;
          subTargetKey: string;
          queryKey: string;
          filePath: string;
          matchCount: number;
          scannedAt: Date;
        }> = [];

        const getLockfile = async (path: string) => {
          const cached = lockfileCache.get(path);
          if (cached) {
            return cached;
          }
          const file = await fetchFile(
            config,
            throttler,
            rateLimiter,
            projectInfo.id,
            projectInfo.default_branch,
            path,
          );
          const lockKind =
            lockfileKindMap[file.path.split("/").pop() ?? ""] ??
            "package_lock";
          const parsed: ParsedLockfile["parsed"] = {};
          if (lockKind === "yarn_lock") {
            parsed.yarnSelectorMap = parseYarnSelectorMap(file.raw);
          } else if (lockKind === "pnpm_lock") {
            parsed.pnpmImporterMap = parsePnpmImporterMap(file.raw);
          }
          const lockfile: ParsedLockfile = {
            path: file.path,
            raw: file.raw,
            json: file.json,
            blobSha: file.blobSha,
            kind: lockKind,
            parsed,
          };
          lockfileCache.set(path, lockfile);
          return lockfile;
        };

        for (const packagePath of packageJsonPaths) {
          debug(`[sync] ${projectLabel} loading ${packagePath}`);
          let pkgFile: ParsedPackage & { blobSha?: string };
          try {
            pkgFile = await fetchFile(
              config,
              throttler,
              rateLimiter,
              projectInfo.id,
              projectInfo.default_branch,
              packagePath,
            );
          } catch (error) {
            if (isNotFoundError(error)) {
              debug(
                `[sync] ${projectLabel} skipping ${packagePath} (not found)`,
              );
              continue;
            }
            throw error;
          }

          await storeProjectFile(
            projectId,
            runId,
            pkgFile,
            "package_json",
            projectInfo.default_branch,
            pkgFile.blobSha,
          );

          await db.insert(packageSnapshot).values({
            projectId,
            syncId: runId,
            packagePath,
            name: (pkgFile.json?.name as string | undefined) ?? null,
            version: (pkgFile.json?.version as string | undefined) ?? null,
            private: Boolean(pkgFile.json?.private ?? false),
            workspacesJson:
              (pkgFile.json?.workspaces as
                | Record<string, unknown>
                | unknown[]
                | undefined) ?? null,
            isWorkspaceRoot: Boolean(pkgFile.json?.workspaces),
          });

          const dependencies = extractDependencies(pkgFile.json);
          const lockCandidates = resolveLockfileCandidates(
            packagePath,
            lockfilePaths,
          );
          const lockPath = await selectLatestLockfilePath(
            config,
            throttler,
            rateLimiter,
            projectInfo.id,
            projectInfo.default_branch,
            lockCandidates,
            lockfileCommitCache,
          );
          const lockfile = lockPath ? await getLockfile(lockPath) : null;

          for (const dep of dependencies) {
            projectDependencyNames.add(dep.name.toLowerCase());
            const dependencyId = await getDependencyId(
              dep.name,
              dependencyMap,
            );
            await db.insert(projectDependencySnapshot).values({
              projectId,
              syncId: runId,
              dependencyId,
              packagePath,
              versionSpec: dep.versionSpec,
              depType: dep.depType,
            });

            const resolved = resolveLockedVersion(
              lockfile,
              dep.name,
              dep.versionSpec,
              packagePath,
            );
            const fallback = resolved ? null : stripVersionSpec(dep.versionSpec);
            if (resolved || fallback) {
              await db.insert(lockDependencySnapshot).values({
                projectId,
                syncId: runId,
                dependencyId,
                packagePath,
                lockfilePath: lockfile?.path ?? null,
                versionResolved: resolved ?? fallback ?? dep.versionSpec,
                depType: dep.depType,
              });
            }
          }
        }

        const projectPath = projectInfo.path_with_namespace?.toLowerCase() ?? "";
        const enabledTargets = new Set(
          usageTargets
            .filter((target) => {
              if (
                projectDependencyNames.has(
                  target.targetDependency.toLowerCase(),
                )
              ) {
                return true;
              }
              if (!projectPath) {
                return false;
              }
              return (
                target.sourceProjects?.some(
                  (path) => path.toLowerCase() === projectPath,
                ) ?? false
              );
            })
            .map((target) => target.targetKey),
        );
        if (useZoektSearch) {
          const matchedTargets = usageSearchTargetsByProject.get(
            projectInfo.id,
          );
          if (matchedTargets) {
            for (const targetKey of matchedTargets) {
              enabledTargets.add(targetKey);
            }
          }
        }
        const queryList = usageQueries.filter((query) =>
          enabledTargets.has(query.targetKey),
        );
        if (queryList.length === 0) {
          debug(
            `[sync] ${projectLabel} usage scan skipped (no target dependencies found)`,
          );
        }
        for (const query of queryList) {
          const matcher = toRegex(query);
          if (!matcher) {
            if (!useZoektSearch) {
              debug(
                `[sync] ${projectLabel} skipping regex scan for ${query.queryKey} (no regex fallback configured)`,
              );
            }
            continue;
          }
          queryMatchers.set(query.queryKey, matcher);
          const extensions = query.extensions ?? [];
          if (extensions.length === 0) {
            logWarn(
              `[sync] ${projectLabel} skipping regex scan for ${query.queryKey} (no extensions configured)`,
            );
            continue;
          }
          for (const extension of extensions) {
            const ext = extension.toLowerCase();
            const list = queriesByExtension.get(ext) ?? [];
            list.push(query);
            queriesByExtension.set(ext, list);
          }
        }

        if (useZoektSearch) {
          let searchFiles = 0;
          for (const query of queryList) {
            if (usageSearchFailures.has(query.queryKey)) {
              continue;
            }
            const fileMap =
              usageSearchMatches.get(query.queryKey)?.get(projectInfo.id) ??
              null;
            if (!fileMap || fileMap.size === 0) {
              continue;
            }
            for (const [filePath, matchCount] of fileMap.entries()) {
              if (!matchCount) {
                continue;
              }
              searchFiles += 1;
              const existing = usageCounts.get(query.queryKey);
              if (existing) {
                existing.count += matchCount;
              } else {
                usageCounts.set(query.queryKey, {
                  queryKey: query.queryKey,
                  targetKey: query.targetKey,
                  subTargetKey: query.subTargetKey,
                  count: matchCount,
                });
              }
              fileUsageRows.push({
                projectId,
                syncId: runId,
                targetKey: query.targetKey,
                subTargetKey: query.subTargetKey,
                queryKey: query.queryKey,
                filePath,
                matchCount,
                scannedAt: new Date(),
              });
            }
          }
          debug(
            `[sync] ${projectLabel} usage search matches: ${searchFiles} files`,
          );
        } else if (queriesByExtension.size > 0) {
          if (treeEntries.length === 0) {
            const treeStart = Date.now();
            debug(`[sync] ${projectLabel} fetching repository tree`);
            treeEntries = await fetchRepositoryTree(
              config,
              throttler,
              rateLimiter,
              projectInfo.id,
              projectInfo.default_branch,
            );
            debug(
              `[sync] ${projectLabel} repository tree fetched (${treeEntries.length} entries, ${((Date.now() - treeStart) / 1000).toFixed(1)}s)`,
            );
          }

          const candidateFiles = treeEntries
            .filter(
              (entry) =>
                entry.type === "blob" &&
                !isNodeModulesPath(entry.path) &&
                queriesByExtension.has(getExtension(entry.path)),
            )
            .map((entry) => entry.path);
          debug(
            `[sync] ${projectLabel} usage scan candidates: ${candidateFiles.length}`,
          );

          let scannedFiles = 0;
          for (const filePath of candidateFiles) {
            const extension = getExtension(filePath);
            const queries = queriesByExtension.get(extension);
            if (!queries || queries.length === 0) {
              continue;
            }

            const file = await fetchFile(
              config,
              throttler,
              rateLimiter,
              projectInfo.id,
              projectInfo.default_branch,
              filePath,
            );
            scannedFiles += 1;
            if (debugEnabled && scannedFiles % scanLogInterval === 0) {
              debug(
                `[sync] ${projectLabel} scanned ${scannedFiles}/${candidateFiles.length} files`,
              );
            }
            if (!file.raw) {
              continue;
            }

            for (const query of queries) {
              const regex = queryMatchers.get(query.queryKey);
              if (!regex) {
                continue;
              }
              const matchCount = countMatches(regex, file.raw);
              if (!matchCount) {
                continue;
              }
              const existing = usageCounts.get(query.queryKey);
              if (existing) {
                existing.count += matchCount;
              } else {
                usageCounts.set(query.queryKey, {
                  queryKey: query.queryKey,
                  targetKey: query.targetKey,
                  subTargetKey: query.subTargetKey,
                  count: matchCount,
                });
              }
              fileUsageRows.push({
                projectId,
                syncId: runId,
                targetKey: query.targetKey,
                subTargetKey: query.subTargetKey,
                queryKey: query.queryKey,
                filePath,
                matchCount,
                scannedAt: new Date(),
              });
            }
          }
        }

        if (fileUsageRows.length > 0) {
          await db.insert(usageFileResult).values(fileUsageRows);
        }

        for (const usage of usageCounts.values()) {
          await db.insert(usageResult).values({
            projectId,
            syncId: runId,
            targetKey: usage.targetKey,
            subTargetKey: usage.subTargetKey,
            queryKey: usage.queryKey,
            matchCount: usage.count,
            scannedAt: new Date(),
          });
        }
        debug(
          `[sync] ${projectLabel} sync complete in ${((Date.now() - projectStartedAt) / 1000).toFixed(1)}s`,
        );
      } catch (error) {
        hadErrors = true;
        projectStatus = "failed";
        logWarn(
          `Project sync failed for ${projectInfo.path_with_namespace}:`,
          error,
        );
      } finally {
        completedProjects += 1;
        logInfo(
          `[sync] (${completedProjects}/${totalProjects}) ${projectStatus}: ${projectLabel}`,
        );
      }
    }

    const runStatus = hadErrors ? "partial" : "completed";
    await updateSyncRun(runId, runStatus);
    const elapsedSeconds = ((Date.now() - runStartedAt) / 1000).toFixed(1);
    logInfo(`[sync] finished (${runStatus}) in ${elapsedSeconds}s`);
  } catch (error) {
    await updateSyncRun(runId, "failed");
    const elapsedSeconds = ((Date.now() - runStartedAt) / 1000).toFixed(1);
    logError(`[sync] failed after ${elapsedSeconds}s`);
    throw error;
  } finally {
    sqlite.close();
  }
};

runSync().catch((error) => {
  console.error(
    `[${new Date().toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })}] GitLab sync failed:`,
    error,
  );
  process.exitCode = 1;
});
