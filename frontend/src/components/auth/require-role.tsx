import { ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/empty-state'
import { useSession } from '@/providers/session-provider'
import type { UserRole } from '@/types/domain'

/**
 * Guards a route subtree behind an authenticated, active account with one
 * of the allowed roles.
 *
 * Pending admins can sign in but see an approval screen instead of the
 * panel; suspended/disabled accounts are refused outright.
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: UserRole[]
  children: ReactNode
}) {
  const { session, isLoading, signOut } = useSession()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-50">
        <Spinner />
      </div>
    )
  }

  if (!session) {
    const next = `${location.pathname}${location.search}`
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(next)}`}
        replace
      />
    )
  }

  if (!roles.includes(session.user.role)) {
    return <Navigate to="/" replace />
  }

  if (session.user.status !== 'active') {
    const pending = session.user.status === 'pending'
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-ink-200 bg-white p-8 text-center shadow-xs">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-warning-50 text-warning-700">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-ink-950">
            {pending ? 'Account awaiting approval' : 'Account unavailable'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-600">
            {pending
              ? 'Your administrator account has been created but has not been approved yet. A Super Admin must approve it before you can use the panel.'
              : 'This account is suspended or disabled. Contact a Super Admin if you believe this is a mistake.'}
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
