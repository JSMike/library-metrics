import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'

const DEFAULT_DB_FILE = './data/library-metrics.sqlite'

const findProjectRoot = (startDir: string) => {
  let current = startDir
  while (true) {
    if (
      existsSync(resolve(current, 'package.json')) ||
      existsSync(resolve(current, 'data'))
    ) {
      return current
    }
    const parent = dirname(current)
    if (parent === current) {
      return null
    }
    current = parent
  }
}

const resolveDbPath = (value: string | undefined, root: string) => {
  const trimmed = value?.trim()
  const requested = trimmed && trimmed.length > 0 ? trimmed : DEFAULT_DB_FILE
  if (isAbsolute(requested)) {
    return requested
  }
  return resolve(root, requested)
}

const copyIfExists = (source: string, destination: string) => {
  if (!existsSync(source)) {
    return false
  }
  mkdirSync(dirname(destination), { recursive: true })
  copyFileSync(source, destination)
  return true
}

const run = () => {
  const projectRoot = findProjectRoot(process.cwd()) ?? process.cwd()
  const sourceDb = resolveDbPath(process.env.DB_FILE_NAME, projectRoot)
  const destinationDb = resolve(projectRoot, '.output', DEFAULT_DB_FILE)

  if (!existsSync(sourceDb)) {
    console.warn(`[build] SQLite DB not found at ${sourceDb}; skipping copy.`)
    return
  }

  copyIfExists(sourceDb, destinationDb)

  const sidecars = ['-wal', '-shm']
  for (const suffix of sidecars) {
    const sourceSidecar = `${sourceDb}${suffix}`
    const destSidecar = `${destinationDb}${suffix}`
    if (existsSync(sourceSidecar)) {
      copyIfExists(sourceSidecar, destSidecar)
    }
  }

  const size = statSync(destinationDb).size
  console.log(`[build] Copied SQLite DB to ${destinationDb} (${size} bytes).`)
}

run()
