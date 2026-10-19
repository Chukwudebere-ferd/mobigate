import { useQuery } from '@tanstack/react-query'
import {
  CalendarClock,
  Clock,
  MapPin,
  MessageSquareText,
  Users,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState, Spinner } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { publicApi } from '@/lib/api'
import { formatDate, formatTime, untilNow } from '@/lib/format'
import { useNow } from '@/lib/use-now'
import { useSession } from '@/providers/session-provider'
import type { InterviewAudience } from '@/types/domain'

const audienceLabels: Record<InterviewAudience, string> = {
  job_applicants: 'Applicants for this role',
  shortlisted_only: 'Shortlisted candidates only',
  all_applicants: 'All applicants',
}

const audienceVariants: Record<InterviewAudience, 'brand' | 'info' | 'outline'> =
  {
    job_applicants: 'brand',
    shortlisted_only: 'info',
    all_applicants: 'outline',
  }

export function ApplicantInterviewsPage() {
  const { session } = useSession()
  const userId = session?.user.id ?? ''

  const announcementsQuery = useQuery({
    queryKey: ['applicant', 'announcements', userId],
    queryFn: () => publicApi.announcementsFor(userId),
    enabled: Boolean(userId),
  })

  const announcements = announcementsQuery.data ?? []
  const now = useNow()

  const sorted = [...announcements].sort((a, b) => {
    const aTime = new Date(a.interview_at).getTime()
    const bTime = new Date(b.interview_at).getTime()
    const aUpcoming = aTime >= now
    const bUpcoming = bTime >= now
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1
    return aUpcoming ? aTime - bTime : bTime - aTime
  })

  return (
    <div className="space-y-8">
      <PageHeader
        icon={CalendarClock}
        title="Interviews"
        description="Interview announcements published for the roles you have applied for. Check the date, time and venue carefully — arrive fifteen minutes early."
      />

      {announcementsQuery.isLoading ? (
        <Spinner />
      ) : sorted.length === 0 ? (
        <Card>
          <EmptyState
            icon={MessageSquareText}
            title="No interview announcements yet"
            description="When the recruitment team publishes an interview for a role you applied for, the details will appear here and you will receive an email and SMS."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {sorted.map((announcement) => {
            const isUpcoming =
              new Date(announcement.interview_at).getTime() >= now

            return (
              <Card key={announcement.id}>
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base">
                      {announcement.job_title ?? 'Interview session'}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {isUpcoming ? 'Upcoming' : 'Completed'} ·{' '}
                      {untilNow(announcement.interview_at)}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={audienceVariants[announcement.audience]}
                    className="shrink-0"
                  >
                    <Users aria-hidden />
                    {audienceLabels[announcement.audience]}
                  </Badge>
                </CardHeader>

                <CardContent className="space-y-4">
                  <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                    <div className="flex items-start gap-2">
                      <CalendarClock
                        className="mt-0.5 size-4 shrink-0 text-ink-400"
                        aria-hidden
                      />
                      <div>
                        <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                          Date
                        </dt>
                        <dd className="text-ink-800">
                          {formatDate(announcement.interview_at)}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock
                        className="mt-0.5 size-4 shrink-0 text-ink-400"
                        aria-hidden
                      />
                      <div>
                        <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                          Time
                        </dt>
                        <dd className="text-ink-800">
                          {formatTime(announcement.interview_at)}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin
                        className="mt-0.5 size-4 shrink-0 text-ink-400"
                        aria-hidden
                      />
                      <div>
                        <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                          Venue
                        </dt>
                        <dd className="text-ink-800">{announcement.venue}</dd>
                      </div>
                    </div>
                  </dl>

                  {announcement.instructions && (
                    <div className="rounded-lg bg-ink-50 px-3.5 py-3">
                      <p className="text-2xs tracking-wide text-ink-500 uppercase">
                        Instructions
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-ink-700">
                        {announcement.instructions}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
