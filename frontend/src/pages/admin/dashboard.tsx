import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  FileText,
  KeyRound,
  Megaphone,
  Plus,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { ApplicationStatusBadge } from '@/components/ui/status-badges'
import { adminApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, humanize, relativeTime } from '@/lib/format'
import { useNow } from '@/lib/use-now'

type Tone = 'brand' | 'warning' | 'info' | 'success' | 'accent'

const toneStyles: Record<Tone, { icon: string; value: string; chip: string }> = {
  brand: {
    icon: 'bg-brand-50 text-brand-700',
    value: 'text-brand-700',
    chip: 'bg-brand-50 text-brand-700',
  },
  warning: {
    icon: 'bg-warning-50 text-warning-700',
    value: 'text-warning-700',
    chip: 'bg-warning-50 text-warning-700',
  },
  info: {
    icon: 'bg-info-50 text-info-700',
    value: 'text-info-700',
    chip: 'bg-info-50 text-info-700',
  },
  success: {
    icon: 'bg-success-50 text-success-700',
    value: 'text-success-700',
    chip: 'bg-success-50 text-success-700',
  },
  accent: {
    icon: 'bg-accent-50 text-accent-800',
    value: 'text-accent-800',
    chip: 'bg-accent-50 text-accent-800',
  },
}

type Range = '7d' | '30d' | '90d'

const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90 }

interface MetricTile {
  label: string
  value: number
  to: string
  tone: Tone
  icon: typeof TrendingUp
  /** Measured change — rendered as a green/red arrow. */
  delta?: number
  /** Factual context — rendered as a neutral chip. */
  fact?: string
  sub: string
}

function humanizeAction(action: string): string {
  return action
    .split('.')
    .map((part) => humanize(part))
    .join(' ')
}

function TrendTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null
  const entry = payload[0]
  const value = typeof entry?.value === 'number' ? entry.value : 0
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 shadow-sm">
      <p className="text-2xs font-medium text-ink-500">
        {formatDate(String(label ?? ''), 'd MMM yyyy')}
      </p>
      <p className="text-sm font-semibold text-ink-900 tabular">
        {value} application{value === 1 ? '' : 's'}
      </p>
    </div>
  )
}

export function AdminDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rangeParam = searchParams.get('range')
  const range: Range =
    rangeParam === '7d' || rangeParam === '90d' ? rangeParam : '30d'

  function setRange(next: Range) {
    const params = new URLSearchParams(searchParams)
    if (next === '30d') params.delete('range')
    else params.set('range', next)
    setSearchParams(params, { replace: true })
  }

  const dashboardQuery = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: () => adminApi.dashboard(),
  })
  const auditQuery = useQuery({
    queryKey: ['admin', 'audit-logs'],
    queryFn: () => adminApi.listAuditLogs(),
  })
  const interviewsQuery = useQuery({
    queryKey: ['admin', 'interviews'],
    queryFn: () => adminApi.listInterviews(),
  })
  const recentApplicationsQuery = useQuery({
    queryKey: ['admin', 'applications', 'recent'],
    queryFn: () => adminApi.listApplications({ per_page: 5 }),
  })

  const metrics = dashboardQuery.data
  const now = useNow()

  // The API exposes a rolling 30-day series; longer ranges simply cover it all.
  const window = RANGE_DAYS[range]
  const trend = metrics
    ? metrics.applications_trend.slice(
        -Math.min(window, metrics.applications_trend.length),
      )
    : []

  const recentActivity = (auditQuery.data ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 6)

  const upcomingInterviews = React.useMemo(
    () =>
      (interviewsQuery.data ?? [])
        .filter(
          (interview) =>
            interview.status === 'published' &&
            new Date(interview.interview_at).getTime() > now,
        )
        .sort(
          (a, b) =>
            new Date(a.interview_at).getTime() -
            new Date(b.interview_at).getTime(),
        )
        .slice(0, 3),
    [interviewsQuery.data, now],
  )

  const recentApplications = recentApplicationsQuery.data?.items ?? []

  const tiles: MetricTile[] = metrics
    ? [
        {
          label: 'Total applications',
          value: metrics.total_applications,
          to: '/admin/applications',
          tone: 'brand',
          icon: ClipboardList,
          delta: metrics.applications_delta,
          sub: 'Across all published roles',
        },
        {
          label: 'Pending',
          value: metrics.pending,
          to: '/admin/applications?status=pending',
          tone: 'warning',
          icon: FileText,
          fact: 'Awaiting review',
          sub: 'Not yet screened by HR',
        },
        {
          label: 'Shortlisted',
          value: metrics.shortlisted,
          to: '/admin/applications?status=shortlisted',
          tone: 'info',
          icon: UserPlus,
          fact: 'Awaiting appointment',
          sub: 'Confirmation message sent',
        },
        {
          label: 'Appointed',
          value: metrics.appointed,
          to: '/admin/applications?status=appointed',
          tone: 'success',
          icon: Users,
          fact: 'Access code issued',
          sub: 'Onboarded onto the staff portal',
        },
        {
          label: 'Total staff',
          value: metrics.total_staff,
          to: '/admin/staff',
          tone: 'success',
          icon: Users,
          fact: 'Active records',
          sub: 'Employees, contractors and partners',
        },
        {
          label: 'Active access codes',
          value: metrics.active_access_codes,
          to: '/admin/access-codes',
          tone: 'brand',
          icon: KeyRound,
          fact: 'Single-use, time-boxed',
          sub: 'Redeemable by appointed staff',
        },
        {
          label: 'Expiring codes',
          value: metrics.expiring_codes,
          to: '/admin/access-codes',
          tone: 'accent',
          icon: CalendarClock,
          fact: 'Expiring soon',
          sub: 'Reissue before they lapse',
        },
        {
          label: 'Upcoming interviews',
          value: metrics.upcoming_interviews,
          to: '/admin/interviews',
          tone: 'info',
          icon: CalendarClock,
          fact: 'Published sessions',
          sub: 'Scheduled in the next 30 days',
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Recruitment activity for Lagos."
        actions={
          <>
            <label className="sr-only" htmlFor="dashboard-range">
              Reporting period
            </label>
            <Select
              id="dashboard-range"
              value={range}
              onChange={(event) => setRange(event.target.value as Range)}
              className="w-40"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </Select>
            <Link to="/admin/jobs" className={buttonVariants({})}>
              <Plus />
              Post new role
            </Link>
          </>
        }
      />

      {/* -- Metric tiles -- */}
      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {dashboardQuery.isLoading &&
          Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-xl border border-ink-200 bg-white"
            />
          ))}

        {tiles.map((tile) => (
          <Link
            key={tile.label}
            to={tile.to}
            className="group rounded-xl border border-ink-200 bg-white p-4 shadow-xs transition-colors hover:border-brand-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-medium text-ink-500">{tile.label}</p>
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-lg',
                  toneStyles[tile.tone].icon,
                )}
              >
                <tile.icon className="size-4" aria-hidden />
              </span>
            </div>
            <p
              className={cn(
                'mt-2 text-2xl font-semibold tracking-tight tabular',
                toneStyles[tile.tone].value,
              )}
            >
              {tile.value.toLocaleString('en-NG')}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {tile.delta !== undefined ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-2xs font-semibold tabular',
                    tile.delta >= 0 ? 'text-success-700' : 'text-danger-700',
                  )}
                >
                  {tile.delta >= 0 ? (
                    <ArrowUpRight className="size-3.5" aria-hidden />
                  ) : (
                    <ArrowDownRight className="size-3.5" aria-hidden />
                  )}
                  {tile.delta >= 0 ? '+' : ''}
                  {tile.delta}%
                </span>
              ) : null}
              {tile.fact ? (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-medium',
                    toneStyles[tile.tone].chip,
                  )}
                >
                  {tile.fact}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-2xs text-ink-500">{tile.sub}</p>
          </Link>
        ))}
      </section>

      {/* -- Trend chart -- */}
      <Card>
        <CardHeader>
          <CardTitle>Applications trend</CardTitle>
          <CardDescription>
            Daily application volume for the selected reporting period.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64 px-0 sm:px-2">
          {dashboardQuery.isLoading ? (
            <Spinner />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={trend}
                margin={{ top: 8, right: 12, bottom: 0, left: -18 }}
              >
                <CartesianGrid
                  stroke="var(--color-ink-200)"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-ink-200)' }}
                  tick={{ fontSize: 11, fill: 'var(--color-ink-500)' }}
                  tickFormatter={(value: string) => formatDate(value, 'd MMM')}
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  width={44}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'var(--color-ink-500)' }}
                />
                <Tooltip
                  content={TrendTooltip}
                  cursor={{ stroke: 'var(--color-ink-300)' }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Applications"
                  stroke="var(--color-brand-600)"
                  strokeWidth={2}
                  fill="var(--color-brand-500)"
                  fillOpacity={0.12}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* -- Activity + interviews -- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Latest actions recorded by the admin team.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {auditQuery.isLoading ? (
              <Spinner />
            ) : recentActivity.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-500">
                No activity recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {recentActivity.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <Avatar
                      first={log.actor_name?.split(' ')[0] ?? 'S'}
                      last={log.actor_name?.split(' ').slice(1).join(' ')}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink-800">
                        {humanizeAction(log.action)}
                      </p>
                      <p className="truncate text-2xs text-ink-500">
                        {log.actor_name ?? 'System'} · {log.entity_type}
                      </p>
                    </div>
                    <span className="shrink-0 text-2xs text-ink-400">
                      {relativeTime(log.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming interviews</CardTitle>
            <CardDescription>Published sessions with a future date.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {interviewsQuery.isLoading ? (
              <Spinner />
            ) : upcomingInterviews.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-500">
                No interviews scheduled.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {upcomingInterviews.map((interview) => (
                  <li
                    key={interview.id}
                    className="flex items-start gap-3 px-5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {interview.job_title ?? 'Interview session'}
                      </p>
                      <p className="truncate text-2xs text-ink-500">
                        {formatDateTime(interview.interview_at)} ·{' '}
                        {interview.venue}
                      </p>
                    </div>
                    <Badge variant="info" className="shrink-0">
                      {interview.applicant_count ?? 0} applicants
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* -- Recent applications + quick actions -- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent applications</CardTitle>
            <CardDescription>The five most recent submissions.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {recentApplicationsQuery.isLoading ? (
              <Spinner />
            ) : recentApplications.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-500">
                No applications received yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {recentApplications.map((application) => (
                  <li
                    key={application.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <Avatar
                      first={application.first_name}
                      last={application.last_name}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {application.first_name} {application.last_name}
                      </p>
                      <p className="truncate text-2xs text-ink-500">
                        {application.job_title ?? 'Role'}
                      </p>
                    </div>
                    <ApplicationStatusBadge status={application.status} />
                    <span className="hidden shrink-0 text-2xs text-ink-400 sm:inline">
                      {relativeTime(application.submitted_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Jump straight into the main workflows.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Link
                to="/admin/jobs"
                className={buttonVariants({ variant: 'outline' })}
              >
                <Plus />
                Post a role
              </Link>
              <Link
                to="/admin/applications"
                className={buttonVariants({ variant: 'outline' })}
              >
                <ClipboardList />
                Review applications
              </Link>
              <Link
                to="/admin/access-codes"
                className={buttonVariants({ variant: 'outline' })}
              >
                <KeyRound />
                Issue access code
              </Link>
              <Link
                to="/admin/interviews"
                className={buttonVariants({ variant: 'outline' })}
              >
                <Megaphone />
                Post interview announcement
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-2xs text-ink-500">
              <TrendingUp className="size-3.5" aria-hidden />
              Recruitment activity is scoped to Lagos state.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
