import * as React from 'react'
import type { Session, UserRole } from '@/types/domain'

/**
 * Session state for the frontend.
 *
 * In production this is populated by Better Auth: the client holds the
 * session cookie and exposes the signed-in user. Until the Go API and auth
 * service are wired together, the provider resolves a mock session so the
 * page designs can be exercised end to end.
 *
 * The mock is chosen by role so each portal can be reviewed in isolation:
 *   /admin     -> admin
 *   /applicant -> applicant
 *   /staff     -> staff
 */

const ROLE_STORAGE_KEY = 'mgm.mock.role'

interface SessionContextValue {
  session: Session | null
  role: UserRole
  isLoading: boolean
  setRole: (role: UserRole) => void
  signIn: (role: UserRole) => void
  signOut: () => void
}

const SessionContext = React.createContext<SessionContextValue | null>(null)

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
  },
}

function readStoredRole(): UserRole {
  if (typeof window === 'undefined') return 'applicant'
  const stored = window.localStorage.getItem(ROLE_STORAGE_KEY)
  if (stored && stored in MOCK_SESSIONS) return stored as UserRole
  const path = window.location.pathname
  if (path.startsWith('/admin')) return 'admin'
  if (path.startsWith('/staff')) return 'staff'
  return 'applicant'
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
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

  const signOut = React.useCallback(() => {
    window.localStorage.removeItem(ROLE_STORAGE_KEY)
    setRoleState('applicant')
  }, [])

  const value = React.useMemo<SessionContextValue>(
    () => ({
      session: MOCK_SESSIONS[role],
      role,
      isLoading: false,
      setRole,
      signIn,
      signOut,
    }),
    [role, setRole, signIn, signOut],
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const context = React.useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}
