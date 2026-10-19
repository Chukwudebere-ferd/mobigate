import {
  Briefcase,
  CalendarClock,
  ChevronDown,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Menu,
  MessageSquareText,
  Settings,
  Users,
  X,
} from 'lucide-react'
import * as React from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/cn'
import { fullName } from '@/lib/format'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  badge?: string
}

const primaryNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/applications', label: 'Applications', icon: Briefcase, badge: '96' },
  { to: '/admin/jobs', label: 'Jobs', icon: CalendarClock },
  { to: '/admin/interviews', label: 'Interviews', icon: MessageSquareText },
  { to: '/admin/shortlists', label: 'Shortlists', icon: Users },
  { to: '/admin/access-codes', label: 'Access Codes', icon: KeyRound },
  { to: '/admin/staff', label: 'Staff', icon: Users },
  { to: '/admin/locations', label: 'Locations', icon: MapPin },
]

const secondaryNav: NavItem[] = [
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

function NavSection({
  items,
  onNavigate,
}: {
  items: NavItem[]
  onNavigate?: () => void
}) {
  return (
    <nav className="space-y-0.5">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
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
                  isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600',
                )}
                aria-hidden
              />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular',
                    isActive
                      ? 'bg-brand-100 text-brand-700'
                      : 'bg-ink-200/70 text-ink-600',
                  )}
                >
                  {item.badge}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

/**
 * The admin panel shell: a fixed sidebar, a top bar with tenant context, and
 * a scrolling content region. On small screens the sidebar becomes a drawer.
 */
export function AdminShell() {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const location = useLocation()

  // Close the mobile drawer whenever the route changes. Deriving it during
  // render avoids a state update in an effect, which would cause a second
  // render pass on every navigation.
  const [lastPath, setLastPath] = React.useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    if (mobileOpen) setMobileOpen(false)
  }

  return (
    <div className="min-h-dvh bg-ink-50">
      {/* -- Desktop sidebar -- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-200 bg-white lg:flex">
        <SidebarContent />
      </aside>

      {/* -- Mobile drawer -- */}
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
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* -- Main column -- */}
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

          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-ink-400">Admin</span>
            <span className="text-ink-300">/</span>
            <span className="font-medium text-ink-700">Lagos</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-2xs font-medium text-ink-600">
              State scope
              <ChevronDown className="size-3" />
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
              <Avatar first="Aisha" last="Adeyemi" size="sm" />
              <div className="hidden leading-tight sm:block">
                <p className="text-xs font-semibold text-ink-900">Aisha Adeyemi</p>
                <p className="text-2xs text-ink-500">State Admin</p>
              </div>
              <ChevronDown className="size-4 text-ink-400" />
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

function SidebarContent() {
  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-ink-200 px-5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          M
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink-900">MGM-Portal</p>
          <p className="text-2xs text-ink-500">Group Management</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scroll-slim px-3 py-4">
        <p className="mb-2 px-3 text-2xs font-semibold tracking-wider text-ink-400 uppercase">
          Recruitment
        </p>
        <NavSection items={primaryNav} />

        <p className="mt-6 mb-2 px-3 text-2xs font-semibold tracking-wider text-ink-400 uppercase">
          Configuration
        </p>
        <NavSection items={secondaryNav} />
      </div>

      <div className="border-t border-ink-200 p-3">
        <div className="rounded-lg bg-ink-50 p-3">
          <p className="text-2xs font-semibold text-ink-700">Need help?</p>
          <p className="mt-0.5 text-2xs text-ink-500">
            Contact the platform team for admin access issues.
          </p>
        </div>
      </div>
    </>
  )
}

/** Compact shell for the applicant and staff portals. */
export function PortalShell({
  title,
  nav,
  user,
}: {
  title: string
  nav: NavItem[]
  user: { first_name: string; last_name: string; role: string }
}) {
  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              M
            </span>
            <span className="text-sm font-semibold text-ink-900">{title}</span>
          </Link>

          <nav className="ml-6 hidden items-center gap-1 sm:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <div className="text-right leading-tight">
              <p className="text-xs font-semibold text-ink-900">
                {fullName(user.first_name, user.last_name)}
              </p>
              <p className="text-2xs text-ink-500 capitalize">{user.role}</p>
            </div>
            <Avatar first={user.first_name} last={user.last_name} size="sm" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
