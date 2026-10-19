import { useQuery } from '@tanstack/react-query'
import {
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  Check,
  MapPin,
  Search,
  SearchX,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Avatar } from '@/components/ui/avatar'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Select } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { employmentCategoryLabels, locationPath, publicApi } from '@/lib/api'
import { formatDate } from '@/lib/format'
import type { EmploymentCategory, Job } from '@/types/domain'

/**
 * The public careers page.
 *
 * A flat, editorial listing: a short statement of intent, department filters,
 * then one row per role with the title, a one-line summary and the facts a
 * candidate needs to decide (location, category, deadline). The process strip
 * and the culture note sit below the list, where a candidate has already
 * found a role and is deciding whether to apply.
 */

/**
 * The public Job model carries no `department_id`, so the careers page groups
 * roles by team using the title. Replace with a server-provided department
 * once the Job contract carries one.
 */
const DEPARTMENT_RULES: { name: string; keywords: string[] }[] = [
  {
    name: 'Engineering',
    keywords: ['engineer', 'developer', 'software', 'data', 'platform'],
  },
  { name: 'Finance', keywords: ['finance', 'account', 'audit', 'payroll'] },
  {
    name: 'Operations',
    keywords: ['operation', 'logistics', 'supply', 'procurement'],
  },
  {
    name: 'Marketing',
    keywords: ['marketing', 'brand', 'communications', 'growth'],
  },
  { name: 'Legal', keywords: ['legal', 'counsel', 'compliance'] },
  {
    name: 'Human Resources',
    keywords: ['human resource', 'hr', 'people', 'talent', 'recruit'],
  },
]

/** The four stages a candidate moves through, in order. */
const PROCESS_STEPS = [
  {
    title: 'Apply online',
    body: 'One form, one CV, one photograph. You get an application number the moment you submit.',
  },
  {
    title: 'Interview',
    body: 'Announcements are published against the role you applied for, with the date, venue and instructions.',
  },
  {
    title: 'Shortlist',
    body: 'A written confirmation reaches you the moment you are shortlisted, with everything you need to bring.',
  },
  {
    title: 'Staff ID',
    body: 'Redeem your access code, complete your staff record, and your Staff ID is issued on the spot.',
  },
]

/**
 * Placeholder culture note. There is no API source for this yet — it is
 * authored copy that a content source should replace before launch.
 */
const CULTURE_NOTE = {
  quote:
    'We hire people who would rather own a problem than pass it on. You get the context behind the task, not just the task — and the record of what you built stays yours.',
  name: 'Tunde Adebisi',
  role: 'Senior Backend Engineer, Engineering',
}

const STEPS = [
  {
    title: 'Apply',
    description:
      'Submit your details, CV and a passport photograph. You get an application number straight away.',
    icon: ClipboardCheck,
  },
  {
    title: 'Interview',
    description:
      'Shortlisted candidates are invited to an interview session, with the date and venue sent to you.',
    icon: CalendarClock,
  },
  {
    title: 'Shortlist',
    description:
      'Interview feedback and references are reviewed before the shortlist is confirmed.',
    icon: CircleCheck,
  },
  {
    title: 'Appointment',
    description:
      'Successful applicants receive an access code and begin staff onboarding.',
    icon: Briefcase,
  },
]

interface RoleRow {
  job: Job
  department: string
  locationName: string
  category: EmploymentCategory | null
  closed: boolean
}

function departmentOf(job: Job): string {
  const title = job.title.toLowerCase()
  const match = DEPARTMENT_RULES.find((rule) =>
    rule.keywords.some((keyword) => title.includes(keyword)),
  )
  return match ? match.name : 'General'
}

/** Whole days left until `deadline`; negative once it has passed. */
function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null
  const target = new Date(deadline).getTime()
  if (Number.isNaN(target)) return null
  return Math.ceil((target - Date.now()) / 86_400_000)
}

function excerpt(text: string, length = 150): string {
  if (text.length <= length) return text
  const cut = text.slice(0, length)
  const lastStop = cut.lastIndexOf('. ')
  if (lastStop > 60) return cut.slice(0, lastStop + 1)
  return `${cut.trimEnd()}…`
}

export function CareersPage() {
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('all')
  const [location, setLocation] = useState('all')
  const [jobType, setJobType] = useState('all')

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['public', 'jobs'],
    queryFn: () => publicApi.listJobs(),
  })

  const rows = useMemo<RoleRow[]>(
    () =>
      jobs.map((job) => {
        const remaining = daysUntil(job.deadline_at)
        return {
          job,
          department: departmentOf(job),
          locationName: job.location_name ?? locationPath(job.location_id),
          category: job.employment_category,
          closed: remaining !== null && remaining < 0,
        }
      }),
    [jobs],
  )

  const departments = useMemo(
    () => [...new Set(rows.map((row) => row.department))].sort(),
    [rows],
  )
  const locations = useMemo(
    () => [...new Set(rows.map((row) => row.locationName))].sort(),
    [rows],
  )
  const categories = useMemo(
    () =>
      [
        ...new Set(
          rows
            .map((row) => row.category)
            .filter((value): value is EmploymentCategory => value !== null),
        ),
      ].sort(),
    [rows],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (department !== 'all' && row.department !== department) return false
      if (location !== 'all' && row.locationName !== location) return false
      if (jobType !== 'all' && row.category !== jobType) return false
      if (!term) return true
      return (
        row.job.title.toLowerCase().includes(term) ||
        row.job.description.toLowerCase().includes(term) ||
        row.locationName.toLowerCase().includes(term) ||
        row.department.toLowerCase().includes(term)
      )
    })
  }, [rows, search, department, location, jobType])

  const isFiltered =
    search.trim() !== '' ||
    department !== 'all' ||
    location !== 'all' ||
    jobType !== 'all'

  const resetFilters = () => {
    setSearch('')
    setDepartment('all')
    setLocation('all')
    setJobType('all')
  }

  const totalOpenings = filtered.reduce(
    (sum, row) => sum + row.job.openings,
    0,
  )

  return (
    <div className="bg-white">
      {/* -- Hero ------------------------------------------------------------ */}
      <section className="relative overflow-hidden border-b border-ink-200">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_15%_-20%,var(--color-brand-100),transparent_60%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(45rem_28rem_at_90%_110%,var(--color-accent-100),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-ink-950 text-balance sm:text-5xl sm:leading-[1.08]">
            Be part of our mission
          </h1>
          <p className="mt-5 max-w-2xl text-base text-ink-600 text-balance sm:text-lg">
            We&apos;re hiring across the Group — engineering, operations,
            finance, legal, marketing and people. We value flat hierarchies,
            clear communication, and full ownership of the work.
          </p>
          <Link
            to="/applicant"
            className={cn(
              buttonVariants({ variant: 'link' }),
              'mt-4 px-0 text-sm',
            )}
          >
            Already applied? Track your application
            <ArrowUpRight aria-hidden />
          </Link>
        </div>
      </section>

      {/* -- Filters ---------------------------------------------------------- */}
      <section className="border-b border-ink-200">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div
              role="group"
              aria-label="Filter roles by department"
              className="-mx-1 flex flex-1 flex-wrap gap-2 px-1"
            >
              <FilterPill
                active={department === 'all'}
                onClick={() => setDepartment('all')}
              >
                View all
              </FilterPill>
              {departments.map((name) => (
                <FilterPill
                  key={name}
                  active={department === name}
                  onClick={() => setDepartment(name)}
                >
                  {name}
                </FilterPill>
              ))}
            </div>

            <div className="relative lg:w-72">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400"
              />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search roles"
                aria-label="Search roles by title, keyword or location"
                className="h-9 pl-9"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Select
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              aria-label="Filter roles by location"
              className="h-9 w-auto min-w-44 text-xs"
            >
              <option value="all">All locations</option>
              {locations.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>

            <Select
              value={jobType}
              onChange={(event) => setJobType(event.target.value)}
              aria-label="Filter roles by employment category"
              className="h-9 w-auto min-w-40 text-xs"
            >
              <option value="all">All employment types</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {employmentCategoryLabels[category]}
                </option>
              ))}
            </Select>

            <span className="text-2xs text-ink-500">
              {isLoading
                ? 'Loading roles…'
                : `${filtered.length} ${filtered.length === 1 ? 'role' : 'roles'} · ${totalOpenings} ${totalOpenings === 1 ? 'opening' : 'openings'}`}
            </span>

            {isFiltered ? (
              <button
                type="button"
                onClick={resetFilters}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {/* -- Roles ------------------------------------------------------------ */}
      <section>
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 sm:py-8">
          {isLoading ? null : filtered.length === 0 ? (
            <div className="rounded-xl border border-ink-200">
              <EmptyState
                icon={SearchX}
                title="No roles match your search"
                description="Try a different keyword, location or employment type — new roles are published every week."
                action={
                  <button
                    type="button"
                    onClick={resetFilters}
                    className={buttonVariants({ variant: 'outline' })}
                  >
                    Clear filters
                  </button>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-ink-200">
              {filtered.map((row) => (
                <li key={row.job.id} className="py-7 sm:py-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold tracking-tight text-ink-950 sm:text-xl">
                        <Link
                          to={`/jobs/${row.job.slug}`}
                          className="transition-colors hover:text-brand-700"
                        >
                          {row.job.title}
                        </Link>
                      </h2>

                      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-600">
                        {excerpt(row.job.description)}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Tag icon={MapPin}>{row.locationName}</Tag>
                        {row.category ? (
                          <Tag icon={Briefcase}>
                            {employmentCategoryLabels[row.category]}
                          </Tag>
                        ) : null}
                        <Tag icon={Users}>
                          {row.job.openings}{' '}
                          {row.job.openings === 1 ? 'opening' : 'openings'}
                        </Tag>
                        {row.job.deadline_at ? (
                          <Tag icon={CalendarClock}>
                            Closes {formatDate(row.job.deadline_at)}
                          </Tag>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0 sm:pt-1">
                      {row.closed ? (
                        <span className="text-sm font-medium text-ink-400">
                          Applications closed
                        </span>
                      ) : (
                        <Link
                          to={`/apply/${row.job.slug}`}
                          className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-900"
                        >
                          Apply
                          <ArrowUpRight aria-hidden className="size-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* -- Process ---------------------------------------------------------- */}
      <section id="process" className="border-t border-ink-200 bg-ink-50">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">
            How the process works
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-ink-600">
            Four stages, and you can check where you stand at any time from the
            applicant portal.
          </p>

          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS_STEPS.map((step, index) => (
              <li key={step.title} className="border-t-2 border-ink-900 pt-5">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-3 text-base font-semibold text-ink-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-ink-600">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -- Culture note ------------------------------------------------------ */}
      <section className="relative overflow-hidden border-t border-ink-200 bg-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_24rem_at_50%_120%,var(--color-brand-50),transparent_65%)]"
        />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <blockquote className="text-2xl font-medium leading-snug tracking-tight text-ink-900 text-balance sm:text-3xl">
            {CULTURE_NOTE.quote}
          </blockquote>
          <div className="mt-9 flex flex-col items-center gap-3">
            <Avatar
              first={CULTURE_NOTE.name.split(' ')[0]}
              last={CULTURE_NOTE.name.split(' ')[1]}
              size="lg"
            />
            <div>
              <p className="text-sm font-semibold text-ink-900">
                {CULTURE_NOTE.name}
              </p>
              <p className="text-xs text-ink-500">{CULTURE_NOTE.role}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors',
        active
          ? 'border-brand-700 bg-brand-700 text-white'
          : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900',
      )}
    >
      {active ? <Check aria-hidden className="size-3.5" /> : null}
      {children}
    </button>
  )
}

function Tag({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-2xs text-ink-600">
      <Icon aria-hidden className="size-3.5 text-ink-400" />
      {children}
    </span>
  )
}
