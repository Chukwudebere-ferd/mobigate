/**
 * Better Auth server configuration.
 *
 * Better Auth owns identity: credentials, sessions and role metadata. The Go
 * API owns the recruitment and personnel domain and verifies the session
 * cookie on every protected route.
 *
 * Run with:  pnpm --filter @mgm/auth dev
 */
import { betterAuth } from 'better-auth'
import { admin as adminPlugin } from 'better-auth/plugins'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/mgm?sslmode=disable',
})

export const auth = betterAuth({
  database: pool,
  secret: process.env.AUTH_SECRET ?? 'dev-secret-change-me',
  baseURL: process.env.AUTH_BASE_URL ?? 'http://localhost:3000',

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  // The Go service reads the tenant and role off the session. The role field
  // is written by the application, not by Better Auth's own admin plugin,
  // so that "Admin" here means the MGM role, not a Better Auth admin.
  user: {
    additionalFields: {
      tenantId: { type: 'string', required: false },
      role: {
        type: 'string',
        required: false,
        defaultValue: 'applicant',
        input: false,
      },
      staffId: { type: 'string', required: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },

  plugins: [adminPlugin()],

  advanced: {
    // Better Auth's own tables live in the same database as the domain
    // tables. The migration command creates them.
    database: {
      generateId: 'uuid',
    },
  },
})
