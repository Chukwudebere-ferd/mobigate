import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarClock,
  MapPin,
  Search,
  SearchX,
  Users,
} from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, Spinner } from '@/components/ui/empty-state'
import { Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { EmploymentCategoryBadge } from '@/components/ui/status-badges'
import { publicApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDate, pluralize, untilNow } from '@/lib/format'
import type { Job } from '@/types/domain'

/**
 * The public job listings.
 *
 * Filtered client-side: the published set is small, and it keeps the page
 * instant without a round trip on every keystroke.
 */
export function CareersPage() {
  const jobsQuery = useQuery({
    queryKey: ['public', 'jobs'],
    queryFn: () => publicApi.listJobs(),
  })

  const [search, setSearch] = React.useState('')
  const [category, setCategory] = React.useState('all')
  const [location, setLocation] = React.useState('all')

  const jobs = jobsQuery.data ?? []

  const categories = React.useMemo(
    () =>
      Array.from(
        new Set(
          jobs
            .map((job) => job.employment_category)
            .filter((c): c is NonNullable<typeof c> => Boolean(c)),
        ),
      ).sort(),
    [jobs],
  )

  const locations = React.useMemo(
    () =>
      Array.from(
        new Set(jobs.map((job) => job.location_name).filter(Boolean)),
      ).sort(),
    [jobs],
  )

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    return jobs.filter((job) => {
      if (category !== 'all' && job.employment_category !== category)
        return false
      if (location !== 'all' && job.location_name !== location) return false
      if (!needle) return true
      return (
        job.title.toLowerCase().includes(needle) ||
        job.description.toLowerCase().includes(needle) ||
        (job.location_name ?? '').toLowerCase().includes(needle)
      )
    })
  }, [jobs, search, category, location])

  const hasFilters =
    search.trim() !== '' || category !== 'all' || location !== 'all'

  function clearFilters() {
    setSearch('')
    setCategory('all')
    setLocation('all')
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeader
        title="Open roles"
        description="Every vacancy at Mobigate Group, with the location, category and closing date for each. Applications are reviewed by a person, and shortlisted candidates are told exactly what happens next."
      />

      {/* -- Filters -- */}
      <Card className="mt-6">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400"
              aria-hidden
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, description or location"
              className="pl-9"
              aria-label="Search roles"
            />
          </div>

          <Select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="sm:w-48"
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </Select>

          <Select
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="sm:w-56"
            aria-label="Filter by location"
          >
            <option value="all">All locations</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              Clear
            </button>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-sm text-ink-500">
        {hasFilters
          ? `${pluralize(filtered.length, 'role')} matching your filters`
          : `${pluralize(jobs.length, 'role')} currently open`}
      </p>

      {/* -- Job list -- */}
      {jobsQuery.isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon={hasFilters ? SearchX : Search}
            title={
              hasFilters
                ? 'No roles match these filters'
                : 'There are no open roles right now'
            }
            description={
              hasFilters
                ? 'Try widening your search, or clear the filters to see every open role.'
                : 'Check back soon — new vacancies are posted as they are approved.'
            }
            action={
              hasFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className={buttonVariants({ variant: 'outline' })}
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </ul>
      )}
    </div>
  )
}

function JobCard({ job }: { job: Job }) {
  const closesSoon =
    job.deadline_at !== null &&
    new Date(job.deadline_at).getTime() - Date.now() < 7 * 86_400_000

  return (
    <li>
      <Card className="group h-full transition-shadow hover:shadow-md">
        <CardContent className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink-900">
                <Link
                  to={`/jobs/${job.slug}`}
                  className="hover:text-brand-700"
                >
                  {job.title}
                </Link>
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                {job.location_name ?? 'Location to be confirmed'}
              </p>
            </div>
            {job.employment_category && (
              <EmploymentCategoryBadge
                category={job.employment_category}
                className="shrink-0"
              />
            )}
          </div>

          <p className="mt-3 line-clamp-3 flex-1 text-sm text-ink-500">
            {job.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-500">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden />
              {pluralize(job.openings, 'opening')}
            </span>
            {job.deadline_at && (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5',
                  closesSoon && 'font-medium text-warning-700',
                )}
              >
                <CalendarClock className="size-3.5" aria-hidden />
                {closesSoon
                  ? `Closes ${untilNow(job.deadline_at)}`
                  : `Closes ${formatDate(job.deadline_at)}`}
              </span>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
            <span className="text-xs text-ink-400">
              Posted {formatDate(job.publish_at)}
            </span>
            <Badge variant="outline" className="gap-1">
              View role
              <ArrowRight
                className="size-3 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Badge>
          </div>
        </CardContent>
      </Card>
    </li>
  )
}
