# MGM-Portal API (Go)

Go + PostgreSQL backend for the MGM-Portal MVP. Owns the recruitment and
personnel domain; authentication is delegated to Better Auth.

## Status

Scaffold. The route contract, domain models, ID generation and the database
schema are in place; the persistence layer and handler bodies land next.

| Path | Contents |
|---|---|
| `cmd/mgm-api/main.go` | Entry point, router, graceful shutdown |
| `internal/config` | Environment configuration |
| `internal/models` | Domain types (map 1:1 to the TS types) |
| `internal/codes` | Access code generation, hashing, hinting, ID formatting |
| `internal/sequence` | Atomic Application Number / Staff ID allocation |
| `internal/store` | Database access layer |
| `internal/httpapi` | HTTP handlers — the route contract |
| `migrations/0001_init.sql` | Full schema |
| `migrations/0002_seed.sql` | Reference tenants, locations and templates |
| `migrations/0003_better_auth.sql` | Better Auth identity tables |
| `migrations/0004_admin_settings.sql` | Group-wide access-code settings |
| `migrations/0005_application_consent.sql` | NDPA consent timestamp and notice version |

## Running

Requires Go 1.21+ and PostgreSQL 15+.

```bash
createdb mgm
for file in migrations/*.sql; do psql mgm -f "$file"; done

export DATABASE_URL="postgres://postgres:postgres@localhost:5432/mgm?sslmode=disable"
go run ./cmd/mgm-api
```

The API listens on `:8080`. The frontend dev server proxies `/api` to it
(see `frontend/vite.config.ts`).

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `HTTP_ADDR` | `:8080` | Listen address |
| `DATABASE_URL` | local postgres | Connection string |
| `AUTH_BASE_URL` | `http://localhost:3000` | Better Auth server |
| `AUTH_SECRET` | dev placeholder | Session signing secret — **must** be set in production |
| `ALLOWED_HOSTS` | `*` | Comma-separated allowed hosts |

## Authentication

Better Auth issues a session cookie. The Go service verifies that cookie
before serving any `/admin/*`, `/me/*` or `/staff/*` route, then reads the
tenant from the session and scopes every query to it (BR-15).

Two deployment shapes are supported:

1. **Separate auth service** — Better Auth runs as its own Node process.
   The Go service calls `/api/auth/get-session` with the request cookie.
2. **Go-native** — `better-auth-go` (a third-party Go port of the Better Auth
   server) mounts the auth routes inside this binary, so production runs a
   single Go process with no Node dependency.

The frontend is unaffected either way: the Better Auth React client only
issues fetches against `/api/auth/*`.

## Route contract

Implemented in `internal/httpapi/handlers.go`; the frontend calls these
through `frontend/src/lib/api/index.ts`.

### Public

| Method | Path | Returns |
|---|---|---|
| `GET` | `/public/jobs` | Published jobs |
| `GET` | `/public/jobs/{slug}` | One job |
| `POST` | `/public/applications` | `201` application with generated number |

### Signed-in user

| Method | Path | Returns |
|---|---|---|
| `GET` | `/me/applications` | The caller's applications |
| `GET` | `/me/applications/{id}` | One application |
| `GET` | `/me/applications/{id}/shortlist` | Confirmation message, or `404` |
| `GET` | `/me/interviews` | Announcements the caller may see |

### Staff

| Method | Path | Returns |
|---|---|---|
| `POST` | `/staff/redeem` | `{ application }` for a valid code |
| `POST` | `/staff/onboarding` | `{ staff }` with allocated Staff ID |

### Admin

| Method | Path | Returns |
|---|---|---|
| `GET` | `/admin/dashboard` | Metric tiles + 30-day trend |
| `GET`/`POST` | `/admin/jobs` | List / create |
| `PATCH` | `/admin/jobs/{id}` | Update |
| `GET` | `/admin/applications` | Filtered, paginated list |
| `GET` | `/admin/applications/{id}` | One application |
| `GET` | `/admin/applications/{id}/events` | Status history |
| `PATCH` | `/admin/applications/{id}/status` | Transition status |
| `GET`/`POST` | `/admin/shortlists` | List / create (message required) |
| `PATCH` | `/admin/shortlists/{id}` | Revoke |
| `GET`/`POST` | `/admin/interviews` | List / create announcement |
| `PATCH` | `/admin/interviews/{id}` | Publish / cancel |
| `GET`/`POST` | `/admin/access-codes` | List / issue |
| `PATCH` | `/admin/access-codes/{id}` | Revoke |
| `GET` | `/admin/staff` | Filtered, paginated list |
| `GET` | `/admin/staff/{id}` | One staff record |
| `GET`/`POST` | `/admin/locations` | Tree / create |
| `PATCH` | `/admin/locations/{id}` | Approve |
| `GET`/`POST` | `/admin/departments` | List / ensure department by name |
| `GET` | `/admin/users` | Users and admins |
| `PATCH` | `/admin/users/{id}` | Approve admin |
| `GET` | `/admin/templates` | Message templates |
| `GET` | `/admin/notifications` | Delivery log |
| `GET` | `/admin/audit-logs` | Audit trail |

### Invariants the store layer must uphold

| Rule | Enforcement |
|---|---|
| BR-01/02 | ID formats via `codes.FormatApplicationNumber` / `FormatStaffID` |
| BR-03 | Sequence allocation via `sequence.Allocator.Next` (atomic upsert) |
| BR-04 | `codes.GenerateAccessCode` — Crockford base32, 6 chars |
| BR-05/06 | Expiry check and attempt lockout at redemption |
| BR-07 | Shortlist create rejects an empty message |
| BR-08 | `/me/applications/{id}/shortlist` returns `404` for non-shortlisted |
| BR-11 | Staff creation, ID allocation, code consumption and audit in one transaction |
| BR-15 | Every query filtered by tenant; cross-tenant reads return `404` |
| BR-17 | Access codes stored as SHA-256 hashes only |
