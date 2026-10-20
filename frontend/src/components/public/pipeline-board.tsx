import { CalendarCheck, FileText, KeyRound, ShieldCheck } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { ApplicationStatusBadge } from '@/components/ui/status-badges'
import { cn } from '@/lib/cn'
import { formatTime, fullName } from '@/lib/format'
import {
  accessCodes,
  applications,
  interviews,
  shortlists,
  staffProfiles,
} from '@/mocks/seed'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const

type BlockTone = 'brand' | 'info' | 'accent' | 'warning' | 'success' | 'deep'

interface BoardBlock {
  id: string
  day: number
  title: string
  meta?: string
  tone: BlockTone
  /** Placement inside the day grid (percentages of the board width). */
  left: string
  width: string
  top: string
  /** Delay for the staggered pop-in. */
  delay: string
}

export function PipelineBoard({ className }: { className?: string }) {
  const queue = applications.slice(0, 3)
  const interview = interviews.find((item) => item.id === 'int-1')
  const shortlist = shortlists.find((item) => item.id === 'sl-1')
  const appointed = applications.find((item) => item.status === 'appointed')
  const code = accessCodes.find((item) => item.id === 'code-1')
  const staff = staffProfiles[0]

  const blocks: BoardBlock[] = []

  if (interview) {
    blocks.push({
      id: 'interview',
      day: 0,
      title: `${interview.job_title ?? 'Interview'} screening`,
      meta: '09:00 - 10:00',
      tone: 'brand',
      left: '2%',
      width: '17%',
      top: '4%',
      delay: '300ms',
    })
  }

  if (shortlist) {
    blocks.push({
      id: 'shortlist',
      day: 2,
      title: shortlist.applicant_name ?? 'Shortlist & requirements',
      meta: `Shortlisted · ${formatTime(interview?.interview_at)}`,
      tone: 'deep',
      left: '42%',
      width: '22%',
      top: '6%',
      delay: '700ms',
    })
  }

  blocks.push({
    id: 'review',
    day: 1,
    title: 'CV review & analysis',
    meta: '13:00 - 14:30',
    tone: 'info',
    left: '23%',
    width: '17%',
    top: '34%',
    delay: '500ms',
  })

  if (code) {
    blocks.push({
      id: 'code',
      day: 3,
      title: 'Access code issued',
      meta: `•••• ${code.code_hint}`,
      tone: 'accent',
      left: '67%',
      width: '15%',
      top: '12%',
      delay: '900ms',
    })
  }

  if (appointed) {
    blocks.push({
      id: 'appointed',
      day: 3,
      title: fullName(appointed.first_name, appointed.last_name),
      meta: '14:00 - 15:30',
      tone: 'warning',
      left: '67%',
      width: '15%',
      top: '62%',
      delay: '1100ms',
    })
  }

  if (staff) {
    blocks.push({
      id: 'staff',
      day: 4,
      title: 'Staff ID allocated',
      meta: staff.staff_id,
      tone: 'deep',
      left: '85%',
      width: '14%',
      top: '42%',
      delay: '1300ms',
    })
    blocks.push({
      id: 'verified',
      day: 4,
      title: 'Verified & audited',
      meta: 'On record',
      tone: 'success',
      left: '85%',
      width: '14%',
      top: '74%',
      delay: '1500ms',
    })
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-xl',
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-ink-200 bg-ink-50 px-4 py-2.5">
        <span className="flex shrink-0 gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-ink-300" />
          <span className="size-2.5 rounded-full bg-ink-300" />
          <span className="size-2.5 rounded-full bg-ink-300" />
        </span>
        <span className="truncate font-mono text-2xs text-ink-500">
          Hiring pipeline · this week
        </span>
        <span className="ml-auto hidden items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-2xs font-medium text-success-700 ring-1 ring-success-100 ring-inset sm:inline-flex">
          <span className="size-1.5 animate-pulse rounded-full bg-success-500" />
          Live
        </span>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="w-full shrink-0 border-b border-ink-200 bg-ink-50/50 p-3 lg:w-60 lg:border-r lg:border-b-0">
          <p className="px-1 text-2xs font-semibold tracking-wider text-ink-500 uppercase">
            Applicant queue
          </p>
          <ul className="mt-2 space-y-2">
            {queue.map((item, index) => (
              <li
                key={item.id}
                className="animate-board-pop rounded-xl border border-ink-200 bg-white p-3 shadow-xs motion-reduce:animate-none"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <div className="flex items-center gap-2">
                  <span className="flex -space-x-1.5" aria-hidden>
                    <Avatar first={item.first_name} last={item.last_name} size="xs" />
                    <Avatar first="Aisha" last="Adeyemi" size="xs" />
                  </span>
                  <ApplicationStatusBadge status={item.status} />
                </div>
                <p className="mt-2 text-xs font-semibold text-ink-900">
                  {fullName(item.first_name, item.last_name)}
                </p>
                <p className="truncate text-2xs text-ink-500">{item.job_title}</p>
                <p className="mt-1 font-mono text-2xs font-medium text-ink-700">
                  {item.application_number}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative min-w-0 flex-1 overflow-x-auto">
          {/* The drift slides the board left by 64px, so the board is given
              64px of extra width to guarantee it always covers the viewport
              and never exposes an empty edge. Drift is desktop-only: on small
              screens the board is a stacked agenda, and a sideways animation
              would fight the scroll container. */}
          <div className="sm:min-w-[720px] lg:w-[calc(100%+4rem)] lg:animate-board-drift lg:motion-reduce:animate-none">
            <div className="hidden grid-cols-5 border-b border-ink-200 bg-white sm:grid">
              {DAYS.map((day, index) => (
                <div
                  key={day}
                  className={cn(
                    'px-3 py-2.5',
                    index > 0 && 'border-l border-ink-100',
                    day === 'Wednesday' && 'bg-brand-50/60',
                  )}
                >
                  <p
                    className={cn(
                      'text-xs font-semibold',
                      day === 'Wednesday' ? 'text-brand-700' : 'text-ink-900',
                    )}
                  >
                    {day}
                  </p>
                  <p className="text-2xs text-ink-500">
                    {blocks.filter((b) => b.day === index).length} events
                  </p>
                </div>
              ))}
            </div>
            <BoardGrid blocks={blocks} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** Per-tone surface for a board block: edge colour, border and text. */
const TONE_STYLES: Record<
  BlockTone,
  { surface: string; edge: string; icon: typeof CalendarCheck }
> = {
  brand: {
    surface: 'border-brand-200 bg-white',
    edge: 'border-l-brand-600',
    icon: CalendarCheck,
  },
  info: {
    surface: 'border-ink-200 bg-white',
    edge: 'border-l-info-600',
    icon: FileText,
  },
  accent: {
    surface: 'border-accent-200 bg-white',
    edge: 'border-l-accent-500',
    icon: KeyRound,
  },
  warning: {
    surface: 'border-ink-200 bg-white',
    edge: 'border-l-warning-500',
    icon: CalendarCheck,
  },
  success: {
    surface: 'border-success-700 bg-success-600 text-white',
    edge: 'border-l-success-900',
    icon: ShieldCheck,
  },
  deep: {
    surface: 'border-brand-700 bg-brand-700 text-white',
    edge: 'border-l-brand-900',
    icon: ShieldCheck,
  },
}

function BoardGrid({ blocks }: { blocks: BoardBlock[] }) {
  const byDay = DAYS.map((day, index) => ({
    day,
    items: blocks.filter((block) => block.day === index),
  }))

  return (
    <>
      {/* -- Mobile: a stacked agenda, one group per day ---------------- */}
      <div className="divide-y divide-ink-200 sm:hidden">
        {byDay.map(({ day, items }) => (
          <div key={day} className="px-4 py-3">
            <p
              className={cn(
                'text-2xs font-semibold tracking-wider uppercase',
                day === 'Wednesday' ? 'text-brand-700' : 'text-ink-500',
              )}
            >
              {day}
            </p>
            {items.length === 0 ? (
              <p className="mt-1 text-2xs text-ink-400">No events scheduled</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {items.map((block) => {
                  const tone = TONE_STYLES[block.tone]
                  const Icon = tone.icon
                  const onDark = block.tone === 'success' || block.tone === 'deep'

                  return (
                    <li
                      key={block.id}
                      className={cn(
                        'animate-board-pop rounded-lg border border-l-4 p-3 motion-reduce:animate-none',
                        tone.surface,
                        tone.edge,
                        onDark ? 'shadow-lg' : 'shadow-sm',
                      )}
                      style={{ animationDelay: block.delay }}
                    >
                      <p
                        className={cn(
                          'flex items-center gap-1.5 text-xs font-semibold',
                          onDark ? 'text-white' : 'text-ink-900',
                        )}
                      >
                        <Icon
                          aria-hidden
                          className={cn(
                            'size-3.5 shrink-0',
                            onDark ? 'text-white/80' : 'text-ink-400',
                          )}
                        />
                        {block.title}
                      </p>
                      {block.meta ? (
                        <p
                          className={cn(
                            'mt-1 font-mono text-2xs',
                            onDark ? 'text-white/75' : 'text-ink-500',
                          )}
                        >
                          {block.meta}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* -- Desktop: the week board ------------------------------------ */}
      <div className="relative hidden min-h-[400px] bg-[linear-gradient(to_bottom,var(--color-ink-100)_1px,transparent_1px)] bg-[size:100%_48px] sm:block">
      {/* -- Day column rules -- */}
      <div aria-hidden className="absolute inset-0 grid grid-cols-5">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className={cn(index > 0 && 'border-l border-ink-100')} />
        ))}
      </div>

      {/* -- Sweeping "now" line -- */}
      <div
        aria-hidden
        className="animate-now-line absolute right-4 left-4 h-px bg-danger-500/70 motion-reduce:animate-none"
      >
        <span className="absolute -top-1 left-0 size-2 -translate-x-1/2 rounded-full bg-danger-500" />
      </div>

      {/* -- Event blocks -- */}
      {blocks.map((block) => {
        const tone = TONE_STYLES[block.tone]
        const Icon = tone.icon
        const onDark = block.tone === 'success' || block.tone === 'deep'

        return (
          <div
            key={block.id}
            className={cn(
              'animate-board-pop absolute rounded-lg border border-l-4 p-2.5 shadow-md motion-reduce:animate-none',
              tone.surface,
              tone.edge,
              onDark ? 'shadow-lg' : '',
            )}
            style={{
              left: block.left,
              width: block.width,
              top: block.top,
              animationDelay: block.delay,
            }}
          >
            <p
              className={cn(
                'flex items-center gap-1 text-2xs font-semibold',
                onDark ? 'text-white' : 'text-ink-900',
              )}
            >
              <Icon
                aria-hidden
                className={cn(
                  'size-3 shrink-0',
                  onDark ? 'text-white/80' : 'text-ink-400',
                )}
              />
              <span className="truncate">{block.title}</span>
            </p>
            {block.meta ? (
              <p
                className={cn(
                  'mt-0.5 truncate font-mono text-2xs',
                  onDark ? 'text-white/75' : 'text-ink-500',
                )}
              >
                {block.meta}
              </p>
            ) : null}
          </div>
        )
      })}
      </div>
    </>
  )
}

