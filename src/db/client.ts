import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const dbFileEnv = process.env.DB_FILE_NAME;
const dbFile =
  dbFileEnv && dbFileEnv.trim().length > 0
    ? dbFileEnv
    : "./data/gitlab-metrics.sqlite";

export const sqlite = new Database(dbFile);
export const db = drizzle(sqlite, { schema });
