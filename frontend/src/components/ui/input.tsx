import * as React from 'react'
import { cn } from '@/lib/cn'

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(({ className, type, invalid, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    aria-invalid={invalid || undefined}
    className={cn(
      'flex h-9 w-full rounded-md border border-ink-300 bg-white px-3 py-1 text-sm text-ink-900 shadow-xs transition-colors',
      'placeholder:text-ink-400',
      'focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25',
      'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400',
      'aria-[invalid=true]:border-danger-500 aria-[invalid=true]:ring-danger-500/20',
      'file:mr-3 file:rounded file:border-0 file:bg-ink-100 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-ink-700',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      'flex min-h-20 w-full rounded-md border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-xs transition-colors',
      'placeholder:text-ink-400',
      'focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25',
      'disabled:cursor-not-allowed disabled:bg-ink-50',
      'aria-[invalid=true]:border-danger-500 aria-[invalid=true]:ring-danger-500/20',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(({ className, invalid, children, ...props }, ref) => (
  <select
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      'flex h-9 w-full appearance-none rounded-md border border-ink-300 bg-white bg-[length:16px] bg-[position:right_0.6rem_center] bg-no-repeat px-3 py-1 pr-9 text-sm text-ink-900 shadow-xs transition-colors',
      'focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25',
      'disabled:cursor-not-allowed disabled:bg-ink-50',
      'aria-[invalid=true]:border-danger-500 aria-[invalid=true]:ring-danger-500/20',
      className,
    )}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='2' stroke='%23566' %3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
    }}
    {...props}
  >
    {children}
  </select>
))
Select.displayName = 'Select'

interface FieldProps {
  label: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1 text-sm font-medium text-ink-800"
      >
        {label}
        {required && (
          <span className="text-danger-600" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  )
}

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode
  description?: string
}

export function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 rounded border-ink-300 text-brand-600 accent-brand-600 focus:ring-2 focus:ring-brand-500/30"
        {...props}
      />
      <label htmlFor={inputId} className="text-sm leading-5 text-ink-700">
        {label}
        {description && (
          <span className="mt-0.5 block text-xs text-ink-500">{description}</span>
        )}
      </label>
    </div>
  )
}
