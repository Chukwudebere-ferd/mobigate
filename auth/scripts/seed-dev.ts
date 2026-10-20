/**
 * Applies backend/dev/seed_demo.sql to DATABASE_URL.
 *
 * Run with `pnpm seed:dev` from the repo root. This is development fixture
 * data only; it is deliberately outside migrations so a fresh production
 * database never receives demo applicants or staff.
 */
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Pool } from 'pg'

import '../src/env.js'

const here = dirname(fileURLToPath(import.meta.url))
const seedFile = resolve(here, '../../backend/dev/seed_demo.sql')

async function main() {
  const sql = await readFile(seedFile, 'utf8')
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/mgm?sslmode=disable',
  })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('Demo seed applied')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
