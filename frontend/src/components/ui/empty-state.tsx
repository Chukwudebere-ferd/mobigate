import type { LucideIcon } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/cn'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-ink-100">
          <Icon className="size-6 text-ink-400" aria-hidden />
        </div>
      )}
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-ink-500 text-balance">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('flex items-center justify-center py-12', className)}
    >
      <span className="size-6 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-ink-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <div className="size-9 shrink-0 animate-pulse rounded-full bg-ink-100" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-ink-100" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-ink-100/70" />
          </div>
          <div className="h-6 w-20 animate-pulse rounded-full bg-ink-100" />
        </div>
      ))}
    </div>
  )
}
