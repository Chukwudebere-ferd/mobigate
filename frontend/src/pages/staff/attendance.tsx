import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  CalendarCheck2,
  Clock,
  LaptopMinimal,
  LogIn,
  LogOut,
  Timer,
} from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState, Spinner, TableSkeleton } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { staffApi } from '@/lib/api'
import { formatDate, formatDateTime, formatTime } from '@/lib/format'
import type { AttendanceRecord } from '@/types/domain'

/**
 * A staff member's own attendance history.
 *
 * Read-only, and deliberately so: clocking happens on the paired office
 * laptop, never from a personal device. This screen exists so anyone can
 * check their own record from anywhere — which was the requirement — while
 * the act of clocking stays confined to the office.
 *
 * The hours shown are computed by the server from the office timezone, so
 * what a staff member reads here is what the administrator sees.
 */
export function StaffAttendancePage() {
  const query = useQuery({
    queryKey: ['staff', 'attendance'],
    queryFn: () => staffApi.attendance(),
    retry: false,
  })

  const records = query.data?.items ?? []
  const open = records.find((record) => record.status === 'open')
  // Captured once at mount rather than rebuilt on every render: calling
  // `new Date()` in the render body is impure and makes this list recompute
  // against a clock that moves between renders.
  const [nowISO] = React.useState(() => new Date().toISOString())
  const closedThisMonth = records.filter(
    (record) =>
      record.status === 'closed' && sameMonth(record.clock_in_at, nowISO),
  )

  if (query.isLoading) return <Spinner />

  if (query.isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={CalendarCheck2}
          title="Attendance"
          description="Your clock-in and clock-out history."
        />
        <EmptyState
          icon={AlertCircle}
          title="Your attendance could not be loaded"
          description={
            query.error instanceof Error
              ? query.error.message
              : 'Try again in a moment.'
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarCheck2}
        title="Attendance"
        description="Your clock-in and clock-out history, recorded on the office attendance terminal."
      />

      {/* -- Current state -- */}
      {open ? (
        <Card className="border-info-100 bg-info-50/50">
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-100 ring-1 ring-info-100">
                <Timer className="size-5 text-info-700" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  You are clocked in
                </p>
                <p className="mt-1 text-sm text-ink-600">
                  Since {formatDateTime(open.clock_in_at)}. Remember to clock
                  out on the office terminal before you leave.
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-lg bg-white px-4 py-3 ring-1 ring-info-100 sm:text-right">
              <p className="text-2xs font-semibold tracking-wide text-ink-500 uppercase">
                Elapsed
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-ink-900 tabular">
                {formatDuration(open.hours_worked_minutes)}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-start gap-2.5 rounded-lg border border-ink-200 bg-white px-3.5 py-3 shadow-xs">
          <LaptopMinimal
            className="mt-0.5 size-4 shrink-0 text-ink-400"
            aria-hidden
          />
          <p className="text-sm text-ink-600">
            You are not clocked in. Clocking is done on the attendance terminal
            in the office — enter your Staff ID there and follow the on-screen
            steps. Attendance can be viewed from anywhere, but only the office
            terminal can record it.
          </p>
        </div>
      )}

      {/* -- Summary -- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          icon={Clock}
          label="Records"
          value={String(records.length)}
          hint="All time"
        />
        <SummaryTile
          icon={LogIn}
          label="Currently clocked in"
          value={open ? 'Yes' : 'No'}
          hint={open ? `Since ${formatTime(open.clock_in_at)}` : 'Not on duty'}
        />
        <SummaryTile
          icon={CalendarCheck2}
          label="This month"
          value={String(closedThisMonth.length)}
          hint="Completed days"
        />
      </div>

      {/* -- History -- */}
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            Your most recent clock-ins and clock-outs, newest first.
          </CardDescription>
        </CardHeader>
        {records.length === 0 ? (
          <CardContent>
            <p className="text-sm text-ink-500">
              No attendance has been recorded for you yet. Your first clock-in
              will appear here.
            </p>
          </CardContent>
        ) : query.isLoading ? (
          <TableSkeleton rows={6} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Clock in</TableHead>
                <TableHead>Clock out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <AttendanceRow key={record.id} record={record} />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}

function AttendanceRow({ record }: { record: AttendanceRecord }) {
  return (
    <TableRow>
      <TableCell>
        <p className="font-medium text-ink-900">
          {formatDate(record.clock_in_at, 'EEE d MMM yyyy')}
        </p>
        {record.needs_attention && (
          <p className="mt-0.5 text-2xs text-warning-700">
            Needs a clock-out
          </p>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 text-ink-700">
          <LogIn className="size-3.5 text-ink-400" aria-hidden />
          {formatTime(record.clock_in_at)}
        </span>
        {record.late_minutes > 0 && (
          <span className="mt-0.5 block text-2xs text-warning-700">
            {record.late_minutes} min late
          </span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {record.clock_out_at ? (
          <span className="inline-flex items-center gap-1.5 text-ink-700">
            <LogOut className="size-3.5 text-ink-400" aria-hidden />
            {formatTime(record.clock_out_at)}
          </span>
        ) : (
          <span className="text-ink-400">—</span>
        )}
        {record.clock_out_at && record.early_minutes > 0 && (
          <span className="mt-0.5 block text-2xs text-warning-700">
            {record.early_minutes} min early
          </span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-ink-700 tabular">
        {record.status === 'closed'
          ? formatDuration(record.hours_worked_minutes)
          : 'On duty'}
      </TableCell>
      <TableCell>
        <AttendanceBadge record={record} />
      </TableCell>
    </TableRow>
  )
}

function AttendanceBadge({ record }: { record: AttendanceRecord }) {
  if (record.status === 'open') {
    return (
      <Badge variant={record.needs_attention ? 'warning' : 'info'} dot>
        {record.needs_attention ? 'Needs clock-out' : 'On duty'}
      </Badge>
    )
  }
  if (record.needs_attention) {
    return (
      <Badge variant="warning" dot>
        Closed by admin
      </Badge>
    )
  }
  return (
    <Badge variant="success" dot>
      Complete
    </Badge>
  )
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Clock
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-600">{label}</p>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 ring-1 ring-ink-200">
          <Icon className="size-4.5 text-ink-500" aria-hidden />
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

function sameMonth(a: string, b: string) {
  const left = new Date(a)
  const right = new Date(b)
  if (Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return false
  return (
    left.getMonth() === right.getMonth() && left.getFullYear() === right.getFullYear()
  )
}
