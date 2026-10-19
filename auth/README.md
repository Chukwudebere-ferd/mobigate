# Better Auth service

Identity for MGM-Portal. Better Auth owns credentials, sessions and role
metadata; the Go API owns the recruitment and personnel domain and verifies
the session cookie on every protected route.

## Why a separate service

Better Auth's server is TypeScript-native. Rather than reimplement it in Go,
it runs as a small Node service alongside the Go API, sharing the same
PostgreSQL database.

```
React (5173)  ──/api/*────►  Go API (8080)
     │                            │
     └──/api/auth/*──►  Better Auth (3000)
```

The React client only issues fetches against `/api/auth/*`, so if you later
prefer a single Go binary, `better-auth-go` can mount the same routes and
the frontend needs no change.

## Setup

```bash
pnpm install

# Create the Better Auth tables (user, session, account, verification)
pnpm generate   # writes a migration
pnpm migrate    # applies it

pnpm dev        # http://localhost:3000/api/auth
```

The service shares the MGM database. Apply the domain schema first:

```bash
psql mgm -f ../backend/migrations/0001_init.sql
psql mgm -f ../backend/migrations/0002_seed.sql
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | local postgres | Shared database |
| `AUTH_SECRET` | dev placeholder | Signing secret — **must** be set in production |
| `AUTH_BASE_URL` | `http://localhost:3000` | Public base URL |
| `AUTH_PORT` | `3000` | Listen port |

## Roles

Better Auth stores `role`, `tenantId` and `staffId` as additional user
fields. `role` is one of `super_admin`, `admin`, `staff`, `applicant` and is
written by the application, not by Better Auth's admin plugin — the plugin's
"admin" means something different and is not used here.

The Go API reads these fields from the session to scope every query to the
correct tenant (BR-15).

## Account states

| Role | Flow |
|---|---|
| `admin` | Created by a Super Admin → `pending` → sets password → approved → `active` |
| `applicant` | Registers at application time → `active` |
| `staff` | No account until an access code is redeemed → `active` |
| `super_admin` | Created directly → `active` |
