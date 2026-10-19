import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-brand-600 text-white shadow-xs hover:bg-brand-700 active:bg-brand-800',
        secondary:
          'bg-white text-ink-800 ring-1 ring-ink-200 shadow-xs hover:bg-ink-50 active:bg-ink-100',
        outline:
          'bg-transparent text-ink-700 ring-1 ring-ink-300 hover:bg-ink-50 active:bg-ink-100',
        ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
        danger:
          'bg-danger-600 text-white shadow-xs hover:bg-danger-700 active:bg-danger-800',
        'danger-outline':
          'bg-white text-danger-700 ring-1 ring-danger-200 hover:bg-danger-50',
        success:
          'bg-success-600 text-white shadow-xs hover:bg-success-700 active:bg-success-900',
        link: 'text-brand-700 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-3.5',
        lg: 'h-11 px-6 text-base',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  loadingText?: string
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, loading, loadingText, children, disabled, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {loading && loadingText ? loadingText : children}
    </button>
  ),
)
Button.displayName = 'Button'

export { buttonVariants }
