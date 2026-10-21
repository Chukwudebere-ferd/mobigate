import { ArrowLeft, Eye, EyeOff, KeyRound, MailCheck } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'

/**
 * Password reset for every Better Auth account, including applicants and
 * administrators. Better Auth owns the token; SendLiberty delivers the link.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const { authClient } = await import('@/lib/auth-client')
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (result.error) {
        setError(result.error.message ?? 'We could not send the reset email.')
        return
      }
      setSent(true)
    } catch {
      setError('Unable to send a reset email right now. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPageShell
      title="Reset your password"
      subtitle="Enter the email address on your Mobigate account and we will send you a reset link."
    >
      {sent ? (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-success-200 bg-success-50 p-4 text-sm text-success-800">
            <MailCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>
              If an account exists for that email, a reset link is on its way.
              The link expires in one hour.
            </p>
          </div>
          <Link to="/login" className="block">
            <Button variant="outline" className="w-full">
              Back to sign in
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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
            loadingText="Sending…"
          >
            <MailCheck aria-hidden />
            Send reset link
          </Button>
        </form>
      )}
    </AuthPageShell>
  )
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [complete, setComplete] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.')
      return
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.')
      return
    }
    if (!token) {
      setError('This reset link is missing a token. Request a new one.')
      return
    }

    setSubmitting(true)
    try {
      const { authClient } = await import('@/lib/auth-client')
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      })

      if (result.error) {
        setError(
          result.error.message ??
            'This reset link is invalid or has expired. Request a new one.',
        )
        return
      }
      setComplete(true)
    } catch {
      setError('Unable to reset your password right now. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <AuthPageShell
        title="Reset link unavailable"
        subtitle="This link is missing its reset token, or it was copied incompletely."
      >
        <Link to="/forgot-password">
          <Button className="w-full">Request a new link</Button>
        </Link>
      </AuthPageShell>
    )
  }

  if (complete) {
    return (
      <AuthPageShell
        title="Password updated"
        subtitle="Your new password is ready. Sign in to continue."
      >
        <Button className="w-full" onClick={() => navigate('/login')}>
          Go to sign in
        </Button>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell
      title="Choose a new password"
      subtitle="Use at least 8 characters. Your reset link can only be used once."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="New password" htmlFor="password" required>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={submitting}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
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

        <Field label="Confirm password" htmlFor="confirm_password" required>
          <Input
            id="confirm_password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            disabled={submitting}
          />
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
          loadingText="Updating…"
        >
          <KeyRound aria-hidden />
          Set new password
        </Button>
      </form>
    </AuthPageShell>
  )
}

function AuthPageShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
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
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>
          <p className="mt-4 text-center text-2xs text-ink-500">
            Need help? Contact your Mobigate administrator.
          </p>
        </div>
      </main>
    </div>
  )
}
