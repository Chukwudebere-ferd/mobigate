import {
  ArrowRight,
  ClipboardCheck,
  Copy,
  FileCheck,
  Hourglass,
  MapPin,
  Megaphone,
  Search,
  UserCheck,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/format'
import type { Application } from '@/types/domain'

const NEXT_STEPS = [
  {
    title: 'Application received',
    description:
      'Your application is logged against the role and assigned an application number.',
    icon: ClipboardCheck,
    state: 'Complete',
  },
  {
    title: 'Document review',
    description:
      'The recruitment team checks your qualifications, CV and supporting documents.',
    icon: FileCheck,
    state: 'In progress',
  },
  {
    title: 'Interview announcement',
    description:
      'Shortlisted candidates receive an interview invitation with the date, venue and instructions.',
    icon: Megaphone,
    state: 'Upcoming',
  },
  {
    title: 'Shortlist decision',
    description:
      'Once interviews are done, the final shortlist is confirmed and appointments are made.',
    icon: UserCheck,
    state: 'Upcoming',
  },
]

interface ReceivedState {
  application?: Application
}

export function ApplicationReceivedPage() {
  const location = useLocation()
  const [copied, setCopied] = useState(false)
  const state = location.state as ReceivedState | null
  const application = state?.application

  const applicationNumber = application?.application_number
  const jobTitle = application?.job_title ?? 'the role'

  const copyNumber = async () => {
    if (!applicationNumber) return
    try {
      await navigator.clipboard.writeText(applicationNumber)
      setCopied(true)
      toast.success('Copied')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy the application number')
    }
  }

  return (
    <div className="bg-ink-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        {/* -- Success header -- */}
        <div className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-50 ring-1 ring-success-100">
            <ClipboardCheck aria-hidden className="size-7 text-success-600" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
            Application received
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-ink-600">
            Thank you for applying for{' '}
            <span className="font-medium text-ink-800">{jobTitle}</span>. We
            have logged your application and the recruitment team will review
            it.
          </p>
        </div>

        {/* -- Application number -- */}
        {applicationNumber ? (
          <Card className="mt-8">
            <CardContent className="p-5 sm:p-6">
              <p className="text-2xs font-semibold tracking-wider text-ink-400 uppercase">
                Application number
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="rounded-lg bg-ink-900 px-4 py-3 font-mono text-lg font-semibold tracking-wider text-white tabular sm:text-xl">
                  {applicationNumber}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={copyNumber}
                  aria-label="Copy application number to clipboard"
                >
                  {copied ? (
                    <FileCheck aria-hidden className="text-success-600" />
                  ) : (
                    <Copy aria-hidden />
                  )}
                  {copied ? 'Copied' : 'Copy number'}
                </Button>
              </div>
              <p className="mt-3 flex gap-2 text-xs text-ink-500">
                <MapPin aria-hidden className="size-4 shrink-0 text-ink-400" />
                <span>
                  Keep this number safe — you can use it to track the status of
                  your application in the applicant portal, and we quote it in
                  any interview invitation.
                </span>
              </p>
              {application?.submitted_at ? (
                <p className="mt-2 flex gap-2 text-xs text-ink-500">
                  <Hourglass aria-hidden className="size-4 shrink-0 text-ink-400" />
                  <span>
                    Submitted on{' '}
                    {formatDateTime(application.submitted_at)}
                  </span>
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-8">
            <CardContent className="p-5 sm:p-6">
              <p className="text-sm text-ink-600">
                Your application was submitted successfully, but we could not
                retrieve the application number from this session. You will
                receive it by email, and you can also look it up in the
                applicant portal.
              </p>
            </CardContent>
          </Card>
        )}

        {/* -- What happens next -- */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>What happens next</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-5">
              {NEXT_STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                      {index + 1}
                    </span>
                    {index < NEXT_STEPS.length - 1 ? (
                      <span
                        aria-hidden
                        className="mt-1 w-px flex-1 bg-ink-200"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-ink-900">
                        {step.title}
                      </p>
                      <span
                        className={
                          index === 0
                            ? 'inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-2xs font-medium text-success-700 ring-1 ring-success-100'
                            : 'inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-2xs font-medium text-ink-600 ring-1 ring-ink-200'
                        }
                      >
                        {index === 0 ? (
                          <FileCheck aria-hidden className="size-3" />
                        ) : (
                          <step.icon aria-hidden className="size-3" />
                        )}
                        {step.state}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-600">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* -- CTAs -- */}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link to="/applicant" className={buttonVariants({ size: 'lg' })}>
            <Search aria-hidden />
            Track my application
          </Link>
          <Link
            to="/"
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            Browse other roles
            <ArrowRight aria-hidden />
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-ink-500">
          Keep this page open, or use your application number in the applicant
          portal to check progress at any time.
        </p>
      </div>
    </div>
  )
}
