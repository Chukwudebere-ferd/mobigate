import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Eye, EyeOff, UserPlus } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { http } from '@/lib/api/client'
import type { MeResponse } from '@/types/domain'

/**
 * Applicant account creation.
 *
 * Better Auth owns the credential; the role is never chosen here — it is
 * assigned by the Go API when the account is provisioned (BR-09: register
 * before applying). After sign-up we call POST /public/provision, which
 * creates the portal profile from the verified session, then continue to the
 * applicant portal.
 */
export function SignupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      // Dynamic import keeps Better Auth's browser-only client out of the
      // server render harness.
      const { authClient } = await import('@/lib/auth-client')

      const result = await authClient.signUp.email({
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        email: email.trim(),
        password,
      })

      if (result.error) {
        setError(
          result.error.message ??
            'Could not create the account. Check your details and try again.',
        )
        return
      }

      // The identity exists; now create the portal profile from the session.
      // The response is the /me shape, so no extra round trip is needed.
      const me = await http.post<MeResponse>('/public/provision')
      queryClient.setQueryData(['session', 'me'], me)

      navigate('/applicant', { replace: true })
    } catch {
      setError(
        'The account was created but the portal profile could not be prepared. Please sign in to continue.',
      )
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
              Create your account
            </h1>
            <p className="mt-1.5 text-sm text-ink-500">
              An account is required before you can apply for a role.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name" htmlFor="first-name" required>
                  <Input
                    id="first-name"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                    disabled={submitting}
                  />
                </Field>
                <Field label="Last name" htmlFor="last-name" required>
                  <Input
                    id="last-name"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                    disabled={submitting}
                  />
                </Field>
              </div>

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

              <Field
                label="Password"
                htmlFor="password"
                required
                hint="At least 8 characters."
              >
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={8}
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
                loadingText="Creating account…"
              >
                <UserPlus aria-hidden />
                Create account
              </Button>
            </form>

            <p className="mt-5 text-center text-xs text-ink-500">
              Already registered?{' '}
              <Link
                to="/login"
                className="font-medium text-brand-700 hover:text-brand-800"
              >
                Sign in
              </Link>
            </p>
          </div>

          <p className="mt-4 text-center text-2xs text-ink-500">
            Staff: sign in with the account prepared for you, then redeem your
            access code in onboarding.
          </p>
        </div>
      </main>
    </div>
  )
}
