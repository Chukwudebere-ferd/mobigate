import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  CheckCircle2,
  Clock,
  Copy,
  KeyRound,
  Search,
  ShieldAlert,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
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
import { EmptyState, TableSkeleton } from '@/components/ui/empty-state'
import { Field, Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Pagination } from '@/components/ui/pagination'
import { AccessCodeStatusBadge } from '@/components/ui/status-badges'
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
import { formatDate, formatTime } from '@/lib/format'
import type {
  AccessCode,
  AccessCodeStatus,
  AccessCodeType,
  Application,
} from '@/types/domain'

const PER_PAGE = 10
const EXPIRY_WINDOW_DAYS = 7

const STATUS_OPTIONS: { value: AccessCodeStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'used', label: 'Used' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'expired', label: 'Expired' },
]

const TYPE_OPTIONS: { value: AccessCodeType | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'applicant', label: 'Applicant' },
  { value: 'staff', label: 'Staff' },
]

const EXPIRY_OPTIONS: { value: number; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
]

function daysUntil(iso: string): number {
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return Number.POSITIVE_INFINITY
  return (target - Date.now()) / 86_400_000
}

function expiresIn(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(23, 59, 0, 0)
  return date.toISOString()
}

function isAccessCodeStatus(value: string | null): value is AccessCodeStatus {
  return (
    value === 'active' ||
    value === 'used' ||
    value === 'revoked' ||
    value === 'expired'
  )
}

function isAccessCodeType(value: string | null): value is AccessCodeType {
  return value === 'applicant' || value === 'staff'
}

export function AdminAccessCodesPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // Filters live in the URL so a filtered view can be linked and reloaded.
  const statusParam = searchParams.get('status')
  const status: AccessCodeStatus | 'all' = isAccessCodeStatus(statusParam)
    ? statusParam
    : 'all'
  const typeParam = searchParams.get('type')
  const type: AccessCodeType | 'all' = isAccessCodeType(typeParam)
    ? typeParam
    : 'all'
  const urlSearch = searchParams.get('q') ?? ''
  const pageParam = Number(searchParams.get('page') ?? '1')
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

  // The URL is the source of truth for the filter; the input keeps a local
  // copy so typing stays responsive and is pushed back on a short debounce.
  const [search, setSearch] = React.useState(urlSearch)
  const [syncedSearch, setSyncedSearch] = React.useState(urlSearch)

  const [issueOpen, setIssueOpen] = React.useState(false)
  const [revokeTarget, setRevokeTarget] = React.useState<AccessCode | null>(null)

  // Adjust the local copy when the URL changes underneath us (back/forward).
  if (urlSearch !== syncedSearch) {
    setSyncedSearch(urlSearch)
    setSearch(urlSearch)
  }

  const setParam = React.useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === '') params.delete(key)
            else params.set(key, value)
          }
          return params
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  React.useEffect(() => {
    const trimmed = search.trim()
    if (trimmed === urlSearch) return
    const timer = setTimeout(() => {
      setParam({ q: trimmed || null, page: null })
    }, 250)
    return () => clearTimeout(timer)
  }, [search, urlSearch, setParam])

  const codesQuery = useQuery({
    queryKey: ['access-codes', { search: urlSearch, status, type, page }],
    queryFn: () =>
      adminApi.listAccessCodes({
        search: urlSearch || undefined,
        status,
        type,
        page,
        per_page: PER_PAGE,
      }),
  })

  // An unfiltered pull backs the summary tiles so the counts describe the
  // whole estate rather than the current filter selection.
  const summaryQuery = useQuery({
    queryKey: ['access-codes', 'summary'],
    queryFn: () => adminApi.listAccessCodes({ per_page: 200 }),
  })

  const summary = React.useMemo(() => {
    const rows = summaryQuery.data?.items ?? []
    const active = rows.filter((c) => c.status === 'active')
    const expiringSoon = active.filter(
      (c) => daysUntil(c.expires_at) <= EXPIRY_WINDOW_DAYS,
    )
    return {
      active: active.length,
      used: rows.filter((c) => c.status === 'used').length,
      revoked: rows.filter((c) => c.status === 'revoked').length,
      expired: rows.filter((c) => c.status === 'expired').length,
      expiringSoon: expiringSoon.length,
    }
  }, [summaryQuery.data])

  const revokeMutation = useMutation({
    mutationFn: (id: string) => adminApi.revokeAccessCode(id),
    onSuccess: () => {
      toast.success('Access code revoked')
      queryClient.invalidateQueries({ queryKey: ['access-codes'] })
      setRevokeTarget(null)
    },
    onError: () => {
      toast.error('Could not revoke the access code. Please try again.')
    },
  })

  const codes = codesQuery.data?.items ?? []
  const total = codesQuery.data?.total ?? 0
  const totalPages = codesQuery.data?.total_pages ?? 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Access codes"
        description="Single-use, time-boxed codes for candidates and staff. Only a hash is stored on the server, so the full code is shown once at issue time and can never be retrieved again."
        icon={KeyRound}
        actions={
          <Button onClick={() => setIssueOpen(true)}>
            <KeyRound />
            Issue access code
          </Button>
        }
      />

      {/* -- Summary -- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Active"
          value={summary.active}
          tone="success"
          icon={CheckCircle2}
        />
        <StatCard label="Used" value={summary.used} tone="neutral" icon={Clock} />
        <StatCard
          label="Revoked"
          value={summary.revoked}
          tone="danger"
          icon={XCircle}
        />
        <StatCard
          label="Expired"
          value={summary.expired}
          tone="neutral"
          icon={Clock}
        />
        <StatCard
          label="Expiring within 7 days"
          value={summary.expiringSoon}
          tone="warning"
          icon={TriangleAlert}
        />
      </div>

      {/* -- Filter bar -- */}
      <Card>
        <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <Field label="Search" htmlFor="access-code-search">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-400"
                  aria-hidden
                />
                <Input
                  id="access-code-search"
                  className="pl-9"
                  value={search}
                  placeholder="Candidate name or last 4 characters of the code"
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </Field>
          </div>
          <div className="w-full sm:w-44">
            <Field label="Status" htmlFor="access-code-status">
              <Select
                id="access-code-status"
                value={status}
                onChange={(e) => {
                  const next = e.target.value
                  setParam({
                    status: next === 'all' ? null : next,
                    page: null,
                  })
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="w-full sm:w-44">
            <Field label="Type" htmlFor="access-code-type">
              <Select
                id="access-code-type"
                value={type}
                onChange={(e) => {
                  const next = e.target.value
                  setParam({ type: next === 'all' ? null : next, page: null })
                }}
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* -- Table -- */}
      <Card>
        {codesQuery.isLoading ? (
          <TableSkeleton rows={6} />
        ) : codesQuery.isError ? (
          <CardContent className="py-10 text-center">
            <p className="text-sm font-semibold text-ink-900">
              Could not load access codes
            </p>
            <p className="mt-1 text-sm text-ink-500">
              Check your connection and try again.
            </p>
          </CardContent>
        ) : codes.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No access codes found"
            description={
              urlSearch || status !== 'all' || type !== 'all'
                ? 'No codes match the current filters. Try widening the search or clearing the filters.'
                : 'Issue an access code to let a candidate complete onboarding.'
            }
            action={
              <Button onClick={() => setIssueOpen(true)}>
                <KeyRound />
                Issue access code
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => {
                  const expiringSoon =
                    code.status === 'active' &&
                    daysUntil(code.expires_at) <= EXPIRY_WINDOW_DAYS
                  const risky = code.failed_attempts >= 3
                  return (
                    <TableRow key={code.id}>
                      <TableCell>
                        <span
                          title="Only the last 4 characters are stored. The full code is hashed on the server and can never be recovered."
                          className="inline-flex cursor-help items-center gap-1.5 rounded-md bg-ink-100 px-2 py-1 font-mono text-xs tracking-wider text-ink-700 ring-1 ring-ink-200"
                        >
                          <span className="text-ink-400">····</span>
                          {code.code_hint}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={code.type === 'staff' ? 'brand' : 'info'}
                        >
                          {code.type === 'staff' ? 'Staff' : 'Applicant'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-ink-900">
                        {code.applicant_name ?? '—'}
                      </TableCell>
                      <TableCell>{code.job_title ?? '—'}</TableCell>
                      <TableCell>
                        <AccessCodeStatusBadge status={code.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(code.created_at)}
                        <span className="block text-2xs text-ink-500">
                          {formatTime(code.created_at)}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(
                          'whitespace-nowrap',
                          expiringSoon && 'font-medium text-warning-700',
                        )}
                      >
                        {formatDate(code.expires_at)}
                        {expiringSoon && (
                          <span className="block text-2xs text-warning-700">
                            within {EXPIRY_WINDOW_DAYS} days
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'tabular',
                            risky
                              ? 'font-semibold text-danger-700'
                              : code.failed_attempts > 0
                                ? 'text-warning-700'
                                : 'text-ink-500',
                          )}
                        >
                          {code.failed_attempts}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {code.status === 'active' ? (
                          <Button
                            size="sm"
                            variant="danger-outline"
                            onClick={() => setRevokeTarget(code)}
                          >
                            <Ban />
                            Revoke
                          </Button>
                        ) : (
                          <span className="text-2xs text-ink-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              onPageChange={(next) => setParam({ page: String(next) })}
            />
          </>
        )}
      </Card>

      <IssueAccessCodeDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
      />

      <RevokeAccessCodeDialog
        code={revokeTarget}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
        onConfirm={() => {
          if (!revokeTarget) return
          revokeMutation.mutate(revokeTarget.id)
        }}
        pending={revokeMutation.isPending}
      />
    </div>
  )
}

function IssueAccessCodeDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const [applicationId, setApplicationId] = React.useState('')
  const [codeType, setCodeType] = React.useState<AccessCodeType>('staff')
  const [expiryDays, setExpiryDays] = React.useState(7)
  const [issuedCode, setIssuedCode] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  const applicationsQuery = useQuery({
    queryKey: ['applications', 'issuable'],
    queryFn: () => adminApi.listApplications({ per_page: 200 }),
    enabled: open,
  })

  const issuable: Application[] = React.useMemo(
    () =>
      (applicationsQuery.data?.items ?? []).filter(
        (app) => app.status === 'shortlisted' || app.status === 'appointed',
      ),
    [applicationsQuery.data],
  )

  const issueMutation = useMutation({
    mutationFn: (payload: {
      application_id: string
      type: AccessCodeType
      expires_at: string
    }) => adminApi.issueAccessCode(payload),
    onSuccess: (result) => {
      // The plaintext code is returned exactly once. It is captured here and
      // shown to the admin; it can never be fetched again.
      setIssuedCode(result.code)
      setCopied(false)
      toast.success('Access code issued')
      queryClient.invalidateQueries({ queryKey: ['access-codes'] })
    },
    onError: () => {
      toast.error('Could not issue the access code. Please try again.')
    },
  })

  const reset = () => {
    setApplicationId('')
    setCodeType('staff')
    setExpiryDays(7)
    setIssuedCode(null)
    setCopied(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const copyCode = async () => {
    if (!issuedCode) return
    try {
      await navigator.clipboard.writeText(issuedCode)
      setCopied(true)
      toast.success('Code copied to clipboard')
    } catch {
      toast.error('Could not copy automatically — select the code and copy it manually.')
    }
  }

  const selectedApplication = issuable.find(
    (app) => app.id === applicationId,
  )

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      className="sm:max-w-2xl"
      aria-label="Issue access code"
    >
      <DialogHeader>
        <DialogTitle>
          {issuedCode ? 'Copy your access code now' : 'Issue access code'}
        </DialogTitle>
        <DialogDescription>
          {issuedCode
            ? 'This is the only time the full code is shown. Send it to the candidate over a secure channel.'
            : 'Codes are single-use and time-boxed. Only a hash is stored on the server.'}
        </DialogDescription>
      </DialogHeader>

      {issuedCode ? (
        <>
          <DialogBody className="space-y-4">
            <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-5 text-center">
              <p className="text-2xs font-medium tracking-wide text-brand-700 uppercase">
                Access code
              </p>
              <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.35em] text-brand-900 select-all">
                {issuedCode}
              </p>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={copyCode}
            >
              <Copy />
              {copied ? 'Copied to clipboard' : 'Copy code'}
            </Button>

            <div className="flex items-start gap-2.5 rounded-lg bg-danger-50 px-3.5 py-3 ring-1 ring-danger-100">
              <TriangleAlert className="mt-0.5 size-4.5 shrink-0 text-danger-700" aria-hidden />
              <div className="text-sm text-danger-900">
                <p className="font-semibold">This code will not be shown again</p>
                <p className="mt-1">
                  The server stores only a hash of the code, so it cannot be
                  retrieved, edited or re-sent. Copy it now and pass it to{' '}
                  {selectedApplication
                    ? `${selectedApplication.first_name} ${selectedApplication.last_name}`
                    : 'the candidate'}
                  . If it is lost, revoke it and issue a new one.
                </p>
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              onClick={() => {
                handleOpenChange(false)
              }}
            >
              I have copied it
            </Button>
          </DialogFooter>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (!applicationId) {
              toast.error('Select the candidate this code is for.')
              return
            }
            issueMutation.mutate({
              application_id: applicationId,
              type: codeType,
              expires_at: expiresIn(expiryDays),
            })
          }}
        >
          <DialogBody className="space-y-4">
            <Field
              label="Candidate"
              htmlFor="access-code-candidate"
              required
              hint="Only shortlisted or appointed applicants can receive an access code."
            >
              <Select
                id="access-code-candidate"
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                required
              >
                <option value="">Select a candidate…</option>
                {issuable.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.first_name} {app.last_name} —{' '}
                    {app.job_title ?? 'No role'} ({app.application_number})
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Code type"
                htmlFor="access-code-type-issue"
                hint="Staff codes are used for portal onboarding; applicant codes for interview access."
              >
                <Select
                  id="access-code-type-issue"
                  value={codeType}
                  onChange={(e) => setCodeType(e.target.value as AccessCodeType)}
                >
                  <option value="staff">Staff</option>
                  <option value="applicant">Applicant</option>
                </Select>
              </Field>

              <Field
                label="Expires after"
                htmlFor="access-code-expiry"
                hint="The code stops working at the end of this period."
              >
                <Select
                  id="access-code-expiry"
                  value={String(expiryDays)}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                >
                  {EXPIRY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <p className="flex items-start gap-2 rounded-lg bg-info-50 px-3 py-2.5 text-xs text-info-900 ring-1 ring-info-100">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              The code is generated and hashed on the server. The plaintext is
              returned once, in the next step, and never again.
            </p>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={issueMutation.isPending}
              loadingText="Issuing"
            >
              <KeyRound />
              Issue access code
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  )
}

function RevokeAccessCodeDialog({
  code,
  onOpenChange,
  onConfirm,
  pending,
}: {
  code: AccessCode | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <Dialog
      open={code !== null}
      onOpenChange={onOpenChange}
      aria-label="Revoke access code"
    >
      <DialogHeader>
        <DialogTitle>Revoke this access code?</DialogTitle>
        <DialogDescription>
          The code ending{' '}
          <span className="font-mono font-medium text-ink-800">
            {code?.code_hint}
          </span>{' '}
          will stop working immediately.
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-lg bg-danger-50 px-3.5 py-3 ring-1 ring-danger-100">
          <TriangleAlert className="mt-0.5 size-4.5 shrink-0 text-danger-700" aria-hidden />
          <div className="text-sm text-danger-900">
            <p className="font-semibold">The code becomes unusable</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                {code?.applicant_name ?? 'The candidate'} will not be able to
                redeem the code, even if they still hold it.
              </li>
              <li>
                A new code must be issued to the candidate — the current one
                cannot be reactivated.
              </li>
            </ul>
          </div>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          Keep code
        </Button>
        <Button
          variant="danger"
          onClick={onConfirm}
          loading={pending}
          loadingText="Revoking"
        >
          Revoke access code
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
