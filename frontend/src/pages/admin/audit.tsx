/**
 * Admin › Audit log (README BR-14, M13).
 *
 * An append-only record of every status transition, code issuance, code
 * redemption, CV download and account change. Entries are never edited or
 * removed — the log is the evidence trail for the whole portal.
 */

import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Clock,
  FileSearch,
  Info,
  Search,
  Users,
} from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, TableSkeleton } from '@/components/ui/empty-state'
import { Field, Input, Select } from '@/components/ui/input'
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
import { cn } from '@/lib/cn'
import { formatDateTime, relativeTime } from '@/lib/format'
import type { AuditLog } from '@/types/domain'

/** Pretty-print a before/after snapshot for the change dialog. */
function prettyJson(value: Record<string, unknown> | null): string {
  if (!value) return '— no snapshot recorded —'
  return JSON.stringify(value, null, 2)
}

function isSameDay(value: string, reference: Date): boolean {
  const date = new Date(value)
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  )
}

export function AdminAuditPage() {
  const [search, setSearch] = React.useState('')
  const [action, setAction] = React.useState('all')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [selected, setSelected] = React.useState<AuditLog | null>(null)
  // Captured once per mount: the "today" boundary for the summary tile.
  const [now] = React.useState(() => new Date())

  const auditQuery = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => adminApi.listAuditLogs(),
  })

  const logs = React.useMemo(() => auditQuery.data ?? [], [auditQuery.data])

  const actions = React.useMemo(() => {
    const set = new Set<string>()
    for (const log of logs) set.add(log.action)
    return Array.from(set).sort()
  }, [logs])

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    const fromTime = from ? new Date(from).getTime() : null
    // Inclusive of the whole end day.
    const toTime = to ? new Date(to).getTime() + 86_400_000 : null

    return logs.filter((log) => {
      if (action !== 'all' && log.action !== action) return false
      if (needle) {
        const haystack = `${log.actor_name ?? ''} ${log.actor_id ?? ''} ${log.action} ${log.entity_type} ${log.entity_id ?? ''}`
        if (!haystack.toLowerCase().includes(needle)) return false
      }
      const created = new Date(log.created_at).getTime()
      if (fromTime !== null && created < fromTime) return false
      if (toTime !== null && created > toTime) return false
      return true
    })
  }, [logs, search, action, from, to])

  const summary = React.useMemo(() => {
    const actors = new Set<string>()
    const counts = new Map<string, number>()
    let today = 0

    for (const log of logs) {
      actors.add(log.actor_id ?? log.actor_name ?? 'unknown')
      counts.set(log.action, (counts.get(log.action) ?? 0) + 1)
      if (isSameDay(log.created_at, now)) today += 1
    }

    let topAction = '—'
    let topCount = 0
    for (const [key, value] of counts) {
      if (value > topCount) {
        topAction = key
        topCount = value
      }
    }

    return {
      total: logs.length,
      today,
      actors: actors.size,
      topAction,
      topCount,
    }
  }, [logs, now])

  const hasFilters =
    search.trim().length > 0 || action !== 'all' || from !== '' || to !== ''

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="An append-only record of every status transition, code issuance, code redemption, CV download and account change. Entries are written by the system and can never be edited or removed."
        icon={FileSearch}
      />

      {/* -- Summary -- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total events"
          value={summary.total.toString()}
          icon={Activity}
        />
        <SummaryCard
          label="Events today"
          value={summary.today.toString()}
          icon={Clock}
        />
        <SummaryCard
          label="Distinct actors"
          value={summary.actors.toString()}
          icon={Users}
        />
        <SummaryCard
          label="Most common action"
          value={summary.topAction}
          hint={summary.topCount > 0 ? `${summary.topCount} events` : undefined}
          icon={FileSearch}
        />
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-info-500/30 bg-info-50 p-3">
        <Info className="mt-0.5 size-4 shrink-0 text-info-700" aria-hidden />
        <p className="text-xs text-info-900">
          CV downloads are logged deliberately. Every time an Admin opens a
          candidate's CV the event is written here with the actor and the IP
          address, so access to applicant documents is always attributable
          (README M5, BR-14).
        </p>
      </div>

      {/* -- Filters -- */}
      <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-xs">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search" htmlFor="audit-search">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-400"
                aria-hidden
              />
              <Input
                id="audit-search"
                className="pl-8"
                placeholder="Actor or action"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </Field>

          <Field label="Action" htmlFor="audit-action">
            <Select
              id="audit-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="all">All actions</option>
              {actions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="From" htmlFor="audit-from">
            <Input
              id="audit-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>

          <Field label="To" htmlFor="audit-to">
            <Input
              id="audit-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* -- Log -- */}
      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xs">
        {auditQuery.isLoading ? (
          <TableSkeleton rows={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileSearch}
            title={
              hasFilters
                ? 'No events match these filters'
                : 'No audit events yet'
            }
            description={
              hasFilters
                ? 'Widen the date range or clear the action filter to see more.'
                : 'Activity is written here as soon as it happens — status changes, code issuance, CV downloads and account changes.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity type</TableHead>
                <TableHead>Entity id</TableHead>
                <TableHead>IP address</TableHead>
                <TableHead className="text-right">Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <span
                      className="text-ink-700"
                      title={formatDateTime(log.created_at)}
                    >
                      {relativeTime(log.created_at)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-ink-900">
                      {log.actor_name ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-2xs text-ink-800">
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell>{log.entity_type}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-ink-700">
                      {log.entity_id ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-ink-600">
                      {log.ip_address ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(log)}
                    >
                      View changes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ChangeDialog log={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

/* -- Summary card -------------------------------------------------------- */

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint?: string
  icon: typeof Activity
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 ring-1 ring-brand-100">
          <Icon className="size-4.5 text-brand-700" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
            {label}
          </p>
          <p
            className={cn(
              'mt-0.5 truncate text-lg font-semibold text-ink-900',
              value.length > 18 && 'font-mono text-sm',
            )}
            title={value}
          >
            {value}
          </p>
          {hint && <p className="text-2xs text-ink-500">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

/* -- Change dialog ------------------------------------------------------- */

function ChangeDialog({
  log,
  onClose,
}: {
  log: AuditLog | null
  onClose: () => void
}) {
  return (
    <Dialog
      open={log !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogHeader>
        <div className="min-w-0">
          <DialogTitle>Recorded changes</DialogTitle>
          <DialogDescription>
            {log ? (
              <>
                <span className="font-mono text-xs">{log.action}</span> on{' '}
                {log.entity_type}
                {log.entity_id ? ` · ${log.entity_id}` : ''} ·{' '}
                {formatDateTime(log.created_at)}
              </>
            ) : (
              ''
            )}
          </DialogDescription>
        </div>
        <DialogClose onClick={onClose} />
      </DialogHeader>

      <DialogBody className="space-y-4">
        {log && (
          <>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
                  Actor
                </dt>
                <dd className="mt-0.5 text-sm text-ink-800">
                  {log.actor_name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
                  IP address
                </dt>
                <dd className="mt-0.5 font-mono text-xs text-ink-800">
                  {log.ip_address ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
                  User agent
                </dt>
                <dd
                  className="mt-0.5 truncate text-xs text-ink-800"
                  title={log.user_agent ?? ''}
                >
                  {log.user_agent ?? '—'}
                </dd>
              </div>
            </dl>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-1.5 text-2xs font-medium tracking-wide text-ink-500 uppercase">
                  Before
                </p>
                <pre className="max-h-72 overflow-auto rounded-lg border border-ink-200 bg-ink-50 p-3 font-mono text-xs whitespace-pre-wrap text-ink-700">
                  {prettyJson(log.before_data)}
                </pre>
              </div>
              <div>
                <p className="mb-1.5 text-2xs font-medium tracking-wide text-ink-500 uppercase">
                  After
                </p>
                <pre className="max-h-72 overflow-auto rounded-lg border border-success-500/30 bg-success-50 p-3 font-mono text-xs whitespace-pre-wrap text-success-900">
                  {prettyJson(log.after_data)}
                </pre>
              </div>
            </div>
          </>
        )}
      </DialogBody>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
