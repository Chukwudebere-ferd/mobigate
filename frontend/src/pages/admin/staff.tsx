/**
 * Admin › Staff (README M10).
 *
 * Read-only staff register: filter, paginate, and open a staff record.
 * The record shows the employment and personal detail an Admin needs, and
 * marks bank details, guarantor and next-of-kin as confidential — those are
 * visible to the record owner and administrators only (README M10, §3.1).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Briefcase,
  Contact,
  Copy,
  Download,
  FileText,
  HeartHandshake,
  IdCard,
  Landmark,
  Lock,
  Mail,
  MapPin,
  Phone,
  Search,
  UserPlus,
  Users,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, TableSkeleton } from '@/components/ui/empty-state'
import { Field, Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
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
import {
  adminApi,
  employmentCategoryLabels,
  locationPath,
  sortLocationsByPath,
} from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, fullName } from '@/lib/format'
import type {
  EmploymentCategory,
  StaffFilters,
  StaffProfile,
  StaffStatus,
} from '@/types/domain'

const PAGE_SIZE = 10

/** Suggested departments in the manual-entry form. */
const DEPARTMENT_PRESETS = ['Developer', 'Marketing', 'HR'] as const
const CUSTOM_DEPARTMENT = '__custom__'

const staffStatusLabels: Record<StaffStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  exited: 'Exited',
}

/** Download a CSV of the rows currently on screen. */
function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function AdminStaffPage() {
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState<StaffStatus | 'all'>('all')
  const [category, setCategory] = React.useState<EmploymentCategory | 'all'>('all')
  const [departmentId, setDepartmentId] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [manualOpen, setManualOpen] = React.useState(false)

  // Debounce the free-text search so we do not refetch on every keystroke.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const filters = React.useMemo<StaffFilters>(
    () => ({
      page,
      per_page: PAGE_SIZE,
      search: search || undefined,
      status,
      employment_category: category,
      department_id: departmentId || undefined,
    }),
    [page, search, status, category, departmentId],
  )

  const staffQuery = useQuery({
    queryKey: ['staff', filters],
    queryFn: () => adminApi.listStaff(filters),
  })

  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: () => adminApi.listDepartments(),
  })

  const items = staffQuery.data?.items ?? []
  const total = staffQuery.data?.total ?? 0
  const totalPages = staffQuery.data?.total_pages ?? 1
  const hasFilters =
    search.length > 0 || status !== 'all' || category !== 'all' || departmentId !== ''

  function handleExport() {
    if (items.length === 0) {
      toast.error('There is nothing to export on this page.')
      return
    }
    const rows: string[][] = [
      [
        'Staff ID',
        'First name',
        'Last name',
        'Email',
        'Category',
        'Department',
        'Position',
        'Location',
        'Appointment date',
        'Status',
      ],
      ...items.map((s) => [
        s.staff_id,
        s.first_name,
        s.last_name,
        s.email,
        s.employment_category,
        s.department_name ?? '',
        s.position ?? '',
        s.location_name ?? '',
        s.appointment_date ?? '',
        s.status,
      ]),
    ]
    downloadCsv('mgm-staff-register.csv', rows)
    toast.success(`Exported ${items.length} staff records.`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="Every person appointed to the Group, with the Staff ID issued at onboarding. Appointed candidates become staff records automatically once their access code is redeemed."
        icon={Users}
        actions={
          <>
            <Button variant="outline" onClick={handleExport}>
              <Download />
              Export register
            </Button>
            <Button onClick={() => setManualOpen(true)}>
              <UserPlus />
              Add staff manually
            </Button>
          </>
        }
      />

      {/* -- Filter bar -- */}
      <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-xs">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Search" htmlFor="staff-search">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-400"
                aria-hidden
              />
              <Input
                id="staff-search"
                className="pl-8"
                placeholder="Name, Staff ID or email"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </Field>

          <Field label="Status" htmlFor="staff-status">
            <Select
              id="staff-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as StaffStatus | 'all')
                setPage(1)
              }}
            >
              <option value="all">All statuses</option>
              {(Object.keys(staffStatusLabels) as StaffStatus[]).map((value) => (
                <option key={value} value={value}>
                  {staffStatusLabels[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Employment category" htmlFor="staff-category">
            <Select
              id="staff-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as EmploymentCategory | 'all')
                setPage(1)
              }}
            >
              <option value="all">All categories</option>
              {(Object.keys(employmentCategoryLabels) as EmploymentCategory[]).map(
                (value) => (
                  <option key={value} value={value}>
                    {employmentCategoryLabels[value]}
                  </option>
                ),
              )}
            </Select>
          </Field>

          <Field label="Department" htmlFor="staff-department">
            <Select
              id="staff-department"
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All departments</option>
              {(departmentsQuery.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {/* -- Register -- */}
      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xs">
        {staffQuery.isLoading ? (
          <TableSkeleton rows={6} />
        ) : items.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={Search}
              title="No staff match these filters"
              description="Try a different name, Staff ID, status or department."
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No staff records yet"
              description="Appoint candidates from the Applications screen to create staff records."
            />
          )
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Appointment date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((staff) => (
                  <TableRow key={staff.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar
                          first={staff.first_name}
                          last={staff.last_name}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink-900">
                            {fullName(staff.first_name, staff.last_name)}
                          </p>
                          <p className="truncate text-xs text-ink-500">
                            {staff.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-ink-700">
                        {staff.staff_id}
                      </span>
                    </TableCell>
                    <TableCell>
                      <EmploymentCategoryBadge
                        category={staff.employment_category}
                      />
                    </TableCell>
                    <TableCell>{staff.department_name ?? '—'}</TableCell>
                    <TableCell>{staff.position ?? '—'}</TableCell>
                    <TableCell>{staff.location_name ?? '—'}</TableCell>
                    <TableCell>
                      <span className="tabular">
                        {formatDate(staff.appointment_date)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StaffStatusBadge status={staff.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedId(staff.id)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={staffQuery.data?.page ?? 1}
              totalPages={totalPages}
              total={total}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <StaffRecordDialog staffId={selectedId} onClose={() => setSelectedId(null)} />

      {manualOpen && (
        <ManualStaffDialog
          onClose={() => setManualOpen(false)}
          onCreated={(staff) => {
            setManualOpen(false)
            void queryClient.invalidateQueries({ queryKey: ['staff'] })
            void queryClient.invalidateQueries({ queryKey: ['departments'] })
            toast.success(
              `${fullName(staff.first_name, staff.last_name)} added as ${staff.staff_id}.`,
            )
          }}
        />
      )}
    </div>
  )
}

/* -- Manual staff entry -------------------------------------------------- */

function ManualStaffDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (staff: StaffProfile) => void
}) {
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [category, setCategory] =
    React.useState<EmploymentCategory>('employee')
  const [departmentChoice, setDepartmentChoice] = React.useState('')
  const [customDepartment, setCustomDepartment] = React.useState('')
  const [locationId, setLocationId] = React.useState('')
  const [position, setPosition] = React.useState('')
  const [appointmentDate, setAppointmentDate] = React.useState('')

  const departmentsQuery = useQuery({
    queryKey: ['departments'],
    queryFn: () => adminApi.listDepartments(),
  })
  const locationsQuery = useQuery({
    queryKey: ['locations'],
    queryFn: () => adminApi.listLocations(),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const departmentName =
        departmentChoice === CUSTOM_DEPARTMENT
          ? customDepartment.trim()
          : departmentChoice
      const department = departmentName
        ? await adminApi.ensureDepartment(departmentName)
        : undefined
      return adminApi.createStaff({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        employment_category: category,
        department_id: department?.id,
        location_id: locationId || undefined,
        position: position.trim() || undefined,
        appointment_date: appointmentDate || undefined,
      })
    },
    onSuccess: onCreated,
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not create the staff record.',
      )
    },
  })

  const departmentOptions = React.useMemo(() => {
    const names = new Map<string, string>()
    for (const preset of DEPARTMENT_PRESETS) {
      names.set(preset.toLowerCase(), preset)
    }
    for (const department of departmentsQuery.data ?? []) {
      const name = department.name.trim()
      const key = name.toLowerCase()
      if (name && !names.has(key)) names.set(key, name)
    }
    const presetKeys = new Set(
      DEPARTMENT_PRESETS.map((preset) => preset.toLowerCase()),
    )
    const extras = [...names.entries()]
      .filter(([key]) => !presetKeys.has(key))
      .map(([, name]) => name)
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    return [...DEPARTMENT_PRESETS, ...extras]
  }, [departmentsQuery.data])

  const customDepartmentValid =
    departmentChoice !== CUSTOM_DEPARTMENT ||
    customDepartment.trim().length > 0

  const valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    phone.trim().length > 0 &&
    customDepartmentValid

  const locationOptions = sortLocationsByPath(
    (locationsQuery.data ?? []).filter(
      (location) => location.status === 'approved',
    ),
  )

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogHeader>
        <div className="min-w-0">
          <DialogTitle>Add staff manually</DialogTitle>
          <DialogDescription>
            For appointments made outside the portal. A Staff ID is allocated
            when you save.
          </DialogDescription>
        </div>
        <DialogClose onClick={onClose} />
      </DialogHeader>
      <form
        id="manual-staff-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (valid) createMutation.mutate()
        }}
      >
        <DialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" htmlFor="manual-first-name" required>
              <Input
                id="manual-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Field>
            <Field label="Last name" htmlFor="manual-last-name" required>
              <Input
                id="manual-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="manual-email" required>
              <Input
                id="manual-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="manual-phone" required>
              <Input
                id="manual-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Employment category"
              htmlFor="manual-category"
              required
            >
              <Select
                id="manual-category"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as EmploymentCategory)
                }
              >
                {Object.entries(employmentCategoryLabels).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ),
                )}
              </Select>
            </Field>
            <Field
              label="Department"
              htmlFor="manual-department"
              hint={
                departmentChoice === CUSTOM_DEPARTMENT
                  ? 'Type the new department name.'
                  : undefined
              }
            >
              <div className="space-y-2">
                <Select
                  id="manual-department"
                  value={departmentChoice}
                  onChange={(e) => {
                    const value = e.target.value
                    setDepartmentChoice(value)
                    if (value !== CUSTOM_DEPARTMENT) {
                      setCustomDepartment('')
                    }
                  }}
                >
                  <option value="">No department</option>
                  {departmentOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  <option value={CUSTOM_DEPARTMENT}>Other / custom…</option>
                </Select>
                {departmentChoice === CUSTOM_DEPARTMENT && (
                  <Input
                    id="manual-department-custom"
                    value={customDepartment}
                    maxLength={80}
                    onChange={(e) => setCustomDepartment(e.target.value)}
                    placeholder="e.g. Product, Sales"
                    aria-label="Custom department name"
                    invalid={customDepartment.trim().length === 0}
                  />
                )}
              </div>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Location" htmlFor="manual-location">
              <Select
                id="manual-location"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">No location</option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {locationPath(location.id)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Position" htmlFor="manual-position">
              <Input
                id="manual-position"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Appointment date"
            htmlFor="manual-appointment"
            hint="Optional; defaults to no recorded appointment date."
          >
            <Input
              id="manual-appointment"
              type="date"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
            />
          </Field>
        </DialogBody>
      </form>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="manual-staff-form"
          loading={createMutation.isPending}
          disabled={!valid}
        >
          <UserPlus />
          Create staff record
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

/* -- Staff record ------------------------------------------------------- */

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-0.5 text-sm break-words text-ink-800',
          mono && 'font-mono text-xs',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function DetailGroup({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Briefcase
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
        <Icon className="size-4 text-ink-400" aria-hidden />
        {title}
      </h3>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </dl>
    </section>
  )
}

function StaffRecordDialog({
  staffId,
  onClose,
}: {
  staffId: string | null
  onClose: () => void
}) {
  const [copiedValue, setCopiedValue] = React.useState<string | null>(null)

  const staffQuery = useQuery({
    queryKey: ['staff-record', staffId],
    queryFn: () => adminApi.getStaff(staffId as string),
    enabled: staffId !== null,
  })

  const staff: StaffProfile | undefined = staffQuery.data
  const copied = staff !== undefined && copiedValue === staff.staff_id

  async function copyStaffId(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedValue(value)
      toast.success('Staff ID copied to clipboard.')
    } catch {
      toast.error('Could not copy the Staff ID. Select it manually instead.')
    }
  }

  return (
    <Dialog
      open={staffId !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      className="sm:max-w-3xl"
    >
      {staffQuery.isLoading ? (
        <DialogBody>
          <p className="py-8 text-center text-sm text-ink-500">
            Loading staff record…
          </p>
        </DialogBody>
      ) : !staff ? (
        <DialogHeader>
          <div className="min-w-0">
            <DialogTitle>Staff record</DialogTitle>
            <DialogDescription>
              That staff record could not be found.
            </DialogDescription>
          </div>
          <DialogClose onClick={onClose} />
        </DialogHeader>
      ) : (
        <>
          <DialogHeader>
            <div className="flex min-w-0 items-start gap-3">
              <Avatar
                first={staff.first_name}
                last={staff.last_name}
                size="lg"
              />
              <div className="min-w-0">
                <DialogTitle>
                  {fullName(staff.first_name, staff.last_name)}
                </DialogTitle>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-ink-100 px-2 py-1 font-mono text-xs text-ink-800">
                    <IdCard className="size-3.5 text-ink-500" aria-hidden />
                    {staff.staff_id}
                    <button
                      type="button"
                      onClick={() => void copyStaffId(staff.staff_id)}
                      className="rounded p-0.5 text-ink-500 transition-colors hover:bg-ink-200 hover:text-ink-800"
                      aria-label="Copy Staff ID"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </span>
                  {copied && (
                    <span className="text-xs text-success-700">Copied</span>
                  )}
                  <StaffStatusBadge status={staff.status} />
                  <EmploymentCategoryBadge
                    category={staff.employment_category}
                  />
                </div>
              </div>
            </div>
            <DialogClose onClick={onClose} />
          </DialogHeader>

          <DialogBody className="space-y-6">
            <DetailGroup icon={Briefcase} title="Employment">
              <DetailItem
                label="Department"
                value={staff.department_name ?? '—'}
              />
              <DetailItem label="Position" value={staff.position ?? '—'} />
              <DetailItem
                label="Appointment date"
                value={formatDate(staff.appointment_date)}
              />
              <DetailItem
                label="Category"
                value={employmentCategoryLabels[staff.employment_category]}
              />
              <DetailItem
                label="Rules of engagement"
                value={
                  staff.rules_of_engagement_accepted_at
                    ? `Acknowledged ${formatDateTime(
                        staff.rules_of_engagement_accepted_at,
                      )}`
                    : 'Not yet acknowledged'
                }
              />
              <DetailItem
                label="Source application"
                value={
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                    <FileText className="size-3.5 text-ink-400" aria-hidden />
                    {staff.application_id ?? '—'}
                  </span>
                }
                mono
              />
            </DetailGroup>

            <DetailGroup icon={Contact} title="Personal">
              <DetailItem label="Gender" value={staff.gender ?? '—'} />
              <DetailItem
                label="Date of birth"
                value={formatDate(staff.date_of_birth)}
              />
              <DetailItem
                label="Phone"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5 text-ink-400" aria-hidden />
                    {staff.phone ?? '—'}
                  </span>
                }
              />
              <DetailItem
                label="Email"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-3.5 text-ink-400" aria-hidden />
                    <span className="break-all">{staff.email}</span>
                  </span>
                }
              />
              <DetailItem label="Address" value={staff.address_line ?? '—'} />
              <DetailItem
                label="Location"
                value={
                  <span className="inline-flex items-start gap-1.5">
                    <MapPin
                      className="mt-0.5 size-3.5 shrink-0 text-ink-400"
                      aria-hidden
                    />
                    {locationPath(staff.location_id)}
                  </span>
                }
              />
            </DetailGroup>

            {/* Confidential — README M10: visible to the record owner and
                administrators only, never to peers. */}
            <section className="rounded-lg border border-warning-500/30 bg-warning-50/70 p-4">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-warning-700" aria-hidden />
                <h3 className="text-sm font-semibold text-warning-900">
                  Confidential
                </h3>
              </div>
              <p className="mt-1 text-xs text-warning-900/80">
                Visible to the record owner and administrators only.
              </p>

              <div className="mt-4 space-y-5">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-warning-900">
                    <Landmark className="size-4" aria-hidden />
                    Bank details
                  </p>
                  <dl className="mt-2 grid gap-3 sm:grid-cols-3">
                    <DetailItem label="Bank" value={staff.bank_name ?? '—'} />
                    <DetailItem
                      label="Account name"
                      value={staff.bank_account_name ?? '—'}
                    />
                    <DetailItem
                      label="Account number"
                      value={staff.bank_account_number ?? '—'}
                      mono
                    />
                  </dl>
                </div>

                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-warning-900">
                    <HeartHandshake className="size-4" aria-hidden />
                    Guarantor
                  </p>
                  <dl className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <DetailItem
                      label="Name"
                      value={staff.guarantor_name ?? '—'}
                    />
                    <DetailItem
                      label="Relationship"
                      value={staff.guarantor_relationship ?? '—'}
                    />
                    <DetailItem
                      label="Phone"
                      value={staff.guarantor_phone ?? '—'}
                    />
                    <DetailItem
                      label="Address"
                      value={staff.guarantor_address ?? '—'}
                    />
                  </dl>
                </div>

                <div>
                  <p className="flex items-center gap-2 text-sm font-medium text-warning-900">
                    <Contact className="size-4" aria-hidden />
                    Next of kin
                  </p>
                  <dl className="mt-2 grid gap-3 sm:grid-cols-3">
                    <DetailItem
                      label="Name"
                      value={staff.next_of_kin_name ?? '—'}
                    />
                    <DetailItem
                      label="Relationship"
                      value={staff.next_of_kin_relationship ?? '—'}
                    />
                    <DetailItem
                      label="Phone"
                      value={staff.next_of_kin_phone ?? '—'}
                    />
                  </dl>
                </div>
              </div>
            </section>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </>
      )}
    </Dialog>
  )
}
