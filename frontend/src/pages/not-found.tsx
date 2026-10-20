import { ArrowLeft, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-white px-6 py-16 text-center">
      {/* -- Giant sliced 404, like the broken-dresser reference -- */}
      <div aria-hidden className="relative select-none">
        <p className="text-[11rem] leading-none font-bold tracking-tighter text-ink-200 tabular sm:text-[16rem]">
          404
        </p>
        {/* Slice lines across the numerals */}
        <span className="absolute top-[22%] -left-4 h-1.5 w-[110%] -rotate-6 rounded-full bg-white shadow-sm" />
        <span className="absolute top-[46%] -left-4 h-1.5 w-[110%] rotate-3 rounded-full bg-white shadow-sm" />
        <span className="absolute top-[68%] -left-4 h-1 w-[110%] -rotate-2 rounded-full bg-white shadow-sm" />
        {/* Little broken drawer, purely CSS */}
        <span className="absolute -bottom-2 left-[12%] hidden h-16 w-24 -rotate-6 rounded-md border border-ink-300 bg-ink-100 shadow-lg sm:block">
          <span className="absolute top-2 right-2 left-2 h-1.5 rounded-full bg-ink-300" />
          <span className="absolute top-5 right-2 left-2 h-1.5 rounded-full bg-ink-300" />
          <span className="absolute top-8 right-2 left-2 h-1.5 rounded-full bg-ink-300" />
          <span className="absolute -bottom-2 left-2 size-2 rounded-full bg-ink-400" />
          <span className="absolute -right-1 -bottom-2 size-2 rounded-full bg-ink-400" />
        </span>
        <span className="absolute -right-2 bottom-0 hidden h-12 w-20 rotate-3 rounded-md border border-ink-300 bg-ink-100 shadow-lg sm:block">
          <span className="absolute top-2 right-2 left-2 h-1.5 rounded-full bg-ink-300" />
          <span className="absolute top-5 right-2 left-2 h-1.5 rounded-full bg-ink-300" />
        </span>
      </div>

      <h1 className="mt-6 text-lg font-semibold tracking-wide text-ink-900 uppercase">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-sm text-ink-500 text-balance">
        The page you are looking for does not exist or has been moved. Head
        back to the open roles or your portal.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <Link to="/" className={cn(buttonVariants({}), 'gap-2')}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to home
        </Link>
        <Link to="/careers" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
          <Search aria-hidden className="size-4" />
          Browse open roles
        </Link>
      </div>
    </div>
  )
}
