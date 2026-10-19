import { KeyRound, ShieldCheck, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { ApplicationStatusBadge, EmploymentCategoryBadge } from '@/components/ui/status-badges'
import { cn } from '@/lib/cn'
import { formatDate, fullName, untilNow } from '@/lib/format'
import { accessCodes, applications, staffProfiles } from '@/mocks/seed'

/**
 * The hero collage.
 *
 * A stack of real product cards — an application, an access code, a Staff ID
 * — layered the way an agency site layers its floating panels. Every value
 * shown is taken from the seed data, so the collage is the product rather
 * than a picture of it.
 */
export function HeroCollage({ className }: { className?: string }) {
  const application = applications.find((item) => item.id === 'app-8')
  const code = accessCodes.find((item) => item.id === 'code-1')
  const staff = staffProfiles[0]

  if (!application || !code || !staff) return null

  return (
    <div className={cn('relative', className)}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {/* -- Application -- */}
        <Card
          className="sm:col-span-2 lg:col-start-1 lg:row-start-1 lg:col-span-1"
          delay
        >
          <div className="flex items-center justify-between gap-3">
            <Eyebrow icon={Sparkles}>Application received</Eyebrow>
            <ApplicationStatusBadge status={application.status} />
          </div>
          <p className="mt-3 text-base font-semibold text-ink-900">
            {fullName(application.first_name, application.last_name)}
          </p>
          <p className="text-xs text-ink-500">{application.job_title}</p>
          <p className="mt-3 font-mono text-sm font-semibold tracking-wider text-ink-900">
            {application.application_number}
          </p>
          <p className="mt-1 text-2xs text-ink-500">
            Issued {formatDate(application.submitted_at)}
          </p>
        </Card>

        {/* -- Access code -- */}
        <Card className="lg:col-start-2 lg:row-start-1 lg:mt-12">
          <Eyebrow icon={KeyRound}>Access code</Eyebrow>
          <p className="mt-3 font-mono text-lg font-semibold tracking-[0.2em] text-ink-900">
            ••••{code.code_hint}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <Badge variant="success" dot>
              Active
            </Badge>
            <span className="text-2xs text-ink-500">
              Expires {untilNow(code.expires_at)}
            </span>
          </div>
          <p className="mt-3 border-t border-ink-100 pt-2 text-2xs text-ink-500">
            Issued to {code.applicant_name}. Held only as a hash — the
            plaintext is shown once, at issue.
          </p>
        </Card>

        {/* -- Verified chip -- */}
        <div className="lg:col-start-1 lg:row-start-2 lg:-mt-8 lg:ml-6 lg:z-10">
          <div className="flex items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-4 py-3 shadow-lg">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-700 ring-1 ring-success-100">
              <ShieldCheck aria-hidden className="size-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-ink-900">
                Identity verified
              </p>
              <p className="text-2xs text-ink-500">Admin approved · audited</p>
            </div>
          </div>
        </div>

        {/* -- Staff ID -- */}
        <Card className="lg:col-start-2 lg:row-start-2">
          <Eyebrow icon={ShieldCheck}>Staff ID issued</Eyebrow>
          <p className="mt-3 font-mono text-base font-semibold tracking-wider text-ink-900">
            {staff.staff_id}
          </p>
          <p className="mt-1 text-xs text-ink-600">
            {fullName(staff.first_name, staff.last_name)} · {staff.position}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <EmploymentCategoryBadge category={staff.employment_category} />
            <span className="text-2xs text-ink-500">{staff.department_name}</span>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Card({
  className,
  children,
  delay = false,
}: {
  className?: string
  children: React.ReactNode
  delay?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-ink-200 bg-white p-4 shadow-lg',
        delay && 'lg:shadow-xl',
        className,
      )}
    >
      {children}
    </div>
  )
}

function Eyebrow({
  icon: Icon,
  children,
}: {
  icon: typeof Sparkles
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-1.5 text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-500 uppercase">
      <Icon aria-hidden className="size-3.5 text-brand-600" />
      {children}
    </span>
  )
}
