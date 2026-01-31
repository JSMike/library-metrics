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
  projectSnapshot,
  syncRun,
} from "../db/schema";
import {
  fetchAllPages,
  fetchJson,
  getGitLabConfig,
  type GitLabCommitResponse,
  type GitLabGroupResponse,
  type GitLabProjectResponse,
} from "../lib/gitlab";
import { Throttler } from "../lib/throttle";

type SyncRunStatus = "started" | "completed" | "failed" | "partial";

type GitLabTreeEntry = {
  path: string;
  type: "blob" | "tree";
};

type GitLabFileResponse = {
  file_path: string;
  encoding: string;
  content: string;
  blob_id?: string;
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

const parsePnpmImporterMap = (raw: string) => {
  try {
    const data = parseYaml(raw) as {
      importers?: Record<
        string,
        {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
          optionalDependencies?: Record<string, string>;
          peerDependencies?: Record<string, string>;
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
        depMap.set(name, version);
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

const extractPnpmVersion = (value: string) => {
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
    projectId,
    ref,
    bestPath,
    cache,
  );
  for (const path of candidates.slice(1)) {
    const date = await getLockfileCommitDate(
      config,
      throttler,
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

const ensureGroup = async (groupInfo: GitLabGroupResponse) => {
  const existing = await db
    .select()
    .from(gitlabGroup)
    .where(eq(gitlabGroup.gitlabId, groupInfo.id));

  if (existing.length > 0) {
    await db
      .update(gitlabGroup)
      .set({
        path: groupInfo.full_path,
        name: groupInfo.name,
        webUrl: groupInfo.web_url ?? null,
      })
      .where(eq(gitlabGroup.gitlabId, groupInfo.id));
    return existing[0];
  }

  await db.insert(gitlabGroup).values({
    gitlabId: groupInfo.id,
    path: groupInfo.full_path,
    name: groupInfo.name,
    webUrl: groupInfo.web_url ?? null,
  });

  const inserted = await db
    .select()
    .from(gitlabGroup)
    .where(eq(gitlabGroup.gitlabId, groupInfo.id));
  return inserted[0];
};

const buildProjectMap = async (groupId: number) => {
  const rows = await db
    .select({
      id: project.id,
      gitlabId: project.gitlabId,
    })
    .from(project)
    .where(eq(project.groupId, groupId));

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
  projectId: number,
  ref: string | null,
): Promise<GitLabCommitResponse | null> => {
  if (!ref) {
    return null;
  }

  const { data } = await fetchJson<GitLabCommitResponse[]>(
    config,
    throttler,
    `/projects/${projectId}/repository/commits?ref_name=${encodeURIComponent(ref)}&per_page=1`,
  );

  return data[0] ?? null;
};

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
  projectId: number,
  ref: string | null,
) => {
  if (!ref) {
    return [];
  }
  return fetchAllPages<GitLabTreeEntry>(
    config,
    throttler,
    `/projects/${projectId}/repository/tree?ref=${encodeURIComponent(ref)}&recursive=true`,
  );
};

const fetchFile = async (
  config: ReturnType<typeof getGitLabConfig>,
  throttler: Throttler,
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
  const config = getGitLabConfig();
  const throttler = new Throttler({
    concurrency: config.concurrency,
    minDelayMs: config.delayMs,
  });
  const runId = await createSyncRun("manual run");
  const dependencyMap = await loadDependencyMap();
  let hadErrors = false;

  try {
    const { data: groupInfo } = await fetchJson<GitLabGroupResponse>(
      config,
      throttler,
      `/groups/${encodeURIComponent(config.groupPath)}`,
    );

    const groupRow = await ensureGroup(groupInfo);
    const projectMap = await buildProjectMap(groupRow.id);
    const projects = await fetchAllPages<GitLabProjectResponse>(
      config,
      throttler,
      `/groups/${groupInfo.id}/projects?include_subgroups=true`,
    );

    for (const projectInfo of projects) {
      try {
        const projectId = await ensureProject(
          groupRow.id,
          projectInfo,
          projectMap,
        );
        const latestCommit = await fetchLatestCommit(
          config,
          throttler,
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

        const isUnchanged =
          previousSnapshot &&
          latestCommitSha &&
          previousSnapshot.latestCommitSha === latestCommitSha;

        const dataSourceSyncId = isUnchanged
          ? previousSnapshot.dataSourceSyncId ?? previousSnapshot.syncId
          : runId;

        await db.insert(projectSnapshot).values({
          projectId,
          syncId: runId,
          defaultBranch: projectInfo.default_branch ?? "",
          archived: projectInfo.archived ?? false,
          visibility: projectInfo.visibility ?? null,
          lastActivityAt: projectInfo.last_activity_at
            ? new Date(projectInfo.last_activity_at)
            : null,
          metadataJson: null,
          ref: projectInfo.default_branch ?? null,
          latestCommitSha,
          latestCommitAt,
          dataSourceSyncId,
          isUnchanged: Boolean(isUnchanged),
          checkedAt: new Date(),
        });

        if (isUnchanged) {
          continue;
        }

        const treeEntries = await fetchRepositoryTree(
          config,
          throttler,
          projectInfo.id,
          projectInfo.default_branch,
        );

        const packageJsonPaths = treeEntries
          .filter(
            (entry) =>
              entry.type === "blob" && entry.path.endsWith("package.json"),
          )
          .map((entry) => entry.path);

        const lockfilePaths = new Set(
          treeEntries
            .filter(
              (entry) =>
                entry.type === "blob" &&
                lockfileNames.some((name) => entry.path.endsWith(name)),
            )
            .map((entry) => entry.path),
        );

        const lockfileCache = new Map<string, ParsedLockfile>();
        const lockfileCommitCache = new Map<string, Date | null>();

        const getLockfile = async (path: string) => {
          const cached = lockfileCache.get(path);
          if (cached) {
            return cached;
          }
          const file = await fetchFile(
            config,
            throttler,
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
          const pkgFile = await fetchFile(
            config,
            throttler,
            projectInfo.id,
            projectInfo.default_branch,
            packagePath,
          );

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
            projectInfo.id,
            projectInfo.default_branch,
            lockCandidates,
            lockfileCommitCache,
          );
          const lockfile = lockPath ? await getLockfile(lockPath) : null;

          for (const dep of dependencies) {
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
      } catch (error) {
        hadErrors = true;
        console.warn(
          `Project sync failed for ${projectInfo.path_with_namespace}:`,
          error,
        );
      }
    }

    await updateSyncRun(runId, hadErrors ? "partial" : "completed");
  } catch (error) {
    await updateSyncRun(runId, "failed");
    throw error;
  } finally {
    sqlite.close();
  }
};

runSync().catch((error) => {
  console.error("GitLab sync failed:", error);
  process.exitCode = 1;
});
