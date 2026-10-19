import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Card, CardContent } from './card'

/**
 * A metric tile for dashboard and summary strips.
 *
 * The tone controls the icon treatment only. The number itself stays in ink
 * so that a row of tiles reads as one set rather than a colour chart.
 */
export type StatCardTone =
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'accent'
  | 'neutral'

const toneClasses: Record<StatCardTone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  success: 'bg-success-50 text-success-700 ring-success-100',
  warning: 'bg-warning-50 text-warning-700 ring-warning-100',
  danger: 'bg-danger-50 text-danger-700 ring-danger-100',
  info: 'bg-info-50 text-info-700 ring-info-100',
  accent: 'bg-accent-50 text-accent-800 ring-accent-200',
  neutral: 'bg-ink-100 text-ink-600 ring-ink-200',
}

export function StatCard({
  label,
  value,
  suffix,
  tone = 'neutral',
  icon: Icon,
  hint,
  delta,
  className,
}: {
  label: string
  value: number | string
  suffix?: string
  tone?: StatCardTone
  icon?: LucideIcon
  hint?: string
  /** Optional change indicator, e.g. { value: 12, direction: 'up' }. */
  delta?: { value: number; direction: 'up' | 'down' | 'flat' }
  className?: string
}) {
  return (
    <Card className={className}>
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
            {label}
          </p>
          {Icon && (
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-lg ring-1',
                toneClasses[tone],
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
          )}
        </div>

        <p className="text-2xl font-semibold text-ink-900 tabular">
          {value}
          {suffix ? (
            <span className="text-base font-medium text-ink-500">{suffix}</span>
          ) : null}
        </p>

        {delta && (
          <p
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              delta.direction === 'up' && 'text-success-700',
              delta.direction === 'down' && 'text-danger-700',
              delta.direction === 'flat' && 'text-ink-500',
            )}
          >
            <span aria-hidden>
              {delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '→'}
            </span>
            {delta.value > 0 ? '+' : ''}
            {delta.value}%
            <span className="font-normal text-ink-500">vs. previous period</span>
          </p>
        )}

        {hint && <p className="text-xs text-ink-500">{hint}</p>}
      </CardContent>
    </Card>
  )
}
