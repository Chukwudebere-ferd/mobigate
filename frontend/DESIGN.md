# MGM-Portal Frontend — Design Guide

Reference for building pages in this codebase. Follow it exactly so the
portal reads as one system.

## Stack

- React 19 + TypeScript (strict), Vite 8, React Router 7, TanStack Query 5
- Tailwind CSS v4 (CSS-first tokens in `src/index.css`, no `tailwind.config.js`)
- Path alias: `@/` → `src/`

## Layout & tone

Admin-grade, quiet, information-dense. No gradients, no glassmorphism, no
decorative illustration. The interface should look like a well-made internal
tool: clear hierarchy, generous whitespace, restrained colour used only to
signal state.

## Colour tokens (Tailwind v4 utilities)

| Token | Use |
|---|---|
| `brand-50…950` | Primary actions, active nav, links, admin chrome |
| `ink-50…950` | Neutrals — text, borders, surfaces |
| `accent-50…900` | Gold, reserved for director/partner category + emphasis |
| `success-*` | Approved, appointed, active, sent |
| `warning-*` | Pending, expiring, needs attention |
| `danger-*` | Rejected, revoked, failed, destructive actions |
| `info-*` | Shortlisted, in-progress, neutral announcements |

Surfaces: page background `bg-ink-50`, cards `bg-white` with
`border border-ink-200` and `shadow-xs`. Never a coloured page background.

## Component library (`@/components/ui/`)

Import from these — do not rebuild them inline.

| Component | Notes |
|---|---|
| `Button` | `variant`: primary / secondary / outline / ghost / danger / danger-outline / success / link. `size`: sm / md / lg / icon / icon-sm. `loading` + `loadingText`. |
| `Input`, `Textarea`, `Select`, `Field`, `Checkbox` | `Field` wraps label + control + hint/error. `invalid` prop on controls. |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | |
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` | Table itself wraps in an overflow-x container. |
| `Badge` | `variant`: neutral / brand / success / warning / danger / info / accent / outline. Optional `dot`. |
| `Dialog`, `DialogHeader`, `DialogBody`, `DialogFooter`, `DialogTitle`, `DialogDescription` | `open` + `onOpenChange`. Renders null when closed. Use `sm:max-w-*` overrides for width. |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Controlled or uncontrolled. |
| `Avatar` | `first`/`last`/`size` (xs–xl). Falls back to initials. |
| `Pagination` | `page`, `totalPages`, `total`, `onPageChange`. |
| `EmptyState` | `icon`, `title`, `description`, `action`. |
| `Spinner`, `TableSkeleton` | Loading states. |
| `PageHeader` | `title`, `description`, `icon`, `actions`, `breadcrumb`. |
| `StatCard` | Metric tile: `label`, `value`, `suffix`, `tone` (brand/success/warning/danger/info/accent/neutral), `icon`, `hint`, `delta`. **Use this for every metric tile** — do not define a local copy in a page file. |
| Status badges | `ApplicationStatusBadge`, `JobStatusBadge`, `AccessCodeStatusBadge`, `StaffStatusBadge`, `UserStatusBadge`, `EmploymentCategoryBadge`. Always use these rather than hand-rolled badges. |

Also available: `buttonVariants` (for styling a `Link` as a button) and
`cn` from `@/lib/cn`.

## Layout shells (`@/components/layout/`)

- `AdminShell` — sidebar + top bar. Admin pages render inside its `<Outlet />`
  automatically; do **not** add a page container or outer padding. Use
  `<PageHeader>` then content.
- `PublicShell` — public careers site, used by `/`, `/jobs/:slug`, `/apply/:slug`.
- `PortalShell` — compact top-bar shell for applicant and staff portals.

## Data layer

Pages fetch through the API modules in `@/lib/api`:

- `publicApi` — `listJobs`, `getJob`, `submitApplication`, `myApplications`,
  `shortlistMessageFor`, `announcementsFor`
- `adminApi` — `dashboard`, `listJobs`, `createJob`, `updateJob`,
  `listApplications`, `getApplication`, `applicationEvents`,
  `setApplicationStatus`, `shortlist`, `revokeShortlist`, `listShortlists`,
  `listInterviews`, `createInterview`, `updateInterviewStatus`,
  `listAccessCodes`, `issueAccessCode`, `revokeAccessCode`, `redeemAccessCode`,
  `listStaff`, `getStaff`, `listLocations`, `createLocation`, `approveLocation`,
  `listDepartments`, `listUsers`, `approveUser`, `listTemplates`,
  `listNotifications`, `listAuditLogs`
- `locationPath(id)` renders the full "Country › State › LGA › City" breadcrumb.
- `childrenOf` / `descendantsOf` / `locationById` for the location tree.

Use TanStack Query:

```ts
const { data, isLoading, error } = useQuery({
  queryKey: ['applications', filters],
  queryFn: () => adminApi.listApplications(filters),
})
```

Mutations: `useMutation` + `await queryClient.invalidateQueries({ queryKey: [...] })`
+ `toast.success(...)` from `sonner`. Always surface failures with
`toast.error(...)`.

## Conventions

- TypeScript strict. No `any`. No unused variables (`noUnusedLocals` is on).
- `verbatimModuleSyntax` is on: type-only imports **must** use `import type`.
- Enums are imported from `@/types/domain`; never redeclared locally.
- Formatting helpers live in `@/lib/format` — `formatDate`, `formatDateTime`,
  `formatTime`, `relativeTime`, `untilNow`, `formatBytes`, `initials`,
  `fullName`, `humanize`, `pluralize`.
- Icons: `lucide-react`, `size-4.5` inside buttons and nav, `size-5` in headers.
- Every interactive element needs an accessible name and visible focus.
- Mobile-first: tables get horizontal scroll, filter bars wrap, dialogs become
  bottom sheets (`sm:` breakpoints handle the rest).
- Empty states matter — every list needs one.
- Show realistic content: real-looking Nigerian names, Lagos/LGA locations,
  application numbers like `APP/LA/2026/0007`.

## Status semantics

| Status | Tone | Meaning |
|---|---|---|
| `pending` | warning | Awaiting review |
| `shortlisted` | info | Advanced, awaiting appointment |
| `appointed` | success | Access code issued |
| `rejected` | danger | Did not advance |
| `withdrawn` | neutral | Applicant withdrew |

Access codes: `active` success · `used` neutral · `revoked` danger · `expired` warning.

Jobs: `draft` neutral · `published` success · `closed` warning · `archived` neutral.

## Domain rules to respect

- A shortlist **requires** a non-empty confirmation message (README BR-07).
- The shortlist confirmation message is visible **only** to shortlisted
  applicants (BR-08).
- An application locks for applicant editing once shortlisted (BR-10).
- Access codes are single-use, time-boxed, and stored hashed — the plaintext
  is shown **once** at issue time and never again (BR-05, BR-17).
- Staff ID format is `STA/{STATE_CODE}/{YEAR}/{0001}`; Application Number is
  `APP/{STATE_CODE}/{YEAR}/{0001}`.
- Bank details, guarantor and next-of-kin are visible to the record owner,
  Admin and Super Admin only — never to peers (README M10).
