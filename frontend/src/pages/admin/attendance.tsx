import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarCheck2,
  Camera,
  CheckCircle2,
  Clock,
  ImageOff,
  Pencil,
  Search,
  UserRound,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, TableSkeleton } from '@/components/ui/empty-state'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { adminApi } from '@/lib/api'
import { formatDate, formatDateTime, formatTime } from '@/lib/format'
import type { AttendanceRecord, AttendanceStatus } from '@/types/domain'

/**
 * The administrator's attendance workspace.
 *
 * Three jobs, in the order an administrator meets them:
 *
 *   1. See today's roster — who is in, who is out, who is late or early.
 *   2. Clear the exceptions queue — open records from an earlier day, i.e.
 *      forgotten clock-outs. These are never closed automatically; the
 *      record stays open and flagged until a person fixes it, because a
 *      wrong clock-out time is worse than a missing one.
 *   3. Correct a genuine mistake — adjust the times, always with a note,
 *      always audited.
 *
 * The photographs are evidence, not identity: they are fetched as short-lived
 * signed URLs on demand and are never exposed as a stable link.
 */

type StatusFilter = AttendanceStatus | 'all'

interface Correction {
  record: AttendanceRecord
}

export function AdminAttendancePage() {
  const [status, setStatus] = React.useState<StatusFilter>('all')
  const [dateFrom, setDateFrom] = React.useState('')
  const [dateTo, setDateTo] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [exceptionsOnly, setExceptionsOnly] = React.useState(false)
  const [correction, setCorrection] = React.useState<Correction | null>(null)
  const [photoRecord, setPhotoRecord] = React.useState<AttendanceRecord | null>(
    null,
  )
  const [photoSide, setPhotoSide] = React.useState<'in' | 'out'>('in')
  const queryClient = useQueryClient()

  const recordsQuery = useQuery({
    queryKey: [
      'admin',
      'attendance',
      { status, dateFrom, dateTo, search, exceptionsOnly },
    ],
    queryFn: () =>
      adminApi.listAttendance({
        status,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        search: search.trim() || undefined,
        exceptions: exceptionsOnly || undefined,
      }),
    retry: false,
  })

  const records = recordsQuery.data ?? []
  const exceptions = records.filter((record) => record.needs_attention)
  const onDuty = records.filter(
    (record) =>
      record.status === 'open' && !record.needs_attention,
  )

  function openPhoto(record: AttendanceRecord, side: 'in' | 'out') {
    setPhotoRecord(record)
    setPhotoSide(side)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        icon={CalendarCheck2}
        title="Attendance"
        description="Today's roster, forgotten clock-outs and manual corrections."
      />

      {/* -- Summary tiles -- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          icon={UserRound}
          label="Currently on duty"
          value={String(onDuty.length)}
          hint="Clocked in today"
        />
        <SummaryTile
          icon={AlertTriangle}
          label="Needs attention"
          value={String(exceptions.length)}
          hint="Open from an earlier day"
          tone={exceptions.length > 0 ? 'warning' : 'neutral'}
        />
        <SummaryTile
          icon={Clock}
          label="Records shown"
          value={String(records.length)}
          hint="Newest first"
        />
      </div>

      {/* -- Exceptions queue -- */}
      {exceptions.length > 0 && (
        <Card className="border-warning-200 bg-warning-50/40">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning-700" aria-hidden />
              <CardTitle className="text-warning-900">
                Forgotten clock-outs
              </CardTitle>
            </div>
            <Badge variant="warning" dot>
              {exceptions.length} open
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Clocked in</TableHead>
                  <TableHead>Open for</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <p className="font-medium text-ink-900">
                        {record.staff_name}
                      </p>
                      <p className="text-xs text-ink-500">
                        {record.staff_id}
                        {record.department_name
                          ? ` · ${record.department_name}`
                          : ''}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-ink-700">
                      {formatDateTime(record.clock_in_at)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-ink-600">
                      {formatDuration(record.hours_worked_minutes)} so far
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openPhoto(record, 'in')}
                        >
                          <Camera />
                          Photo
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setCorrection({ record })}
                        >
                          <Pencil />
                          Correct
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* -- Filters -- */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
          <CardTitle>All records</CardTitle>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Search" htmlFor="att-search" className="w-52">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-400"
                  aria-hidden
                />
                <Input
                  id="att-search"
                  placeholder="Name or staff ID"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-8"
                />
              </div>
            </Field>
            <Field label="Status" htmlFor="att-status" className="w-36">
              <Select
                id="att-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as StatusFilter)
                }
              >
                <option value="all">All statuses</option>
                <option value="open">Clocked in</option>
                <option value="closed">Completed</option>
              </Select>
            </Field>
            <Field label="From" htmlFor="att-from" className="w-40">
              <Input
                id="att-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </Field>
            <Field label="To" htmlFor="att-to" className="w-40">
              <Input
                id="att-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </Field>
            <Button
              type="button"
              variant={exceptionsOnly ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setExceptionsOnly((value) => !value)}
              className="mb-0.5"
            >
              <AlertTriangle />
              Exceptions only
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {recordsQuery.isLoading ? (
            <TableSkeleton rows={8} />
          ) : recordsQuery.isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="Attendance could not be loaded"
              description={
                recordsQuery.error instanceof Error
                  ? recordsQuery.error.message
                  : 'Try again in a moment.'
              }
            />
          ) : records.length === 0 ? (
            <EmptyState
              icon={CalendarCheck2}
              title="No attendance records"
              description="Records appear here as staff clock in on the office terminal."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock in</TableHead>
                  <TableHead>Clock out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Evidence</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <p className="font-medium text-ink-900">
                        {record.staff_name}
                      </p>
                      <p className="text-xs text-ink-500">
                        {record.staff_id}
                        {record.department_name
                          ? ` · ${record.department_name}`
                          : ''}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-ink-700">
                      {formatDate(record.clock_in_at, 'EEE d MMM yyyy')}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="text-ink-700">
                        {formatTime(record.clock_in_at)}
                      </span>
                      {record.late_minutes > 0 && (
                        <span className="block text-2xs text-warning-700">
                          {record.late_minutes} min late
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {record.clock_out_at ? (
                        <>
                          <span className="text-ink-700">
                            {formatTime(record.clock_out_at)}
                          </span>
                          {record.early_minutes > 0 && (
                            <span className="block text-2xs text-warning-700">
                              {record.early_minutes} min early
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-ink-700 tabular">
                      {record.status === 'closed'
                        ? formatDuration(record.hours_worked_minutes)
                        : 'On duty'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <PhotoButton
                          onClick={() => openPhoto(record, 'in')}
                          available={Boolean(record.clock_in_photo_key)}
                          label="Clock-in photo"
                        />
                        <PhotoButton
                          onClick={() => openPhoto(record, 'out')}
                          available={Boolean(record.clock_out_photo_key)}
                          label="Clock-out photo"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <AttendanceBadge record={record} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCorrection({ record })}
                        >
                          <Pencil />
                          Correct
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CorrectionDialog
        correction={correction}
        onClose={() => setCorrection(null)}
        onSaved={() => {
          setCorrection(null)
          void queryClient.invalidateQueries({ queryKey: ['admin', 'attendance'] })
        }}
      />

      <PhotoDialog
        record={photoRecord}
        side={photoSide}
        onClose={() => setPhotoRecord(null)}
      />
    </div>
  )
}

/* -- Evidence photo ------------------------------------------------------- */

function PhotoButton({
  onClick,
  available,
  label,
}: {
  onClick: () => void
  available: boolean
  label: string
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={available ? 'outline' : 'ghost'}
      disabled={!available}
      onClick={onClick}
      title={available ? label : `No ${label.toLowerCase()} on this record`}
      aria-label={label}
    >
      {available ? <Camera /> : <ImageOff />}
    </Button>
  )
}

function PhotoDialog({
  record,
  side,
  onClose,
}: {
  record: AttendanceRecord | null
  side: 'in' | 'out'
  onClose: () => void
}) {
  const [url, setUrl] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!record) {
      setUrl(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setUrl(null)
    adminApi
      .attendancePhotoURL(record.id, side)
      .then((result) => {
        if (!cancelled) setUrl(result.url)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'The photograph could not be opened.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [record, side])

  if (!record) return null

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogHeader>
        <div>
          <DialogTitle>
            {side === 'in' ? 'Clock-in' : 'Clock-out'} photograph
          </DialogTitle>
          <DialogDescription>
            {record.staff_name} · {record.staff_id} ·{' '}
            {side === 'in'
              ? formatDateTime(record.clock_in_at)
              : record.clock_out_at
                ? formatDateTime(record.clock_out_at)
                : 'Not clocked out'}
          </DialogDescription>
        </div>
      </DialogHeader>
      <DialogBody>
        <div className="flex items-center justify-center rounded-xl bg-ink-950/90 p-2">
          {loading ? (
            <p className="py-16 text-sm text-ink-400">Opening…</p>
          ) : error ? (
            <p className="py-16 text-sm text-danger-300">{error}</p>
          ) : url ? (
            // Short-lived signed URL fetched just now; it expires on its own.
            <img
              src={url}
              alt={`${side === 'in' ? 'Clock-in' : 'Clock-out'} photo of ${record.staff_name}`}
              className="max-h-[60vh] w-auto rounded-lg object-contain"
            />
          ) : (
            <p className="py-16 text-sm text-ink-400">No photograph</p>
          )}
        </div>
        <p className="mt-3 text-center text-2xs text-ink-500">
          Visible to administrators only. Access is logged.
        </p>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

/* -- Correction ----------------------------------------------------------- */

function CorrectionDialog({
  correction,
  onClose,
  onSaved,
}: {
  correction: Correction | null
  onClose: () => void
  onSaved: () => void
}) {
  const record = correction?.record
  const [status, setStatus] = React.useState<AttendanceStatus>('closed')
  const [clockIn, setClockIn] = React.useState('')
  const [clockOut, setClockOut] = React.useState('')
  const [note, setNote] = React.useState('')

  // Seed the form from the record each time it opens.
  React.useEffect(() => {
    if (!record) return
    setStatus(record.status)
    setClockIn(toLocalInput(record.clock_in_at))
    setClockOut(record.clock_out_at ? toLocalInput(record.clock_out_at) : '')
    setNote(record.note ?? '')
  }, [record])

  const mutation = useMutation({
    mutationFn: (input: {
      id: string
      clock_in_at: string
      clock_out_at: string | null
      status: AttendanceStatus
      note: string
    }) => adminApi.correctAttendance(input.id, input),
    onSuccess: () => {
      toast.success('Record corrected and logged')
      setNote('')
      onSaved()
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : 'The record could not be corrected',
      )
    },
  })

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!record) return

    // A note is mandatory: every correction has to be explainable to someone
    // reading the audit log later, including the person it happened to.
    if (!note.trim()) {
      toast.error('Add a note explaining the correction')
      return
    }
    if (status === 'closed' && !clockOut) {
      toast.error('Enter the clock-out time, or set the status to clocked in')
      return
    }
    if (status === 'closed' && clockIn && clockOut && clockOut < clockIn) {
      toast.error('The clock-out cannot be before the clock-in')
      return
    }

    mutation.mutate({
      id: record.id,
      clock_in_at: clockIn ? new Date(clockIn).toISOString() : '',
      clock_out_at:
        status === 'closed' && clockOut
          ? new Date(clockOut).toISOString()
          : null,
      status,
      note: note.trim(),
    })
  }

  if (!record) return null

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogHeader>
        <div>
          <DialogTitle>Correct attendance record</DialogTitle>
          <DialogDescription>
            {record.staff_name} · {record.staff_id} ·{' '}
            {formatDate(record.clock_in_at, 'EEE d MMM yyyy')}
          </DialogDescription>
        </div>
      </DialogHeader>

      <form onSubmit={submit}>
        <DialogBody className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg bg-info-50 px-3 py-2.5 ring-1 ring-info-100">
            <Clock className="mt-0.5 size-4 shrink-0 text-info-700" aria-hidden />
            <p className="text-sm text-info-800">
              To close a forgotten clock-out, enter the time the person
              actually left. The correction is saved with your name and this
              note.
            </p>
          </div>

          <Field label="Status" htmlFor="corr-status" required>
            <Select
              id="corr-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as AttendanceStatus)
              }
            >
              <option value="closed">Completed (clocked out)</option>
              <option value="open">Still clocked in</option>
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Clock in" htmlFor="corr-in">
              <Input
                id="corr-in"
                type="datetime-local"
                value={clockIn}
                onChange={(event) => setClockIn(event.target.value)}
              />
            </Field>
            <Field
              label="Clock out"
              htmlFor="corr-out"
              hint={status === 'open' ? 'Leave empty while on duty' : undefined}
            >
              <Input
                id="corr-out"
                type="datetime-local"
                value={clockOut}
                onChange={(event) => setClockOut(event.target.value)}
                disabled={status === 'open'}
              />
            </Field>
          </div>

          <Field
            label="Note (required)"
            htmlFor="corr-note"
            hint="Why this correction was needed. Kept in the audit log."
            required
          >
            <Textarea
              id="corr-note"
              rows={3}
              maxLength={500}
              placeholder="Forgot to clock out; left at 17:30 per department head."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          {record.corrected_at && (
            <p className="text-2xs text-ink-500">
              Previously corrected on {formatDateTime(record.corrected_at)}.
              Saving again replaces the times but keeps this new note.
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={mutation.isPending}
            loadingText="Saving…"
          >
            <CheckCircle2 />
            Save correction
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

/* -- Shared pieces -------------------------------------------------------- */

function AttendanceBadge({ record }: { record: AttendanceRecord }) {
  if (record.status === 'open') {
    return (
      <Badge variant={record.needs_attention ? 'warning' : 'info'} dot>
        {record.needs_attention ? 'Needs clock-out' : 'On duty'}
      </Badge>
    )
  }
  return (
    <Badge variant={record.corrected_at ? 'neutral' : 'success'} dot>
      {record.corrected_at ? 'Corrected' : 'Complete'}
    </Badge>
  )
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  icon: typeof Clock
  label: string
  value: string
  hint: string
  tone?: 'neutral' | 'warning'
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-600">{label}</p>
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ${
            tone === 'warning'
              ? 'bg-warning-50 text-warning-700 ring-warning-100'
              : 'bg-ink-100 text-ink-500 ring-ink-200'
          }`}
        >
          <Icon className="size-4.5" aria-hidden />
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-ink-950 tabular">
        {value}
      </p>
      <p className="mt-2 text-xs text-ink-500">{hint}</p>
    </div>
  )
}

/** Minutes to a "7h 30m" string; "—" for anything unparseable. */
function formatDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 0) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/**
 * RFC3339 (as the API sends it) to the value a datetime-local input expects,
 * in the browser's own timezone. The store keeps UTC; this is purely a
 * display conversion for the picker.
 */
function toLocalInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
