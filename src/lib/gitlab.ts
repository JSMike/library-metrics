import { Throttler } from "./throttle";

export type GitLabConfig = {
  baseUrl: string;
  token: string;
  groupPath: string;
  apiVersion: string;
  concurrency: number;
  delayMs: number;
  timeoutMs: number;
};

export type GitLabGroupResponse = {
  id: number;
  name: string;
  path: string;
  full_path: string;
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
};

export type GitLabCommitResponse = {
  id: string;
  committed_date?: string;
  created_at?: string;
};

const DEFAULT_API_VERSION = "v4";

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

export const getGitLabConfig = (): GitLabConfig => {
  return {
    baseUrl: getEnv("GITLAB_BASE_URL", "https://gitlab.com"),
    token: requireEnv("GITLAB_TOKEN"),
    groupPath: requireEnv("GITLAB_GROUP_PATH"),
    apiVersion: getEnv("GITLAB_API_VERSION", DEFAULT_API_VERSION),
    concurrency: getNumberEnv("GITLAB_REQUEST_CONCURRENCY", 3),
    delayMs: getNumberEnv("GITLAB_REQUEST_DELAY_MS", 250),
    timeoutMs: getNumberEnv("GITLAB_REQUEST_TIMEOUT_MS", 30000),
  };
};

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const apiFetch = (
  config: GitLabConfig,
  throttler: Throttler,
  path: string,
  init?: RequestInit,
): Promise<Response> => {
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

export const fetchJson = async <T>(
  config: GitLabConfig,
  throttler: Throttler,
  path: string,
  init?: RequestInit,
  retries = 2,
): Promise<{ data: T; response: Response }> => {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await apiFetch(config, throttler, path, init);
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : 500 * (attempt + 1);
      await sleep(waitMs);
      continue;
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `GitLab API error ${response.status} on ${path}: ${body}`,
      );
    }

    const data = (await response.json()) as T;
    return { data, response };
  }

  throw new Error(`GitLab API rate-limited on ${path}`);
};

export const fetchAllPages = async <T>(
  config: GitLabConfig,
  throttler: Throttler,
  path: string,
): Promise<T[]> => {
  const results: T[] = [];
  let page = 1;
  let nextPage = "1";

  while (nextPage) {
    const pagePath = `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`;
    const { data, response } = await fetchJson<T[]>(
      config,
      throttler,
      pagePath,
    );
    results.push(...data);
    nextPage = response.headers.get("x-next-page") ?? "";
    page = nextPage ? Number(nextPage) : 0;
  }

  return results;
};
