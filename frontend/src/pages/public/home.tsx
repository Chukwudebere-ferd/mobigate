import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Briefcase,
  Building,
  CalendarClock,
  CircleCheck,
  ClipboardCheck,
  Clock,
  MapPin,
  Search,
  SearchX,
  Sparkles,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

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
import { EmptyState } from '@/components/ui/empty-state'
import { Field, Input, Select } from '@/components/ui/input'
import { EmploymentCategoryBadge } from '@/components/ui/status-badges'
import { employmentCategoryLabels, locationPath, publicApi } from '@/lib/api'
import { formatDate, untilNow } from '@/lib/format'
import type { EmploymentCategory, Job } from '@/types/domain'

/**
 * The public Job model carries no `department_id`, so the careers site groups
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
      'Shortlisted candidates are invited to an interview session at Mobigate House, Lagos.',
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
}

function departmentOf(job: Job): string {
  const title = job.title.toLowerCase()
  const match = DEPARTMENT_RULES.find((rule) =>
    rule.keywords.some((keyword) => title.includes(keyword)),
  )
  return match ? match.name : 'General'
}

function excerpt(text: string, length = 160): string {
  if (text.length <= length) return text
  return `${text.slice(0, length).trimEnd()}…`
}

export function HomePage() {
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
      jobs.map((job) => ({
        job,
        department: departmentOf(job),
        locationName: job.location_name ?? locationPath(job.location_id),
        category: job.employment_category,
      })),
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

  const resetFilters = () => {
    setSearch('')
    setDepartment('all')
    setLocation('all')
    setJobType('all')
  }

  return (
    <div className="bg-ink-50">
      {/* -- Hero ---------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-ink-200 bg-ink-50">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-grid opacity-70"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <Badge variant="brand" className="gap-1.5">
            <Sparkles aria-hidden />
            Careers at Mobigate Group
          </Badge>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-ink-900 text-balance sm:text-4xl">
            Build the systems that move people and goods across Nigeria
          </h1>
          <p className="mt-4 max-w-2xl text-base text-ink-600">
            We hire engineers, operators, finance, legal and marketing
            professionals to run the Group&apos;s recruitment, mobility and
            personnel platforms. Pick a role, apply online, and track your
            application every step of the way.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Badge variant="neutral" className="gap-1.5">
              <Briefcase aria-hidden />
              {rows.length} open roles
            </Badge>
            <Badge variant="neutral" className="gap-1.5">
              <MapPin aria-hidden />
              {locations.length} locations
            </Badge>
            <Badge variant="neutral" className="gap-1.5">
              <Building aria-hidden />
              {departments.length} departments
            </Badge>
          </div>

          {/* -- Search & filters -- */}
          <Card className="mt-8">
            <CardContent className="p-4 sm:p-5">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Search roles"
                  htmlFor="role-search"
                  className="md:col-span-2"
                >
                  <div className="relative">
                    <Search
                      aria-hidden
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400"
                    />
                    <Input
                      id="role-search"
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Title, keyword or location"
                      className="pl-9"
                    />
                  </div>
                </Field>

                <Field label="Department" htmlFor="department-filter">
                  <Select
                    id="department-filter"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                  >
                    <option value="all">All departments</option>
                    {departments.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Location" htmlFor="location-filter">
                  <Select
                    id="location-filter"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                  >
                    <option value="all">All locations</option>
                    {locations.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Job type" htmlFor="job-type-filter">
                  <Select
                    id="job-type-filter"
                    value={jobType}
                    onChange={(event) => setJobType(event.target.value)}
                  >
                    <option value="all">All job types</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {employmentCategoryLabels[category]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* -- Open roles ---------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-ink-900">
              Open roles
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              {filtered.length} of {rows.length} positions available
            </p>
          </div>
          <Link
            to="/applicant"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Track my application
            <ArrowRight aria-hidden />
          </Link>
        </div>

        {isLoading ? (
          <p className="py-12 text-center text-sm text-ink-500">
            Loading open roles…
          </p>
        ) : filtered.length === 0 ? (
          <Card className="mt-6">
            <EmptyState
              icon={SearchX}
              title="No roles match your search"
              description="Try a different keyword, location or job type — new roles are published every week."
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
          </Card>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {filtered.map((row) => (
              <Card key={row.job.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">
                      <Link
                        to={`/jobs/${row.job.slug}`}
                        className="hover:text-brand-700"
                      >
                        {row.job.title}
                      </Link>
                    </CardTitle>
                    {row.category ? (
                      <EmploymentCategoryBadge category={row.category} />
                    ) : null}
                  </div>
                  <CardDescription className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin aria-hidden className="size-3.5" />
                      {row.locationName}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users aria-hidden className="size-3.5" />
                      {row.job.openings} openings
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock aria-hidden className="size-3.5" />
                      Closes {untilNow(row.job.deadline_at)}
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-ink-600">
                    {excerpt(row.job.description)}
                  </p>
                </CardContent>
                <CardFooter className="justify-between">
                  <span className="text-2xs text-ink-400">
                    Posted {formatDate(row.job.publish_at ?? row.job.created_at)}
                  </span>
                  <Link
                    to={`/jobs/${row.job.slug}`}
                    className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                  >
                    View role
                    <ArrowRight aria-hidden />
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* -- How it works -------------------------------------------------- */}
      <section className="border-y border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight text-ink-900">
            How it works
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Every application follows the same four stages, so you always know
            where you stand.
          </p>

          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <step.icon aria-hidden className="size-5 text-ink-400" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-ink-900">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm text-ink-600">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -- Closing CTA --------------------------------------------------- */}
      <section className="bg-brand-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-xl font-semibold tracking-tight text-white">
              Already applied, or joining the Group as staff?
            </h2>
            <p className="mt-2 text-sm text-brand-100">
              Applicants can follow review, interview and shortlist updates
              from the applicant portal. Staff members use the staff portal to
              complete onboarding and access the personnel records.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/applicant"
              className={buttonVariants({ variant: 'primary' })}
            >
              Applicant portal
              <ArrowRight aria-hidden />
            </Link>
            <Link
              to="/staff"
              className={buttonVariants({ variant: 'secondary' })}
            >
              Staff portal
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
