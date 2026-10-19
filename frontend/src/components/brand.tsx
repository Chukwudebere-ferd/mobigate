import { cn } from '@/lib/cn'

/**
 * The Mobigate Group wordmark.
 *
 * Drawn as inline SVG rather than shipped as a raster image so it stays
 * sharp at any size, inherits the current text colour, and costs nothing to
 * download.
 */
export function Brand({
  className,
  showTagline = false,
}: {
  className?: string
  showTagline?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
        M
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight text-ink-900">
          Mobigate Group
        </span>
        {showTagline && (
          <span className="block text-2xs text-ink-500">
            Recruitment &amp; Staff Management
          </span>
        )}
      </span>
    </span>
  )
}
