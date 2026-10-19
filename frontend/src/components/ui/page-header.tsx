import type { LucideIcon } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * Standard page heading used across the admin panel, applicant portal and
 * staff portal so every screen has the same title rhythm.
 */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  breadcrumb,
  className,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  actions?: React.ReactNode
  breadcrumb?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {breadcrumb && <div className="mb-2">{breadcrumb}</div>}
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 ring-1 ring-brand-100">
              <Icon className="size-4.5 text-brand-700" aria-hidden />
            </span>
          )}
          <h1 className="truncate text-xl font-semibold tracking-tight text-ink-900">
            {title}
          </h1>
        </div>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-ink-500 text-balance">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
