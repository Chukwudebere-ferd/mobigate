import * as React from 'react'
import { Link, Outlet } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'

/** Marketing shell for the public careers site. */
export function PublicShell() {
  // Sampled once on mount so the footer year does not change on re-render.
  const [year] = React.useState(() => new Date().getFullYear())

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              M
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink-900">Mobigate Group</p>
              <p className="text-2xs text-ink-500">Careers</p>
            </div>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            <Link
              to="/"
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              Open roles
            </Link>
            <Link
              to="/applicant"
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              My applications
            </Link>
            <Link
              to="/staff"
              className="rounded-md px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
            >
              Staff portal
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <Link
              to="/applicant"
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              Sign in
            </Link>
            <Link to="/" className={buttonVariants({ size: 'sm' })}>
              View roles
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink-200 bg-ink-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              M
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink-900">Mobigate Group</p>
              <p className="text-2xs text-ink-500">
                Group Management Portal — Recruitment & Personnel
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-500">
            <Link to="/" className="hover:text-ink-800">
              Careers
            </Link>
            <Link to="/applicant" className="hover:text-ink-800">
              Applicant portal
            </Link>
            <Link to="/staff" className="hover:text-ink-800">
              Staff portal
            </Link>
            <Link to="/admin" className="hover:text-ink-800">
              Admin
            </Link>
          </nav>
          <p className="text-2xs text-ink-400">
            © {year} Mobigate Group. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
