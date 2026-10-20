/**
 * Loads environment variables for the auth service.
 *
 * The service shares backend/.env with the Go API so there is a single
 * source for DATABASE_URL and AUTH_SECRET. Imported first by auth.ts and
 * the bootstrap script, before any module reads process.env.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

for (const file of [
  resolve(here, '../../backend/.env'),
  resolve(here, '../.env'),
]) {
  if (!existsSync(file)) continue
  try {
    process.loadEnvFile(file)
  } catch {
    // A malformed env file should not stop the service; the missing values
    // surface as explicit configuration errors instead.
  }
}
