/**
 * The product visual on the public landing page.
 *
 * These views are not screenshots. Each one is assembled from the real
 * interface components — StatCard, Table, the status badges — so the page
 * always shows the product as it actually renders and stays in step with
 * it as the product changes.
 *
 * The records behind the views are frozen fictional stand-ins: the landing
 * page never renders production data (privacy). Timestamps drift with page
 * load so the walkthrough always reads as current.
 *
 * The staff view deliberately omits bank details, guarantor and next of kin.
 * Those are restricted to the record owner and administrators (README M10),
 * and a public marketing page is neither.
 */
import { BadgeCheck, FileStack, ShieldCheck, UserCheck, Users } from 'lucide-react'
import { useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import {
  ApplicationStatusBadge,
  EmploymentCategoryBadge,
  StaffStatusBadge,
} from '@/components/ui/status-badges'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/cn'
import { formatDate, fullName, relativeTime } from '@/lib/format'

const DEMO = {
  metrics: {
    total_applications: 1284,
    shortlisted: 96,
    appointed: 41,
    total_staff: 214,
  },
  recentApplications: [
    {
      id: 'a1',
      application_number: 'APP/LA/2026/0042',
      first_name: 'Ngozi',
      last_name: 'Obi',
      job_title: 'Senior Backend Engineer',
      status: 'shortlisted' as const,
    },
    {
      id: 'a2',
      application_number: 'APP/LA/2026/0043',
      first_name: 'Tunde',
      last_name: 'Adebisi',
      job_title: 'Frontend Engineer',
      status: 'pending' as const,
    },
    {
      id: 'a3',
      application_number: 'APP/LA/2026/0044',
      first_name: 'Aisha',
      last_name: 'Bello',
      job_title: 'Operations Officer',
      status: 'pending' as const,
    },
    {
      id: 'a4',
      application_number: 'APP/LA/2026/0045',
      first_name: 'Sadiq',
      last_name: 'Yusuf',
      job_title: 'Facilities Manager',
      status: 'rejected' as const,
    },
  ],
  applicant: {
    application_number: 'APP/LA/2026/0042',
    first_name: 'Ngozi',
    last_name: 'Obi',
    job_title: 'Senior Backend Engineer',
    status: 'shortlisted' as const,
  },
  events: [
    {
      id: 'e1',
      reason: 'Shortlisted for interview — CV matches the role requirements.',
      actor_name: 'Aisha Adeyemi',
      created_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
    },
    {
      id: 'e2',
      reason: 'Application received and queued for review.',
      actor_name: 'Recruitment pipeline',
      created_at: new Date(Date.now() - 30 * 3600_000).toISOString(),
    },
    {
      id: 'e3',
      reason: 'Application submitted through the careers portal.',
      actor_name: 'Ngozi Obi',
      created_at: new Date(Date.now() - 52 * 3600_000).toISOString(),
    },
  ],
  shortlistMessage:
    'Dear Ngozi, congratulations — you have been shortlisted for the Senior Backend Engineer role. Report to the Human Resources office on Monday by 9:00 AM for your interview.',
  staff: {
    staff_id: 'STA/LA/2026/0007',
    status: 'active' as const,
    first_name: 'Aisha',
    last_name: 'Bello',
    position: 'Operations Officer',
    department_name: 'Operations',
    location_name: 'Lagos › Ikeja',
    appointment_date: '2026-08-17T00:00:00Z',
    employment_category: 'employee' as const,
  },
}

const VIEWS = [
  { key: 'applicant', label: 'Applicant portal', route: '/applicant' },
  { key: 'staff', label: 'Staff record', route: '/staff' },
  { key: 'pipeline', label: 'Hiring pipeline', route: '/careers' },
] as const

type ViewKey = (typeof VIEWS)[number]['key']

export function ProductVisual({ className }: { className?: string }) {
  const [view, setView] = useState<ViewKey>('applicant')
  const active = VIEWS.find((item) => item.key === view) ?? VIEWS[0]

  return (
    <div className={cn('w-full', className)}>
      {/* -- Product frame -- */}
      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg">
        <div className="flex items-center gap-3 border-b border-ink-200 bg-ink-50 px-4 py-2.5">
          <span className="flex shrink-0 gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-ink-300" />
            <span className="size-2.5 rounded-full bg-ink-300" />
            <span className="size-2.5 rounded-full bg-ink-300" />
          </span>
          <span className="truncate font-mono text-2xs text-ink-500">
            {active.route}
          </span>
        </div>

        <div className="p-4 sm:p-5">
          {view === 'pipeline' ? <PipelineView /> : null}
          {view === 'applicant' ? <ApplicantView /> : null}
          {view === 'staff' ? <StaffView /> : null}
        </div>
      </div>

      {/* -- View switcher -- */}
      <div
        role="group"
        aria-label="Product views"
        className="mt-4 inline-flex flex-wrap gap-1 rounded-lg bg-ink-100 p-1"
      >
        {VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setView(item.key)}
            aria-pressed={view === item.key}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              view === item.key
                ? 'bg-white text-ink-900 shadow-xs'
                : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* -- Hiring pipeline (public-safe: counts + recent movement, no admin chrome) -- */

function PipelineView() {
  const recent = DEMO.recentApplications

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Applications"
          value={DEMO.metrics.total_applications}
          tone="brand"
          icon={FileStack}
        />
        <StatCard
          label="Shortlisted"
          value={DEMO.metrics.shortlisted}
          tone="info"
          icon={BadgeCheck}
        />
        <StatCard
          label="Appointed"
          value={DEMO.metrics.appointed}
          tone="success"
          icon={UserCheck}
        />
        <StatCard
          label="Staff"
          value={DEMO.metrics.total_staff}
          tone="accent"
          icon={Users}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-ink-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.map((application) => (
              <TableRow key={application.id}>
                <TableCell>
                  <p className="font-medium text-ink-900">
                    {fullName(application.first_name, application.last_name)}
                  </p>
                  <p className="font-mono text-2xs text-ink-400">
                    {application.application_number}
                  </p>
                </TableCell>
                <TableCell className="text-ink-600">
                  {application.job_title}
                </TableCell>
                <TableCell>
                  <ApplicationStatusBadge status={application.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/* -- Applicant portal ----------------------------------------------------- */

function ApplicantView() {
  const application = DEMO.applicant
  const shortlist = { message: DEMO.shortlistMessage }
  const events = DEMO.events

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
            Application number
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-ink-900">
            {application.application_number}
          </p>
        </div>
        <ApplicationStatusBadge status={application.status} />
      </div>

      <div>
        <p className="text-sm font-semibold text-ink-900">
          {fullName(application.first_name, application.last_name)}
        </p>
        <p className="text-xs text-ink-500">{application.job_title}</p>
      </div>

      {/* -- Status history -- */}
      <ol className="space-y-3">
        {events.map((event) => (
          <li key={event.id} className="flex gap-3">
            <span
              aria-hidden
              className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-800">
                {event.reason}
              </p>
              <p className="text-2xs text-ink-500">
                {event.actor_name} · {relativeTime(event.created_at)}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* -- Confirmation message, stored verbatim -- */}
      {shortlist ? (
        <Card className="border-info-200 bg-info-50/40">
          <CardHeader className="border-b-0 pb-2">
            <CardTitle className="text-xs text-ink-700">
              Confirmation message
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs leading-relaxed text-ink-700">
              {shortlist.message}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

/* -- Staff record --------------------------------------------------------- */

function StaffView() {
  const staff = DEMO.staff

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
            Staff ID
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-ink-900">
            {staff.staff_id}
          </p>
        </div>
        <StaffStatusBadge status={staff.status} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" value={fullName(staff.first_name, staff.last_name)} />
        <Field label="Position" value={staff.position ?? '—'} />
        <Field label="Department" value={staff.department_name ?? '—'} />
        <Field label="Location" value={staff.location_name ?? '—'} />
        <Field
          label="Appointment date"
          value={formatDate(staff.appointment_date)}
        />
        <div>
          <p className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
            Employment category
          </p>
          <div className="mt-1.5">
            <EmploymentCategoryBadge category={staff.employment_category} />
          </div>
        </div>
      </div>

      <p className="flex gap-2 border-t border-ink-200 pt-3 text-2xs text-ink-500">
        <ShieldCheck aria-hidden className="size-3.5 shrink-0 text-ink-400" />
        Bank details, guarantor and next of kin are withheld here. They are
        visible only to the record owner and administrators.
      </p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm text-ink-800">{value}</p>
    </div>
  )
}
