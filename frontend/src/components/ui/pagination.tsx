import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './button'

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  className,
}: {
  page: number
  totalPages: number
  total?: number
  pageSize?: number
  onPageChange: (page: number) => void
  className?: string
}) {
  if (totalPages <= 1) return null

  // Window of pages around the current one, with ellipses.
  const pages: (number | 'gap')[] = []
  const window = 1
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages) {
      pages.push(p)
    } else if (Math.abs(p - page) <= window) {
      pages.push(p)
    } else if (pages[pages.length - 1] !== 'gap') {
      pages.push('gap')
    }
  }

  const range =
    total !== undefined && pageSize !== undefined
      ? {
          start: Math.min((page - 1) * pageSize + 1, total),
          end: Math.min(page * pageSize, total),
        }
      : null

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-3 border-t border-ink-200 px-4 py-3 sm:flex-row',
        className,
      )}
    >
      {total !== undefined && (
        <p className="text-sm text-ink-500">
          {range ? (
            <>
              Showing{' '}
              <span className="font-medium text-ink-800">
                {range.start}–{range.end}
              </span>{' '}
              of <span className="font-medium text-ink-800">{total}</span>{' '}
              {total === 1 ? 'entry' : 'entries'}
            </>
          ) : (
            <>
              Page <span className="font-medium text-ink-800">{page}</span> of{' '}
              <span className="font-medium text-ink-800">{totalPages}</span>
            </>
          )}
        </p>
      )}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
          Previous
        </Button>
        <div className="mx-1 hidden items-center gap-1 sm:flex">
          {pages.map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-ink-400">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  'size-8 rounded-md text-sm font-medium transition-colors',
                  p === page
                    ? 'bg-brand-600 text-white'
                    : 'text-ink-600 hover:bg-ink-100',
                )}
              >
                {p}
              </button>
            ),
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
