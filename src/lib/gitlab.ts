import { Throttler } from "./throttle";

export type GitLabConfig = {
  baseUrl: string;
  token: string;
  apiVersion: string;
  concurrency: number;
  delayMs: number;
  timeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
  groupIncludePaths: string[];
  groupExcludePaths: string[];
};

export type GitLabGroupResponse = {
  id: number;
  name: string;
  path: string;
  full_path: string;
  web_url?: string;
  parent_id?: number | null;
  saml_group_links?: Array<{
    name?: string | null;
    access_level?: number | null;
  }>;
};

export type GitLabNamespaceResponse = {
  id: number;
  name: string;
  path: string;
  full_path: string;
  kind?: string;
  parent_id?: number | null;
  web_url?: string;
};

export type GitLabProjectResponse = {
  id: number;
  name: string;
  path_with_namespace: string;
  default_branch: string | null;
  archived: boolean;
  visibility: string;
  last_activity_at: string | null;
  marked_for_deletion_on?: string | null;
  marked_for_deletion_at?: string | null;
  namespace?: GitLabNamespaceResponse | null;
};

export type GitLabCommitResponse = {
  id: string;
  committed_date?: string;
  created_at?: string;
};

const DEFAULT_API_VERSION = "v4";
const DEFAULT_GLOBAL_RATE_LIMIT = 2000;
const DEFAULT_GLOBAL_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_SEARCH_RATE_LIMIT = 30;
const DEFAULT_SEARCH_WINDOW_MS = 60 * 1000;
const DEFAULT_PROJECT_RATE_LIMIT = 400;
const DEFAULT_PROJECT_WINDOW_MS = 60 * 1000;
const DEFAULT_GROUP_RATE_LIMIT = 200;
const DEFAULT_GROUP_WINDOW_MS = 60 * 1000;
const DEFAULT_GROUP_PROJECTS_RATE_LIMIT = 600;
const DEFAULT_GROUP_PROJECTS_WINDOW_MS = 60 * 1000;
const DEFAULT_ARCHIVE_RATE_LIMIT = 5;
const DEFAULT_ARCHIVE_WINDOW_MS = 60 * 1000;

const getEnv = (key: string, fallback: string) => {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value : fallback;
};

const getNumberEnv = (key: string, fallback: number) => {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

class GitLabApiError extends Error {
  status: number;
  path: string;
  body: string;

  constructor(status: number, path: string, body: string) {
    super(`GitLab API error ${status} on ${path}: ${body}`);
    this.name = "GitLabApiError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

const isRetryableStatus = (status: number) =>
  status === 500 || status === 502 || status === 503 || status === 504;

const normalizeGroupPath = (value: string) =>
  value.trim().replace(/^\/+|\/+$/g, "");

const parseListEnv = (key: string) => {
  const raw = process.env[key];
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((value) => normalizeGroupPath(value))
    .filter((value) => value.length > 0);
};

const dedupe = (values: string[]) => Array.from(new Set(values));

export const getGitLabConfig = (): GitLabConfig => {
  const groupPathRaw = process.env.GITLAB_GROUP_PATH ?? "";
  const groupPath = normalizeGroupPath(groupPathRaw);
  const groupIncludePaths = dedupe([
    ...parseListEnv("GITLAB_GROUP_INCLUDE_PATHS"),
    ...(groupPath ? [groupPath] : []),
  ]);
  const groupExcludePaths = dedupe(
    parseListEnv("GITLAB_GROUP_EXCLUDE_PATHS"),
  );

  return {
    baseUrl: getEnv("GITLAB_BASE_URL", "https://gitlab.com"),
    token: requireEnv("GITLAB_TOKEN"),
    apiVersion: getEnv("GITLAB_API_VERSION", DEFAULT_API_VERSION),
    concurrency: getNumberEnv("GITLAB_REQUEST_CONCURRENCY", 3),
    delayMs: getNumberEnv("GITLAB_REQUEST_DELAY_MS", 0),
    timeoutMs: getNumberEnv("GITLAB_REQUEST_TIMEOUT_MS", 30000),
    retryCount: Math.max(0, getNumberEnv("GITLAB_REQUEST_RETRIES", 1)),
    retryDelayMs: Math.max(0, getNumberEnv("GITLAB_REQUEST_RETRY_DELAY_MS", 2000)),
    groupIncludePaths,
    groupExcludePaths,
  };
};

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

type RateLimitRule = {
  key: string;
  limit: number;
  windowMs: number;
  minSpacingMs?: number;
  match: (path: string) => boolean;
};

type RateLimitBucket = {
  key: string;
  limit: number;
  windowMs: number;
  minSpacingMs: number;
  lastRequestAt: number;
  remaining: number | null;
  resetAt: number | null;
  windowStart: number;
  windowCount: number;
};

const buildMinSpacing = (limit: number, windowMs: number) =>
  Math.max(1, Math.ceil(windowMs / limit));

const createBucket = (rule: RateLimitRule): RateLimitBucket => ({
  key: rule.key,
  limit: rule.limit,
  windowMs: rule.windowMs,
  minSpacingMs:
    rule.minSpacingMs ?? buildMinSpacing(rule.limit, rule.windowMs),
  lastRequestAt: 0,
  remaining: null,
  resetAt: null,
  windowStart: 0,
  windowCount: 0,
});

export class RateLimiter {
  private readonly globalKey = "global";
  private readonly rules: RateLimitRule[];
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly chains = new Map<string, Promise<void>>();

  constructor(
    rules: RateLimitRule[],
    options: { globalMinSpacingMs?: number } = {},
  ) {
    this.rules = rules;
    for (const rule of rules) {
      this.buckets.set(rule.key, createBucket(rule));
    }
    if (!this.buckets.has(this.globalKey)) {
      this.buckets.set(
        this.globalKey,
        createBucket({
          key: this.globalKey,
          limit: DEFAULT_GLOBAL_RATE_LIMIT,
          windowMs: DEFAULT_GLOBAL_WINDOW_MS,
          minSpacingMs: options.globalMinSpacingMs,
          match: () => true,
        }),
      );
    }
  }

  async wait(path: string) {
    const keys = this.getKeysForPath(path);
    for (const key of keys) {
      await this.waitForKey(key);
    }
  }

  updateFromHeaders(path: string, response: Response) {
    const limitHeader = Number(response.headers.get("RateLimit-Limit"));
    const remainingHeader = Number(response.headers.get("RateLimit-Remaining"));
    const resetHeader = Number(response.headers.get("RateLimit-Reset"));
    const limit = Number.isFinite(limitHeader) && limitHeader > 0 ? limitHeader : null;
    const remaining = Number.isFinite(remainingHeader) ? remainingHeader : null;
    const resetAt =
      Number.isFinite(resetHeader) && resetHeader > 0
        ? resetHeader * 1000
        : null;
    if (!limit && remaining === null && !resetAt) {
      return;
    }

    const key = this.getRuleForPath(path)?.key ?? this.globalKey;
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return;
    }

    if (limit) {
      bucket.limit = limit;
      bucket.minSpacingMs = buildMinSpacing(bucket.limit, bucket.windowMs);
    }
    if (remaining !== null) {
      bucket.remaining = remaining;
    }
    if (resetAt) {
      bucket.resetAt = resetAt;
    }
  }

  private getRuleForPath(path: string) {
    return this.rules.find((rule) => rule.match(path)) ?? null;
  }

  private getKeysForPath(path: string) {
    const keys = new Set<string>([this.globalKey]);
    const rule = this.getRuleForPath(path);
    if (rule && rule.key !== this.globalKey) {
      keys.add(rule.key);
    }
    return Array.from(keys);
  }

  private getBucket(key: string) {
    const existing = this.buckets.get(key);
    if (existing) {
      return existing;
    }
    const fallback: RateLimitBucket = {
      key,
      limit: DEFAULT_GLOBAL_RATE_LIMIT,
      windowMs: DEFAULT_GLOBAL_WINDOW_MS,
      minSpacingMs: buildMinSpacing(
        DEFAULT_GLOBAL_RATE_LIMIT,
        DEFAULT_GLOBAL_WINDOW_MS,
      ),
      lastRequestAt: 0,
      remaining: null,
      resetAt: null,
      windowStart: 0,
      windowCount: 0,
    };
    this.buckets.set(key, fallback);
    return fallback;
  }

  private async waitForKey(key: string) {
    const previous = this.chains.get(key) ?? Promise.resolve();
    const current = previous.then(async () => {
      const bucket = this.getBucket(key);
      await this.applyDelay(bucket);
    });
    this.chains.set(key, current.catch(() => {}));
    await current;
  }

  private async applyDelay(bucket: RateLimitBucket) {
    const now = Date.now();
    if (bucket.resetAt && now >= bucket.resetAt) {
      bucket.resetAt = null;
      bucket.remaining = null;
    }

    if (!bucket.resetAt || bucket.remaining === null) {
      if (!bucket.windowStart || now - bucket.windowStart >= bucket.windowMs) {
        bucket.windowStart = now;
        bucket.windowCount = 0;
      }
      if (bucket.windowCount >= bucket.limit) {
        const waitMs = bucket.windowStart + bucket.windowMs - now;
        if (waitMs > 0) {
          await sleep(waitMs);
        }
        bucket.windowStart = Date.now();
        bucket.windowCount = 0;
      }
    }

    if (bucket.resetAt && bucket.remaining !== null && bucket.remaining <= 0) {
      const waitMs = bucket.resetAt - now;
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      bucket.resetAt = null;
      bucket.remaining = null;
      bucket.windowStart = Date.now();
      bucket.windowCount = 0;
    }

    const currentTime = Date.now();
    let spacingMs = bucket.minSpacingMs;

    if (bucket.resetAt && bucket.remaining !== null && bucket.remaining > 0) {
      const windowRemaining = Math.max(0, bucket.resetAt - currentTime);
      const headerSpacing = Math.ceil(windowRemaining / bucket.remaining);
      spacingMs = Math.max(spacingMs, headerSpacing);
    }

    const sinceLast = currentTime - bucket.lastRequestAt;
    if (sinceLast < spacingMs) {
      await sleep(spacingMs - sinceLast);
    }
    bucket.lastRequestAt = Date.now();
    if (bucket.remaining !== null) {
      bucket.remaining = Math.max(0, bucket.remaining - 1);
    }
    bucket.windowCount += 1;
  }
}

export const createRateLimiter = () =>
  new RateLimiter(
    [
      {
        key: "repo-archive",
        limit: DEFAULT_ARCHIVE_RATE_LIMIT,
        windowMs: DEFAULT_ARCHIVE_WINDOW_MS,
        match: (path) => path.includes("/repository/archive"),
      },
      {
        key: "search",
        limit: DEFAULT_SEARCH_RATE_LIMIT,
        windowMs: DEFAULT_SEARCH_WINDOW_MS,
        match: (path) => path.includes("/search"),
      },
      {
        key: "group-projects",
        limit: DEFAULT_GROUP_PROJECTS_RATE_LIMIT,
        windowMs: DEFAULT_GROUP_PROJECTS_WINDOW_MS,
        match: (path) =>
          path.startsWith("/groups/") && path.includes("/projects"),
      },
      {
        key: "group",
        limit: DEFAULT_GROUP_RATE_LIMIT,
        windowMs: DEFAULT_GROUP_WINDOW_MS,
        match: (path) => path.startsWith("/groups/"),
      },
      {
        key: "project",
        limit: DEFAULT_PROJECT_RATE_LIMIT,
        windowMs: DEFAULT_PROJECT_WINDOW_MS,
        match: (path) => path.startsWith("/projects/"),
      },
    ],
    { globalMinSpacingMs: 0 },
  );

export const apiFetch = async (
  config: GitLabConfig,
  throttler: Throttler,
  rateLimiter: RateLimiter,
  path: string,
  init?: RequestInit,
): Promise<Response> => {
  await rateLimiter.wait(path);
  return throttler.run(async () => {
    const url = new URL(`/api/${config.apiVersion}${path}`, config.baseUrl);
    const headers = new Headers(init?.headers ?? {});
    headers.set("Authorization", `Bearer ${config.token}`);
    headers.set("Accept", "application/json");

    if (init?.signal || config.timeoutMs <= 0) {
      return fetch(url, { ...init, headers });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      return await fetch(url, { ...init, headers, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  });
};

const isRetryableError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }
  const name = (error as { name?: string }).name ?? "";
  return name === "AbortError" || name === "TimeoutError";
};

export const fetchJson = async <T>(
  config: GitLabConfig,
  throttler: Throttler,
  rateLimiter: RateLimiter,
  path: string,
  init?: RequestInit,
  retries = config.retryCount,
): Promise<{ data: T; response: Response }> => {
  const maxRetries = Math.max(0, retries);
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response: Response;
    try {
      response = await apiFetch(config, throttler, rateLimiter, path, init);
    } catch (error) {
      if (isRetryableError(error) && attempt < maxRetries) {
        await sleep(config.retryDelayMs);
        continue;
      }
      throw error;
    }
    rateLimiter.updateFromHeaders(path, response);
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      const resetAt = Number(response.headers.get("RateLimit-Reset") ?? 0) * 1000;
      const waitMs =
        retryAfter > 0
          ? retryAfter * 1000
          : resetAt > Date.now()
            ? resetAt - Date.now()
            : 500 * (attempt + 1);
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      const body = await response.text();
      if (isRetryableStatus(response.status) && attempt < maxRetries) {
        await sleep(config.retryDelayMs * (attempt + 1));
        continue;
      }
      throw new GitLabApiError(response.status, path, body);
    }

    const data = (await response.json()) as T;
    return { data, response };
  }

  throw new Error(`GitLab API rate-limited on ${path}`);
};

export const fetchAllPages = async <T>(
  config: GitLabConfig,
  throttler: Throttler,
  rateLimiter: RateLimiter,
  path: string,
  options?: {
    label?: string;
    log?: (message: string) => void;
    logEveryPages?: number;
  },
): Promise<T[]> => {
  const results: T[] = [];
  let page = 1;
  let nextPage = "1";
  let pageCount = 0;
  const log = options?.log;
  const logEveryPages = options?.logEveryPages ?? 0;
  const label = options?.label ?? path;

  while (nextPage) {
    const pagePath = `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`;
    try {
      const { data, response } = await fetchJson<T[]>(
        config,
        throttler,
        rateLimiter,
        pagePath,
      );
      results.push(...data);
      pageCount += 1;
      if (log && logEveryPages > 0 && pageCount % logEveryPages === 0) {
        log(
          `[gitlab] ${label} page ${page} fetched (${data.length} items, ${results.length} total)`,
        );
      }
      nextPage = response.headers.get("x-next-page") ?? "";
      page = nextPage ? Number(nextPage) : 0;
    } catch (error) {
      if (
        error instanceof GitLabApiError &&
        isRetryableStatus(error.status)
      ) {
        console.warn(
          `[gitlab] ${error.message} (page ${page}); returning partial results (${results.length})`,
        );
        break;
      }
      throw error;
    }
  }

  return results;
};
