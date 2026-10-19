/**
 * Render harness for the MGM-Portal frontend.
 *
 * Renders every route with react-dom/server against the mock data and
 * reports failures. This catches runtime problems — bad hooks, undefined
 * access, missing context — that a typecheck cannot, without needing a
 * browser.
 *
 *   node scripts/render-check.mjs
 */
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const ROUTES = [
  ['/preview', 'Design review index'],
  ['/', 'Company landing'],
  ['/careers', 'Careers listing'],
  ['/jobs/senior-backend-engineer', 'Job detail'],
  ['/apply/senior-backend-engineer', 'Application form'],
  ['/application/received', 'Application received'],
  ['/applicant', 'My applications'],
  ['/applicant/applications/app-13', 'Application status (shortlisted)'],
  ['/applicant/applications/app-14', 'Application status (rejected)'],
  ['/applicant/interviews', 'Interview announcements'],
  ['/staff', 'Staff profile'],
  ['/staff/onboarding', 'Access code redemption'],
  ['/admin', 'Dashboard'],
  ['/admin/applications', 'Applications'],
  ['/admin/jobs', 'Job postings'],
  ['/admin/interviews', 'Interviews'],
  ['/admin/shortlists', 'Shortlists'],
  ['/admin/access-codes', 'Access codes'],
  ['/admin/staff', 'Staff directory'],
  ['/admin/locations', 'Location management'],
  ['/admin/settings', 'Settings'],
  ['/admin/audit', 'Audit log'],
  ['/does-not-exist', 'Not found'],
]

const { routes } = await import('../src/routes.tsx')
const { SessionProvider } = await import('../src/providers/session-provider.tsx')

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})

function stripMarkup(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

let failures = 0

for (const [path, label] of ROUTES) {
  try {
    const handler = createStaticHandler(routes)
    const context = await handler.query(
      new Request(`http://localhost${path}`, { method: 'GET' }),
    )
    const router = createStaticRouter(routes, context)
    const html = renderToString(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          SessionProvider,
          null,
          createElement(StaticRouterProvider, { router, context }),
        ),
      ),
    )
    const text = stripMarkup(html)
    const ok = text.length > 40
    console.log(
      `${ok ? 'PASS' : 'THIN'}  ${path.padEnd(38)} ${String(text.length).padStart(6)} chars  ${label}`,
    )
    if (!ok) {
      failures++
      console.log(`      -> "${text.slice(0, 160)}"`)
    }
  } catch (error) {
    failures++
    console.log(`FAIL  ${path.padEnd(38)} ${label}`)
    console.log(`      -> ${error?.message ?? error}`)
    if (error?.stack) {
      console.log(
        error.stack
          .split('\n')
          .slice(0, 4)
          .map((l) => `         ${l}`)
          .join('\n'),
      )
    }
  }
}

console.log(
  `\n${ROUTES.length - failures}/${ROUTES.length} routes rendered without error.`,
)
process.exit(failures > 0 ? 1 : 0)
