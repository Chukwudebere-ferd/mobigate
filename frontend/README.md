# MGM-Portal — Frontend

React 19 + TypeScript + Vite + Tailwind CSS v4. The MGM-Portal MVP interface:
the public careers site, the applicant portal, the staff portal and the
admin panel.

## Running

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

The frontend runs against an **in-memory mock** by default, so every screen
works without a backend. To point it at the Go API instead:

```bash
VITE_API_MODE=live pnpm dev
```

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_MODE` | `mock` | `mock` uses seed data; `live` calls the Go API |
| `VITE_API_URL` | same origin | Base URL for the Go API |
| `VITE_AUTH_URL` | same origin | Base URL for Better Auth |

## Screens

### Public careers site

| Route | Screen |
|---|---|
| `/` | Open roles, search and filters, how it works |
| `/jobs/:slug` | Role detail, requirements, apply CTA |
| `/apply/:slug` | Application form with CV and photo upload |
| `/application/received` | Application number confirmation |

### Applicant portal

| Route | Screen |
|---|---|
| `/applicant` | My applications, with status |
| `/applicant/applications/:id` | Status timeline and shortlist message |
| `/applicant/interviews` | Interview announcements |

### Staff portal

| Route | Screen |
|---|---|
| `/staff` | Profile, bank details, guarantor, documents |
| `/staff/onboarding` | Access code redemption and staff details form |

### Admin panel

| Route | Screen |
|---|---|
| `/admin` | Dashboard — metric tiles, 30-day trend, recent activity |
| `/admin/applications` | Filter, search, bulk shortlist, reject, appoint |
| `/admin/jobs` | Job postings and editor |
| `/admin/interviews` | Announcements, audience scoping, notifications |
| `/admin/shortlists` | Shortlist records and confirmation messages |
| `/admin/access-codes` | Generate, issue, revoke |
| `/admin/staff` | Staff directory and records |
| `/admin/locations` | Location hierarchy tree and approval queue |
| `/admin/settings` | Templates, access code settings, users, notification log |
| `/admin/audit` | Audit trail with before/after changes |

## Reviewing a portal

The mock session picks a role from the URL. Visit a portal's route directly,
or set the role from the browser console:

```js
localStorage.setItem('mgm.mock.role', 'admin')
location.reload()
```

Roles: `super_admin` · `admin` · `applicant` · `staff`.

## Architecture

```
src/
├── components/
│   ├── layout/      AdminShell, PublicShell, PortalShell
│   └── ui/          Button, Input, Card, Table, Badge, Dialog, Tabs, ...
├── lib/
│   ├── api/         API contract — client.ts (HTTP) + index.ts (endpoints)
│   ├── auth-client  Better Auth React client
│   ├── cn.ts        Class merging
│   └── format.ts    Date, byte, and name formatting
├── mocks/           Seed data for mock mode
├── pages/           Route components, grouped by portal
├── providers/       Session provider
└── types/           Domain types, mirroring the Go models
```

### The API contract

`src/lib/api/index.ts` is the single seam between the UI and the backend. It
exports `publicApi` and `adminApi`; each function is async and shaped like a
REST endpoint.

In mock mode they resolve from `src/mocks/seed.ts` with simulated latency. In
live mode they issue HTTP requests through `src/lib/api/client.ts`. Pages
never know which mode they are in, so switching to the real backend is a
one-line change.

### Data fetching

TanStack Query. Reads use `useQuery` with the filters in the query key;
writes use `useMutation`, invalidate on success, and report failures with a
`sonner` toast.

## Conventions

Read [`DESIGN.md`](./DESIGN.md) before adding a page. It covers the colour
tokens, the component library, the data layer, and the domain rules the UI
must respect — such as a shortlist requiring a confirmation message, and
bank details being visible only to the record owner and administrators.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Typecheck and production build |
| `pnpm preview` | Serve the production build |
| `pnpm lint` | Oxlint |
| `pnpm typecheck` | `tsc --noEmit` |
