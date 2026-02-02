import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const fileKinds = [
  "package_json",
  "package_lock",
  "bun_lock",
  "bun_lockb",
  "yarn_lock",
  "pnpm_lock",
] as const;
export const dependencyTypes = ["prod", "dev", "peer", "optional"] as const;
export const syncRunStatuses = [
  "started",
  "completed",
  "failed",
  "partial",
] as const;

export const syncRun = sqliteTable(
  "sync_run",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source").notNull(),
    status: text("status", { enum: syncRunStatuses }).notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    note: text("note"),
  },
  (table) => ({
    statusIdx: index("sync_run_status_idx").on(table.status),
  }),
);

export const gitlabGroup = sqliteTable(
  "gitlab_group",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gitlabId: integer("gitlab_id").notNull(),
    parentGroupId: integer("parent_group_id").references(
      () => gitlabGroup.id,
    ),
    path: text("path").notNull(),
    name: text("name").notNull(),
    webUrl: text("web_url"),
  },
  (table) => ({
    gitlabIdIdx: uniqueIndex("gitlab_group_gitlab_id_idx").on(table.gitlabId),
    pathIdx: uniqueIndex("gitlab_group_path_idx").on(table.path),
    parentIdx: index("gitlab_group_parent_idx").on(table.parentGroupId),
  }),
);

export const project = sqliteTable(
  "project",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gitlabId: integer("gitlab_id").notNull(),
    groupId: integer("group_id")
      .notNull()
      .references(() => gitlabGroup.id),
    pathWithNamespace: text("path_with_namespace").notNull(),
    name: text("name").notNull(),
  },
  (table) => ({
    gitlabIdIdx: uniqueIndex("project_gitlab_id_idx").on(table.gitlabId),
    pathIdx: uniqueIndex("project_path_with_namespace_idx").on(
      table.pathWithNamespace,
    ),
    groupIdx: index("project_group_idx").on(table.groupId),
  }),
);

export const gitlabUser = sqliteTable(
  "gitlab_user",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gitlabUserId: integer("gitlab_user_id").notNull(),
    username: text("username").notNull(),
    name: text("name"),
  },
  (table) => ({
    gitlabUserIdIdx: uniqueIndex("gitlab_user_gitlab_id_idx").on(
      table.gitlabUserId,
    ),
    usernameIdx: uniqueIndex("gitlab_user_username_idx").on(table.username),
  }),
);

export const dependency = sqliteTable(
  "dependency",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    scope: text("scope"),
    shortName: text("short_name").notNull(),
  },
  (table) => ({
    nameIdx: uniqueIndex("dependency_name_idx").on(table.name),
  }),
);

export const projectSnapshot = sqliteTable(
  "project_snapshot",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => project.id),
    syncId: integer("sync_id")
      .notNull()
      .references(() => syncRun.id),
    defaultBranch: text("default_branch").notNull(),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    pendingDeletionAt: integer("pending_deletion_at", { mode: "timestamp_ms" }),
    visibility: text("visibility"),
    lastActivityAt: integer("last_activity_at", { mode: "timestamp_ms" }),
    metadataJson: text("metadata_json", { mode: "json" }).$type<
      Record<string, unknown> | null
    >(),
    ref: text("ref"),
    latestCommitSha: text("latest_commit_sha"),
    latestCommitAt: integer("latest_commit_at", { mode: "timestamp_ms" }),
    dataSourceSyncId: integer("data_source_sync_id").references(
      () => syncRun.id,
    ),
    isUnchanged: integer("is_unchanged", { mode: "boolean" })
      .notNull()
      .default(false),
    checkedAt: integer("checked_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    projectSyncIdx: uniqueIndex("project_snapshot_project_sync_idx").on(
      table.projectId,
      table.syncId,
    ),
    projectIdx: index("project_snapshot_project_idx").on(table.projectId),
    syncIdx: index("project_snapshot_sync_idx").on(table.syncId),
  }),
);

export const packageSnapshot = sqliteTable(
  "package_snapshot",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => project.id),
    syncId: integer("sync_id")
      .notNull()
      .references(() => syncRun.id),
    packagePath: text("package_path").notNull(),
    name: text("name"),
    version: text("version"),
    private: integer("private", { mode: "boolean" }).default(false),
    workspacesJson: text("workspaces_json", { mode: "json" }).$type<
      unknown[] | Record<string, unknown> | null
    >(),
    isWorkspaceRoot: integer("is_workspace_root", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => ({
    packageSyncIdx: uniqueIndex("package_snapshot_project_sync_path_idx").on(
      table.projectId,
      table.syncId,
      table.packagePath,
    ),
  }),
);

export const projectMemberSnapshot = sqliteTable(
  "project_member_snapshot",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => project.id),
    syncId: integer("sync_id")
      .notNull()
      .references(() => syncRun.id),
    gitlabUserId: integer("gitlab_user_id").references(
      () => gitlabUser.gitlabUserId,
    ),
    username: text("username"),
    name: text("name"),
    accessLevel: integer("access_level"),
    state: text("state"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    projectSyncIdx: index("project_member_project_sync_idx").on(
      table.projectId,
      table.syncId,
    ),
    userIdx: index("project_member_user_idx").on(table.gitlabUserId),
  }),
);

export const projectExternalRefSnapshot = sqliteTable(
  "project_external_ref_snapshot",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => project.id),
    syncId: integer("sync_id")
      .notNull()
      .references(() => syncRun.id),
    system: text("system").notNull(),
    externalId: text("external_id"),
    externalKey: text("external_key"),
    note: text("note"),
  },
  (table) => ({
    projectSyncIdx: index("external_ref_project_sync_idx").on(
      table.projectId,
      table.syncId,
    ),
    systemIdx: index("external_ref_system_idx").on(table.system),
  }),
);

export const projectFileSnapshot = sqliteTable(
  "project_file_snapshot",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => project.id),
    syncId: integer("sync_id")
      .notNull()
      .references(() => syncRun.id),
    path: text("path").notNull(),
    ref: text("ref"),
    blobSha: text("blob_sha"),
    kind: text("kind", { enum: fileKinds }).notNull(),
    contentJson: text("content_json", { mode: "json" }).$type<
      Record<string, unknown> | null
    >(),
    contentRaw: text("content_raw"),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    projectSyncKindIdx: index("project_file_project_sync_kind_idx").on(
      table.projectId,
      table.syncId,
      table.kind,
    ),
    projectSyncPathIdx: index("project_file_project_sync_path_idx").on(
      table.projectId,
      table.syncId,
      table.path,
    ),
    uniqueSnapshotIdx: uniqueIndex("project_file_snapshot_unique_idx").on(
      table.projectId,
      table.syncId,
      table.path,
      table.kind,
    ),
  }),
);

export const projectDependencySnapshot = sqliteTable(
  "project_dependency_snapshot",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => project.id),
    syncId: integer("sync_id")
      .notNull()
      .references(() => syncRun.id),
    dependencyId: integer("dependency_id")
      .notNull()
      .references(() => dependency.id),
    packagePath: text("package_path").notNull(),
    versionSpec: text("version_spec").notNull(),
    depType: text("dep_type", { enum: dependencyTypes }).notNull(),
  },
  (table) => ({
    projectDepIdx: index("project_dependency_project_idx").on(
      table.projectId,
      table.syncId,
      table.dependencyId,
    ),
    depIdx: index("project_dependency_dep_idx").on(table.dependencyId),
  }),
);

export const lockDependencySnapshot = sqliteTable(
  "lock_dependency_snapshot",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => project.id),
    syncId: integer("sync_id")
      .notNull()
      .references(() => syncRun.id),
    dependencyId: integer("dependency_id")
      .notNull()
      .references(() => dependency.id),
    packagePath: text("package_path").notNull(),
    lockfilePath: text("lockfile_path"),
    versionResolved: text("version_resolved").notNull(),
    depType: text("dep_type", { enum: dependencyTypes }).notNull(),
  },
  (table) => ({
    projectDepIdx: index("lock_dependency_project_idx").on(
      table.projectId,
      table.syncId,
      table.dependencyId,
    ),
  }),
);

export const usageResult = sqliteTable(
  "usage_result",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => project.id),
    syncId: integer("sync_id")
      .notNull()
      .references(() => syncRun.id),
    targetKey: text("target_key").notNull(),
    subTargetKey: text("sub_target_key"),
    queryKey: text("query_key").notNull(),
    matchCount: integer("match_count").notNull().default(0),
    scannedAt: integer("scanned_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    projectQueryIdx: index("usage_result_project_query_idx").on(
      table.projectId,
      table.syncId,
      table.queryKey,
    ),
    targetIdx: index("usage_result_target_idx").on(
      table.targetKey,
      table.syncId,
    ),
    targetSubIdx: index("usage_result_target_sub_idx").on(
      table.targetKey,
      table.subTargetKey,
      table.syncId,
    ),
    queryIdx: index("usage_result_query_idx").on(table.queryKey, table.syncId),
  }),
);

export const usageFileResult = sqliteTable(
  "usage_file_result",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => project.id),
    syncId: integer("sync_id")
      .notNull()
      .references(() => syncRun.id),
    targetKey: text("target_key").notNull(),
    subTargetKey: text("sub_target_key"),
    queryKey: text("query_key").notNull(),
    filePath: text("file_path").notNull(),
    matchCount: integer("match_count").notNull().default(0),
    scannedAt: integer("scanned_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    projectQueryIdx: index("usage_file_result_project_query_idx").on(
      table.projectId,
      table.syncId,
      table.queryKey,
    ),
    targetIdx: index("usage_file_result_target_idx").on(
      table.targetKey,
      table.syncId,
    ),
    targetSubIdx: index("usage_file_result_target_sub_idx").on(
      table.targetKey,
      table.subTargetKey,
      table.syncId,
    ),
    queryIdx: index("usage_file_result_query_idx").on(
      table.queryKey,
      table.syncId,
    ),
  }),
);
