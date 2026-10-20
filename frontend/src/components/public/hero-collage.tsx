import { CalendarCheck, KeyRound, MessageSquareText, ShieldCheck, Sparkles } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ApplicationStatusBadge, EmploymentCategoryBadge } from '@/components/ui/status-badges'
import { cn } from '@/lib/cn'
import { formatDate, formatTime, fullName, untilNow } from '@/lib/format'
import { accessCodes, applications, interviews, shortlists, staffProfiles } from '@/mocks/seed'

/**
 * Floating orbit around the landing hero.
 *
 * Four applicant avatars at the frame corners with small cursor arrows,
 * like the contract-management reference: real people from the seed data,
 * brand ring, gentle float. Decorative only (aria-hidden) — the same
 * records render as data in the static cards below on mobile.
 */
export function HeroCollage({ className }: { className?: string }) {
  const shortlist = shortlists.find((item) => item.id === 'sl-1')
  const interview = interviews.find((item) => item.id === 'int-1')
  const application = applications.find((item) => item.id === 'app-2')
  const code = accessCodes.find((item) => item.id === 'code-1')
  const staff = staffProfiles[0]

  if (!shortlist || !interview || !application || !code || !staff) return null

  const people = [
    { first: 'Ngozi', last: 'Obi' },
    { first: 'Tunde', last: 'Adebisi' },
    { first: 'Aisha', last: 'Bello' },
    { first: 'Sadiq', last: 'Yusuf' },
  ]

  return (
    <div className={cn('relative', className)}>
      {/* -- Desktop: avatar orbit at the frame corners -- */}
      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
        {people.map((person, index) => (
          <OrbitAvatar
            key={`${person.first}-${person.last}`}
            first={person.first}
            last={person.last}
            position={index}
          />
        ))}
      </div>

      {/* -- Mobile / tablet: static data cards under the copy -- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
        <ShortlistNote message={shortlist.message} applicant={shortlist.applicant_name ?? ''} />
        <InterviewCard
          job={interview.job_title ?? ''}
          venue={interview.venue}
          date={formatDate(interview.interview_at)}
          time={formatTime(interview.interview_at)}
        />
        <ApplicationCard
          name={fullName(application.first_name, application.last_name)}
          job={application.job_title ?? ''}
          number={application.application_number}
          status={application.status}
        />
        <StaffCard
          staffId={staff.staff_id}
          name={fullName(staff.first_name, staff.last_name)}
          position={staff.position ?? ''}
          codeHint={code.code_hint}
          expires={untilNow(code.expires_at)}
        />
      </div>
    </div>
  )
}

/** One corner avatar with a small cursor arrow, gently floating. */
function OrbitAvatar({
  first,
  last,
  position,
}: {
  first: string
  last: string
  position: number
}) {
  const corners = [
    'top-10 left-10',
    'top-8 right-12',
    'bottom-16 left-16',
    'right-14 bottom-14',
  ]
  const delays = ['0.2s', '1.1s', '1.9s', '2.7s']
  const arrowSide = position % 2 === 0 ? '-right-3' : '-left-3'

  return (
    <div
      className={`animate-float absolute ${corners[position % corners.length]} motion-reduce:animate-none`}
      style={{ animationDelay: delays[position % delays.length] }}
    >
      <div className="relative">
        <span className="block rounded-full bg-white p-1 shadow-lg ring-1 ring-ink-200">
          <Avatar first={first} last={last} size="lg" />
        </span>
        <svg
          aria-hidden
          viewBox="0 0 12 12"
          className={`absolute top-1/2 ${arrowSide} size-3 -translate-y-1/2 text-ink-800`}
          fill="currentColor"
        >
          <path d="M2 1.5 10 6 2 10.5Z" />
        </svg>
      </div>
    </div>
  )
}

function Frame({
  className,
  children,
  label,
}: {
  className?: string
  children: React.ReactNode
  label: string
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        'rounded-xl border border-ink-200 bg-white p-4 text-left shadow-xl transition-transform duration-300 hover:-translate-y-1',
        className,
      )}
    >
      {children}
    </div>
  )
}

function ShortlistNote({ message, applicant }: { message: string; applicant: string }) {
  const short = message.length > 120 ? `${message.slice(0, 120).trimEnd()}…` : message
  return (
    <Frame
      label={`Shortlist confirmation message for ${applicant}`}
      className="border-accent-200 bg-accent-50"
    >
      <Eyebrow icon={MessageSquareText}>Shortlist message</Eyebrow>
      <p className="mt-2 text-xs leading-relaxed text-ink-800 italic">“{short}”</p>
      <p className="mt-2 text-2xs font-medium text-ink-500">Stored verbatim · {applicant}</p>
    </Frame>
  )
}

function InterviewCard({
  job,
  venue,
  date,
  time,
}: {
  job: string
  venue: string
  date: string
  time: string
}) {
  return (
    <Frame label={`Interview reminder for ${job}`}>
      <Eyebrow icon={CalendarCheck}>Reminders</Eyebrow>
      <p className="mt-2 text-sm font-semibold text-ink-900">{job} interview</p>
      <p className="text-2xs text-ink-500">{venue}</p>
      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-2xs font-medium text-brand-700 ring-1 ring-brand-100 ring-inset">
        {date} · {time}
      </p>
    </Frame>
  )
}

function ApplicationCard({
  name,
  job,
  number,
  status,
}: {
  name: string
  job: string
  number: string
  status: 'pending' | 'shortlisted' | 'rejected' | 'appointed' | 'withdrawn'
}) {
  return (
    <Frame label={`Application ${number} for ${name}`}>
      <div className="flex items-center justify-between gap-2">
        <Eyebrow icon={Sparkles}>Today's applications</Eyebrow>
        <ApplicationStatusBadge status={status} />
      </div>
      <p className="mt-2 text-sm font-semibold text-ink-900">{name}</p>
      <p className="text-2xs text-ink-500">{job}</p>
      <p className="mt-2 font-mono text-xs font-semibold tracking-wider text-ink-900">{number}</p>
    </Frame>
  )
}

function StaffCard({
  staffId,
  name,
  position,
  codeHint,
  expires,
}: {
  staffId: string
  name: string
  position: string
  codeHint: string
  expires: string
}) {
  const staff = staffProfiles[0]
  return (
    <Frame label={`Staff ID ${staffId} for ${name}`}>
      <Eyebrow icon={ShieldCheck}>Staff ID issued</Eyebrow>
      <p className="mt-2 font-mono text-sm font-semibold tracking-wider text-ink-900">{staffId}</p>
      <p className="mt-0.5 text-2xs text-ink-600">
        {name} · {position}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-2">
        {staff ? <EmploymentCategoryBadge category={staff.employment_category} /> : null}
        <Badge variant="success" dot>
          <KeyRound aria-hidden className="size-3" />
          ••••{codeHint}
        </Badge>
        <span className="text-2xs text-ink-500">Expires {expires}</span>
      </div>
    </Frame>
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
