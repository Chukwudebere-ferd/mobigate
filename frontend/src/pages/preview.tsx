import {
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  Compass,
  FileText,
  KeyRound,
  LayoutDashboard,
  MapPin,
  MessageSquareText,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { useSession } from '@/providers/session-provider'
import type { UserRole } from '@/types/domain'

/**
 * A design-review index of every screen in the portal.
 *
 * Each entry links straight to the route and names the source file, so the
 * reviewer can navigate the app and open the corresponding file side by side.
 * The role switcher sets the mock session, which matters because the admin,
 * applicant and staff portals render different content per role.
 */

interface PreviewEntry {
  path: string
  label: string
  file: string
  role: UserRole
  note: string
}

interface PreviewGroup {
  title: string
  description: string
  icon: typeof Compass
  entries: PreviewEntry[]
}

const GROUPS: PreviewGroup[] = [
  {
    title: 'Public careers site',
    description: 'What an applicant sees before they ever sign in.',
    icon: Compass,
    entries: [
      {
        path: '/',
        label: 'Careers landing',
        file: 'pages/public/home.tsx',
        role: 'applicant',
        note: 'Hero, role search and filters, role cards, how-it-works.',
      },
      {
        path: '/jobs/senior-backend-engineer',
        label: 'Job detail',
        file: 'pages/public/job-detail.tsx',
        role: 'applicant',
        note: 'Requirements, documents to bring, sticky apply sidebar.',
      },
      {
        path: '/apply/senior-backend-engineer',
        label: 'Application form',
        file: 'pages/public/apply.tsx',
        role: 'applicant',
        note: 'Four sections, cascading location selects, CV and photo upload.',
      },
      {
        path: '/application/received',
        label: 'Application received',
        file: 'pages/public/received.tsx',
        role: 'applicant',
        note: 'Application number, copy button, what happens next.',
      },
    ],
  },
  {
    title: 'Applicant portal',
    description: 'Signed-in applicant: applications, status, interview announcements.',
    icon: FileText,
    entries: [
      {
        path: '/applicant',
        label: 'My applications',
        file: 'pages/applicant/applications.tsx',
        role: 'applicant',
        note: 'Status cards for every application, plus upcoming interviews.',
      },
      {
        path: '/applicant/applications/app-13',
        label: 'Application status',
        file: 'pages/applicant/status.tsx',
        role: 'applicant',
        note: 'Status timeline, submitted details, and the shortlist message.',
      },
      {
        path: '/applicant/applications/app-14',
        label: 'Status — rejected',
        file: 'pages/applicant/status.tsx',
        role: 'applicant',
        note: 'Same page, rejected path. No shortlist message shown (BR-08).',
      },
      {
        path: '/applicant/interviews',
        label: 'Interview announcements',
        file: 'pages/applicant/interviews.tsx',
        role: 'applicant',
        note: 'Upcoming first, then past. Venue, time and instructions.',
      },
    ],
  },
  {
    title: 'Staff portal',
    description: 'Appointed staff: profile, documents, and the onboarding flow.',
    icon: Users,
    entries: [
      {
        path: '/staff',
        label: 'My profile',
        file: 'pages/staff/portal.tsx',
        role: 'staff',
        note: 'Employment, bank, guarantor, next of kin, documents.',
      },
      {
        path: '/staff/onboarding',
        label: 'Access code redemption',
        file: 'pages/staff/onboarding.tsx',
        role: 'staff',
        note: 'Phase A: redeem a code. Phase B: staff details form.',
      },
    ],
  },
  {
    title: 'Admin panel',
    description: 'The operational side: recruitment pipeline and personnel records.',
    icon: LayoutDashboard,
    entries: [
      {
        path: '/admin',
        label: 'Dashboard',
        file: 'pages/admin/dashboard.tsx',
        role: 'admin',
        note: 'Metric tiles, 30-day trend chart, recent activity.',
      },
      {
        path: '/admin/applications',
        label: 'Applications',
        file: 'pages/admin/applications.tsx',
        role: 'admin',
        note: 'Filters, bulk shortlist with message, reject, appoint, detail drawer.',
      },
      {
        path: '/admin/jobs',
        label: 'Job postings',
        file: 'pages/admin/jobs.tsx',
        role: 'admin',
        note: 'Job list and editor: post, publish, close, archive.',
      },
      {
        path: '/admin/interviews',
        label: 'Interviews',
        file: 'pages/admin/interviews.tsx',
        role: 'admin',
        note: 'Announcements, audience scoping, notify candidates.',
      },
      {
        path: '/admin/shortlists',
        label: 'Shortlists',
        file: 'pages/admin/shortlists.tsx',
        role: 'admin',
        note: 'Confirmation messages, revoke, resend.',
      },
      {
        path: '/admin/access-codes',
        label: 'Access codes',
        file: 'pages/admin/access-codes.tsx',
        role: 'admin',
        note: 'Issue and revoke. The plaintext code is shown exactly once.',
      },
      {
        path: '/admin/staff',
        label: 'Staff directory',
        file: 'pages/admin/staff.tsx',
        role: 'admin',
        note: 'Directory and staff record. Confidential fields are marked.',
      },
      {
        path: '/admin/locations',
        label: 'Location management',
        file: 'pages/admin/locations.tsx',
        role: 'admin',
        note: 'Location tree, detail panel, approval queue.',
      },
      {
        path: '/admin/settings',
        label: 'Settings',
        file: 'pages/admin/settings.tsx',
        role: 'admin',
        note: 'Templates, code settings, users, notification log.',
      },
      {
        path: '/admin/audit',
        label: 'Audit log',
        file: 'pages/admin/audit.tsx',
        role: 'admin',
        note: 'Event trail with before/after changes.',
      },
    ],
  },
]

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
  applicant: 'Applicant',
}

const ROLE_TONE: Record<UserRole, 'brand' | 'info' | 'success' | 'neutral'> = {
  super_admin: 'brand',
  admin: 'info',
  staff: 'success',
  applicant: 'neutral',
}

export function PreviewPage() {
  const { role, setRole } = useSession()
  const [query, setQuery] = React.useState('')

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return GROUPS
    return GROUPS.map((group) => ({
      ...group,
      entries: group.entries.filter(
        (entry) =>
          entry.label.toLowerCase().includes(needle) ||
          entry.path.toLowerCase().includes(needle) ||
          entry.file.toLowerCase().includes(needle) ||
          entry.note.toLowerCase().includes(needle) ||
          group.title.toLowerCase().includes(needle),
      ),
    })).filter((group) => group.entries.length > 0)
  }, [query])

  const total = GROUPS.reduce((sum, group) => sum + group.entries.length, 0)
  const shown = filtered.reduce((sum, group) => sum + group.entries.length, 0)

  return (
    <div className="min-h-dvh bg-ink-50">
      {/* -- Header -- */}
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                  M
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    MGM-Portal
                  </p>
                  <p className="text-2xs text-ink-500">Design review</p>
                </div>
              </div>

              <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
                Screen index
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm text-ink-500 text-balance">
                Every screen in the MVP, grouped by portal. Pick a role to
                preview it, then open a screen to review it against its source
                file.
              </p>
            </div>

            {/* -- Role switcher -- */}
            <div className="shrink-0 rounded-xl border border-ink-200 bg-ink-50 p-4">
              <p className="text-2xs font-semibold tracking-wide text-ink-500 uppercase">
                Preview as
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(['applicant', 'staff', 'admin', 'super_admin'] as UserRole[]).map(
                  (option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRole(option)}
                      className={cn(
                        'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                        role === option
                          ? 'bg-brand-600 text-white shadow-xs'
                          : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-100',
                      )}
                    >
                      {ROLE_LABELS[option]}
                    </button>
                  ),
                )}
              </div>
              <p className="mt-2.5 text-2xs text-ink-500">
                Currently previewing as{' '}
                <span className="font-medium text-ink-700">
                  {ROLE_LABELS[role]}
                </span>
              </p>
            </div>
          </div>

          {/* -- Search -- */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter screens by name, route or file…"
              aria-label="Filter screens"
              className="h-9 w-full rounded-md border border-ink-300 bg-white px-3 text-sm shadow-xs placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 focus:outline-none sm:max-w-sm"
            />
            <p className="text-xs text-ink-500">
              Showing {shown} of {total} screens
            </p>
          </div>
        </div>
      </header>

      {/* -- Groups -- */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-14 text-center">
              <p className="text-sm font-medium text-ink-900">No screens match</p>
              <p className="mt-1 text-sm text-ink-500">
                Try a different search term.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {filtered.map((group) => (
              <section key={group.title}>
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 ring-1 ring-brand-100">
                    <group.icon className="size-4 text-brand-700" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-ink-900">
                      {group.title}
                    </h2>
                    <p className="text-xs text-ink-500">{group.description}</p>
                  </div>
                </div>

                <ul className="mt-4 grid gap-3 md:grid-cols-2">
                  {group.entries.map((entry) => (
                    <li key={entry.path}>
                      <Card className="h-full transition-shadow hover:shadow-md">
                        <CardContent className="space-y-3 pt-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-ink-900">
                                {entry.label}
                              </p>
                              <code className="mt-0.5 block truncate font-mono text-2xs text-brand-700">
                                {entry.path}
                              </code>
                            </div>
                            <Badge
                              variant={ROLE_TONE[entry.role]}
                              className="shrink-0"
                            >
                              {ROLE_LABELS[entry.role]}
                            </Badge>
                          </div>

                          <p className="text-sm text-ink-500 text-balance">
                            {entry.note}
                          </p>

                          <div className="flex items-center justify-between gap-2 border-t border-ink-100 pt-3">
                            <code className="truncate font-mono text-2xs text-ink-400">
                              {entry.file}
                            </code>
                            <Link
                              to={entry.path}
                              className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                            >
                              Open
                              <ArrowUpRight className="size-3.5" aria-hidden />
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {/* -- Legend -- */}
        <Card className="mt-10">
          <CardHeader>
            <CardTitle>Reference</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 pt-0 sm:grid-cols-2">
            <div>
              <p className="text-2xs font-semibold tracking-wide text-ink-500 uppercase">
                Demo accounts
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-600">
                <li className="flex items-center gap-2">
                  <Avatar first="Ngozi" last="Obi" size="xs" />
                  Ngozi Obi — applicant, shortlisted on Finance Officer
                </li>
                <li className="flex items-center gap-2">
                  <Avatar first="Tunde" last="Adebisi" size="xs" />
                  Tunde Adebisi — appointed, Staff ID STA/LA/2026/0001
                </li>
                <li className="flex items-center gap-2">
                  <Avatar first="Aisha" last="Adeyemi" size="xs" />
                  Aisha Adeyemi — state admin, Lagos
                </li>
                <li className="flex items-center gap-2">
                  <Avatar first="Chidi" last="Okonkwo" size="xs" />
                  Chidi Okonkwo — super admin
                </li>
              </ul>
            </div>

            <div>
              <p className="text-2xs font-semibold tracking-wide text-ink-500 uppercase">
                Working access code
              </p>
              <p className="mt-2 text-sm text-ink-600">
                The staff onboarding page needs a valid code. These are seeded
                as active:
              </p>
              <ul className="mt-2 space-y-1.5 font-mono text-sm text-ink-800">
                <li>MGK7M2 — expires in 9 days</li>
                <li>5R5T1P — expires in 4 days</li>
                <li>8H2N7Q — expires in 1 day</li>
              </ul>
              <p className="mt-3 flex items-start gap-1.5 text-2xs text-ink-500">
                <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
                Codes are matched on their last four characters, so the prefix
                does not matter.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <Link to="/" className={buttonVariants({ variant: 'outline' })}>
            <Briefcase className="size-4" aria-hidden />
            Public careers site
          </Link>
          <Link to="/admin" className={buttonVariants({ variant: 'outline' })}>
            <LayoutDashboard className="size-4" aria-hidden />
            Admin panel
          </Link>
          <Link to="/applicant" className={buttonVariants({ variant: 'outline' })}>
            <FileText className="size-4" aria-hidden />
            Applicant portal
          </Link>
          <Link to="/staff" className={buttonVariants({ variant: 'outline' })}>
            <Users className="size-4" aria-hidden />
            Staff portal
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-2xs text-ink-400">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3" aria-hidden />
            {total} screens across {GROUPS.length} portals
          </span>
          <span className="inline-flex items-center gap-1.5">
            <KeyRound className="size-3" aria-hidden />
            Mock data — no backend required
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3" aria-hidden />
            Responsive from 320px up
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageSquareText className="size-3" aria-hidden />
            Review notes on every card
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Settings className="size-3" aria-hidden />
            Design system in DESIGN.md
          </span>
        </div>
      </main>
    </div>
  )
}
