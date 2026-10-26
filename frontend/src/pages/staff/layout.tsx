import {
  Banknote,
  Briefcase,
  IdCard,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import * as React from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/cn'
import { fullName } from '@/lib/format'
import { useSession } from '@/providers/session-provider'
import type { Session } from '@/types/domain'

const staffNavItems = [
  { to: '/staff', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/staff/payroll', label: 'Payroll', icon: Banknote, end: false },
  { to: '/staff/onboarding', label: 'Onboarding', icon: IdCard, end: false },
]

/** Applicants only need onboarding until their staff record is approved. */
const onboardingNavItems = [
  { to: '/staff/onboarding', label: 'Onboarding', icon: IdCard, end: false },
]

function pageLabel(pathname: string) {
  if (pathname.startsWith('/staff/onboarding')) return 'Onboarding'
  if (pathname.startsWith('/staff/payroll')) return 'Payroll'
  return 'Overview'
}

/**
 * Staff portal shell: a light sidebar with the staff member's own workspace,
 * plus a top bar for orientation and account actions.
 */
export function StaffLayout() {
  const { session, signOut } = useSession()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [lastPath, setLastPath] = React.useState(location.pathname)

  // Close the mobile drawer whenever the route changes.
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    if (mobileOpen) setMobileOpen(false)
  }

  if (!session) return null

  const { user } = session

  return (
    <div className="min-h-dvh bg-ink-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-200 bg-white lg:flex">
        <SidebarContent user={user} onSignOut={signOut} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/50 animate-fade-in"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="relative z-10 flex h-full w-72 flex-col bg-white shadow-xl animate-slide-up">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 rounded-md p-1.5 text-ink-400 hover:bg-ink-100"
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </button>
            <SidebarContent user={user} onSignOut={signOut} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-ink-200 bg-white/85 px-4 backdrop-blur-sm sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>

          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="font-medium text-ink-400">Staff</span>
            <span className="text-ink-300">/</span>
            <span className="truncate font-medium text-ink-700">
              {pageLabel(location.pathname)}
            </span>
            <span className="hidden rounded-full bg-ink-100 px-2 py-0.5 text-2xs font-medium text-ink-600 sm:inline">
              Staff portal
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/"
              className="hidden text-xs text-ink-500 hover:text-ink-800 sm:inline"
            >
              View public site
            </Link>
            <div className="flex items-center gap-2.5">
              <Avatar
                first={user.first_name}
                last={user.last_name}
                size="sm"
              />
              <div className="hidden leading-tight sm:block">
                <p className="text-xs font-semibold text-ink-900">
                  {fullName(user.first_name, user.last_name)}
                </p>
                <p className="text-2xs text-ink-500">
                  {user.staff_id ?? 'Staff'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
              <span className="sr-only sm:hidden">Sign out</span>
            </button>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function SidebarContent({
  user,
  onSignOut,
}: {
  user: Session['user']
  onSignOut: () => Promise<void>
}) {
  const navItems =
    user.role === 'staff' ? staffNavItems : onboardingNavItems

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-ink-200 px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          M
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink-900">Staff portal</p>
          <p className="text-2xs text-ink-500">Mobigate Group</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-slim px-3 py-4">
        <p className="mb-2 px-3 text-2xs font-semibold tracking-wider text-ink-400 uppercase">
          Workspace
        </p>
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      'size-4.5 shrink-0 transition-colors',
                      isActive
                        ? 'text-brand-600'
                        : 'text-ink-400 group-hover:text-ink-600',
                    )}
                    aria-hidden
                  />
                  <span className="flex-1">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <p className="mt-6 mb-2 px-3 text-2xs font-semibold tracking-wider text-ink-400 uppercase">
          Company
        </p>
        <nav>
          <Link
            to="/"
            className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
          >
            <Briefcase
              className="size-4.5 shrink-0 text-ink-400 transition-colors group-hover:text-ink-600"
              aria-hidden
            />
            Public site
          </Link>
        </nav>
      </div>

      <div className="border-t border-ink-200 p-3">
        <div className="flex items-center gap-2.5 rounded-lg border border-ink-200 bg-white p-2.5">
          <Avatar
            first={user.first_name}
            last={user.last_name}
            size="sm"
          />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-semibold text-ink-900">
              {fullName(user.first_name, user.last_name)}
            </p>
            <p className="truncate text-2xs text-ink-500">
              {user.staff_id ?? 'Staff member'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </>
  )
}
