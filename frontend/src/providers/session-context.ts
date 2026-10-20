import * as React from 'react'

import type { Session, UserRole } from '@/types/domain'

export interface SessionContextValue {
  session: Session | null
  role: UserRole
  tenantName: string | null
  isLoading: boolean
  setRole: (role: UserRole) => void
  signIn: (role: UserRole) => void
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

export const SessionContext = React.createContext<SessionContextValue | null>(
  null,
)

export function useSession(): SessionContextValue {
  const context = React.useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return context
}
