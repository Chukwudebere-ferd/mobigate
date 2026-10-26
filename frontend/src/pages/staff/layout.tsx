import { IdCard, LogOut, UserRound } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/cn'
import { fullName } from '@/lib/format'
import { useSession } from '@/providers/session-provider'

const navItems = [
  { to: '/staff', label: 'My profile', icon: UserRound, end: true },
  { to: '/staff/onboarding', label: 'Complete onboarding', icon: IdCard, end: false },
]

/**
 * Staff portal shell: a compact top bar with the staff member's identity and
 * their Staff ID, above a scrolling content region.
 */
export function StaffLayout() {
  const { session, signOut } = useSession()

  if (!session) return null

  const { user } = session

  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              M
            </span>
            <span className="hidden text-sm font-semibold text-ink-900 sm:inline">
              Staff portal
            </span>
          </Link>

          <nav
            aria-label="Staff"
            className="ml-2 flex items-center gap-1 overflow-x-auto scroll-slim sm:ml-6"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                  )
                }
              >
                <item.icon className="size-4.5 shrink-0" aria-hidden />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user.staff_id && (
              <span className="hidden items-center gap-1.5 rounded-md bg-ink-100 px-2 py-1 font-mono text-xs font-medium text-ink-700 ring-1 ring-ink-200 sm:inline-flex">
                <IdCard className="size-3.5 text-ink-400" aria-hidden />
                {user.staff_id}
              </span>
            )}
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-xs font-semibold text-ink-900">
                {fullName(user.first_name, user.last_name)}
              </p>
              <p className="text-2xs text-ink-500">Staff</p>
            </div>
            <Avatar first={user.first_name} last={user.last_name} size="sm" />
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
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
