import 'dotenv/config'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

const getDbFile = () => {
  const envValue = process.env.DB_FILE_NAME
  const trimmed = envValue && envValue.trim().length > 0 ? envValue.trim() : ''
  return trimmed || './data/gitlab-metrics.sqlite'
}

const run = async () => {
  const dbFile = getDbFile()
  if (dbFile === ':memory:') {
    throw new Error('DB_FILE_NAME is set to :memory:, unable to run migrations.')
  }

  const resolvedPath = resolve(process.cwd(), dbFile)
  mkdirSync(dirname(resolvedPath), { recursive: true })

  const sqlite = new Database(resolvedPath)
  try {
    const db = drizzle(sqlite)
    await migrate(db, { migrationsFolder: './drizzle' })
  } finally {
    sqlite.close()
  }
}

run().catch((error) => {
  console.error('[db:migrate] failed:', error)
  process.exitCode = 1
})
