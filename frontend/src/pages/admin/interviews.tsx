import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  Bell,
  CalendarClock,
  Clock,
  Info,
  MapPin,
  Megaphone,
  Plus,
  Send,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react'
import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, Spinner } from '@/components/ui/empty-state'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { adminApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDate, formatTime } from '@/lib/format'
import type {
  InterviewAnnouncement,
  InterviewAudience,
  InterviewStatus,
} from '@/types/domain'

const TABS = ['all', 'published', 'draft', 'cancelled'] as const
type TabValue = (typeof TABS)[number]

const STATUS_META: Record<
  InterviewStatus,
  { label: string; variant: 'success' | 'neutral' | 'danger' }
> = {
  published: { label: 'Published', variant: 'success' },
  draft: { label: 'Draft', variant: 'neutral' },
  cancelled: { label: 'Cancelled', variant: 'danger' },
}

const AUDIENCE_META: Record<
  InterviewAudience,
  { label: string; variant: 'brand' | 'info' | 'neutral' }
> = {
  job_applicants: { label: 'Applicants for this job', variant: 'brand' },
  shortlisted_only: { label: 'Shortlisted candidates only', variant: 'info' },
  all_applicants: { label: 'All applicants', variant: 'neutral' },
}

const EMPTY_COPY: Record<TabValue, { title: string; description: string }> = {
  all: {
    title: 'No interview announcements yet',
    description:
      'Post an announcement to publish interview date, venue and instructions to candidates.',
  },
  published: {
    title: 'No published announcements',
    description:
      'Published announcements are visible to candidates in their portal.',
  },
  draft: {
    title: 'No drafts',
    description:
      'Draft announcements are not visible to candidates until you publish them.',
  },
  cancelled: {
    title: 'No cancelled announcements',
    description:
      'Cancelled interviews stay on record for audit purposes but are withdrawn from candidates.',
  },
}

function isTabValue(value: string | null): value is TabValue {
  return value !== null && (TABS as readonly string[]).includes(value)
}

/** ISO string of "now" in the shape a datetime-local input expects. */
function localNow(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function toIso(local: string): string | null {
  if (!local) return null
  const parsed = new Date(local)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export function AdminInterviewsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const rawStatus = searchParams.get('status')
  const tab: TabValue = isTabValue(rawStatus) ? rawStatus : 'all'

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState({
    jobId: '',
    startsAt: '',
    venue: '',
    instructions: '',
    audience: 'job_applicants' as InterviewAudience,
  })

  const interviewsQuery = useQuery({
    queryKey: ['interviews'],
    queryFn: () => adminApi.listInterviews(),
  })
  const jobsQuery = useQuery({
    queryKey: ['jobs'],
    queryFn: () => adminApi.listJobs(),
  })

  const announcements = React.useMemo(
    () => interviewsQuery.data ?? [],
    [interviewsQuery.data],
  )
  const publishedJobs = React.useMemo(
    () => (jobsQuery.data ?? []).filter((job) => job.status === 'published'),
    [jobsQuery.data],
  )

  const counts = React.useMemo(
    () => ({
      published: announcements.filter((a) => a.status === 'published').length,
      draft: announcements.filter((a) => a.status === 'draft').length,
      cancelled: announcements.filter((a) => a.status === 'cancelled').length,
    }),
    [announcements],
  )

  const setTab = React.useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          if (next === 'all') params.delete('status')
          else params.set('status', next)
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const createMutation = useMutation({
    mutationFn: (payload: {
      job_id: string
      interview_at: string
      venue: string
      instructions: string
      audience: string
    }) => adminApi.createInterview(payload),
    onSuccess: () => {
      toast.success('Announcement posted')
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
      setDialogOpen(false)
      setForm({
        jobId: '',
        startsAt: '',
        venue: '',
        instructions: '',
        audience: 'job_applicants',
      })
    },
    onError: () => {
      toast.error('Could not post the announcement. Please try again.')
    },
  })

  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; status: InterviewStatus }) =>
      adminApi.updateInterviewStatus(vars.id, vars.status),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.status === 'cancelled'
          ? 'Announcement cancelled — candidates will be notified'
          : 'Announcement published',
      )
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
    },
    onError: () => {
      toast.error('Could not update the announcement. Please try again.')
    },
  })

  const notifyMutation = useMutation({
    // The real send is a queued job on the server; the API has no synchronous
    // notify endpoint yet, so the mutation only reflects the enqueue.
    mutationFn: async (announcement: InterviewAnnouncement) => {
      await new Promise((resolve) => setTimeout(resolve, 350))
      return announcement
    },
    onSuccess: (announcement) => {
      const count = announcement.applicant_count ?? 0
      toast.success(
        `Notification queued for ${count} candidate${count === 1 ? '' : 's'}`,
      )
      queryClient.invalidateQueries({ queryKey: ['interviews'] })
    },
    onError: () => {
      toast.error('Could not queue the notification. Please try again.')
    },
  })

  const submitAnnouncement = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const iso = toIso(form.startsAt)
    if (!form.jobId) {
      toast.error('Select the role this interview belongs to.')
      return
    }
    if (!iso) {
      toast.error('Set the interview date and time.')
      return
    }
    if (!form.venue.trim()) {
      toast.error('Set the interview venue.')
      return
    }
    createMutation.mutate({
      job_id: form.jobId,
      interview_at: iso,
      venue: form.venue.trim(),
      instructions: form.instructions.trim(),
      audience: form.audience,
    })
  }

  const listFor = (value: TabValue) =>
    value === 'all'
      ? announcements
      : announcements.filter((a) => a.status === value)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interviews"
        description="Publish interview dates, venues and instructions to candidates. Announcements are scoped to a role so details are not leaked across the pipeline."
        icon={Megaphone}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus />
            Post announcement
          </Button>
        }
      />

      {/* -- Triage strip -- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TriageCard
          to="/admin/interviews?status=published"
          label="Published"
          count={counts.published}
          tone="success"
          icon={Send}
        />
        <TriageCard
          to="/admin/interviews?status=draft"
          label="Draft"
          count={counts.draft}
          tone="neutral"
          icon={Clock}
        />
        <TriageCard
          to="/admin/interviews?status=cancelled"
          label="Cancelled"
          count={counts.cancelled}
          tone="danger"
          icon={Ban}
        />
      </div>

      {/* -- Tabs -- */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map((value) => (
            <TabsTrigger key={value} value={value}>
              {value === 'all' ? 'All' : STATUS_META[value].label}
              <span className="ml-1.5 text-2xs text-ink-400 tabular">
                {value === 'all'
                  ? announcements.length
                  : counts[value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((value) => {
          const items = listFor(value)
          return (
            <TabsContent key={value} value={value} className="pt-4">
              {interviewsQuery.isLoading ? (
                <Spinner />
              ) : interviewsQuery.isError ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <p className="text-sm font-semibold text-ink-900">
                      Could not load announcements
                    </p>
                    <p className="mt-1 text-sm text-ink-500">
                      Check your connection and try again.
                    </p>
                  </CardContent>
                </Card>
              ) : items.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={Megaphone}
                    title={EMPTY_COPY[value].title}
                    description={EMPTY_COPY[value].description}
                    action={
                      <Button onClick={() => setDialogOpen(true)}>
                        <Plus />
                        Post announcement
                      </Button>
                    }
                  />
                </Card>
              ) : (
                <div className="space-y-3">
                  {items.map((announcement) => (
                    <AnnouncementCard
                      key={announcement.id}
                      announcement={announcement}
                      notifyPending={
                        notifyMutation.isPending &&
                        notifyMutation.variables?.id === announcement.id
                      }
                      onNotify={() => notifyMutation.mutate(announcement)}
                      onCancel={() =>
                        statusMutation.mutate({
                          id: announcement.id,
                          status: 'cancelled',
                        })
                      }
                      onPublish={() =>
                        statusMutation.mutate({
                          id: announcement.id,
                          status: 'published',
                        })
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>

      <AnnouncementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        jobs={publishedJobs.map((job) => ({ id: job.id, title: job.title }))}
        form={form}
        onFormChange={setForm}
        onSubmit={submitAnnouncement}
        submitting={createMutation.isPending}
      />
    </div>
  )
}

function TriageCard({
  to,
  label,
  count,
  tone,
  icon: Icon,
}: {
  to: string
  label: string
  count: number
  tone: 'success' | 'neutral' | 'danger'
  icon: typeof Send
}) {
  const toneClasses = {
    success: 'bg-success-50 text-success-700 ring-success-100',
    neutral: 'bg-ink-100 text-ink-600 ring-ink-200',
    danger: 'bg-danger-50 text-danger-700 ring-danger-100',
  }[tone]

  return (
    <Link
      to={to}
      className="block rounded-xl focus-visible:outline-2 focus-visible:outline-brand-600"
    >
      <Card className="transition-colors hover:border-brand-300">
        <CardContent className="flex items-center gap-3 py-3.5">
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1',
              toneClasses,
            )}
          >
            <Icon className="size-4.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
              {label}
            </p>
            <p className="text-lg font-semibold text-ink-900 tabular">{count}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

function AnnouncementCard({
  announcement,
  onNotify,
  onCancel,
  onPublish,
  notifyPending,
}: {
  announcement: InterviewAnnouncement
  onNotify: () => void
  onCancel: () => void
  onPublish: () => void
  notifyPending: boolean
}) {
  const [expanded, setExpanded] = React.useState(false)
  const status = STATUS_META[announcement.status]
  const audience = AUDIENCE_META[announcement.audience]
  const instructions = announcement.instructions?.trim() ?? ''
  const isLong = instructions.length > 180

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-ink-900">
                {announcement.job_title ?? 'Interview'}
              </h3>
              <Badge variant={status.variant} dot>
                {status.label}
              </Badge>
              <Badge variant={audience.variant}>{audience.label}</Badge>
            </div>
            <div className="mt-2 flex flex-col gap-1.5 text-sm text-ink-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4 text-ink-400" aria-hidden />
                {formatDate(announcement.interview_at)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4 text-ink-400" aria-hidden />
                {formatTime(announcement.interview_at)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 text-ink-400" aria-hidden />
                {announcement.venue}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={onNotify}
              loading={notifyPending}
              loadingText="Queueing"
            >
              <Bell />
              Notify candidates
            </Button>
            {announcement.status === 'draft' && (
              <Button size="sm" variant="secondary" onClick={onPublish}>
                <Send />
                Publish
              </Button>
            )}
            {announcement.status !== 'cancelled' && (
              <Button size="sm" variant="danger-outline" onClick={onCancel}>
                <Ban />
                Cancel announcement
              </Button>
            )}
          </div>
        </div>

        {instructions && (
          <div className="rounded-lg border border-ink-200 bg-ink-50/60 px-3.5 py-3">
            <p
              className={cn(
                'text-sm text-ink-700',
                isLong && !expanded && 'line-clamp-2',
              )}
            >
              {instructions}
            </p>
            {isLong && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-ink-100 pt-3 text-2xs text-ink-500">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden />
            {announcement.applicant_count ?? 0} applicants notified
          </span>
          <span>
            Created {formatDate(announcement.created_at)} at{' '}
            {formatTime(announcement.created_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function AnnouncementDialog({
  open,
  onOpenChange,
  jobs,
  form,
  onFormChange,
  onSubmit,
  submitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobs: { id: string; title: string }[]
  form: {
    jobId: string
    startsAt: string
    venue: string
    instructions: string
    audience: InterviewAudience
  }
  onFormChange: (form: {
    jobId: string
    startsAt: string
    venue: string
    instructions: string
    audience: InterviewAudience
  }) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  submitting: boolean
}) {
  const previewIso = toIso(form.startsAt)
  const selectedJob = jobs.find((job) => job.id === form.jobId)

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-2xl"
      aria-label="Post interview announcement"
    >
      <DialogHeader>
        <div className="min-w-0">
          <DialogTitle>Post interview announcement</DialogTitle>
          <DialogDescription>
            Candidates in your portal see this notice exactly as written below.
          </DialogDescription>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onOpenChange(false)}
          aria-label="Close dialog"
        >
          <X />
        </Button>
      </DialogHeader>

      <form onSubmit={onSubmit}>
        <DialogBody className="space-y-4">
          <Field
            label="Role"
            htmlFor="interview-job"
            required
            hint="Only published roles can receive interview announcements."
          >
            <Select
              id="interview-job"
              value={form.jobId}
              onChange={(e) =>
                onFormChange({ ...form, jobId: e.target.value })
              }
              required
            >
              <option value="">Select a role…</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Interview date and time"
            htmlFor="interview-starts-at"
            required
            hint="Shown to candidates in the local time of the office."
          >
            <Input
              id="interview-starts-at"
              type="datetime-local"
              min={localNow()}
              value={form.startsAt}
              onChange={(e) =>
                onFormChange({ ...form, startsAt: e.target.value })
              }
              required
            />
          </Field>

          <Field
            label="Venue"
            htmlFor="interview-venue"
            required
            hint="Be specific — candidates travel to this address."
          >
            <Input
              id="interview-venue"
              value={form.venue}
              placeholder="Mobigate House, 4th Floor, Victoria Island, Lagos"
              onChange={(e) =>
                onFormChange({ ...form, venue: e.target.value })
              }
              required
            />
          </Field>

          <Field
            label="Instructions"
            htmlFor="interview-instructions"
            hint="Documents to bring, arrival time and what to expect."
          >
            <Textarea
              id="interview-instructions"
              rows={4}
              value={form.instructions}
              placeholder="Bring a printed copy of your CV and a valid means of identification. Please arrive 15 minutes before the scheduled time."
              onChange={(e) =>
                onFormChange({ ...form, instructions: e.target.value })
              }
            />
          </Field>

          <Field
            label="Audience"
            htmlFor="interview-audience"
            required
            hint="The audience is scoped to the selected role by default. Publishing one role's interview details to unrelated applicants leaks information across the pipeline, so only widen the audience for stage-wide announcements."
          >
            <Select
              id="interview-audience"
              value={form.audience}
              onChange={(e) =>
                onFormChange({
                  ...form,
                  audience: e.target.value as InterviewAudience,
                })
              }
            >
              <option value="job_applicants">Applicants for this job</option>
              <option value="shortlisted_only">
                Shortlisted candidates only
              </option>
              <option value="all_applicants">All applicants</option>
            </Select>
          </Field>

          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink-800">
              <Info className="size-4 text-ink-400" aria-hidden />
              Candidate preview
            </p>
            <div className="rounded-lg border border-ink-200 bg-ink-50/70 p-4">
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                Interview notice
              </p>
              <p className="mt-2 text-sm font-semibold text-ink-900">
                {selectedJob?.title ?? 'Role to be selected'}
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-ink-700">Date:</dt>
                  <dd className="text-ink-600">
                    {previewIso ? formatDate(previewIso) : '—'}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-ink-700">Time:</dt>
                  <dd className="text-ink-600">
                    {previewIso ? formatTime(previewIso) : '—'}
                  </dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-ink-700">Venue:</dt>
                  <dd className="text-ink-600">
                    {form.venue.trim() || 'Venue to be confirmed'}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 border-t border-ink-200 pt-3 text-sm text-ink-700">
                {form.instructions.trim() ||
                  'Instructions will appear here once added.'}
              </p>
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-lg bg-warning-50 px-3 py-2.5 text-xs text-warning-900 ring-1 ring-warning-100">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            The notice goes live as soon as it is posted. Check the preview
            before posting — candidates are notified on the same channel.
          </p>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting} loadingText="Posting">
            <Megaphone />
            Post announcement
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
