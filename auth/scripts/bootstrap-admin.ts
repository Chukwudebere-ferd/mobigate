/**
 * One-time bootstrap of the first Super Admin.
 *
 * Better Auth owns the credential; the MGM `users` row is created with the
 * same UUID and is authoritative for role, tenant and approval status.
 *
 *   BOOTSTRAP_ADMIN_EMAIL=...
 *   BOOTSTRAP_ADMIN_PASSWORD=...        (min 12 chars)
 *   BOOTSTRAP_ADMIN_FIRST_NAME=...
 *   BOOTSTRAP_ADMIN_LAST_NAME=...
 *   BOOTSTRAP_TENANT_ID=...             (defaults to the seeded Lagos tenant)
 *
 * Safe to re-run: an existing auth user is linked rather than duplicated.
 * Prints no credentials.
 */
import { Pool } from 'pg'

import { auth } from '../src/auth.js'

const DEFAULT_TENANT_ID = '20000000-0000-0000-0000-000000000001'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

async function main() {
  const email = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase()
  const password = required('BOOTSTRAP_ADMIN_PASSWORD')
  const firstName = required('BOOTSTRAP_ADMIN_FIRST_NAME')
  const lastName = required('BOOTSTRAP_ADMIN_LAST_NAME')
  const tenantId = process.env.BOOTSTRAP_TENANT_ID?.trim() || DEFAULT_TENANT_ID

  if (password.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters')
  }

  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/mgm?sslmode=disable',
  })

  try {
    const tenant = await pool.query('SELECT id FROM tenants WHERE id = $1', [
      tenantId,
    ])
    if (tenant.rowCount === 0) {
      throw new Error(`tenant ${tenantId} does not exist; apply 0002_seed.sql`)
    }

    let userId: string

    try {
      const result = await auth.api.signUpEmail({
        body: {
          name: `${firstName} ${lastName}`,
          email,
          password,
        },
      })
      userId = result.user.id
      console.log('Created Better Auth credential')
    } catch (error) {
      const existing = await pool.query(
        'SELECT id FROM "user" WHERE lower(email) = $1',
        [email],
      )
      if (existing.rowCount === 0) throw error
      userId = existing.rows[0].id as string
      console.log('Better Auth credential already exists; linking')
    }

    await pool.query(
      `
        INSERT INTO users (
          id, tenant_id, role, email, first_name, last_name,
          status, email_verified_at
        )
        VALUES ($1, $2, 'super_admin', $3, $4, $5, 'active', now())
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          role = 'super_admin',
          email = EXCLUDED.email,
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          status = 'active',
          email_verified_at = now(),
          updated_at = now()
      `,
      [userId, tenantId, email, firstName, lastName],
    )

    // Mirror the role/tenant onto the auth user for client-side display.
    // Authorization still reads the domain row above.
    await pool.query(
      'UPDATE "user" SET "role" = $1, "tenantId" = $2 WHERE id = $3',
      ['super_admin', tenantId, userId],
    )

    console.log(`Super Admin ready: ${email} (${userId})`)
  } finally {
    await pool.end()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
