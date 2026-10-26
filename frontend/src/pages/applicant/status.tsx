import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CircleDashed,
  ClipboardList,
  Copy,
  FileText,
  Info,
  Mail,
  MapPin,
  MessageSquareText,
  Pencil,
  Phone,
  Sparkles,
  User,
} from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, Spinner } from '@/components/ui/empty-state'
import { Field, Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { ApplicationStatusBadge } from '@/components/ui/status-badges'
import { locationPath, publicApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, fullName } from '@/lib/format'
import { useNow } from '@/lib/use-now'
import { useSession } from '@/providers/session-provider'
import type {
  Application,
  ApplicationEvent,
  ApplicationStatus,
} from '@/types/domain'

/** Canonical stages of the recruitment pipeline, in order. */
type StageKey = 'pending' | 'shortlisted' | 'appointed' | 'rejected' | 'withdrawn'

const STAGE_LABELS: Record<StageKey, string> = {
  pending: 'Applied',
  shortlisted: 'Shortlisted',
  appointed: 'Appointed',
  rejected: 'Not successful',
  withdrawn: 'Withdrawn',
}

const STAGE_DESCRIPTIONS: Record<StageKey, string> = {
  pending: 'Your application was received and is awaiting review.',
  shortlisted: 'You advanced to the shortlist and were invited to interview.',
  appointed: 'You were appointed. An access code was issued for onboarding.',
  rejected: 'This application did not progress further.',
  withdrawn: 'This application was withdrawn.',
}

type StepState = 'done' | 'current' | 'upcoming' | 'skipped'

export function ApplicantStatusPage() {
  const { id = '' } = useParams<{ id: string }>()
  const { session } = useSession()
  const userId = session?.user.id ?? ''

  const applicationQuery = useQuery({
    queryKey: ['applicant', 'application', id],
    // /me scope: the API returns 404 for any application the caller does
    // not own, which the page renders as "not found" (BR-08).
    queryFn: () => publicApi.myApplication(id),
    enabled: Boolean(id),
    retry: false,
  })

  const eventsQuery = useQuery({
    queryKey: ['applicant', 'application-events', id],
    queryFn: () => publicApi.myApplicationEvents(id),
    enabled: Boolean(id),
    retry: false,
  })

  const shortlistQuery = useQuery({
    queryKey: ['applicant', 'shortlist-message', id],
    queryFn: () => publicApi.shortlistMessageFor(id),
    enabled: Boolean(id),
    retry: false,
  })

  const announcementsQuery = useQuery({
    queryKey: ['applicant', 'announcements', userId],
    queryFn: () => publicApi.announcementsFor(),
    enabled: Boolean(userId),
  })

  const application = applicationQuery.data
  const now = useNow()
  const [editOpen, setEditOpen] = React.useState(false)

  if (applicationQuery.isLoading) return <Spinner />

  // An applicant may only ever read their own application (BR-08).
  if (!application || application.applicant_id !== userId) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="Application not found"
          description="We could not find an application with that reference. Check the link, or return to your list of applications."
          action={
            <Link to="/applicant" className={buttonVariants({ variant: 'outline' })}>
              Back to my applications
            </Link>
          }
        />
      </Card>
    )
  }

  const events = eventsQuery.data ?? []
  const shortlist = shortlistQuery.data

  const interview = (announcementsQuery.data ?? []).find(
    (a) =>
      a.status === 'published' &&
      a.job_id === application.job_id &&
      new Date(a.interview_at).getTime() > now,
  )

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <Link
          to="/applicant"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-ink-900"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to my applications
        </Link>
      </nav>

      <PageHeader
        icon={FileText}
        title={application.job_title ?? 'Application'}
        description={`Submitted on ${formatDate(application.submitted_at)}. Your application number is quoted in every message from the recruitment team.`}
        actions={
          <div className="flex items-center gap-2">
            <ApplicationStatusBadge status={application.status} />
            {application.status === 'pending' && (
              <Button
                variant="outline"
                onClick={() => setEditOpen(true)}
                aria-label="Edit your application"
              >
                <Pencil aria-hidden />
                Edit
              </Button>
            )}
          </div>
        }
      />

      {/* -- Hero -- */}
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-2xs tracking-wide text-ink-500 uppercase">
              Application number
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-lg font-semibold tracking-tight text-ink-900">
                {application.application_number}
              </span>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(application.application_number)
                    .then(() =>
                      toast.success('Application number copied to clipboard'),
                    )
                    .catch(() =>
                      toast.error('Could not copy the application number'),
                    )
                }}
                className="inline-flex size-7 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
                aria-label={`Copy application number ${application.application_number}`}
              >
                <Copy className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3 sm:gap-6">
            <div>
              <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                Role
              </dt>
              <dd className="text-ink-800">{application.job_title ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                Submitted
              </dt>
              <dd className="text-ink-800">
                {formatDate(application.submitted_at)}
              </dd>
            </div>
            <div>
              <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                Last updated
              </dt>
              <dd className="text-ink-800">
                {formatDate(application.updated_at)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* -- Shortlist confirmation message -- */}
      {shortlist && (
        <Card className="border-info-100 bg-info-50/60">
          <CardHeader className="border-info-100/70">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info-100 ring-1 ring-info-100">
                <Sparkles className="size-4.5 text-info-700" aria-hidden />
              </span>
              <div>
                <CardTitle className="text-base text-info-900">
                  Message from the recruitment team
                </CardTitle>
                <CardDescription className="mt-0.5 text-ink-600">
                  Sent {formatDate(shortlist.created_at)}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-ink-800">
              {shortlist.message}
            </p>

            {(interview || messageVenue(shortlist.message)) && (
              <div className="grid gap-3 rounded-lg border border-info-100 bg-white/70 p-4 sm:grid-cols-2">
                {interview && (
                  <div className="flex items-start gap-2.5">
                    <CalendarClock
                      className="mt-0.5 size-4 shrink-0 text-info-700"
                      aria-hidden
                    />
                    <div>
                      <p className="text-2xs tracking-wide text-ink-500 uppercase">
                        Interview date
                      </p>
                      <p className="text-sm font-medium text-ink-900">
                        {formatDate(interview.interview_at)}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-info-700" aria-hidden />
                  <div>
                    <p className="text-2xs tracking-wide text-ink-500 uppercase">
                      Venue
                    </p>
                    <p className="text-sm font-medium text-ink-900">
                      {interview?.venue ?? messageVenue(shortlist.message)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* -- Timeline -- */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Application progress</CardTitle>
            <CardDescription>
              Every decision the recruitment team has recorded on your
              application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StatusTimeline
              status={application.status}
              events={events}
              submittedAt={application.submitted_at}
            />
          </CardContent>
        </Card>

        {/* -- What happens next -- */}
        <Card>
          <CardHeader>
            <CardTitle>What happens next</CardTitle>
          </CardHeader>
          <CardContent>
            <NextSteps status={application.status} />
          </CardContent>
        </Card>
      </div>

      {/* -- Submitted details -- */}
      <Card>
        <CardHeader>
          <CardTitle>Your submitted details</CardTitle>
          <CardDescription>
            This is what you submitted with your application. Contact the
            recruitment team if anything needs to be corrected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <Detail
              icon={User}
              label="Full name"
              value={fullName(application.first_name, application.last_name)}
            />
            <Detail
              icon={Mail}
              label="Email"
              value={application.email}
            />
            <Detail icon={Phone} label="Phone" value={application.phone} />
            <Detail
              icon={User}
              label="Gender"
              value={application.gender ?? '—'}
            />
            <Detail
              icon={CalendarClock}
              label="Date of birth"
              value={formatDate(application.date_of_birth)}
            />
            <Detail
              icon={MapPin}
              label="Location"
              value={locationPath(application.location_id)}
            />
            <Detail
              icon={ClipboardList}
              label="Qualification"
              value={application.qualification ?? '—'}
            />
            <Detail
              icon={FileText}
              label="Address"
              value={application.address_line ?? '—'}
            />
          </dl>
        </CardContent>
      </Card>

      {/* BR-10: editable only while pending; the server enforces the lock. */}
      {application.status === 'pending' && editOpen && (
        <EditApplicationDialog
          application={application}
          open
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  )
}

/**
 * Edit dialog for a still-pending application (BR-10). The location is not
 * editable here; the recruitment team handles location corrections.
 */
function EditApplicationDialog({
  application,
  open,
  onOpenChange,
}: {
  application: Application
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [firstName, setFirstName] = React.useState(application.first_name)
  const [lastName, setLastName] = React.useState(application.last_name)
  const [phone, setPhone] = React.useState(application.phone)
  const [gender, setGender] = React.useState(
    (application.gender ?? 'male').toLowerCase(),
  )
  const [dateOfBirth, setDateOfBirth] = React.useState(
    application.date_of_birth ? application.date_of_birth.slice(0, 10) : '',
  )
  const [addressLine, setAddressLine] = React.useState(
    application.address_line ?? '',
  )
  const [qualification, setQualification] = React.useState(
    application.qualification ?? '',
  )
  const [photo, setPhoto] = React.useState<File | undefined>(undefined)
  const [error, setError] = React.useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      publicApi.editMyApplication(application.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        gender,
        date_of_birth: dateOfBirth,
        address_line: addressLine.trim(),
        qualification: qualification.trim(),
        photo,
      }),
    onSuccess: () => {
      toast.success('Application updated')
      void queryClient.invalidateQueries({ queryKey: ['applicant'] })
      onOpenChange(false)
    },
    onError: (cause: Error) => setError(cause.message),
  })

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.')
      return
    }
    if (phone.trim().length < 7) {
      setError('Enter a valid phone number.')
      return
    }
    if (!dateOfBirth || Number.isNaN(Date.parse(dateOfBirth))) {
      setError('Enter a valid date of birth.')
      return
    }
    if (photo && photo.size > 2 * 1024 * 1024) {
      setError('The photograph must be 2 MB or smaller.')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={submit} noValidate>
        <DialogHeader>
          <div>
            <DialogTitle>Edit your application</DialogTitle>
            <DialogDescription>
              Corrections are accepted while the application is pending. Once
              it is shortlisted the record is locked.
            </DialogDescription>
          </div>
          <DialogClose />
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="edit-first-name" required>
              <Input
                id="edit-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </Field>
            <Field label="Last name" htmlFor="edit-last-name" required>
              <Input
                id="edit-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Phone number" htmlFor="edit-phone" required>
            <Input
              id="edit-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gender" htmlFor="edit-gender" required>
              <Select
                id="edit-gender"
                value={gender}
                onChange={(event) => setGender(event.target.value)}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Date of birth" htmlFor="edit-dob" required>
              <Input
                id="edit-dob"
                type="date"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
              />
            </Field>
          </div>

          <Field label="Residential address" htmlFor="edit-address" required>
            <Input
              id="edit-address"
              value={addressLine}
              onChange={(event) => setAddressLine(event.target.value)}
            />
          </Field>

          <Field
            label="Highest qualification"
            htmlFor="edit-qualification"
            required
          >
            <Input
              id="edit-qualification"
              value={qualification}
              onChange={(event) => setQualification(event.target.value)}
            />
          </Field>

          <Field
            label="Replace photograph"
            htmlFor="edit-photo"
            hint="Optional. PNG, JPG or WEBP, up to 2 MB."
          >
            <Input
              id="edit-photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setPhoto(event.target.files?.[0])}
            />
          </Field>

          {error ? (
            <p
              role="alert"
              className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700"
            >
              {error}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={mutation.isPending}
            loadingText="Saving…"
          >
            Save changes
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
      <div className="min-w-0">
        <dt className="text-2xs tracking-wide text-ink-500 uppercase">
          {label}
        </dt>
        <dd className="text-sm break-words text-ink-900">{value}</dd>
      </div>
    </div>
  )
}

/**
 * Builds the vertical stepper from the real event trail, so completed steps
 * carry the timestamp the decision was recorded at.
 */
function StatusTimeline({
  status,
  events,
  submittedAt,
}: {
  status: ApplicationStatus
  events: ApplicationEvent[]
  submittedAt: string
}) {
  const eventFor = (key: StageKey) =>
    events.find((e) => e.to_status === key) ??
    events.find((e) => e.from_status === key)

  const applied = eventFor('pending')
  const shortlisted = eventFor('shortlisted')
  const terminal: StageKey =
    status === 'rejected'
      ? 'rejected'
      : status === 'withdrawn'
        ? 'withdrawn'
        : 'appointed'

  const steps: { key: StageKey; state: StepState; event?: ApplicationEvent }[] =
    [
      {
        key: 'pending',
        state: status === 'pending' ? 'current' : 'done',
        event: applied,
      },
      {
        key: 'shortlisted',
        state:
          status === 'shortlisted'
            ? 'current'
            : shortlisted
              ? 'done'
              : terminal === 'rejected' || terminal === 'withdrawn'
                ? 'skipped'
                : 'upcoming',
        event: shortlisted,
      },
      {
        key: terminal,
        state: status === terminal ? 'current' : 'upcoming',
        event: eventFor(terminal),
      },
    ]

  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        return (
          <li key={step.key} className="flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full',
                  step.state === 'done' && 'bg-success-600 text-white',
                  step.state === 'current' && 'bg-brand-600 text-white',
                  step.state === 'upcoming' && 'bg-ink-100 text-ink-400',
                  step.state === 'skipped' && 'bg-ink-100 text-ink-300',
                )}
              >
                {step.state === 'done' ? (
                  <Check className="size-4" aria-hidden />
                ) : step.state === 'current' ? (
                  <span className="size-2 rounded-full bg-white" aria-hidden />
                ) : (
                  <CircleDashed className="size-4" aria-hidden />
                )}
              </span>

              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    'mt-2 w-px flex-1',
                    step.state === 'done' ? 'bg-success-500' : 'bg-ink-200',
                  )}
                />
              )}
            </div>

            <div className="min-w-0 pt-0.5">
              <p
                className={cn(
                  'text-sm font-semibold',
                  step.state === 'done' && 'text-ink-900',
                  step.state === 'current' && 'text-brand-800',
                  step.state === 'upcoming' && 'text-ink-400',
                  step.state === 'skipped' && 'text-ink-400 line-through',
                )}
              >
                {STAGE_LABELS[step.key]}
                {step.state === 'current' && (
                  <span className="ml-2 align-middle text-2xs font-medium tracking-wide text-ink-500 uppercase">
                    Current stage
                  </span>
                )}
              </p>

              <p
                className={cn(
                  'mt-0.5 text-sm',
                  step.state === 'upcoming' || step.state === 'skipped'
                    ? 'text-ink-400'
                    : 'text-ink-600',
                )}
              >
                {STAGE_DESCRIPTIONS[step.key]}
              </p>

              {step.state !== 'upcoming' && step.state !== 'skipped' && (
                <p className="mt-1 text-xs text-ink-500">
                  {step.key === 'pending' && !step.event
                    ? formatDateTime(submittedAt)
                    : step.event
                      ? formatDateTime(step.event.created_at)
                      : '—'}
                </p>
              )}

              {step.event?.reason && (
                <p className="mt-1.5 rounded-md bg-ink-50 px-2.5 py-1.5 text-xs text-ink-600">
                  {step.event.reason}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function NextSteps({ status }: { status: ApplicationStatus }) {
  const content: Record<ApplicationStatus, { title: string; body: string }> = {
    pending: {
      title: 'We are reviewing your application',
      body: 'Our recruitment team reviews every application in the order it was received. If you are shortlisted you will receive an email with your interview details.',
    },
    shortlisted: {
      title: 'Attend your interview',
      body: 'Check the message from the recruitment team above for the date and venue. Bring a printed copy of your CV and a valid means of identification.',
    },
    appointed: {
      title: 'Complete your onboarding',
      body: 'The recruitment team will hand you an access code. Use it in the Staff Portal to complete your staff details — your Staff ID is issued at the end of that form.',
    },
    rejected: {
      title: 'Keep an eye out for other roles',
      body: 'This application has closed. You are welcome to apply for other roles at Mobigate Group, and we would be glad to consider a new application.',
    },
    withdrawn: {
      title: 'This application was withdrawn',
      body: 'Nothing further is required. Contact the recruitment team if you would like to re-apply.',
    },
  }

  const { title, body } = content[status]

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-ink-900">{title}</p>
          <p className="mt-1 text-sm text-ink-600">{body}</p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg bg-ink-50 px-3 py-2.5">
        <MessageSquareText
          className="mt-0.5 size-4 shrink-0 text-ink-400"
          aria-hidden
        />
        <p className="text-xs text-ink-600">
          Quote your application number when you contact us, and we will pick up
          from there.
        </p>
      </div>
    </div>
  )
}

/**
 * The shortlist message is free text, so the venue is best-effort extracted
 * from the "report to ..." clause when no interview announcement matches.
 */
function messageVenue(message: string): string | null {
  const match = /report to\s+(.+?)(?:\s+on\b|\.|$)/i.exec(message)
  return match?.[1]?.trim() ?? null
}
