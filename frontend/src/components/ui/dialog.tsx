import { X } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/cn'

interface DialogContextValue {
  close: () => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

export const Dialog = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(({ className, open, onOpenChange, children, ...props }, ref) => {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange?.(false)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onOpenChange])

  const close = React.useCallback(() => onOpenChange?.(false), [onOpenChange])

  if (!open) return null

  return (
    <DialogContext.Provider value={{ close }}>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px] animate-fade-in"
          onClick={close}
          aria-hidden
        />
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          className={cn(
            'relative z-10 max-h-[92vh] w-full overflow-y-auto scroll-slim rounded-t-2xl bg-white shadow-xl animate-slide-up sm:max-w-lg sm:rounded-2xl',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    </DialogContext.Provider>
  )
})
Dialog.displayName = 'Dialog'

export function DialogHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function DialogBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('px-5 py-4', className)} {...props}>
      {children}
    </div>
  )
}

export function DialogFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 border-t border-ink-200 bg-ink-50/60 px-5 py-3 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function DialogTitle({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-base font-semibold text-ink-900', className)}
      {...props}
    >
      {children}
    </h2>
  )
}

export function DialogDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('mt-1 text-sm text-ink-500', className)} {...props}>
      {children}
    </p>
  )
}

/**
 * The close affordance in a dialog header. Closes the enclosing dialog
 * unless an explicit onClick is supplied.
 */
export function DialogClose({
  className,
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = React.useContext(DialogContext)

  return (
    <button
      type="button"
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) context?.close()
      }}
      className={cn(
        'rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700',
        className,
      )}
      aria-label="Close dialog"
      {...props}
    >
      {children ?? <X className="size-4" />}
    </button>
  )
}
