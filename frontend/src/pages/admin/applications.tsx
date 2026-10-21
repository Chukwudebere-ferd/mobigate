import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Eye,
  FileDown,
  Search,
  Send,
  TriangleAlert,
  UserX,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, Spinner } from '@/components/ui/empty-state'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { ApplicationStatusBadge } from '@/components/ui/status-badges'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { adminApi, childrenOf, descendantsOf, locationPath } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, humanize, relativeTime } from '@/lib/format'
import { APPLICATION_STATUSES } from '@/types/domain'
import type {
  Application,
  ApplicationEvent,
  ApplicationStatus,
  Job,
  Location,
} from '@/types/domain'

const PER_PAGE = 20
const MESSAGE_LIMIT = 1200

type SortKey = 'submitted_at' | 'status' | 'job'

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: 'Pending',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
  appointed: 'Appointed',
  withdrawn: 'Withdrawn',
}

/* ------------------------------------------------------------------ utils */

function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function downloadFile(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8',
) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function placeholdersIn(body: string): string[] {
  const matches = body.match(/\{\{\s*([a-z_]+)\s*\}\}/gi)
  if (!matches) return []
  return Array.from(new Set(matches))
}

/** Download a plain-text record summary for the selected application. */
function downloadApplicationSummary(application: Application) {
  const summary = [
    `Applicant: ${application.first_name} ${application.last_name}`,
    `Application number: ${application.application_number}`,
    `Email: ${application.email}`,
    `Phone: ${application.phone}`,
    `Role: ${application.job_title ?? '—'}`,
    `Location: ${locationPath(application.location_id)}`,
    `Qualification: ${application.qualification ?? '—'}`,
    `Status: ${application.status}`,
    `Submitted: ${formatDateTime(application.submitted_at)}`,
  ].join('\n')
  downloadFile(
    `${application.application_number.replaceAll('/', '-')}_summary.txt`,
    summary,
    'text/plain;charset=utf-8',
  )
  toast.success('Application summary downloaded.')
}

/* ------------------------------------------------------------- components */

function SortHeader({
  label,
  sortKey,
  activeSort,
  order,
  onSort,
}: {
  label: string
  sortKey: SortKey
  activeSort: SortKey
  order: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}) {
  const active = activeSort === sortKey
  return (
    <TableHead
      aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onSort(sortKey)}
        className="-ml-2 h-8 px-2 text-xs tracking-wide uppercase"
      >
        {label}
        {active ? (
          order === 'asc' ? (
            <ArrowUp className="size-3.5" aria-hidden />
          ) : (
            <ArrowDown className="size-3.5" aria-hidden />
          )
        ) : null}
      </Button>
    </TableHead>
  )
}

function ShortlistDialog({
  open,
  onOpenChange,
  applications,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applications: Application[]
  onCompleted: () => void
}) {
  const queryClient = useQueryClient()
  const [templateId, setTemplateId] = useState('')
  const [message, setMessage] = useState('')

  const templatesQuery = useQuery({
    queryKey: ['admin', 'templates'],
    queryFn: () => adminApi.listTemplates(),
    enabled: open,
  })

  // Reset the draft whenever the dialog is dismissed.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setTemplateId('')
      setMessage('')
    }
    onOpenChange(next)
  }

  const jobIds = Array.from(
    new Set(applications.map((application) => application.job_id)),
  )
  const singleJob = jobIds.length === 1 ? jobIds[0] : null
  const jobTitle =
    applications.find((application) => application.job_id === singleJob)
      ?.job_title ?? null

  const shortlistMutation = useMutation({
    mutationFn: (vars: { ids: string[]; message: string; jobId: string }) =>
      adminApi.shortlist(vars.ids, vars.message, vars.jobId),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'application'] })
      toast.success(
        `${variables.ids.length} candidate${variables.ids.length === 1 ? '' : 's'} shortlisted.`,
      )
      onCompleted()
      handleOpenChange(false)
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not shortlist the selected candidates.',
      )
    },
  })

  const templates = (templatesQuery.data ?? []).filter((template) =>
    ['shortlist_confirmation', 'interview_announcement'].includes(template.key),
  )

  function applyTemplate(id: string) {
    setTemplateId(id)
    const template = templates.find((item) => item.id === id)
    if (!template) return
    setMessage(template.body)
  }

  const trimmed = message.trim()
  const unresolved = placeholdersIn(message)
  const canSubmit =
    trimmed.length > 0 && singleJob !== null && applications.length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} className="sm:max-w-2xl">
      <DialogHeader>
        <div className="min-w-0">
          <DialogTitle>
            Shortlist {applications.length} candidate
            {applications.length === 1 ? '' : 's'}
          </DialogTitle>
          <DialogDescription>
            A confirmation message is required before candidates can be
            shortlisted (BR-07).
          </DialogDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => handleOpenChange(false)}
          aria-label="Close shortlist dialog"
        >
          <X />
        </Button>
      </DialogHeader>

      <DialogBody className="space-y-4">
        {applications.length === 0 ? (
          <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5">
            <p className="text-sm text-ink-700">
              No applicants are selected. Tick the checkboxes in the results
              table first, then open this dialog again.
            </p>
          </div>
        ) : null}

        <div className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5">
          <p className="text-sm text-ink-800">
            {applications.length} selected candidate
            {applications.length === 1 ? '' : 's'}
            {jobTitle ? ` for ${jobTitle}` : ''}
          </p>
          {applications.length > 0 ? (
            <p className="mt-1 text-2xs text-ink-500">
              {applications
                .slice(0, 4)
                .map(
                  (application) =>
                    `${application.first_name} ${application.last_name}`,
                )
                .join(', ')}
              {applications.length > 4
                ? ` and ${applications.length - 4} more`
                : ''}
            </p>
          ) : null}
        </div>

        {jobIds.length > 1 ? (
          <div className="flex items-start gap-2 rounded-lg border border-warning-100 bg-warning-50 px-3 py-2.5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-700" aria-hidden />
            <p className="text-xs text-warning-900">
              The selection spans {jobIds.length} different roles. A shortlist
              belongs to a single posting — filter the list to one role before
              shortlisting.
            </p>
          </div>
        ) : null}

        <Field
          label="Use a template"
          htmlFor="shortlist-template"
          hint="Templates pre-fill the message; edit it before sending."
        >
          <Select
            id="shortlist-template"
            value={templateId}
            onChange={(event) => applyTemplate(event.target.value)}
          >
            <option value="">Custom message</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.key.replace(/_/g, ' ')} ({template.channel})
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Confirmation message"
          htmlFor="shortlist-message"
          required
          error={message.length > 0 && trimmed.length === 0 ? 'A message is required.' : undefined}
          hint={
            unresolved.length > 0
              ? `Replace the remaining placeholder${unresolved.length === 1 ? '' : 's'}: ${unresolved.join(', ')}`
              : undefined
          }
        >
          <Textarea
            id="shortlist-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={MESSAGE_LIMIT}
            rows={8}
            invalid={message.length > 0 && trimmed.length === 0}
            placeholder="Dear candidate, you have been shortlisted for the role…"
          />
        </Field>

        <div className="flex items-center justify-between text-2xs text-ink-500">
          <span>Sent to the selected candidates only.</span>
          <span
            className={cn(
              'tabular',
              message.length > MESSAGE_LIMIT * 0.9 ? 'text-warning-700' : undefined,
            )}
          >
            {message.length} / {MESSAGE_LIMIT} characters
          </span>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden />
          <p className="text-xs text-ink-600">
            This message is stored verbatim and sent to the selected
            candidates. It is visible only to shortlisted applicants (BR-08).
          </p>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => {
            if (!singleJob) return
            shortlistMutation.mutate({
              ids: applications.map((application) => application.id),
              message: trimmed,
              jobId: singleJob,
            })
          }}
          disabled={!canSubmit}
          loading={shortlistMutation.isPending}
          loadingText="Shortlisting…"
        >
          <Send />
          Shortlist
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

function RejectDialog({
  open,
  onOpenChange,
  applications,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applications: Application[]
  onCompleted: () => void
}) {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')

  // Reset the draft whenever the dialog is dismissed.
  function handleOpenChange(next: boolean) {
    if (!next) setReason('')
    onOpenChange(next)
  }

  const rejectMutation = useMutation({
    mutationFn: (vars: { ids: string[]; reason: string }) =>
      Promise.all(
        vars.ids.map((id) =>
          adminApi.setApplicationStatus(id, 'rejected', vars.reason),
        ),
      ),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'application'] })
      toast.success(
        `${variables.ids.length} application${variables.ids.length === 1 ? '' : 's'} rejected.`,
      )
      onCompleted()
      handleOpenChange(false)
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not reject the selected applications.',
      )
    },
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogHeader>
        <div className="min-w-0">
          <DialogTitle>
            Reject {applications.length} application
            {applications.length === 1 ? '' : 's'}
          </DialogTitle>
          <DialogDescription>
            A reason is recorded on the application timeline and shown to the
            candidate.
          </DialogDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => handleOpenChange(false)}
          aria-label="Close reject dialog"
        >
          <X />
        </Button>
      </DialogHeader>

      <DialogBody className="space-y-4">
        <Field
          label="Reason for rejection"
          htmlFor="reject-reason"
          required
          error={
            reason.length > 0 && reason.trim().length === 0
              ? 'A reason is required.'
              : undefined
          }
        >
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            invalid={reason.length > 0 && reason.trim().length === 0}
            placeholder="Did not meet the minimum qualification requirement…"
          />
        </Field>
      </DialogBody>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={() =>
            rejectMutation.mutate({
              ids: applications.map((application) => application.id),
              reason: reason.trim(),
            })
          }
          disabled={reason.trim().length === 0 || applications.length === 0}
          loading={rejectMutation.isPending}
          loadingText="Rejecting…"
        >
          <UserX />
          Reject
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

function ApplicationDrawer({
  application,
  onClose,
}: {
  application: Application | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [shortlistOpen, setShortlistOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)

  const applicationQuery = useQuery({
    queryKey: ['admin', 'application', application?.id],
    queryFn: () => adminApi.getApplication(application!.id),
    enabled: application !== null,
  })

  const current = applicationQuery.data ?? application

  const eventsQuery = useQuery({
    queryKey: ['admin', 'application-events', current?.id],
    queryFn: () => adminApi.applicationEvents(current!.id),
    enabled: current !== null,
  })

  const statusMutation = useMutation({
    mutationFn: (vars: {
      id: string
      status: ApplicationStatus
      reason?: string
    }) =>
      adminApi.setApplicationStatus(vars.id, vars.status, vars.reason),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'application'] })
      toast.success(
        `Application marked as ${STATUS_LABELS[variables.status].toLowerCase()}.`,
      )
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not update the application status.',
      )
    },
  })

  // Close on Escape and lock background scroll while the panel is open.
  // Nested dialogs own the Escape key while they are open.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])
  const nestedOpen = shortlistOpen || rejectOpen

  useEffect(() => {
    if (!current) return
    document.body.style.overflow = 'hidden'
    if (nestedOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [current, nestedOpen])

  if (!current) return null

  const events: ApplicationEvent[] = eventsQuery.data ?? []
  const location = locationPath(current.location_id)

  return (
    <>
      {/* -- Backdrop -- */}
      <div
        className="fixed inset-0 z-40 bg-ink-950/50 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/* -- Side panel -- */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Application details for ${current.first_name} ${current.last_name}`}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-xl animate-slide-up"
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink-900">
              Application details
            </h2>
            <p className="mt-1 font-mono text-2xs text-ink-500">
              {current.application_number}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close application details"
          >
            <X />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto scroll-slim px-5 py-4">
          <div className="flex items-start gap-3">
            <Avatar first={current.first_name} last={current.last_name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-ink-900">
                {current.first_name} {current.last_name}
              </p>
              <p className="truncate text-sm text-ink-500">{current.email}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <ApplicationStatusBadge status={current.status} />
                <span className="font-mono text-2xs text-ink-500">
                  {current.application_number}
                </span>
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail label="Phone" value={current.phone} />
            <Detail label="Gender" value={current.gender} />
            <Detail label="Date of birth" value={formatDate(current.date_of_birth)} />
            <Detail label="Qualification" value={current.qualification} />
            <Detail label="Role applied for" value={current.job_title} />
            <Detail label="Submitted" value={formatDateTime(current.submitted_at)} />
            <Detail label="Location" value={location} wide />
            <Detail label="Address" value={current.address_line} wide />
          </dl>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">
              Timeline
            </p>
            {eventsQuery.isLoading ? (
              <Spinner className="py-6" />
            ) : events.length === 0 ? (
              <p className="text-sm text-ink-500">No events recorded yet.</p>
            ) : (
              <ol className="space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink-800">
                        {event.from_status
                          ? `${humanize(event.from_status)} → ${humanize(event.to_status)}`
                          : humanize(event.to_status)}
                      </p>
                      {event.reason ? (
                        <p className="text-2xs text-ink-600">{event.reason}</p>
                      ) : null}
                      <p className="text-2xs text-ink-400">
                        {event.actor_name ?? 'System'} ·{' '}
                        {relativeTime(event.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-ink-200 bg-ink-50/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => downloadApplicationSummary(current)}
          >
            <Download />
            Download summary
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="danger-outline"
              onClick={() => setRejectOpen(true)}
              disabled={current.status === 'rejected'}
            >
              <UserX />
              Reject
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShortlistOpen(true)}
              disabled={current.status === 'shortlisted'}
            >
              <Send />
              Shortlist
            </Button>
            <Button
              type="button"
              onClick={() =>
                statusMutation.mutate({
                  id: current.id,
                  status: 'appointed',
                })
              }
              disabled={current.status === 'appointed' || statusMutation.isPending}
              loading={statusMutation.isPending}
              loadingText="Appointing…"
            >
              <Check />
              Appoint
            </Button>
          </div>
        </div>
      </div>

      <ShortlistDialog
        open={shortlistOpen}
        onOpenChange={setShortlistOpen}
        applications={[current]}
        onCompleted={onClose}
      />

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        applications={[current]}
        onCompleted={onClose}
      />
    </>
  )
}

function Detail({
  label,
  value,
  wide,
}: {
  label: string
  value?: string | null
  wide?: boolean
}) {
  return (
    <div className={cn(wide ? 'sm:col-span-2' : undefined)}>
      <dt className="text-2xs font-medium tracking-wide text-ink-400 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-ink-800">{value || '—'}</dd>
    </div>
  )
}

/* ------------------------------------------------------------------ page */

export function AdminApplicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchKey = searchParams.toString()

  const [selected, setSelected] = useState<Record<string, Application>>({})
  const [detail, setDetail] = useState<Application | null>(null)
  const [shortlistOpen, setShortlistOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const filters = useMemo(() => {
    const params = new URLSearchParams(searchKey)
    return {
      search: params.get('search') ?? '',
      status: (params.get('status') as ApplicationStatus | null) ?? null,
      job_id: params.get('job_id') ?? '',
      state_id: params.get('state_id') ?? '',
      lga_id: params.get('lga_id') ?? '',
      date_from: params.get('date_from') ?? '',
      date_to: params.get('date_to') ?? '',
      page: Number(params.get('page') ?? '1'),
      sort: (params.get('sort') as SortKey | null) ?? 'submitted_at',
      order: (params.get('order') as 'asc' | 'desc' | null) ?? 'desc',
    }
  }, [searchKey])

  // The search box writes to the URL immediately; the query runs on a debounce.
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(filters.search),
      300,
    )
    return () => window.clearTimeout(timer)
  }, [filters.search])

  const hasFilters =
    Boolean(filters.search) ||
    Boolean(filters.status) ||
    Boolean(filters.job_id) ||
    Boolean(filters.state_id) ||
    Boolean(filters.lga_id) ||
    Boolean(filters.date_from) ||
    Boolean(filters.date_to)

  function setParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) {
      if (!value) params.delete(key)
      else params.set(key, value)
    }
    if (!('page' in patch)) params.delete('page')
    setSearchParams(params, { replace: true })
  }

  function setParam(key: string, value: string | null) {
    setParams({ [key]: value })
  }

  function clearFilters() {
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  function toggleSort(key: SortKey) {
    const params = new URLSearchParams(searchParams)
    if (filters.sort === key) {
      params.set('order', filters.order === 'asc' ? 'desc' : 'asc')
    } else {
      params.set('sort', key)
      params.set('order', key === 'submitted_at' ? 'desc' : 'asc')
    }
    params.delete('page')
    setSearchParams(params, { replace: true })
  }

  const queryFilters = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: filters.status ?? ('all' as const),
      job_id: filters.job_id || undefined,
      state_id: filters.state_id || undefined,
      lga_id: filters.lga_id || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      page: filters.page,
      per_page: PER_PAGE,
      sort: filters.sort,
      order: filters.order,
    }),
    [debouncedSearch, filters],
  )

  const listQuery = useQuery({
    queryKey: ['admin', 'applications', queryFilters],
    queryFn: () => adminApi.listApplications(queryFilters),
  })

  const jobsQuery = useQuery({
    queryKey: ['admin', 'jobs'],
    queryFn: () => adminApi.listJobs(),
  })

  const locationsQuery = useQuery({
    queryKey: ['admin', 'locations'],
    queryFn: () => adminApi.listLocations(),
  })

  const rows = listQuery.data?.items ?? []
  const total = listQuery.data?.total ?? 0
  const totalPages = listQuery.data?.total_pages ?? 1

  const states: Location[] = (locationsQuery.data ?? []).filter(
    (location) => location.type === 'state',
  )
  const lgas: Location[] = filters.state_id
    ? childrenOf(filters.state_id).filter((location) => location.type === 'lga')
    : []
  const lgaCoverage = filters.lga_id
    ? descendantsOf(filters.lga_id).length
    : 0

  const selectedList = Object.values(selected)
  const allOnPageSelected =
    rows.length > 0 && rows.every((row) => selected[row.id])

  function toggleRow(application: Application) {
    setSelected((previous) => {
      const next = { ...previous }
      if (next[application.id]) delete next[application.id]
      else next[application.id] = application
      return next
    })
  }

  function toggleAllOnPage() {
    setSelected((previous) => {
      const next = { ...previous }
      if (allOnPageSelected) {
        for (const row of rows) delete next[row.id]
      } else {
        for (const row of rows) next[row.id] = row
      }
      return next
    })
  }

  function clearSelection() {
    setSelected({})
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const result = await adminApi.listApplications({
        ...queryFilters,
        page: 1,
        per_page: 500,
      })
      const header = [
        'Application number',
        'First name',
        'Last name',
        'Email',
        'Phone',
        'Role',
        'Location',
        'Status',
        'Qualification',
        'Submitted at',
      ]
      const body = result.items.map((application) =>
        [
          application.application_number,
          application.first_name,
          application.last_name,
          application.email,
          application.phone,
          application.job_title ?? '',
          locationPath(application.location_id),
          application.status,
          application.qualification ?? '',
          application.submitted_at,
        ]
          .map(csvCell)
          .join(','),
      )
      downloadFile(
        `mgm-applications-${new Date().toISOString().slice(0, 10)}.csv`,
        [header.map(csvCell).join(','), ...body].join('\n'),
      )
      toast.success(`${result.items.length} applications exported.`)
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Could not export applications.',
      )
    } finally {
      setExporting(false)
    }
  }

  const detailApplication = detail

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description="Review, shortlist and appoint candidates for every open role."
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={exportCsv}
              disabled={exporting}
              loading={exporting}
              loadingText="Exporting…"
            >
              <FileDown />
              Export CSV
            </Button>
            <Button type="button" onClick={() => setShortlistOpen(true)}>
              <Send />
              Bulk shortlist
            </Button>
          </>
        }
      />

      {/* -- Filters -- */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Narrow the list by candidate, role, status, location or date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Search" htmlFor="filter-search">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-400"
                  aria-hidden
                />
                <Input
                  id="filter-search"
                  type="search"
                  className="pl-8"
                  placeholder="Name, email or application number"
                  value={filters.search}
                  onChange={(event) =>
                    setParam('search', event.target.value || null)
                  }
                />
              </div>
            </Field>

            <Field label="Status" htmlFor="filter-status">
              <Select
                id="filter-status"
                value={filters.status ?? 'all'}
                onChange={(event) =>
                  setParam(
                    'status',
                    event.target.value === 'all' ? null : event.target.value,
                  )
                }
              >
                <option value="all">All statuses</option>
                {APPLICATION_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Role" htmlFor="filter-job">
              <Select
                id="filter-job"
                value={filters.job_id}
                onChange={(event) =>
                  setParam('job_id', event.target.value || null)
                }
              >
                <option value="">All roles</option>
                {(jobsQuery.data ?? []).map((job: Job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="State" htmlFor="filter-state">
              <Select
                id="filter-state"
                value={filters.state_id}
                onChange={(event) =>
                  setParams({
                    state_id: event.target.value || null,
                    lga_id: null,
                  })
                }
              >
                <option value="">All states</option>
                {states.map((state) => (
                  <option key={state.id} value={state.id}>
                    {state.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="LGA"
              htmlFor="filter-lga"
              hint={
                filters.lga_id
                  ? `Covers ${lgaCoverage} location${lgaCoverage === 1 ? '' : 's'}`
                  : 'Select a state first'
              }
            >
              <Select
                id="filter-lga"
                value={filters.lga_id}
                onChange={(event) =>
                  setParam('lga_id', event.target.value || null)
                }
                disabled={!filters.state_id}
              >
                <option value="">All LGAs</option>
                {lgas.map((lga) => (
                  <option key={lga.id} value={lga.id}>
                    {lga.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Submitted from" htmlFor="filter-from">
              <Input
                id="filter-from"
                type="date"
                value={filters.date_from}
                onChange={(event) =>
                  setParam('date_from', event.target.value || null)
                }
              />
            </Field>

            <Field label="Submitted to" htmlFor="filter-to">
              <Input
                id="filter-to"
                type="date"
                value={filters.date_to}
                onChange={(event) =>
                  setParam('date_to', event.target.value || null)
                }
              />
            </Field>

            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                disabled={!hasFilters}
                className="w-full"
              >
                <X />
                Clear filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* -- Results -- */}
      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            {listQuery.isLoading
              ? 'Loading applications…'
              : `${total} application${total === 1 ? '' : 's'} match the current filters.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {listQuery.isLoading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            hasFilters ? (
              <EmptyState
                icon={Search}
                title="No applications match these filters"
                description="Try widening the date range, clearing the location filter, or searching for a different name."
                action={
                  <Button type="button" variant="outline" onClick={clearFilters}>
                    <X />
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={FileDown}
                title="No applications yet"
                description="Applications submitted against published roles will appear here."
                action={
                  <Link to="/admin/jobs" className={buttonVariants({ variant: 'outline' })}>
                    Post a role
                  </Link>
                }
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      label={
                        <span className="sr-only">
                          Select all applications on this page
                        </span>
                      }
                      checked={allOnPageSelected}
                      onChange={toggleAllOnPage}
                    />
                  </TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Application No.</TableHead>
                  <SortHeader
                    label="Role"
                    sortKey="job"
                    activeSort={filters.sort}
                    order={filters.order}
                    onSort={toggleSort}
                  />
                  <TableHead>Location</TableHead>
                  <SortHeader
                    label="Status"
                    sortKey="status"
                    activeSort={filters.sort}
                    order={filters.order}
                    onSort={toggleSort}
                  />
                  <SortHeader
                    label="Submitted"
                    sortKey="submitted_at"
                    activeSort={filters.sort}
                    order={filters.order}
                    onSort={toggleSort}
                  />
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((application) => (
                  <TableRow
                    key={application.id}
                    data-state={selected[application.id] ? 'selected' : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        label={
                          <span className="sr-only">
                            Select {application.first_name}{' '}
                            {application.last_name}
                          </span>
                        }
                        checked={Boolean(selected[application.id])}
                        onChange={() => toggleRow(application)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          first={application.first_name}
                          last={application.last_name}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink-900">
                            {application.first_name} {application.last_name}
                          </p>
                          <p className="truncate text-2xs text-ink-500">
                            {application.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-2xs whitespace-nowrap text-ink-600">
                      {application.application_number}
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {application.job_title ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-40 truncate text-ink-600">
                      {locationPath(application.location_id)}
                    </TableCell>
                    <TableCell>
                      <ApplicationStatusBadge status={application.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-ink-600">
                      {relativeTime(application.submitted_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setDetail(application)}
                        >
                          <Eye />
                          View
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Download application summary for ${application.first_name} ${application.last_name}`}
                          onClick={() => downloadApplicationSummary(application)}
                        >
                          <Download />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {!listQuery.isLoading && rows.length > 0 ? (
          <div className="border-t border-ink-200">
            <Pagination
              page={filters.page}
              totalPages={totalPages}
              total={total}
              onPageChange={(page) => setParam('page', String(page))}
            />
          </div>
        ) : null}

        {/* -- Bulk action bar -- */}
        {selectedList.length > 0 ? (
          <div className="sticky bottom-0 z-10 flex flex-col gap-3 border-t border-ink-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-700">
              <span className="font-semibold tabular">
                {selectedList.length}
              </span>{' '}
              application{selectedList.length === 1 ? '' : 's'} selected
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setShortlistOpen(true)}
              >
                <Send />
                Shortlist selected
              </Button>
              <Button
                type="button"
                variant="danger-outline"
                size="sm"
                onClick={() => setRejectOpen(true)}
              >
                <UserX />
                Reject
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSelection}
              >
                <X />
                Clear
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {/* -- Dialogs -- */}
      <ShortlistDialog
        open={shortlistOpen}
        onOpenChange={setShortlistOpen}
        applications={selectedList}
        onCompleted={clearSelection}
      />

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        applications={selectedList}
        onCompleted={clearSelection}
      />

      <ApplicationDrawer
        application={detailApplication}
        onClose={() => setDetail(null)}
      />
    </div>
  )
}
