import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, EyeOff, LogIn } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { http } from '@/lib/api/client'
import type { MeResponse } from '@/types/domain'

/**
 * Administrator sign-in.
 *
 * Better Auth owns the credential check. After sign-in we ask the Go API for
 * the authoritative MGM profile: only active admin/super_admin accounts may
 * enter the panel. Pending accounts are sent to the panel, where the route
 * guard shows the approval state.
 */
export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const next = searchParams.get('next')
  const destination =
    next && next.startsWith('/admin') ? next : '/admin'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      // Dynamic import keeps Better Auth's browser-only client out of the
      // server render harness.
      const { authClient } = await import('@/lib/auth-client')

      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
      })

      if (result.error) {
        setError(
          result.error.message ??
            'Sign-in failed. Check your email and password.',
        )
        return
      }

      const me = await http.get<MeResponse>('/me')
      queryClient.setQueryData(['session', 'me'], me)

      if (me.user.role !== 'admin' && me.user.role !== 'super_admin') {
        await authClient.signOut()
        setError('This portal is for administrator accounts only.')
        return
      }

      navigate(destination, { replace: true })
    } catch {
      setError('Unable to sign in right now. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              M
            </span>
            <span className="text-sm font-semibold text-ink-900">
              MGM-Portal
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-800"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to careers
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-ink-200 bg-white p-7 shadow-xs">
            <h1 className="text-xl font-semibold tracking-tight text-ink-950">
              Administrator sign in
            </h1>
            <p className="mt-1.5 text-sm text-ink-500">
              Use the account issued by your Super Admin.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Field label="Email" htmlFor="email" required>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={submitting}
                />
              </Field>

              <Field label="Password" htmlFor="password" required>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    disabled={submitting}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={
                      showPassword ? 'Hide password' : 'Show password'
                    }
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-ink-400 transition-colors hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
              </Field>

              {error ? (
                <p
                  role="alert"
                  className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700"
                >
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                className="w-full"
                loading={submitting}
                loadingText="Signing in…"
              >
                <LogIn aria-hidden />
                Sign in
              </Button>
            </form>
          </div>

          <p className="mt-4 text-center text-2xs text-ink-500">
            Access is limited to approved administrator accounts.
          </p>
        </div>
      </main>
    </div>
  )
}
