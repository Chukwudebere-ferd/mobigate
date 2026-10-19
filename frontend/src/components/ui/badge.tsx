import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium ring-1 ring-inset whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
        brand: 'bg-brand-50 text-brand-700 ring-brand-200',
        success: 'bg-success-50 text-success-700 ring-success-100',
        warning: 'bg-warning-50 text-warning-700 ring-warning-100',
        danger: 'bg-danger-50 text-danger-700 ring-danger-100',
        info: 'bg-info-50 text-info-700 ring-info-100',
        accent: 'bg-accent-50 text-accent-800 ring-accent-200',
        outline: 'bg-white text-ink-600 ring-ink-300',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className="size-1.5 rounded-full bg-current opacity-70"
          aria-hidden
        />
      )}
      {children}
    </span>
  )
}

export { badgeVariants }
