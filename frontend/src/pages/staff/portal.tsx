import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  IdCard,
  Landmark,
  LayoutDashboard,
  Lock,
  Mail,
  MapPin,
  Phone,
  ScrollText,
  ShieldCheck,
  UserRound,
  UserRoundCheck,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import {
  EmploymentCategoryBadge,
  StaffStatusBadge,
} from '@/components/ui/status-badges'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { staffApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import {
  formatBytes,
  formatDate,
  formatDateTime,
  fullName,
} from '@/lib/format'
import { useSession } from '@/providers/session-provider'
import type { StaffDocument, StaffStatus } from '@/types/domain'

const summaryToneStyles = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  success: 'bg-success-50 text-success-700 ring-success-100',
  warning: 'bg-warning-50 text-warning-700 ring-warning-100',
  info: 'bg-info-50 text-info-700 ring-info-100',
  neutral: 'bg-ink-100 text-ink-600 ring-ink-200',
} as const

export function StaffPortalPage() {
  const { session } = useSession()

  // The API scopes the record to the signed-in user; no id is passed.
  const staffQuery = useQuery({
    queryKey: ['staff', 'me'],
    queryFn: () => staffApi.me(),
    retry: false,
  })

  const staff = staffQuery.data?.staff
  const documents = staffQuery.data?.documents ?? []

  if (staffQuery.isLoading) return <Spinner />

  if (!staff) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={IdCard}
          title={
            session
              ? `${session.user.first_name} ${session.user.last_name}`
              : 'Staff portal'
          }
          description="Your staff record is not active yet."
        />
        <Card className="border-warning-100 bg-warning-50/60">
          <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning-100 ring-1 ring-warning-100">
                <AlertCircle className="size-5 text-warning-700" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  Complete your onboarding
                </p>
                <p className="mt-1 max-w-xl text-sm text-ink-600">
                  You have signed in, but your staff record has not been created
                  yet. Redeem the access code handed to you by the recruitment
                  team and submit your staff details to receive your Staff ID.
                </p>
              </div>
            </div>
            <Link
              to="/staff/onboarding"
              className={buttonVariants({ variant: 'primary' })}
            >
              Complete onboarding
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Staff dashboard"
        description={`Welcome back, ${staff.first_name}. Here is your current staff record, documents and onboarding status.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StaffSummaryCard
          icon={ShieldCheck}
          label="Employment status"
          value={titleCase(staff.status)}
          hint="Your current standing"
          tone={statusTone(staff.status)}
        />
        <StaffSummaryCard
          icon={IdCard}
          label="Staff ID"
          value={staff.staff_id ?? '—'}
          hint="Your employee number"
          tone="brand"
          mono
        />
        <StaffSummaryCard
          icon={Users}
          label="Department"
          value={staff.department_name ?? '—'}
          hint="Your current team"
          tone="info"
        />
        <StaffSummaryCard
          icon={FileText}
          label="Documents"
          value={documents.length}
          hint="Files on your record"
          tone="warning"
        />
      </div>

      {/* -- Identity summary -- */}
      <Card>
        <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar
            first={staff.first_name}
            last={staff.last_name}
            size="xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-ink-900">
                {fullName(staff.first_name, staff.last_name)}
              </h2>
              <StaffStatusBadge status={staff.status} />
              <EmploymentCategoryBadge
                category={staff.employment_category}
              />
            </div>
            <p className="mt-1 text-sm text-ink-600">
              {[staff.position, staff.department_name]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-600">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5 text-ink-400" aria-hidden />
                {staff.email}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5 text-ink-400" aria-hidden />
                {staff.phone}
              </span>
              {staff.location_name && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5 text-ink-400" aria-hidden />
                  {staff.location_name}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 rounded-lg bg-ink-50 px-4 py-3 ring-1 ring-ink-200 sm:text-right">
            <p className="text-2xs font-semibold tracking-wider text-ink-500 uppercase">
              Staff ID
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-ink-900">
              {staff.staff_id ?? '—'}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* -- Bio-data -- */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <CardDescription>
              Your bio-data as submitted during onboarding.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              <Detail
                icon={UserRound}
                label="Full name"
                value={`${staff.first_name} ${staff.last_name}`}
              />
              <Detail icon={Mail} label="Email" value={staff.email} />
              <Detail icon={Phone} label="Phone" value={staff.phone} />
              <Detail
                icon={UserRound}
                label="Gender"
                value={staff.gender ?? '—'}
              />
              <Detail
                icon={CalendarClock}
                label="Date of birth"
                value={formatDate(staff.date_of_birth)}
              />
              <Detail
                icon={MapPin}
                label="Location"
                value={staff.location_name ?? '—'}
              />
              <Detail
                icon={MapPin}
                label="Address"
                value={staff.address_line ?? '—'}
              />
            </dl>
          </CardContent>
        </Card>

        {/* -- Employment -- */}
        <Card>
          <CardHeader>
            <CardTitle>Employment</CardTitle>
            <CardDescription>Your role at Mobigate Group.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                  Position
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {staff.position ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                  Department
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {staff.department_name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                  Appointment date
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {formatDate(staff.appointment_date)}
                </dd>
              </div>
              <div>
                <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                  Employment category
                </dt>
                <dd className="mt-1">
                  <EmploymentCategoryBadge
                    category={staff.employment_category}
                  />
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* -- Documents -- */}
      <Card id="documents" className="overflow-hidden">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>My documents</CardTitle>
              <CardDescription>
                Supporting documents held against your staff record.
              </CardDescription>
            </div>
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-2xs font-semibold text-ink-600 tabular">
              {documents.length}
            </span>
          </div>
        </CardHeader>
        {documents.length === 0 ? (
          <CardContent>
            <p className="text-sm text-ink-500">
              No documents have been uploaded against your record yet.
            </p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((document) => (
                <DocumentTableRow key={document.id} document={document} />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* -- Confidential sections -- */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 ring-1 ring-ink-200">
              <Lock className="size-4.5 text-ink-600" aria-hidden />
            </span>
            <div>
              <CardTitle>Confidential records</CardTitle>
              <CardDescription>
                Confidential — visible only to you and administrators. These
                details are never shown to colleagues, and are excluded from
                staff lists and exports.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <section>
            <h3 className="flex items-center gap-1.5 text-2xs font-semibold tracking-wider text-ink-500 uppercase">
              <Landmark className="size-3.5" aria-hidden />
              Bank details
            </h3>
            <dl className="mt-3 space-y-3">
              <div>
                <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                  Bank
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {staff.bank_name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                  Account name
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {staff.bank_account_name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                  Account number
                </dt>
                <dd className="mt-0.5 font-mono text-sm text-ink-900">
                  {staff.bank_account_number ?? '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 text-2xs font-semibold tracking-wider text-ink-500 uppercase">
              <UserRoundCheck className="size-3.5" aria-hidden />
              Guarantor
            </h3>
            <dl className="mt-3 space-y-3">
              <div>
                <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                  Name
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {staff.guarantor_name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                  Relationship
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {staff.guarantor_relationship ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                  Phone
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {staff.guarantor_phone ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                  Address
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {staff.guarantor_address ?? '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 text-2xs font-semibold tracking-wider text-ink-500 uppercase">
              <Users className="size-3.5" aria-hidden />
              Next of kin
            </h3>
            <dl className="mt-3 space-y-3">
              <div>
                <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                  Name
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {staff.next_of_kin_name ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                  Relationship
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {staff.next_of_kin_relationship ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-2xs tracking-wide text-ink-500 uppercase">
                  Phone
                </dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {staff.next_of_kin_phone ?? '—'}
                </dd>
              </div>
            </dl>
          </section>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* -- Rules of engagement -- */}
        <Card>
          <CardHeader>
            <CardTitle>Rules of engagement</CardTitle>
            <CardDescription>
              The Group code of conduct, signed on appointment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={cn(
                'flex items-start gap-3 rounded-lg px-3.5 py-3',
                staff.rules_of_engagement_accepted_at
                  ? 'bg-success-50 ring-1 ring-success-100'
                  : 'bg-warning-50 ring-1 ring-warning-100',
              )}
            >
              {staff.rules_of_engagement_accepted_at ? (
                <CheckCircle2
                  className="mt-0.5 size-5 shrink-0 text-success-700"
                  aria-hidden
                />
              ) : (
                <AlertCircle
                  className="mt-0.5 size-5 shrink-0 text-warning-700"
                  aria-hidden
                />
              )}
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  {staff.rules_of_engagement_accepted_at
                    ? 'Acknowledged'
                    : 'Not yet acknowledged'}
                </p>
                <p className="mt-0.5 text-sm text-ink-600">
                  {staff.rules_of_engagement_accepted_at
                    ? `Accepted on ${formatDateTime(staff.rules_of_engagement_accepted_at)}.`
                    : 'You have not yet acknowledged the rules of engagement.'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg bg-ink-50 px-3 py-2.5">
              <ScrollText
                className="mt-0.5 size-4 shrink-0 text-ink-400"
                aria-hidden
              />
              <p className="text-xs text-ink-600">
                The rules of engagement cover confidentiality, data protection,
                conflicts of interest and the handling of personnel records.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Need to update your record?</CardTitle>
            <CardDescription>
              Bio-data corrections are made by Human Resources.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 ring-1 ring-brand-100">
                <ShieldCheck className="size-4.5 text-brand-700" aria-hidden />
              </span>
              <p className="text-sm text-ink-600">
                Send your Staff ID and the details to correct to the HR team.
                Your record cannot be edited directly from this portal.
              </p>
            </div>
            <Link to="/" className={buttonVariants({ variant: 'outline' })}>
              <Briefcase aria-hidden />
              Mobigate Group
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function statusTone(status: StaffStatus) {
  if (status === 'active') return 'success'
  if (status === 'suspended') return 'warning'
  return 'neutral'
}

function StaffSummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  mono,
}: {
  icon: typeof UserRound
  label: string
  value: ReactNode
  hint: string
  tone: keyof typeof summaryToneStyles
  mono?: boolean
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-600">{label}</p>
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg ring-1',
            summaryToneStyles[tone],
          )}
        >
          <Icon className="size-4.5" aria-hidden />
        </span>
      </div>
      <p
        className={cn(
          'mt-4 text-2xl font-semibold tracking-tight break-words text-ink-950 tabular',
          mono && 'font-mono text-xl',
        )}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-ink-500">{hint}</p>
    </div>
  )
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound
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
        <dd className="text-sm break-words text-ink-900">{value}</dd>
      </div>
    </div>
  )
}

/**
 * One document row. The list only carries metadata; the file itself is
 * fetched on demand through a short-lived signed URL.
 */
function DocumentTableRow({ document }: { document: StaffDocument }) {
  const [opening, setOpening] = useState(false)

  async function open() {
    setOpening(true)
    try {
      const { url } = await staffApi.documentURL(document.id)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      toast.error('The document could not be opened. Please try again.')
    } finally {
      setOpening(false)
    }
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 ring-1 ring-ink-200">
            <FileText className="size-4.5 text-ink-600" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-900">
              {document.file_name}
            </p>
            <p className="text-xs text-ink-500">{document.mime_type}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="capitalize">
        {document.category.replaceAll('_', ' ')}
      </TableCell>
      <TableCell className="whitespace-nowrap text-ink-600">
        {formatBytes(document.size_bytes)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-ink-600">
        {formatDate(document.created_at)}
      </TableCell>
      <TableCell className="text-right">
        <button
          type="button"
          onClick={() => void open()}
          disabled={opening}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-60"
          aria-label={`Open ${document.file_name}`}
        >
          <Download className="size-3.5" aria-hidden />
          {opening ? 'Opening…' : 'Open'}
        </button>
      </TableCell>
    </TableRow>
  )
}
