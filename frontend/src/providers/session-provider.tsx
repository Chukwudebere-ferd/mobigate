import * as React from 'react'

import type { Session } from '@/types/domain'

import {
  SessionContext,
  type SessionContextValue,
} from './session-context'

/**
 * Session state for the frontend.
 *
 * In the browser the Better Auth provider — loaded lazily because its client
 * touches `window` at module evaluation — is authoritative. The Go API's /me
 * response decides the role, tenant and approval status.
 *
 * The render harness runs in Node with no browser and no network. A static
 * harness session there keeps every route renderable for `pnpm render-check`;
 * it can never reach a real user's browser.
 */

const LiveSessionProvider = React.lazy(() =>
  import('./session-provider-live').then((module) => ({
    default: module.LiveSessionProvider,
  })),
)

/** Static session for the Node render harness (no browser, no network). */
const HARNESS_SESSION: Session = {
  user: {
    id: 'harness',
    email: 'harness@localhost',
    first_name: 'Render',
    last_name: 'Harness',
    role: 'admin',
    status: 'active',
    tenant_id: null,
  },
  tenant_name: null,
}

function HarnessSessionProvider({ children }: { children: React.ReactNode }) {
  const value = React.useMemo<SessionContextValue>(
    () => ({
      session: HARNESS_SESSION,
      role: 'admin',
      tenantName: null,
      isLoading: false,
      setRole: () => {},
      signIn: () => {},
      signOut: async () => {},
      refresh: async () => {},
    }),
    [],
  )
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Better Auth's browser client must not be imported in Node, so the live
  // provider only ever loads in a real browser.
  if (typeof window === 'undefined') {
    return <HarnessSessionProvider>{children}</HarnessSessionProvider>
  }
  return (
    <React.Suspense fallback={null}>
      <LiveSessionProvider>{children}</LiveSessionProvider>
    </React.Suspense>
  )
}

export { useSession } from './session-context'
