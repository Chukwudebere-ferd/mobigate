import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  CheckCircle2,
  MessageSquareText,
  Quote,
  Send,
  ShieldAlert,
  TriangleAlert,
  Users,
  XCircle,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Avatar } from '@/components/ui/avatar'
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
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { adminApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDate, formatTime, fullName } from '@/lib/format'
import { useSession } from '@/providers/session-provider'
import type { Shortlist } from '@/types/domain'

function splitName(applicantName?: string): {
  first: string
  last: string
} {
  const parts = (applicantName ?? '').trim().split(/\s+/)
  if (parts.length === 0 || parts[0] === '') return { first: '', last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

function isSameMonth(value: string, reference: Date): boolean {
  const date = new Date(value)
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth()
  )
}

/** Stable "today" captured once per mount so the monthly count does not drift. */
function useMonthAnchor(): Date {
  const [anchor] = React.useState(() => new Date())
  return anchor
}

/**
 * Shortlists carry only a user id for the author. Resolve it to a display
 * name: the signed-in admin when it matches, otherwise a generic label.
 */
function resolveActorName(
  createdBy: string | null,
  currentUserId: string | undefined,
  currentUserName: string | null,
): string {
  if (!createdBy) return 'System'
  if (currentUserId && createdBy === currentUserId) {
    return currentUserName ?? 'You'
  }
  return 'Another admin'
}

/**
 * Messages are stored verbatim and re-delivered verbatim, but a message
 * typed entirely in capitals reads as a shout. Normalise that case only —
 * ordinary sentence case is left untouched.
 */
function toSentenceCase(message: string): string {
  if (message !== message.toUpperCase()) return message
  return message.charAt(0).toUpperCase() + message.slice(1).toLowerCase()
}

export function AdminShortlistsPage() {
  const queryClient = useQueryClient()
  const { session } = useSession()

  const shortlistsQuery = useQuery({
    queryKey: ['shortlists'],
    queryFn: () => adminApi.listShortlists(),
  })

  // Total applications and the shortlisted subset are read from the
  // paginated envelope's `total`, so the acceptance rate stays correct even
  // when the underlying list grows beyond one page.
  const allApplicationsQuery = useQuery({
    queryKey: ['applications', 'total'],
    queryFn: () => adminApi.listApplications({ per_page: 1 }),
  })
  const shortlistedApplicationsQuery = useQuery({
    queryKey: ['applications', 'total', 'shortlisted'],
    queryFn: () => adminApi.listApplications({ status: 'shortlisted', per_page: 1 }),
  })

  const shortlists = React.useMemo(
    () => shortlistsQuery.data ?? [],
    [shortlistsQuery.data],
  )

  const monthAnchor = useMonthAnchor()

  const stats = React.useMemo(() => {
    const active = shortlists.filter((s) => s.status === 'active').length
    const revoked = shortlists.filter((s) => s.status === 'revoked').length
    const thisMonth = shortlists.filter((s) =>
      isSameMonth(s.created_at, monthAnchor),
    ).length
    const totalApplications = allApplicationsQuery.data?.total ?? 0
    const shortlistedApplications =
      shortlistedApplicationsQuery.data?.total ?? 0
    const acceptanceRate =
      totalApplications === 0
        ? 0
        : Math.round((shortlistedApplications / totalApplications) * 100)
    return {
      active,
      revoked,
      thisMonth,
      totalApplications,
      shortlistedApplications,
      acceptanceRate,
    }
  }, [
    shortlists,
    monthAnchor,
    allApplicationsQuery.data,
    shortlistedApplicationsQuery.data,
  ])

  const revokeMutation = useMutation({
    mutationFn: (id: string) => adminApi.revokeShortlist(id),
    onSuccess: () => {
      toast.success('Shortlist revoked')
      queryClient.invalidateQueries({ queryKey: ['shortlists'] })
      queryClient.invalidateQueries({ queryKey: ['applications'] })
    },
    onError: () => {
      toast.error('Could not revoke the shortlist. Please try again.')
    },
  })

  const resendMutation = useMutation({
    // The message is stored verbatim at shortlist time; a resend queues a
    // fresh delivery of that text, it never edits it.
    mutationFn: (shortlist: Shortlist) => adminApi.resendShortlist(shortlist.id),
    onSuccess: (notification) => {
      toast.success(
        `Message queued for ${notification.recipient_contact ?? 'the candidate'}.`,
      )
      queryClient.invalidateQueries({ queryKey: ['shortlists'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not queue the message. Please try again.',
      )
    },
  })

  const [revokeTarget, setRevokeTarget] = React.useState<Shortlist | null>(null)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shortlists"
        description="Each shortlist carries a confirmation message that is shown only to the shortlisted candidate. The message is stored exactly as written and cannot be edited after sending — it can only be resent."
        icon={Users}
      />

      {/* -- Summary -- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active shortlists"
          value={stats.active}
          tone="info"
          icon={CheckCircle2}
          hint="Shortlists currently in force"
        />
        <StatCard
          label="Revoked"
          value={stats.revoked}
          tone="danger"
          icon={XCircle}
          hint="Withdrawn before appointment"
        />
        <StatCard
          label="Shortlisted this month"
          value={stats.thisMonth}
          tone="brand"
          icon={Bell}
          hint="Created in the current month"
        />
        <StatCard
          label="Acceptance rate"
          value={stats.acceptanceRate}
          suffix="%"
          tone="success"
          icon={CheckCircle2}
          hint={`${stats.shortlistedApplications} shortlisted of ${stats.totalApplications} applications`}
        />
      </div>

      {/* -- List -- */}
      <Card>
        {shortlistsQuery.isLoading ? (
          <Spinner />
        ) : shortlistsQuery.isError ? (
          <CardContent className="py-10 text-center">
            <p className="text-sm font-semibold text-ink-900">
              Could not load shortlists
            </p>
            <p className="mt-1 text-sm text-ink-500">
              Check your connection and try again.
            </p>
          </CardContent>
        ) : shortlists.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No candidates shortlisted yet"
            description="Select applications and shortlist them in bulk."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {shortlists.map((shortlist) => (
              <ShortlistRow
                key={shortlist.id}
                shortlist={shortlist}
                createdByName={resolveActorName(
                  shortlist.created_by,
                  session?.user.id,
                  session
                    ? fullName(session.user.first_name, session.user.last_name)
                    : null,
                )}
                resendPending={
                  resendMutation.isPending &&
                  resendMutation.variables?.id === shortlist.id
                }
                onResend={() => resendMutation.mutate(shortlist)}
                onRevoke={() => setRevokeTarget(shortlist)}
              />
            ))}
          </ul>
        )}
      </Card>

      <p className="flex items-start gap-2 text-xs text-ink-500">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
        The confirmation message is visible only to the shortlisted candidate.
        Revoking a shortlist notifies the candidate and returns the application
        to <span className="font-medium text-ink-700">pending</span>.
      </p>

      <RevokeDialog
        shortlist={revokeTarget}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
        onConfirm={() => {
          if (!revokeTarget) return
          revokeMutation.mutate(revokeTarget.id, {
            onSuccess: () => setRevokeTarget(null),
          })
        }}
        pending={revokeMutation.isPending}
      />
    </div>
  )
}

function ShortlistRow({
  shortlist,
  createdByName,
  onResend,
  onRevoke,
  resendPending,
}: {
  shortlist: Shortlist
  createdByName: string
  onResend: () => void
  onRevoke: () => void
  resendPending: boolean
}) {
  const [expanded, setExpanded] = React.useState(false)
  const { first, last } = splitName(shortlist.applicant_name)
  const message = toSentenceCase(shortlist.message?.trim() ?? '')
  const isLong = message.length > 200
  const isActive = shortlist.status === 'active'

  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar first={first} last={last} size="md" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-ink-900">
                {shortlist.applicant_name ?? 'Candidate'}
              </p>
              {isActive ? (
                <Badge variant="info" dot>
                  Active
                </Badge>
              ) : (
                <Badge variant="danger" dot>
                  Revoked
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-ink-600">
              {shortlist.job_title ?? 'Role'}
            </p>
            <p className="mt-1 text-2xs text-ink-500">
              Shortlisted {formatDate(shortlist.created_at)} at{' '}
              {formatTime(shortlist.created_at)} by {createdByName}
              {shortlist.revoked_at
                ? ` · revoked ${formatDate(shortlist.revoked_at)}`
                : ''}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onResend}
            loading={resendPending}
            loadingText="Sending"
          >
            <Send />
            Resend message
          </Button>
          {isActive && (
            <Button size="sm" variant="danger-outline" onClick={onRevoke}>
              <XCircle />
              Revoke
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-ink-200 border-l-4 border-l-brand-300 bg-ink-50/70 px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-2xs font-medium tracking-wide text-ink-500 uppercase">
          <Quote className="size-3.5" aria-hidden />
          Message to the candidate
        </p>
        <blockquote
          className={cn(
            'mt-1.5 text-sm text-ink-700',
            isLong && !expanded && 'line-clamp-2',
          )}
        >
          “{message}”
        </blockquote>
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

      <p className="mt-2 flex items-start gap-1.5 text-2xs text-ink-500">
        <MessageSquareText className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Stored verbatim at shortlist time — it cannot be edited after sending,
        only resent.
      </p>
    </li>
  )
}

function RevokeDialog({
  shortlist,
  onOpenChange,
  onConfirm,
  pending,
}: {
  shortlist: Shortlist | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <Dialog
      open={shortlist !== null}
      onOpenChange={onOpenChange}
      aria-label="Revoke shortlist"
    >
      <DialogHeader>
        <DialogTitle>Revoke this shortlist?</DialogTitle>
        <DialogDescription>
          The shortlist for {shortlist?.applicant_name ?? 'this candidate'} will
          be withdrawn immediately.
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-lg bg-danger-50 px-3.5 py-3 ring-1 ring-danger-100">
          <TriangleAlert className="mt-0.5 size-4.5 shrink-0 text-danger-700" aria-hidden />
          <div className="text-sm text-danger-900">
            <p className="font-semibold">This cannot be undone</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>The candidate is notified that the shortlist is withdrawn.</li>
              <li>
                The application returns to{' '}
                <span className="font-medium">pending</span> and can be
                shortlisted again.
              </li>
              <li>The confirmation message stops being shown to the candidate.</li>
            </ul>
          </div>
        </div>
        {shortlist?.message ? (
          <div className="rounded-lg border border-ink-200 bg-ink-50/70 px-3.5 py-3">
            <p className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
              Message that will no longer be shown
            </p>
            <p className="mt-1.5 line-clamp-3 text-sm text-ink-700">
              “{shortlist.message}”
            </p>
          </div>
        ) : null}
      </DialogBody>

      <DialogFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Keep shortlist
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={pending} loadingText="Revoking">
          Revoke shortlist
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
