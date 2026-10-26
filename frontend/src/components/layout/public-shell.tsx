import * as React from 'react'
import { Link, Outlet } from 'react-router-dom'

import { Brand } from '@/components/brand'
import { buttonVariants } from '@/components/ui/button'

const NAV_LINKS = [
  { to: '/', label: 'Platform' },
  { to: '/careers', label: 'Careers' },
  { to: '/applicant', label: 'Applicant portal' },
]

/** Repeated in the footer ticker. Points at real routes only. */
const TICKER_LINKS = [
  { to: '/careers', label: 'Open roles' },
  { to: '/applicant', label: 'Track your application' },
  { to: '/', label: 'How MGM-Portal works' },
  { to: '/applicant/interviews', label: 'Interview announcements' },
  { to: '/careers', label: 'Apply online' },
]

/** Marketing shell for the public site. */
export function PublicShell() {
  // Sampled once on mount so the footer year does not change on re-render.
  const [year] = React.useState(() => new Date().getFullYear())

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <div className="sticky top-0 z-30 px-3 pt-3 sm:px-5">
        <header className="mx-auto max-w-6xl rounded-2xl border border-ink-200 bg-white/90 shadow-sm backdrop-blur-sm">
          <div className="flex h-16 items-center gap-6 px-4 sm:px-5">
            <Link to="/" className="flex items-center">
              <Brand showTagline />
            </Link>

            <nav className="ml-auto hidden items-center gap-1 lg:flex">
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

            <div className="ml-auto flex items-center gap-2 lg:ml-0">
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
      </div>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-brand-950 text-brand-200">
        {/* -- Link ticker -- */}
        <div className="overflow-hidden border-b border-brand-900 py-3">
          <div className="flex w-max animate-marquee motion-reduce:animate-none">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                aria-hidden={copy === 1}
                className="flex items-center gap-8 pr-8"
              >
                {TICKER_LINKS.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="text-2xs font-medium tracking-wide whitespace-nowrap text-brand-300 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* -- Columns -- */}
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Brand showTagline tone="light" />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-brand-300">
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
                { to: '/careers', label: 'Open roles' },
              ]}
            />
          </div>

          <div className="mt-10 border-t border-brand-900 pt-6">
            <p className="text-2xs text-brand-400">
              © {year} Mobigate Group. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* -- Cropped wordmark: sits below the footer on the page surface, not
           inside it, so the dark footer stays short. A hard mask cuts the
           letters at their vertical midpoint and a glass sheen sweeps left to
           right *inside* the glyphs. The text never moves — only the light on
           it does. -- */}
      <div
        aria-hidden
        className="relative h-[8.5vw] w-full overflow-hidden lg:h-[5.5rem]"
      >
        {/* Static (non-animated) tint so the frosted glyphs have something
            to refract against the white page surface. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(65% 100% at 50% 0%, rgba(99,102,241,0.20) 0%, rgba(129,140,248,0.08) 48%, transparent 78%)',
          }}
        />
        <p
          className="animate-word-sheen absolute top-0 text-center text-[17vw] leading-none font-bold tracking-tighter whitespace-nowrap text-transparent select-none motion-reduce:animate-none lg:text-[11rem]"
          style={{
            // The sheen is the text's own fill, so the light travels through
            // the letterforms instead of across a background panel.
            backgroundImage:
              'linear-gradient(100deg, rgba(67,56,202,0.30) 0%, rgba(129,140,248,0.24) 16%, rgba(191,219,254,0.34) 30%, rgba(224,231,255,0.42) 42%, rgba(148,163,184,0.30) 56%, rgba(79,70,229,0.26) 74%, rgba(49,46,129,0.32) 100%)',
            backgroundSize: '220% 100%',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            // Glass: translucent tint fill, so the page surface and the
            // gradient wash behind it show through the letterforms.
            // NOTE: no backdrop-filter here — it would blur the whole
            // element box (a visible rectangle) instead of the glyphs.
            // Stretch the letters so the wordmark spans the full page width.
            left: '50%',
            width: '71.5%',
            transform: 'translateX(-50%) scaleX(1.4)',
            transformOrigin: 'top center',
            filter: 'drop-shadow(0 1px 2px rgba(30,27,75,0.16))',
            // Hard cut at the vertical midpoint: only the top half of the
            // letters is visible.
            WebkitMaskImage:
              'linear-gradient(to bottom, #000 0%, #000 50%, transparent 50%, transparent 100%)',
            maskImage:
              'linear-gradient(to bottom, #000 0%, #000 50%, transparent 50%, transparent 100%)',
          }}
        >
          MOBIGATE
        </p>
      </div>
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
      <p className="text-2xs font-semibold tracking-wider text-brand-400 uppercase">
        {title}
      </p>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((link) => (
          <li key={link.to}>
            <Link
              to={link.to}
              className="text-brand-200 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
