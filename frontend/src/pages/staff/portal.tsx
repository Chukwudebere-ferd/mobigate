import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  FileText,
  IdCard,
  Landmark,
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
import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState, Spinner } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import {
  EmploymentCategoryBadge,
  StaffStatusBadge,
} from '@/components/ui/status-badges'
import { adminApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatBytes, formatDate, formatDateTime } from '@/lib/format'
import { useSession } from '@/providers/session-provider'
import type { Document, StaffProfile } from '@/types/domain'

export function StaffPortalPage() {
  const { session } = useSession()
  const staffId = session?.user.staff_id

  const staffQuery = useQuery({
    queryKey: ['staff', 'me', staffId],
    queryFn: async () => {
      const result = await adminApi.listStaff({
        search: staffId,
        per_page: 10,
      })
      return result.items.find((s) => s.staff_id === staffId) ?? null
    },
    enabled: Boolean(staffId),
  })

  const applicationQuery = useQuery({
    queryKey: ['staff', 'my-application', staffQuery.data?.application_id],
    queryFn: () => adminApi.getApplication(staffQuery.data?.application_id ?? ''),
    enabled: Boolean(staffQuery.data?.application_id),
  })

  if (!staffId) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={IdCard}
          title={session ? `${session.user.first_name} ${session.user.last_name}` : 'Staff portal'}
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
                  yet. Redeem the access code sent to you by the recruitment
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

  if (staffQuery.isLoading) return <Spinner />

  const staff = staffQuery.data

  if (!staff) {
    return (
      <Card>
        <EmptyState
          icon={IdCard}
          title="No staff record found"
          description={`We could not find a staff record for ${staffId}. If you have just been appointed, redeem your access code to complete onboarding.`}
          action={
            <Link to="/staff/onboarding" className={buttonVariants({})}>
              Complete onboarding
            </Link>
          }
        />
      </Card>
    )
  }

  const documents = documentsFor(staff, applicationQuery.data)

  return (
    <div className="space-y-6">
      <PageHeader
        icon={IdCard}
        title={`${staff.first_name} ${staff.last_name}`}
        description="Your staff record as held by the Mobigate Group Human Resources department."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {staff.staff_id && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-ink-100 px-2.5 py-1.5 font-mono text-sm font-semibold text-ink-800 ring-1 ring-ink-200">
                {staff.staff_id}
              </span>
            )}
            <StaffStatusBadge status={staff.status} />
          </div>
        }
      />

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
        {/* -- Documents -- */}
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              Supporting documents held against your staff record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-sm text-ink-500">
                No documents have been uploaded against your record yet.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {documents.map((document) => (
                  <li
                    key={document.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 ring-1 ring-ink-200">
                      <FileText
                        className="size-4.5 text-ink-600"
                        aria-hidden
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {document.file_name}
                      </p>
                      <p className="text-xs text-ink-500">
                        {document.category} · {formatBytes(document.size_bytes)}
                      </p>
                    </div>
                    <FileCheck2
                      className="size-4 shrink-0 text-success-600"
                      aria-hidden
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

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
      </div>

      <Card>
        <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 ring-1 ring-brand-100">
              <ShieldCheck className="size-4.5 text-brand-700" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">
                Something wrong with your record?
              </p>
              <p className="mt-0.5 text-sm text-ink-600">
                Bio-data corrections are made by Human Resources. Send your
                Staff ID and the details to correct.
              </p>
            </div>
          </div>
          <Link to="/" className={buttonVariants({ variant: 'outline' })}>
            <Briefcase aria-hidden />
            Mobigate Group
          </Link>
        </CardContent>
      </Card>
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
 * The document list is assembled from the staff record. The live API returns
 * the `documents` rows owned by the staff record; the mock has no documents
 * collection, so the uploaded CV on the linked application stands in for it.
 */
function documentsFor(
  staff: StaffProfile,
  application: { cv_file_name?: string } | undefined,
): Document[] {
  const documents: Document[] = []

  if (application?.cv_file_name) {
    documents.push({
      id: 'doc-cv',
      tenant_id: staff.tenant_id,
      owner_type: 'staff',
      owner_id: staff.id,
      category: 'Curriculum vitae',
      file_name: application.cv_file_name,
      storage_key: `staff/${staff.id}/cv`,
      mime_type: 'application/pdf',
      size_bytes: 284_672,
      uploaded_by: staff.user_id,
      created_at: staff.created_at,
    })
  }

  documents.push({
    id: 'doc-id',
    tenant_id: staff.tenant_id,
    owner_type: 'staff',
    owner_id: staff.id,
    category: 'Identity document',
    file_name: `${staff.first_name}_${staff.last_name}_National_ID.pdf`,
    storage_key: `staff/${staff.id}/national-id`,
    mime_type: 'application/pdf',
    size_bytes: 153_600,
    uploaded_by: staff.user_id,
    created_at: staff.created_at,
  })

  documents.push({
    id: 'doc-qual',
    tenant_id: staff.tenant_id,
    owner_type: 'staff',
    owner_id: staff.id,
    category: 'Qualification certificate',
    file_name: `${staff.first_name}_${staff.last_name}_Qualification.pdf`,
    storage_key: `staff/${staff.id}/qualification`,
    mime_type: 'application/pdf',
    size_bytes: 421_888,
    uploaded_by: staff.user_id,
    created_at: staff.created_at,
  })

  return documents
}
