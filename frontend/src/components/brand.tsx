import { cn } from '@/lib/cn'
import logo from '@/assets/mobiface-logo.svg'

/**
 * The Mobigate Group wordmark.
 *
 * The artwork is the Mobiface lockup — the stacked-cards mark and the
 * wordmark — shipped as SVG so it stays sharp at any size, inherits the
 * brand colour exactly, and costs a few kilobytes to download.
 */
export function Brand({
  className,
  showTagline = false,
}: {
  className?: string
  showTagline?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <img
        src={logo}
        alt="Mobiface"
        width={112}
        height={34}
        className="h-[26px] w-auto shrink-0"
      />
      {showTagline ? (
        <span className="hidden border-l border-ink-200 pl-3 text-2xs leading-tight text-ink-500 lg:block">
          Recruitment &amp; Staff
          <br />
          Management
        </span>
      ) : null}
    </span>
  )
}
