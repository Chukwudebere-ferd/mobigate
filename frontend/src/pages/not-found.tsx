import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink-50 px-6 text-center">
      <p className="text-7xl font-bold tracking-tight text-brand-200">404</p>
      <h1 className="mt-4 text-xl font-semibold text-ink-900">Page not found</h1>
      <p className="mt-2 max-w-md text-sm text-ink-500 text-balance">
        The page you are looking for does not exist or has been moved. Use the
        links below to get back on track.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link to="/" className={buttonVariants({})}>
          Browse open roles
        </Link>
        <Link to="/admin" className={buttonVariants({ variant: 'outline' })}>
          Admin panel
        </Link>
      </div>
    </div>
  )
}
