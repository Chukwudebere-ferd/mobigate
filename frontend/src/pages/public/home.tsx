import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarCheck,
  ClipboardList,
  KeyRound,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { HeroCollage } from '@/components/public/hero-collage'
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
import { cn } from '@/lib/cn'
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

type Tint = 'brand' | 'success' | 'accent' | 'info'

const CAPABILITIES: {
  title: string
  icon: typeof ClipboardList
  tint: Tint
  description: string
}[] = [
  {
    title: 'Recruitment pipeline',
    icon: ClipboardList,
    tint: 'brand',
    description:
      'Post a role, publish it to the careers page, and take applications with a CV and photograph. Every applicant is issued a sequential application number on submission.',
  },
  {
    title: 'Interview & shortlisting',
    icon: CalendarCheck,
    tint: 'success',
    description:
      'Publish dated interview announcements scoped to a single job. Shortlist in bulk, with a confirmation message that is mandatory and stored verbatim against each candidate.',
  },
  {
    title: 'Access codes & onboarding',
    icon: KeyRound,
    tint: 'accent',
    description:
      'Issue single-use, time-boxed, revocable access codes, held only as hashes. Redeeming one creates the staff record, allocates the Staff ID and writes the audit entry together.',
  },
  {
    title: 'Personnel records',
    icon: ShieldCheck,
    tint: 'info',
    description:
      'Structured, queryable staff records across bio-data, banking, guarantor, next of kin and documents. Bank and family details stay visible only to the owner and administrators.',
  },
]

const TINT_CLASSES: Record<Tint, { card: string; icon: string }> = {
  brand: {
    card: 'bg-brand-50 ring-brand-100',
    icon: 'bg-brand-600 text-white',
  },
  success: {
    card: 'bg-success-50 ring-success-100',
    icon: 'bg-success-600 text-white',
  },
  accent: {
    card: 'bg-accent-50 ring-accent-200',
    icon: 'bg-accent-700 text-white',
  },
  info: {
    card: 'bg-info-50 ring-info-100',
    icon: 'bg-info-600 text-white',
  },
}

const GUARANTEES = [
  'Every admin account is approved by a super admin before it can act',
  'A shortlisted application locks for applicant editing',
  'Five failed redemption attempts lock an access code',
  'Codes expire on a configurable clock — 14 days by default',
  'Every status change is written to an append-only audit log',
]

const PRINCIPLES = [
  {
    title: 'Administrator-mediated onboarding',
    body: 'No person reaches an active staff account without a human verification step.',
  },
  {
    title: 'State-scoped administration',
    body: 'Each state runs its own administration boundary, candidate pool and ID sequence.',
  },
  {
    title: 'Everything is auditable',
    body: 'Status transitions, code issuance, code redemption and CV downloads are all logged with actor and timestamp.',
  },
]

const DEPARTMENTS = [
  'Engineering',
  'Operations',
  'Finance',
  'Legal',
  'Marketing',
  'Human Resources',
]

export function HomePage() {
  const { data: jobs = [] } = useQuery({
    queryKey: ['public', 'jobs'],
    queryFn: () => publicApi.listJobs(),
  })

  const openRoles = jobs.slice(0, 4)
  const locations = new Set(
    jobs.map((job) => job.location_name ?? locationPath(job.location_id)),
  ).size
  const openings = jobs.reduce((sum, job) => sum + job.openings, 0)
  const departments = new Set(
    jobs.map((job) => job.title.split(' ')[0]),
  ).size
  const recentAudit = auditLogs.slice(0, 4)

  return (
    <div className="bg-ink-50">
      {/* -- Hero ------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-brand-950">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-grid-light opacity-25"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <Badge className="gap-1.5 border border-brand-700 bg-brand-900/60 text-accent-300 ring-0">
                <Building2 aria-hidden />
                MGM-Portal · Recruitment &amp; Staff Management
              </Badge>

              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white text-balance sm:text-5xl lg:text-6xl lg:leading-[1.05]">
                From application to Staff ID — every step on the record
              </h1>

              <p className="mt-6 max-w-xl text-base text-brand-100 text-balance sm:text-lg">
                MGM-Portal runs the Group&apos;s recruitment and personnel
                workflow — postings, applications, interviews, shortlisting,
                access codes and staff onboarding. Built for a group operating
                across states, and designed so that nobody reaches an active
                staff account without a human verification step.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/careers"
                  className={cn(
                    buttonVariants({ variant: 'primary', size: 'lg' }),
                    'bg-white text-brand-900 shadow-xs hover:bg-brand-50',
                  )}
                >
                  View open roles
                  <ArrowRight aria-hidden />
                </Link>
                <a
                  href="#platform"
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'lg' }),
                    'bg-transparent text-white ring-1 ring-brand-600 hover:bg-brand-900 hover:text-white active:bg-brand-800',
                  )}
                >
                  See what it does
                </a>
              </div>

              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-brand-800 pt-7">
                <div>
                  <dt className="text-2xs font-medium tracking-wider text-brand-300 uppercase">
                    Open roles
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-white tabular">
                    {jobs.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs font-medium tracking-wider text-brand-300 uppercase">
                    Openings
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-white tabular">
                    {openings}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs font-medium tracking-wider text-brand-300 uppercase">
                    Locations
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-white tabular">
                    {locations}
                  </dd>
                </div>
              </dl>
            </div>

            <HeroCollage />
          </div>
        </div>
      </section>

      {/* -- Departments strip ------------------------------------------------ */}
      <section className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p className="text-center text-2xs font-semibold tracking-wider text-ink-400 uppercase">
            Hiring across the Group
          </p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {DEPARTMENTS.map((department) => (
              <li
                key={department}
                className="text-sm font-medium tracking-wide text-ink-500"
              >
                {department}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* -- Capabilities ------------------------------------------------------ */}
      <section id="platform" className="scroll-mt-20 border-b border-ink-200">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-2xs font-semibold tracking-wider text-brand-700 uppercase">
              What the platform does
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 text-balance sm:text-4xl">
              One system for the whole employment journey
            </h2>
            <p className="mt-4 text-base text-ink-600 text-balance">
              Four connected modules, one auditable record. An applicant who
              enters at the careers page is the same person in the staff
              directory a few weeks later.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((capability) => {
              const tint = TINT_CLASSES[capability.tint]
              return (
                <div
                  key={capability.title}
                  className={`flex flex-col rounded-2xl p-6 ring-1 ${tint.card}`}
                >
                  <h3 className="text-base font-semibold text-ink-900">
                    {capability.title}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-600">
                    {capability.description}
                  </p>
                  <span
                    className={`mt-6 flex size-11 items-center justify-center rounded-xl ${tint.icon}`}
                  >
                    <capability.icon aria-hidden className="size-5" />
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* -- Verification before access ---------------------------------------- */}
      <section className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-2xs font-semibold tracking-wider text-brand-700 uppercase">
                Verification before access
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 text-balance sm:text-4xl">
                No staff account without a human in the loop
              </h2>
              <p className="mt-4 text-base text-ink-600">
                Staff records are not created by a form submission. They are
                created by an access code that a named administrator issued,
                which the candidate redeemed — and all four facts are recorded.
              </p>

              <ul className="mt-8 space-y-3.5">
                {GUARANTEES.map((guarantee) => (
                  <li key={guarantee} className="flex gap-3">
                    <ShieldCheck
                      aria-hidden
                      className="mt-0.5 size-4.5 shrink-0 text-brand-600"
                    />
                    <span className="text-sm text-ink-700">{guarantee}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex items-center gap-5 rounded-2xl border border-brand-200 bg-brand-50/60 p-6">
                <p className="text-4xl font-semibold text-brand-800 tabular">
                  Zero
                </p>
                <p className="text-sm text-ink-700">
                  staff accounts created without a verification event and a
                  redeemed access code on record.
                </p>
              </div>
            </div>

            <div>
              <ProductVisual />
            </div>
          </div>
        </div>
      </section>

      {/* -- Audit trail ------------------------------------------------------- */}
      <section className="border-b border-ink-200">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
            <Card className="overflow-hidden">
              <CardHeader className="bg-ink-50/60">
                <CardTitle>Audit trail</CardTitle>
                <CardDescription>
                  Append-only. Every entry carries the actor, the action and the
                  time.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-ink-100">
                  {recentAudit.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-start justify-between gap-4 px-5 py-3.5"
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

            <div>
              <p className="text-2xs font-semibold tracking-wider text-brand-700 uppercase">
                Traceable communication
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 text-balance sm:text-4xl">
                Every message to a candidate is kept verbatim
              </h2>
              <p className="mt-4 text-base text-ink-600">
                Receipts, interview announcements, shortlist confirmations and
                access codes are all stored exactly as they were sent and
                linked to the applicant. A shortlisted candidate sees their
                confirmation message; a rejected one never does.
              </p>
              <Link
                to="/careers"
                className={buttonVariants({ variant: 'outline' })}
              >
                <span className="hidden sm:inline">See the open roles</span>
                <span className="sm:hidden">Open roles</span>
                <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* -- Open roles -------------------------------------------------------- */}
      <section className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-2xs font-semibold tracking-wider text-brand-700 uppercase">
                Careers
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 text-balance sm:text-4xl">
                The Group is hiring
              </h2>
              <p className="mt-4 text-base text-ink-600">
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

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
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
                    <span className="text-2xs text-ink-400">
                      Closes {untilNow(job.deadline_at)}
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

      {/* -- Board numbers ----------------------------------------------------- */}
      <section className="border-b border-ink-200">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-ink-900">
              On the board right now
            </h2>
            <p className="mt-2 text-base text-ink-500">
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

      {/* -- Principles -------------------------------------------------------- */}
      <section className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-2xs font-semibold tracking-wider text-brand-700 uppercase">
              How we build it
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 text-balance sm:text-4xl">
              Three principles behind every release
            </h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-10">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title} className="border-t-2 border-ink-900 pt-5">
                <h3 className="text-lg font-semibold text-ink-900">
                  {principle.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">
                  {principle.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -- Closing band ------------------------------------------------------- */}
      <section className="bg-brand-950">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-white text-balance sm:text-5xl sm:leading-[1.1]">
              Ready to hire, or ready to apply?
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/careers"
                className={cn(
                  buttonVariants({ variant: 'primary', size: 'lg' }),
                  'bg-white text-brand-900 shadow-xs hover:bg-brand-50',
                )}
              >
                View open roles
                <ArrowUpRight aria-hidden />
              </Link>
              <Link
                to="/applicant"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'lg' }),
                  'bg-transparent text-white ring-1 ring-brand-600 hover:bg-brand-900 hover:text-white active:bg-brand-800',
                )}
              >
                Applicant portal
              </Link>
            </div>
          </div>
          <p className="mt-10 max-w-2xl border-t border-brand-800 pt-8 text-sm text-brand-200">
            Administrators manage postings, applications, interviews,
            shortlists and access codes from the admin console. Applicants
            follow every stage from the applicant portal. Appointed staff
            complete onboarding in the staff portal.
          </p>
        </div>
      </section>
    </div>
  )
}
