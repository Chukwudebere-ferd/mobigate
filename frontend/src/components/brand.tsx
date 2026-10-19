import { cn } from '@/lib/cn'
import logo from '@/assets/mobiface-logo.svg'
import logoLight from '@/assets/mobiface-logo-light.svg'

/**
 * The Mobigate Group wordmark.
 *
 * The artwork is the Mobiface lockup — the stacked-cards mark and the
 * wordmark — shipped as SVG so it stays sharp at any size, inherits the
 * brand colour exactly, and costs a few kilobytes to download.
 *
 * `tone="light"` swaps in the knocked-out variant, which reads on the dark
 * public footer. The mark colours are identical in both.
 */
export function Brand({
  className,
  showTagline = false,
  tone = 'dark',
}: {
  className?: string
  showTagline?: boolean
  tone?: 'dark' | 'light'
}) {
  const light = tone === 'light'

  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <img
        src={light ? logoLight : logo}
        alt="Mobiface"
        width={112}
        height={34}
        className="h-[26px] w-auto shrink-0"
      />
      {showTagline ? (
        <span
          className={cn(
            'hidden border-l pl-3 text-2xs leading-tight lg:block',
            light
              ? 'border-brand-800 text-brand-300'
              : 'border-ink-200 text-ink-500',
          )}
        >
          Recruitment &amp; Staff
          <br />
          Management
        </span>
      ) : null}
    </span>
  )
}
