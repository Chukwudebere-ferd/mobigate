import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Building,
  Clock,
  MapPin,
  Search,
  SearchX,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

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
import { PageHeader } from '@/components/ui/page-header'
import { EmploymentCategoryBadge } from '@/components/ui/status-badges'
import { employmentCategoryLabels, locationPath, publicApi } from '@/lib/api'
import { formatDate, untilNow } from '@/lib/format'
import type { EmploymentCategory, Job } from '@/types/domain'

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

  const totalOpenings = filtered.reduce(
    (sum, row) => sum + row.job.openings,
    0,
  )

  return (
    <div className="bg-ink-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <PageHeader
          title="Open roles"
          description="Every vacancy the Group is currently hiring for. Apply online, keep your application number, and follow your status through each stage."
          actions={
            <Link
              to="/applicant"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Track my application
              <ArrowRight aria-hidden />
            </Link>
          }
        />

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

        {/* -- Results summary -- */}
        <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink-900">
              {isLoading ? 'Loading roles…' : `${filtered.length} roles open`}
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              {totalOpenings} {totalOpenings === 1 ? 'opening' : 'openings'} in
              total across {locations.length}{' '}
              {locations.length === 1 ? 'location' : 'locations'}
            </p>
          </div>
          {filtered.length > 0 && rows.length !== filtered.length ? (
            <button
              type="button"
              onClick={resetFilters}
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        {/* -- Roles -- */}
        {isLoading ? null : filtered.length === 0 ? (
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

        {/* -- How it works -- */}
        <Card className="mt-10">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink-900">
                  How the process works
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Four stages, and you can check where you stand at any time.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-2xs text-ink-500">
                <Building aria-hidden className="size-3.5" />
                Mobigate House, Lagos
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
