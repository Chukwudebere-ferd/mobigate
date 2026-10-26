import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  CalendarClock,
  FileText,
  MapPin,
  MessageSquareText,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState, Spinner } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { ApplicationStatusBadge } from '@/components/ui/status-badges'
import { locationPath, publicApi } from '@/lib/api'
import { formatDate, formatTime } from '@/lib/format'
import { useSession } from '@/providers/session-provider'
import type { ApplicationStatus } from '@/types/domain'

export function ApplicantApplicationsPage() {
  const { session } = useSession()
  const userId = session?.user.id ?? ''

  const applicationsQuery = useQuery({
    queryKey: ['applicant', 'applications', userId],
    // The API scopes these to the signed-in account; no id is passed.
    queryFn: () => publicApi.myApplications(),
    enabled: Boolean(userId),
  })

  const announcementsQuery = useQuery({
    queryKey: ['applicant', 'announcements', userId],
    queryFn: () => publicApi.announcementsFor(),
    enabled: Boolean(userId),
  })

  const applications = applicationsQuery.data ?? []
  const announcements = announcementsQuery.data ?? []

  const upcoming = [...announcements]
    .filter((a) => a.status === 'published')
    .sort(
      (a, b) =>
        new Date(a.interview_at).getTime() - new Date(b.interview_at).getTime(),
    )

  return (
    <div className="space-y-8">
      <PageHeader
        icon={FileText}
        title="My applications"
        description="Every application you have submitted is listed here. Quote the application number when you contact the recruitment team to track the status of your application."
      />

      {applicationsQuery.isLoading ? (
        <Spinner />
      ) : applications.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="You have not applied for any roles yet"
            description="Browse the open roles at Mobigate Group and submit an application — you will be able to track its progress from this page."
            action={
              <Link to="/careers" className={buttonVariants({})}>
                Browse open roles
                <ArrowRight />
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {applications.map((application) => (
              <ApplicationCard
                key={application.id}
                id={application.id}
                applicationNumber={application.application_number}
                jobTitle={application.job_title ?? 'Role'}
                status={application.status}
                location={locationPath(application.location_id)}
                submittedAt={application.submitted_at}
              />
            ))}
          </div>

          <div className="space-y-4">
            <UpcomingInterviewsCard announcements={upcoming} />
          </div>
        </div>
      )}
    </div>
  )
}

function ApplicationCard({
  id,
  applicationNumber,
  jobTitle,
  status,
  location,
  submittedAt,
}: {
  id: string
  applicationNumber: string
  jobTitle: string
  status: ApplicationStatus
  location: string
  submittedAt: string
}) {
  const isShortlisted = status === 'shortlisted'

  return (
    <Card className="transition-shadow hover:shadow-sm">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">{jobTitle}</CardTitle>
          <CardDescription className="mt-1 font-mono text-xs tracking-tight">
            {applicationNumber}
          </CardDescription>
        </div>
        <ApplicationStatusBadge status={status} />
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
            <div>
              <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                Location
              </dt>
              <dd className="text-ink-800">{location}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <CalendarClock
              className="mt-0.5 size-4 shrink-0 text-ink-400"
              aria-hidden
            />
            <div>
              <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                Submitted
              </dt>
              <dd className="text-ink-800">{formatDate(submittedAt)}</dd>
            </div>
          </div>
        </dl>

        {isShortlisted && (
          <div className="flex items-start gap-2.5 rounded-lg bg-info-50 px-3 py-2.5 ring-1 ring-info-100">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-info-700" aria-hidden />
            <p className="text-sm text-info-900">
              You&apos;ve been shortlisted — view your status for details.
            </p>
          </div>
        )}

        <div className="flex justify-end border-t border-ink-100 pt-3">
          <Link
            to={`/applicant/applications/${id}`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            View status
            <ArrowRight />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

function UpcomingInterviewsCard({
  announcements,
}: {
  announcements: {
    id: string
    job_title?: string
    interview_at: string
    venue: string
  }[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming interviews</CardTitle>
        <CardDescription>
          Announcements published for the roles you applied for.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {announcements.length === 0 ? (
          <div className="flex items-start gap-2.5 rounded-lg bg-ink-50 px-3 py-3 text-sm text-ink-600">
            <MessageSquareText
              className="mt-0.5 size-4 shrink-0 text-ink-400"
              aria-hidden
            />
            <p>No interview announcements for you at the moment.</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <div key={announcement.id} className="space-y-1.5">
              <p className="text-sm font-medium text-ink-900">
                {announcement.job_title ?? 'Interview'}
              </p>
              <p className="text-xs text-ink-600">
                {formatDate(announcement.interview_at)} ·{' '}
                {formatTime(announcement.interview_at)}
              </p>
              <p className="text-xs text-ink-500">{announcement.venue}</p>
            </div>
          ))
        )}
        <Link
          to="/applicant/interviews"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          All interview announcements
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </CardContent>
    </Card>
  )
}
