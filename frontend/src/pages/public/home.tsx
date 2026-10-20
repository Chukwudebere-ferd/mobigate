import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  ClipboardList,
  KeyRound,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { HeroCollage } from '@/components/public/hero-collage'
import { PipelineBoard } from '@/components/public/pipeline-board'
import { ProductVisual } from '@/components/public/product-visual'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

const CAPABILITIES: {
  title: string
  icon: typeof ClipboardList
  description: string
}[] = [
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
  const recentAudit = auditLogs.slice(0, 4)

  return (
    <div className="bg-ink-100">
      {/* -- Hero: full-bleed, centered type, avatar orbit -- */}
      <section className="relative overflow-hidden border-b border-ink-200 bg-white">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-brand-50 blur-3xl" />
          <div className="absolute top-40 -left-40 h-80 w-80 rounded-full bg-accent-50 blur-3xl" />
          <div className="absolute top-40 -right-40 h-80 w-80 rounded-full bg-brand-50 blur-3xl" />
        </div>
        <div className="relative mx-auto w-full px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
          <HeroCollage className="pointer-events-none absolute inset-0 hidden lg:block" />
            <div className="relative mx-auto max-w-3xl text-center">
              <h1 className="animate-fade-up text-5xl font-semibold tracking-tight text-balance text-ink-900 sm:text-6xl lg:text-7xl lg:leading-[1.02]">
                One portal to{' '}
                <span className="relative inline-block text-brand-800">
                  recruit
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-1 h-2 rounded-full bg-accent-300 sm:-bottom-1.5"
                  />
                </span>
                <span className="mt-2 block">verify, and onboard staff</span>
              </h1>

              <p
                className="animate-fade-up mx-auto mt-6 max-w-xl text-base text-ink-600 text-balance sm:text-lg"
                style={{ animationDelay: '120ms' }}
              >
                Post a role, take applications with CV and photo, shortlist
                with a written confirmation, issue an access code — and watch
                a Staff ID land on the record. Every step audited.
              </p>

              <div
                className="animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-3"
                style={{ animationDelay: '200ms' }}
              >
                <Link
                  to="/careers"
                  className={buttonVariants({ variant: 'primary', size: 'lg' })}
                >
                  Start hiring
                  <ArrowRight aria-hidden />
                </Link>
                <Link
                  to="/careers"
                  className={buttonVariants({ variant: 'secondary', size: 'lg' })}
                >
                  View open roles
                </Link>
              </div>

              {/* -- Partner-style strip: hiring footprint, not logos -- */}
              <div
                className="animate-fade-up mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-ink-200 pt-7"
                style={{ animationDelay: '280ms' }}
              >
                <p className="w-full text-2xs font-semibold tracking-wider text-ink-400 uppercase sm:w-auto sm:text-left">
                  Live pipeline
                </p>
                <p className="text-sm font-semibold text-ink-900 tabular">
                  {jobs.length} open roles
                </p>
                <p className="text-sm font-semibold text-ink-900 tabular">
                  {openings} openings
                </p>
                <p className="text-sm font-semibold text-ink-900 tabular">
                  {locations} locations
                </p>
              </div>
            </div>

            {/* -- Mobile / tablet cards sit under the strip -- */}
            <HeroCollage className="mx-auto mt-12 max-w-2xl lg:hidden" />
          </div>
      </section>

      {/* -- Capabilities ------------------------------------------------------ */}
      <section id="platform" className="scroll-mt-20 border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-center text-2xs font-semibold tracking-wider text-ink-400 uppercase">
            <span className="w-full sm:w-auto">Hiring across</span>
            {DEPARTMENTS.map((department, index) => (
              <span
                key={department}
                className="flex items-center whitespace-nowrap"
              >
                {index > 0 && (
                  <span aria-hidden className="mr-1 hidden text-ink-300 sm:inline">
                    ·
                  </span>
                )}
                {department}
              </span>
            ))}
          </p>
          <div className="mx-auto mt-6 max-w-2xl text-center">
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

          <div className="mt-12">
            <PipelineBoard />
          </div>

          <p className="mt-4 text-center text-2xs text-ink-400">
            A live view of the pipeline — applications, interviews, shortlists
            and staff records in one place.
          </p>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((capability) => {
              return (
                <div
                  key={capability.title}
                  className="group flex flex-col rounded-2xl border border-ink-200 bg-white p-6 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
                >
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    <capability.icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-ink-900">
                    {capability.title}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">
                    {capability.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* -- Verification before access ---------------------------------------- */}
      <section className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="text-2xs font-semibold tracking-wider text-brand-700 uppercase">
                Verification before access
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 text-balance sm:text-4xl">
                No staff account without a human in the loop
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-600">
                Staff records are not created by a form submission. They are
                created by an access code that a named administrator issued,
                which the candidate redeemed — and all four facts are recorded.
              </p>

              <ul className="mt-8 space-y-3">
                {GUARANTEES.map((guarantee) => (
                  <li
                    key={guarantee}
                    className="flex items-start gap-3 rounded-xl border border-ink-200 bg-ink-50/60 px-4 py-3"
                  >
                    <ShieldCheck
                      aria-hidden
                      className="mt-0.5 size-4.5 shrink-0 text-brand-600"
                    />
                    <span className="text-sm text-ink-700">{guarantee}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-5 rounded-2xl border border-brand-200 bg-brand-50 p-6 shadow-xs sm:p-8">
                <p className="text-5xl font-semibold tracking-tight text-brand-800 tabular sm:text-6xl">
                  Zero
                </p>
                <p className="max-w-xs text-sm leading-relaxed text-ink-700">
                  staff accounts created without a verification event and a
                  redeemed access code on record.
                </p>
              </div>
              <ProductVisual />
            </div>
          </div>
        </div>
      </section>

      {/* -- Audit trail ------------------------------------------------------- */}
      <section className="border-b border-ink-200 bg-ink-50/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Card className="overflow-hidden shadow-sm">
              <CardHeader className="bg-white">
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
              <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-600">
                Receipts, interview announcements, shortlist confirmations and
                access codes are all stored exactly as they were sent and
                linked to the applicant. A shortlisted candidate sees their
                confirmation message; a rejected one never does.
              </p>
              <Link
                to="/careers"
                className={buttonVariants({ variant: 'outline', className: 'mt-7' })}
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
              <Card
                key={job.id}
                className="flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
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

      {/* -- Principles: three quiet rules ------------------------------------- */}
      <section className="border-b border-ink-200">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-2xs font-semibold tracking-wider text-brand-700 uppercase">
              How we build it
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink-900 text-balance sm:text-4xl">
              Three principles behind every release
            </h2>
          </div>
          <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">
            {PRINCIPLES.map((principle, index) => (
              <div
                key={principle.title}
                className="rounded-2xl border border-ink-200 bg-white p-6 shadow-xs"
              >
                <p className="font-mono text-xs font-semibold text-brand-600 tabular">
                  0{index + 1}
                </p>
                <h3 className="mt-3 text-base font-semibold text-ink-900">
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
