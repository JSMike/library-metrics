import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const DEFAULT_DB_FILE = "./data/library-metrics.sqlite";

const findProjectRoot = (startDir: string) => {
  let current = startDir;
  while (true) {
    if (
      existsSync(resolve(current, "package.json")) ||
      existsSync(resolve(current, "data"))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
};

const resolveDbFile = (value: string | undefined) => {
  const trimmed = value?.trim();
  const requested = trimmed && trimmed.length > 0 ? trimmed : DEFAULT_DB_FILE;
  if (isAbsolute(requested)) {
    return requested;
  }

  const root = findProjectRoot(process.cwd());
  if (root) {
    return resolve(root, requested);
  }

  return resolve(process.cwd(), requested);
};

const dbFile = resolveDbFile(process.env.DB_FILE_NAME);

export const sqlite = new Database(dbFile);
export const db = drizzle(sqlite, { schema });
