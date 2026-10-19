# MGM-Portal — Recruitment & Staff Management

Repository for the Mobigate Group Management Portal MVP.

```
mobigate/
├── frontend/     React 19 + TypeScript + Vite + Tailwind v4  (UI)
├── backend/      Go + PostgreSQL                            (API)
├── auth/         Better Auth service                       (identity)
└── README.md     System requirements (v3.0 — MVP scope)
```

---

## MVP scope

Recruitment pipeline and staff onboarding:

**Setup** → **Job application** → **Interview & shortlisting** → **Appointment & staff onboarding**

Roles: `super_admin` · `admin` · `applicant` · `staff`

Full requirements: [`README.md`](./README.md)

---

## Frontend

```bash
cd frontend
pnpm install
pnpm dev        # http://localhost:5173
```

The frontend runs against an in-memory mock by default, so every screen can be
reviewed without a backend. Set `VITE_API_MODE=live` to point at the Go API.

| Route | Screen |
|---|---|
| `/` | Public careers site — open roles |
| `/jobs/:slug` | Job detail |
| `/apply/:slug` | Application form |
| `/application/received` | Application number confirmation |
| `/applicant` | Applicant portal — my applications |
| `/applicant/applications/:id` | Application status + shortlist message |
| `/applicant/interviews` | Interview announcements |
| `/staff` | Staff portal — profile, documents |
| `/staff/onboarding` | Access code redemption + staff details form |
| `/admin` | Admin dashboard |
| `/admin/applications` | Application management (filter, shortlist, appoint) |
| `/admin/jobs` | Job posting management |
| `/admin/interviews` | Interview announcements |
| `/admin/shortlists` | Shortlist records and confirmation messages |
| `/admin/access-codes` | Generate, issue, revoke access codes |
| `/admin/staff` | Staff directory |
| `/admin/locations` | Location hierarchy management |
| `/admin/settings` | Templates, users, notification log |
| `/admin/audit` | Audit log |

Design system and conventions: [`frontend/DESIGN.md`](./frontend/DESIGN.md)

### Mock role switcher

The mock session picks a role from the URL. To review another portal, visit
its route directly, or set the role from the browser console:

```js
localStorage.setItem('mgm.mock.role', 'admin')
```

---

## Backend

Go + PostgreSQL. See [`backend/README.md`](./backend/README.md).

```bash
cd backend
createdb mgm
psql mgm -f migrations/0001_init.sql
psql mgm -f migrations/0002_seed.sql
go run ./cmd/mgm-api
```

## Auth

Better Auth service in [`auth/`](./auth/). See [`auth/README.md`](./auth/README.md).

```bash
cd auth
pnpm install
pnpm migrate
pnpm dev
```

Three processes in development: Go API on `:8080`, Better Auth on `:3000`,
frontend on `:5173` (which proxies `/api` and `/api/auth`).

---

## Tooling

| Tool | Purpose |
|---|---|
| pnpm | Frontend dependencies |
| Go 1.21+ | Backend |
| PostgreSQL 15+ | Database |
