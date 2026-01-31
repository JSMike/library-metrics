import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const dbFile = process.env.DB_FILE_NAME ?? "./data/gitlab-metrics.sqlite";

export const sqlite = new Database(dbFile);
export const db = drizzle(sqlite, { schema });
