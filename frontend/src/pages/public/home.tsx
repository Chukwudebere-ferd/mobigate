import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  ClipboardList,
  KeyRound,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { ProductVisual } from '@/components/public/product-visual'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { EmploymentCategoryBadge } from '@/components/ui/status-badges'
import { locationPath, publicApi } from '@/lib/api'
import { formatDate, untilNow } from '@/lib/format'
import { auditLogs } from '@/mocks/seed'

/**
 * The public landing page.
 *
 * This is the company and platform front door, not a job board. It states
 * what MGM-Portal is, shows the product, and only then offers the careers
 * route. The full vacancy list lives at /careers.
 */

const CAPABILITIES = [
  {
    title: 'Recruitment pipeline',
    icon: ClipboardList,
    description:
      'Post a role, publish it to the careers page, and take applications with a CV and photograph. Every applicant is issued a sequential application number on submission.',
  },
  {
    title: 'Interview & shortlisting',
    icon: CalendarCheck,
    description:
      'Publish dated interview announcements scoped to a single job. Shortlist in bulk, with a confirmation message that is mandatory and stored verbatim against each candidate.',
  },
  {
    title: 'Access codes & onboarding',
    icon: KeyRound,
    description:
      'Issue single-use, time-boxed, revocable access codes, held only as hashes. Redeeming one creates the staff record, allocates the Staff ID and writes the audit entry together.',
  },
  {
    title: 'Personnel records',
    icon: ShieldCheck,
    description:
      'Structured, queryable staff records across bio-data, banking, guarantor, next of kin and documents. Bank and family details stay visible only to the owner and administrators.',
  },
]

const GUARANTEES = [
  'Every admin account is approved by a super admin before it can act',
  'A shortlisted application locks for applicant editing',
  'Five failed redemption attempts lock an access code',
  'Codes expire on a configurable clock — 14 days by default',
  'Every status change is written to an append-only audit log',
]

const SCOPE = [
  { label: 'Country', value: 'Nigeria', note: 'One hierarchy, one tree' },
  { label: 'State', value: 'Lagos · Abuja (FCT)', note: 'Own admin boundary' },
  { label: 'Local Government Area', value: '5 seeded LGAs', note: 'Own candidate pool' },
  { label: 'City / Town', value: '8 cities & towns', note: 'Own ID sequence' },
]

export function HomePage() {
  const { data: jobs = [] } = useQuery({
    queryKey: ['public', 'jobs'],
    queryFn: () => publicApi.listJobs(),
  })

  const openRoles = jobs.slice(0, 4)
  const departments = new Set(openRoles.map((job) => job.title)).size
  const locations = new Set(
    openRoles.map((job) => job.location_name ?? locationPath(job.location_id)),
  ).size
  const openings = jobs.reduce((sum, job) => sum + job.openings, 0)
  const recentAudit = auditLogs.slice(0, 4)

  return (
    <div className="bg-ink-50">
      {/* -- Hero ---------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-ink-200 bg-ink-50">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-grid opacity-70"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <Badge variant="brand" className="gap-1.5">
                <Building2 aria-hidden />
                MGM-Portal · Recruitment &amp; Staff Management
              </Badge>

              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-ink-900 text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
                From application to Staff ID — every step on the record
              </h1>

              <p className="mt-5 max-w-xl text-base text-ink-600 text-balance">
                MGM-Portal runs the Group&apos;s recruitment and personnel
                workflow — postings, applications, interviews, shortlisting,
                access codes and staff onboarding. Built for a group operating
                across states, and designed so that nobody reaches an active
                staff account without a human verification step.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/careers"
                  className={buttonVariants({ size: 'lg' })}
                >
                  View open roles
                  <ArrowRight aria-hidden />
                </Link>
                <a
                  href="#platform"
                  className={buttonVariants({ variant: 'outline', size: 'lg' })}
                >
                  See what it does
                </a>
              </div>

              <dl className="mt-9 grid max-w-lg grid-cols-3 gap-4 border-t border-ink-200 pt-6">
                <div>
                  <dt className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
                    Open roles
                  </dt>
                  <dd className="mt-1 text-xl font-semibold text-ink-900 tabular">
                    {jobs.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
                    Openings
                  </dt>
                  <dd className="mt-1 text-xl font-semibold text-ink-900 tabular">
                    {openings}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
                    Locations
                  </dt>
                  <dd className="mt-1 text-xl font-semibold text-ink-900 tabular">
                    {locations}
                  </dd>
                </div>
              </dl>
            </div>

            <ProductVisual />
          </div>
        </div>
      </section>

      {/* -- Scope --------------------------------------------------------- */}
      <section className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SCOPE.map((item, index) => (
              <div key={item.label} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-ink-900">
                    {item.value}
                  </p>
                  <p className="text-xs text-ink-500">{item.note}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-ink-500">
            Each state runs its own administration boundary, candidate pool and
            ID sequence — so <span className="font-mono text-ink-700">APP/LA/2026/0001</span>{' '}
            belongs to Lagos, and the next state starts its own run.
          </p>
        </div>
      </section>

      {/* -- Capabilities -------------------------------------------------- */}
      <section id="platform" className="scroll-mt-20 border-b border-ink-200">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-2xs font-semibold tracking-wider text-brand-700 uppercase">
              What the platform does
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
              One system for the whole employment journey
            </h2>
            <p className="mt-3 text-base text-ink-600">
              Four connected modules, one auditable record. An applicant who
              enters at the careers page is the same person in the staff
              directory a few weeks later.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {CAPABILITIES.map((capability) => (
              <Card key={capability.title} className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                      <capability.icon aria-hidden className="size-4.5" />
                    </span>
                    <CardTitle className="text-base">
                      {capability.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-ink-600">
                    {capability.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* -- Verification before access ------------------------------------ */}
      <section className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="text-2xs font-semibold tracking-wider text-brand-700 uppercase">
                Verification before access
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
                No staff account without a human in the loop
              </h2>
              <p className="mt-3 text-base text-ink-600">
                Staff records are not created by a form submission. They are
                created by an access code that a named administrator issued,
                which the candidate redeemed — and all four facts are recorded.
              </p>

              <ul className="mt-7 space-y-3">
                {GUARANTEES.map((guarantee) => (
                  <li key={guarantee} className="flex gap-3">
                    <ShieldCheck
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-brand-600"
                    />
                    <span className="text-sm text-ink-700">{guarantee}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* -- Audit trail -- */}
            <div>
              <Card className="overflow-hidden">
                <CardHeader className="bg-ink-50/60">
                  <CardTitle>Audit trail</CardTitle>
                  <CardDescription>
                    Append-only. Every entry carries the actor, the action and
                    the time.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-ink-100">
                    {recentAudit.map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-start justify-between gap-4 px-5 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs font-medium text-ink-900">
                            {entry.action}
                          </p>
                          <p className="mt-0.5 truncate text-2xs text-ink-500">
                            {entry.actor_name} · {entry.entity_type}
                          </p>
                        </div>
                        <span className="shrink-0 text-2xs text-ink-400">
                          {formatDate(entry.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <div className="mt-4 flex items-center gap-4 rounded-xl border border-brand-200 bg-brand-50/60 p-5">
                <p className="text-3xl font-semibold text-brand-800 tabular">
                  Zero
                </p>
                <p className="text-sm text-ink-700">
                  staff accounts created without a verification event and a
                  redeemed access code on record.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -- Open roles ---------------------------------------------------- */}
      <section className="border-b border-ink-200">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-2xs font-semibold tracking-wider text-brand-700 uppercase">
                Careers
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
                The Group is hiring
              </h2>
              <p className="mt-3 text-base text-ink-600">
                Engineering, operations, finance, legal and marketing. Apply
                online and keep your application number — it is your reference
                for every update.
              </p>
            </div>
            <Link
              to="/careers"
              className={buttonVariants({ variant: 'outline' })}
            >
              All {jobs.length} open roles
              <ArrowRight aria-hidden />
            </Link>
          </div>

          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            {openRoles.map((job) => (
              <Card key={job.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">
                      <Link
                        to={`/jobs/${job.slug}`}
                        className="hover:text-brand-700"
                      >
                        {job.title}
                      </Link>
                    </CardTitle>
                    {job.employment_category ? (
                      <EmploymentCategoryBadge
                        category={job.employment_category}
                      />
                    ) : null}
                  </div>
                  <CardDescription className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin aria-hidden className="size-3.5" />
                      {job.location_name ?? locationPath(job.location_id)}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users aria-hidden className="size-3.5" />
                      {job.openings} openings
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      {untilNow(job.deadline_at)}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-ink-600">
                    {job.description.length > 150
                      ? `${job.description.slice(0, 150).trimEnd()}…`
                      : job.description}
                  </p>
                </CardContent>
                <CardFooter className="justify-between">
                  <span className="text-2xs text-ink-400">
                    Posted {formatDate(job.publish_at ?? job.created_at)}
                  </span>
                  <Link
                    to={`/jobs/${job.slug}`}
                    className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                  >
                    View role
                    <ArrowRight aria-hidden />
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* -- Board numbers ------------------------------------------------- */}
      <section className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold tracking-tight text-ink-900">
              On the board right now
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Live figures taken from the current vacancy list.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Open roles"
              value={jobs.length}
              tone="brand"
              icon={ClipboardList}
            />
            <StatCard
              label="Openings"
              value={openings}
              tone="info"
              icon={Users}
            />
            <StatCard
              label="Departments"
              value={departments}
              tone="accent"
              icon={Building2}
            />
            <StatCard
              label="Locations"
              value={locations}
              tone="success"
              icon={MapPin}
            />
          </div>
        </div>
      </section>

      {/* -- CTA ------------------------------------------------------------ */}
      <section className="bg-brand-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Ready to hire, or ready to apply?
            </h2>
            <p className="mt-2 text-sm text-brand-100">
              Administrators manage postings, applications, interviews,
              shortlists and access codes from the admin console. Applicants
              follow every stage from the applicant portal. Appointed staff
              complete onboarding in the staff portal.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/careers"
              className={buttonVariants({ variant: 'primary', size: 'lg' })}
            >
              View open roles
              <ArrowRight aria-hidden />
            </Link>
            <Link
              to="/applicant"
              className={buttonVariants({ variant: 'secondary', size: 'lg' })}
            >
              Applicant portal
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
