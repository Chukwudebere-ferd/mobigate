import * as React from 'react'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

const sizeClasses = {
  xs: 'size-6 text-2xs',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-16 text-lg',
} as const

export function Avatar({
  first,
  last,
  src,
  size = 'md',
  className,
}: {
  first?: string | null
  last?: string | null
  src?: string | null
  size?: keyof typeof sizeClasses
  className?: string
}) {
  const [failed, setFailed] = React.useState(false)

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className={cn(
          'shrink-0 rounded-full object-cover ring-1 ring-ink-200',
          sizeClasses[size],
          className,
        )}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800 ring-1 ring-brand-200',
        sizeClasses[size],
        className,
      )}
    >
      {initials(first, last)}
    </span>
  )
}
