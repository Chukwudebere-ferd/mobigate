import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Briefcase,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Clock,
  FileText,
  IdCard,
  MapPin,
  Phone,
  Upload,
  UserRound,
  Users,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState, Spinner } from '@/components/ui/empty-state'
import { EmploymentCategoryBadge } from '@/components/ui/status-badges'
import { locationPath, publicApi } from '@/lib/api'
import { formatDate, untilNow } from '@/lib/format'

const DOCUMENTS = [
  {
    title: 'Curriculum vitae',
    detail: 'PDF or Word document, no more than 5 MB.',
  },
  {
    title: 'Passport photograph',
    detail: 'Recent colour photograph, no more than 2 MB.',
  },
  {
    title: 'Qualification certificates',
    detail: 'Copies of your highest qualification and transcripts.',
  },
  {
    title: 'Reference details',
    detail: 'Two referees with names, roles and phone numbers.',
  },
]

/** Whole days left until `deadline`; negative once it has passed. */
function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null
  const target = new Date(deadline).getTime()
  if (Number.isNaN(target)) return null
  return Math.ceil((target - Date.now()) / 86_400_000)
}

export function JobDetailPage() {
  const { slug } = useParams<{ slug: string }>()

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ['public', 'job', slug],
    queryFn: async () => (await publicApi.getJob(slug ?? '')) ?? null,
    enabled: Boolean(slug),
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="bg-ink-50">
        <Spinner />
      </div>
    )
  }

  if (isError || !job) {
    return (
      <div className="bg-ink-50">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <Card>
            <EmptyState
              icon={CircleAlert}
              title="This role is no longer available"
              description="The position you are looking for may have been closed, or the link may be incorrect. Browse the current openings to find another opportunity."
              action={
                <Link to="/" className={buttonVariants({})}>
                  Back to open roles
                </Link>
              }
            />
          </Card>
        </div>
      </div>
    )
  }

  const locationName = job.location_name ?? locationPath(job.location_id)
  const requirements = (job.requirements ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const remaining = daysUntil(job.deadline_at)
  const deadlinePassed = remaining !== null && remaining < 0
  const deadlineNear = remaining !== null && remaining >= 0 && remaining <= 7

  return (
    <div className="bg-ink-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* -- Breadcrumb -- */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5">
          <Link
            to="/"
            className="text-sm text-ink-500 transition-colors hover:text-ink-800"
          >
            Home
          </Link>
          <ChevronRight aria-hidden className="size-3.5 text-ink-400" />
          <span className="truncate text-sm font-medium text-ink-800">
            {job.title}
          </span>
        </nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* -- Main column -- */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{job.title}</CardTitle>
                <CardDescription className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin aria-hidden className="size-4" />
                    {locationName}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users aria-hidden className="size-4" />
                    {job.openings} openings
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock aria-hidden className="size-4" />
                    Closes {untilNow(job.deadline_at)}
                  </span>
                </CardDescription>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {job.employment_category ? (
                    <EmploymentCategoryBadge
                      category={job.employment_category}
                    />
                  ) : null}
                  <span className="text-2xs text-ink-400">
                    Posted {formatDate(job.publish_at ?? job.created_at)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <section>
                  <h2 className="text-sm font-semibold text-ink-900">
                    About the role
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-ink-600">
                    {job.description}
                  </p>
                </section>

                {requirements.length > 0 ? (
                  <section>
                    <h2 className="text-sm font-semibold text-ink-900">
                      Requirements
                    </h2>
                    <ul className="mt-3 space-y-2">
                      {requirements.map((requirement) => (
                        <li
                          key={requirement}
                          className="flex gap-2.5 text-sm text-ink-600"
                        >
                          <span
                            aria-hidden
                            className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500"
                          />
                          <span>{requirement}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <section>
                  <h2 className="text-sm font-semibold text-ink-900">
                    Documents you&apos;ll need
                  </h2>
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                    {DOCUMENTS.map((document) => (
                      <li
                        key={document.title}
                        className="flex gap-3 rounded-lg border border-ink-200 bg-ink-50/60 p-3"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-ink-200">
                          <FileText aria-hidden className="size-4 text-ink-500" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-800">
                            {document.title}
                          </p>
                          <p className="text-xs text-ink-500">
                            {document.detail}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </CardContent>
            </Card>

            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-ink-900"
            >
              <ArrowLeft aria-hidden className="size-4" />
              Back to all open roles
            </Link>
          </div>

          {/* -- Sticky sidebar -- */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Apply for this role</CardTitle>
                <CardDescription className="mt-1.5">
                  The form takes about five minutes. You can save and return
                  later.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {deadlinePassed ? (
                  <div className="flex gap-2.5 rounded-lg border border-danger-200 bg-danger-50 p-3">
                    <CircleAlert
                      aria-hidden
                      className="size-4 shrink-0 text-danger-700"
                    />
                    <p className="text-xs text-danger-900">
                      Applications for this role closed{' '}
                      {untilNow(job.deadline_at)}. Send us an email if you
                      would still like to be considered.
                    </p>
                  </div>
                ) : deadlineNear ? (
                  <div className="flex gap-2.5 rounded-lg border border-warning-200 bg-warning-50 p-3">
                    <Clock aria-hidden className="size-4 shrink-0 text-warning-700" />
                    <p className="text-xs text-warning-900">
                      Applications close {untilNow(job.deadline_at)} —{' '}
                      {formatDate(job.deadline_at)}. Apply soon.
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-2.5 rounded-lg border border-ink-200 bg-ink-50/60 p-3">
                    <Clock aria-hidden className="size-4 shrink-0 text-ink-500" />
                    <p className="text-xs text-ink-600">
                      Applications close {untilNow(job.deadline_at)} —{' '}
                      {formatDate(job.deadline_at)}.
                    </p>
                  </div>
                )}

                <div className="space-y-2.5 text-xs text-ink-600">
                  <p className="flex gap-2.5">
                    <IdCard aria-hidden className="size-4 shrink-0 text-ink-400" />
                    <span>
                      You&apos;ll receive an application number in the format{' '}
                      <span className="font-mono text-ink-800">
                        APP/LA/2026/0001
                      </span>{' '}
                      once your application is submitted.
                    </span>
                  </p>
                  <p className="flex gap-2.5">
                    <UserRound
                      aria-hidden
                      className="size-4 shrink-0 text-ink-400"
                    />
                    <span>
                      Use that number to track review, interview and shortlist
                      updates in the applicant portal.
                    </span>
                  </p>
                  <p className="flex gap-2.5">
                    <Phone aria-hidden className="size-4 shrink-0 text-ink-400" />
                    <span>
                      Shortlisted candidates are contacted on the phone number
                      you provide.
                    </span>
                  </p>
                </div>
              </CardContent>
              <div className="border-t border-ink-200 bg-ink-50/60 px-5 py-4">
                {deadlinePassed ? (
                  <Button size="lg" className="w-full" disabled>
                    Applications closed
                  </Button>
                ) : (
                  <Link
                    to={`/apply/${job.slug}`}
                    className={buttonVariants({
                      size: 'lg',
                      className: 'w-full',
                    })}
                  >
                    <Upload aria-hidden />
                    Start application
                  </Link>
                )}
                <p className="mt-2 flex items-center justify-center gap-1.5 text-2xs text-ink-500">
                  <Briefcase aria-hidden className="size-3.5" />
                  {job.openings} {job.openings === 1 ? 'position' : 'positions'}{' '}
                  available
                </p>
              </div>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}
