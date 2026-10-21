# MGM-Portal — Frontend

React 19 + TypeScript + Vite + Tailwind CSS v4. The MGM-Portal MVP interface:
the public careers site, the applicant portal, the staff portal and the
admin panel.

## Running

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

The frontend talks to the Go API (`/api`) and the Better Auth service
(`/api/auth`). With the Vite dev proxy both share the dev server's origin, so
no configuration is needed when all three processes run locally:

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | same origin | Base URL for the Go API |
| `VITE_AUTH_URL` | same origin | Base URL for Better Auth |

## Screens

### Design review

| Route | Screen |
|---|---|
| `/preview` | Screen index — every screen, with a role switcher and review notes |

A developer-facing index of all 20 screens, grouped by portal. Each entry
links to the route, names the source file, and carries a note on what to
review. The role switcher sets the mock session, which matters because the
admin, applicant and staff portals render different content per role.

### Public careers site

| Route | Screen |
|---|---|
| `/` | Open roles, search and filters, how it works |
| `/jobs/:slug` | Role detail, requirements, apply CTA |
| `/apply/:slug` | Application form with passport photo upload (sign-in required) |
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

Roles are decided by the backend, not the frontend: sign in through
`/login` (or create an account at `/signup` as an applicant) and the Go
API's `/me` response routes you to the matching portal. Roles:
`super_admin` · `admin` · `applicant` · `staff`.

Open **`/preview`** for the screen index. It lists every screen with a link,
the source file, and a note on what to review. Note that the preview renders
against a static in-app harness session (admin role, no network), which keeps
every route renderable without a backend; it never reaches a real browser.

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
├── pages/           Route components, grouped by portal
├── providers/       Session provider
├── routes.tsx       The route table, shared by the app and the test harness
└── types/           Domain types, mirroring the Go models
```

### The API contract

`src/lib/api/index.ts` is the single seam between the UI and the backend. It
exports `publicApi` (careers site and signed-in applicant), `staffApi` (staff
onboarding and portal) and `adminApi`; each function issues HTTP requests
through `src/lib/api/client.ts` against the Go API and is shaped like the
REST endpoint it calls.

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
| `pnpm render-check` | Render every route server-side and report failures |
| `pnpm dump-route -- /preview` | Print a route's rendered text |
