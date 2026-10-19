import * as React from 'react'
import { Link, Outlet } from 'react-router-dom'

import { Brand } from '@/components/brand'
import { buttonVariants } from '@/components/ui/button'

const NAV_LINKS = [
  { to: '/', label: 'Platform' },
  { to: '/careers', label: 'Careers' },
  { to: '/applicant', label: 'Applicant portal' },
  { to: '/staff', label: 'Staff portal' },
]

/** Marketing shell for the public site. */
export function PublicShell() {
  // Sampled once on mount so the footer year does not change on re-render.
  const [year] = React.useState(() => new Date().getFullYear())

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" className="flex items-center">
            <Brand showTagline />
          </Link>

          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-md px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <Link
              to="/applicant"
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              Sign in
            </Link>
            <Link to="/careers" className={buttonVariants({ size: 'sm' })}>
              View roles
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-ink-200 bg-ink-50">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Brand showTagline />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-ink-600">
                MGM-Portal is the recruitment and staff management platform of
                the Mobigate Group — postings, applications, interviews,
                shortlisting, access codes and personnel records, with every
                transition written to the audit log.
              </p>
            </div>

            <FooterColumn
              title="Platform"
              links={[
                { to: '/', label: 'Overview' },
                { to: '/careers', label: 'Open roles' },
              ]}
            />

            <FooterColumn
              title="Portals"
              links={[
                { to: '/applicant', label: 'Applicant portal' },
                { to: '/staff', label: 'Staff portal' },
                { to: '/admin', label: 'Admin console' },
              ]}
            />
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-ink-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-2xs text-ink-400">
              © {year} Mobigate Group. All rights reserved.
            </p>
            {import.meta.env.DEV ? (
              <Link
                to="/preview"
                className="text-2xs text-ink-400 hover:text-ink-700"
                title="Developer screen index"
              >
                Screen index
              </Link>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: { to: string; label: string }[]
}) {
  return (
    <div>
      <p className="text-2xs font-semibold tracking-wider text-ink-400 uppercase">
        {title}
      </p>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="text-ink-600 hover:text-ink-900">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
