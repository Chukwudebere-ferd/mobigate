import * as React from 'react'

import type { Session, UserRole } from '@/types/domain'

import {
  SessionContext,
  type SessionContextValue,
} from './session-context'

/**
 * Session state for the frontend.
 *
 * Mock mode (the default for design review) resolves a role from the URL or
 * localStorage. Live mode uses Better Auth for the session and asks the Go
 * API for the authoritative MGM profile (role, tenant, approval status).
 *
 * Set VITE_AUTH_MODE=live to use Better Auth. Data fetching is controlled
 * separately by VITE_API_MODE.
 */

const ROLE_STORAGE_KEY = 'mgm.mock.role'
const AUTH_MODE =
  import.meta.env.VITE_AUTH_MODE ?? import.meta.env.VITE_API_MODE ?? 'mock'
const USE_LIVE_AUTH = AUTH_MODE === 'live'

const LiveSessionProvider = React.lazy(() =>
  import('./session-provider-live').then((module) => ({
    default: module.LiveSessionProvider,
  })),
)

const MOCK_SESSIONS: Record<UserRole, Session> = {
  super_admin: {
    user: {
      id: 'usr-super',
      email: 'admin@mobigate.group',
      first_name: 'Chidi',
      last_name: 'Okonkwo',
      role: 'super_admin',
      status: 'active',
      tenant_id: 'ten-1',
    },
    tenant_name: 'Mobigate Group — Lagos',
  },
  admin: {
    user: {
      id: 'usr-admin-1',
      email: 'a.adeyemi@mobigate.group',
      first_name: 'Aisha',
      last_name: 'Adeyemi',
      role: 'admin',
      status: 'active',
      tenant_id: 'ten-1',
    },
    tenant_name: 'Mobigate Group — Lagos',
  },
  applicant: {
    user: {
      id: 'usr-app-1',
      email: 'ngozi.obi@example.com',
      first_name: 'Ngozi',
      last_name: 'Obi',
      role: 'applicant',
      status: 'active',
      tenant_id: 'ten-1',
    },
    tenant_name: 'Mobigate Group — Lagos',
  },
  staff: {
    user: {
      id: 'usr-staff-1',
      email: 'tunde.adebisi@example.com',
      first_name: 'Tunde',
      last_name: 'Adebisi',
      role: 'staff',
      status: 'active',
      tenant_id: 'ten-1',
      staff_id: 'STA/LA/2026/0001',
    },
    tenant_name: 'Mobigate Group — Lagos',
  },
}

function readStoredRole(): UserRole {
  // The render harness runs in Node with no URL. Default to an admin there so
  // the guarded admin screens are still exercised; in the browser the role is
  // derived from the route or localStorage below.
  if (typeof window === 'undefined') return 'admin'
  const stored = window.localStorage.getItem(ROLE_STORAGE_KEY)
  if (stored && stored in MOCK_SESSIONS) return stored as UserRole
  const path = window.location.pathname
  if (path.startsWith('/admin')) return 'admin'
  if (path.startsWith('/staff')) return 'staff'
  return 'applicant'
}

function MockSessionProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = React.useState<UserRole>(readStoredRole)

  const setRole = React.useCallback((next: UserRole) => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, next)
    setRoleState(next)
  }, [])

  const signIn = React.useCallback(
    (next: UserRole) => {
      setRole(next)
    },
    [setRole],
  )

  const signOut = React.useCallback(async () => {
    window.localStorage.removeItem(ROLE_STORAGE_KEY)
    setRoleState('applicant')
  }, [])

  const refresh = React.useCallback(async () => {}, [])

  const value = React.useMemo<SessionContextValue>(
    () => ({
      session: MOCK_SESSIONS[role],
      role,
      tenantName: MOCK_SESSIONS[role].tenant_name ?? null,
      isLoading: false,
      setRole,
      signIn,
      signOut,
      refresh,
    }),
    [role, setRole, signIn, signOut, refresh],
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Render-check and SSR run in Node, where Better Auth's browser client must
  // not be imported. The mock keeps every route renderable there.
  if (USE_LIVE_AUTH && typeof window !== 'undefined') {
    return (
      <React.Suspense fallback={null}>
        <LiveSessionProvider>{children}</LiveSessionProvider>
      </React.Suspense>
    )
  }
  return <MockSessionProvider>{children}</MockSessionProvider>
}

export { useSession } from './session-context'
