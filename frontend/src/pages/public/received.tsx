import {
  CheckCircle2,
  ClipboardCopy,
  Mail,
  MapPin,
  Phone,
} from 'lucide-react'
import * as React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/format'
import type { Application } from '@/types/domain'

const NEXT_STEPS = [
  {
    title: 'We review every application',
    body: 'A member of the recruitment team reads your application against the requirements for the role.',
  },
  {
    title: 'Interview announcements',
    body: 'If you are invited to interview, the date, venue and instructions appear in your applicant portal and arrive by email and SMS.',
  },
  {
    title: 'A decision, and a reason',
    body: 'If you are shortlisted, you receive a confirmation message telling you exactly what to bring and when. If not, you are notified by email.',
  },
]

export function ApplicationReceivedPage() {
  const location = useLocation()
  const application = (location.state as { application?: Application } | null)
    ?.application

  const [copied, setCopied] = React.useState(false)

  async function copyNumber() {
    if (!application) return
    try {
      await navigator.clipboard.writeText(application.application_number)
      setCopied(true)
      toast.success('Application number copied')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the number and copy it manually.')
    }
  }

  if (!application) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
        <Card>
          <CardContent className="pt-8">
            <div className="flex flex-col items-center px-6 pb-10 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-success-50 text-success-600 ring-1 ring-success-100">
                <CheckCircle2 className="size-7" aria-hidden />
              </span>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink-900">
                Application received
              </h1>
              <p className="mt-2 max-w-md text-sm text-ink-500 text-balance">
                Your application has been submitted. Sign in to the applicant
                portal to see your application number and track your status.
              </p>
              <Link
                to="/applicant"
                className={buttonVariants({ size: 'lg', className: 'mt-6' })}
              >
                Go to applicant portal
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-success-50 text-success-600 ring-1 ring-success-100">
          <CheckCircle2 className="size-7" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
          Application received
        </h1>
        <p className="mt-2 max-w-md text-sm text-ink-500 text-balance">
          Thank you, {application.first_name}. We have your application for{' '}
          <span className="font-medium text-ink-700">
            {application.job_title ?? 'the role you applied for'}
          </span>
          . Keep your application number safe — it is your reference for every
          update.
        </p>
      </div>

      {/* -- Application number -- */}
      <Card className="mt-8">
        <CardContent className="pt-6">
          <p className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
            Your application number
          </p>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="flex-1 rounded-lg bg-ink-900 px-4 py-3 text-center font-mono text-lg font-semibold tracking-wider text-white tabular sm:text-left">
              {application.application_number}
            </code>
            <button
              type="button"
              onClick={copyNumber}
              className={buttonVariants({ variant: 'secondary' })}
            >
              {copied ? <CheckCircle2 /> : <ClipboardCopy />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <dl className="mt-5 grid gap-3 border-t border-ink-100 pt-5 text-sm sm:grid-cols-2">
            <Detail
              icon={Mail}
              label="Email sent to"
              value={application.email}
            />
            <Detail
              icon={Phone}
              label="Phone on file"
              value={application.phone}
            />
            <Detail
              icon={MapPin}
              label="Role"
              value={application.job_title ?? '—'}
            />
            <Detail
              icon={CheckCircle2}
              label="Submitted"
              value={formatDate(application.submitted_at)}
            />
          </dl>
        </CardContent>
      </Card>

      {/* -- What happens next -- */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>What happens next</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <ol className="space-y-4">
            {NEXT_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink-900">{step.title}</p>
                  <p className="mt-0.5 text-sm text-ink-500 text-balance">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="rounded-md bg-ink-50 px-3 py-2.5 text-xs text-ink-500">
            Submitted {formatDate(application.submitted_at, 'd MMMM yyyy, HH:mm')}.
            Review of your application usually takes up to five working days.
          </p>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link to="/applicant" className={buttonVariants({ size: 'lg' })}>
          Track my application
        </Link>
        <Link
          to="/"
          className={buttonVariants({ variant: 'outline', size: 'lg' })}
        >
          Browse other roles
        </Link>
      </div>
    </div>
  )
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
      <div className="min-w-0">
        <dt className="text-2xs tracking-wide text-ink-500 uppercase">
          {label}
        </dt>
        <dd className="truncate text-sm text-ink-800">{value}</dd>
      </div>
    </div>
  )
}
