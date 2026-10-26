import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { Spinner } from '@/components/ui/empty-state'
import { staffApi } from '@/lib/api'
import { NotFoundPage } from '@/pages/not-found'

/**
 * Allows the staff workspace only when the signed-in user owns an active staff
 * record. Missing, suspended or exited staff profiles are treated as 404, as
 * are accounts that are not recognised as staff by the API.
 *
 * Staff onboarding sits outside this guard: applicants redeem their access
 * code there before the API promotes them to the staff role.
 */
export function RequireActiveStaff({ children }: { children: ReactNode }) {
  const staffQuery = useQuery({
    queryKey: ['staff', 'me'],
    queryFn: () => staffApi.me(),
    retry: false,
  })

  if (staffQuery.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ink-50">
        <div className="text-center">
          <Spinner />
          <p className="mt-3 text-sm text-ink-500">
            Checking your staff access and current employment status…
          </p>
        </div>
      </div>
    )
  }

  if (staffQuery.isError || !staffQuery.data?.staff) {
    return <NotFoundPage />
  }

  return <>{children}</>
}
