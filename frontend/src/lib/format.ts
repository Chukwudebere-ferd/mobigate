import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'

/**
 * Formatting helpers. Nigerian locale with explicit fallbacks so dates never
 * render as "Invalid Date" when a field is null.
 */

export function formatDate(value?: string | null, pattern = 'd MMM yyyy'): string {
  if (!value) return '—'
  try {
    return format(parseISO(value), pattern)
  } catch {
    return '—'
  }
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'd MMM yyyy, HH:mm')
  } catch {
    return '—'
  }
}

export function formatTime(value?: string | null): string {
  if (!value) return '—'
  try {
    return format(parseISO(value), 'HH:mm')
  } catch {
    return '—'
  }
}

export function relativeTime(value?: string | null): string {
  if (!value) return '—'
  try {
    return `${formatDistanceToNowStrict(parseISO(value))} ago`
  } catch {
    return '—'
  }
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** Integer kobo to a Nigerian naira string, e.g. 25000000 -> ₦250,000.00. */
export function formatNairaFromKobo(kobo: number): string {
  if (!Number.isFinite(kobo)) return '—'
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(kobo / 100)
}

export function formatMonthYear(month: number, year: number): string {
  const name = MONTH_NAMES[month - 1]
  return name ? `${name} ${year}` : '—'
}

/** "in 4 days" / "3 hours ago" for upcoming and past timestamps. */
export function untilNow(value?: string | null): string {
  if (!value) return '—'
  try {
    const diff = formatDistanceToNowStrict(parseISO(value))
    return diff.includes('ago') ? diff : `in ${diff}`
  } catch {
    return '—'
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function initials(first?: string | null, last?: string | null): string {
  const a = first?.trim()?.[0] ?? ''
  const b = last?.trim()?.[0] ?? ''
  return (a + b).toUpperCase() || '?'
}

export function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ') || '—'
}

/** Title-cases a snake_case enum for display. */
export function humanize(value?: string | null): string {
  if (!value) return '—'
  const s = value.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`
}
