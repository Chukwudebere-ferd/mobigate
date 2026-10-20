import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { http } from '@/lib/api/client'
import { authClient } from '@/lib/auth-client'
import type { MeResponse, Session } from '@/types/domain'

import { SessionContext, type SessionContextValue } from './session-context'

/**
 * Better Auth session provider.
 *
 * Loaded lazily by SessionProvider so the Better Auth client — which touches
 * `window` at module evaluation — is never imported during SSR or the render
 * harness. The Go API's /me response is authoritative for role and status.
 */
export function LiveSessionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const authSession = authClient.useSession()
  const queryClient = useQueryClient()
  const hasAuthUser = Boolean(authSession.data?.user)

  const meQuery = useQuery({
    queryKey: ['session', 'me'],
    queryFn: () => http.get<MeResponse>('/me'),
    enabled: hasAuthUser,
    retry: false,
    staleTime: 30_000,
  })

  const session = React.useMemo<Session | null>(() => {
    if (!meQuery.data?.user) return null
    return {
      user: meQuery.data.user,
      tenant_name: meQuery.data.tenant?.name ?? null,
    }
  }, [meQuery.data])

  const signOut = React.useCallback(async () => {
    await authClient.signOut()
    queryClient.clear()
    window.location.assign('/login')
  }, [queryClient])

  const refresh = React.useCallback(async () => {
    await meQuery.refetch()
  }, [meQuery])

  const value = React.useMemo<SessionContextValue>(
    () => ({
      session,
      role: session?.user.role ?? 'applicant',
      tenantName: session?.tenant_name ?? null,
      isLoading: authSession.isPending || (hasAuthUser && meQuery.isLoading),
      setRole: () => {},
      signIn: () => {},
      signOut,
      refresh,
    }),
    [
      session,
      authSession.isPending,
      hasAuthUser,
      meQuery.isLoading,
      signOut,
      refresh,
    ],
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}
