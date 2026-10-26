import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  Copy,
  FileCheck2,
  IdCard,
  KeyRound,
  Landmark,
  Mail,
  MapPin,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox, Field, Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { publicApi, sortLocationsByName, staffApi } from '@/lib/api'
import { formatBytes } from '@/lib/format'
import { useSession } from '@/providers/session-provider'
import { EMPLOYMENT_CATEGORIES, type StaffRedemption } from '@/types/domain'

/* -------------------------------------------------------------------------- */
/*  Schema                                                                    */
/* -------------------------------------------------------------------------- */

/** Uploads are images only, capped at 2 MB each (README §M4). */
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024

/**
 * A file input value is a `FileList`; the check is duck-typed so the schema
 * stays safe to evaluate outside a browser.
 */
const fileField = (message: string) =>
  z.custom<FileList>(
    (value) => {
      if (!value || typeof value !== 'object') return false
      const list = value as { length?: number }
      return typeof list.length === 'number' && list.length > 0
    },
    message,
  )

const staffDetailsSchema = z.object({
  // Personal details
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().min(1, 'Last name is required'),
  email: z.email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .min(7, 'Enter a valid phone number')
    .regex(/^[\d+][\d\s-]{6,}$/, 'Enter a valid phone number'),
  gender: z.enum(['Male', 'Female', 'Other'], 'Select a gender'),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  address_line: z.string().trim().min(1, 'Address is required'),

  // Location
  country_id: z.string().min(1, 'Select a country'),
  state_id: z.string().min(1, 'Select a state'),
  lga_id: z.string().min(1, 'Select an LGA'),
  // Optional: not every LGA in the reference tree has a city row. The LGA is
  // used as the record's location when no city is chosen.
  city_id: z.string().optional(),

  // Employment
  department_id: z.string().min(1, 'Select a department'),
  position: z.string().trim().min(1, 'Position is required'),
  appointment_date: z.string().min(1, 'Appointment date is required'),
  employment_category: z.enum(EMPLOYMENT_CATEGORIES, {
    error: 'Select an employment category',
  }),

  // Bank details
  bank_name: z.string().trim().min(1, 'Bank name is required'),
  bank_account_name: z.string().trim().min(1, 'Account name is required'),
  bank_account_number: z
    .string()
    .trim()
    .regex(/^\d{8,10}$/, 'Enter a valid 8 to 10 digit account number'),

  // Guarantor
  guarantor_name: z.string().trim().min(1, 'Guarantor name is required'),
  guarantor_relationship: z.string().trim().min(1, 'Relationship is required'),
  guarantor_phone: z
    .string()
    .trim()
    .min(7, 'Enter a valid phone number')
    .regex(/^[\d+][\d\s-]{6,}$/, 'Enter a valid phone number'),
  guarantor_address: z.string().trim().min(1, 'Address is required'),

  // Next of kin
  next_of_kin_name: z.string().trim().min(1, 'Name is required'),
  next_of_kin_relationship: z.string().trim().min(1, 'Relationship is required'),
  next_of_kin_phone: z
    .string()
    .trim()
    .min(7, 'Enter a valid phone number')
    .regex(/^[\d+][\d\s-]{6,}$/, 'Enter a valid phone number'),

  // Supporting documents
  id_document: fileField('Attach a copy of your identity document'),
  qualification_certificates: fileField(
    'Attach your qualification certificates',
  ),

  // Rules of engagement
  rules_of_engagement: z.boolean().refine(
    (accepted) => accepted,
    'You must accept the rules of engagement to continue',
  ),
})
  .superRefine((values, ctx) => {
    for (const key of ['id_document', 'qualification_certificates'] as const) {
      const file = values[key]?.[0]
      if (file && file.size > MAX_DOCUMENT_BYTES) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Image must be 2 MB or smaller',
        })
      }
    }
  })

type StaffDetailsValues = z.infer<typeof staffDetailsSchema>

const GENDERS = ['Male', 'Female', 'Other'] as const

type Gender = (typeof GENDERS)[number]

/** Maps the free-text gender on an application onto the form's enum. */
function toGender(value: string | null): Gender {
  const match = GENDERS.find(
    (gender) => gender.toLowerCase() === value?.trim().toLowerCase(),
  )
  return match ?? 'Female'
}

/** Falls back to employee when a staff record carries an unknown category. */
function toEmploymentCategory(
  value: string | null | undefined,
): StaffDetailsValues['employment_category'] {
  const match = EMPLOYMENT_CATEGORIES.find(
    (category) => category === value?.trim().toLowerCase(),
  )
  return match ?? 'employee'
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export function StaffOnboardingPage() {
  const { refresh } = useSession()
  const [code, setCode] = useState('')
  const [redemption, setRedemption] = useState<StaffRedemption | null>(null)
  const [staffId, setStaffId] = useState<string | null>(null)
  const [staffName, setStaffName] = useState('')

  const redeem = useMutation({
    mutationFn: (value: string) => staffApi.redeem(value),
    onSuccess: (result) => {
      setRedemption(result)
      toast.success('Access code verified')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const submitDetails = useMutation({
    mutationFn: ({
      ticket,
      values,
      policyIds,
    }: {
      ticket: string
      values: StaffDetailsValues
      policyIds: string[]
    }) =>
      staffApi.completeOnboarding(
        ticket,
        buildOnboardingForm(values, policyIds),
      ),
    onSuccess: (result) => {
      // Onboarding promotes the account to the staff role. Refresh the
      // session so the new staff workspace is reachable immediately.
      void refresh()
      setStaffId(result.staff.staff_id)
      setStaffName(`${result.staff.first_name} ${result.staff.last_name}`)
      toast.success('Staff profile created')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  if (staffId) {
    return <SuccessState staffId={staffId} name={staffName} />
  }

  if (redemption) {
    return (
      <DetailsPhase
        redemption={redemption}
        isSubmitting={submitDetails.isPending}
        onSubmit={(values, policyIds) =>
          submitDetails.mutate({
            ticket: redemption.ticket,
            values,
            policyIds,
          })
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={KeyRound}
        title="Complete your onboarding"
        description="Redeem the access code handed to you by the recruitment team, then submit your staff details to receive your Staff ID."
      />

      <Card>
        <CardHeader>
          <CardTitle>Redeem your access code</CardTitle>
          <CardDescription>
            Appointed candidates receive a six-character access code from the
            recruitment team once the appointment is confirmed. The code can be
            used once and expires after fourteen days.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg bg-brand-50 px-3.5 py-3 ring-1 ring-brand-100">
            <Mail className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
            <p className="text-sm text-ink-700">
              Codes are handed to you directly and are never sent by email or
              SMS. Did not get one? Contact the HR department quoting your
              application number.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              redeem.mutate(code.trim().toUpperCase())
            }}
            className="space-y-4"
          >
            <Field
              label="Access code"
              htmlFor="access-code"
              hint="Six characters, letters and numbers. Entered without spaces."
              error={
                redeem.isError ? redeem.error.message : undefined
              }
            >
              <Input
                id="access-code"
                name="access-code"
                value={code}
                onChange={(event) =>
                  setCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 6),
                  )
                }
                autoComplete="one-time-code"
                inputMode="text"
                spellCheck={false}
                maxLength={6}
                placeholder="K7M2Q9"
                className="h-12 text-center font-mono text-xl font-semibold tracking-widest uppercase"
                invalid={redeem.isError}
              />
            </Field>

            {redeem.isError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg bg-danger-50 px-3.5 py-3 ring-1 ring-danger-100"
              >
                <TriangleAlert
                  className="mt-0.5 size-4 shrink-0 text-danger-700"
                  aria-hidden
                />
                <p className="text-sm text-danger-900">{redeem.error.message}</p>
              </div>
            )}

            <Button
              type="submit"
              loading={redeem.isPending}
              loadingText="Verifying code"
              disabled={code.trim().length !== 6}
              className="w-full sm:w-auto"
            >
              Verify code
              <ArrowRight />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Phase B — staff details form                                              */
/* -------------------------------------------------------------------------- */

function DetailsPhase({
  redemption,
  isSubmitting,
  onSubmit,
}: {
  redemption: StaffRedemption
  isSubmitting: boolean
  onSubmit: (values: StaffDetailsValues, policyIds: string[]) => void
}) {
  const application = redemption.application
  const prefill = redemption.prefill
  const policies = redemption.policies ?? []
  const [acceptedPolicies, setAcceptedPolicies] = useState<string[]>([])
  const [policyError, setPolicyError] = useState<string | null>(null)
  // An earlier snapshot saved from this form; its values win over prefill.
  const draft = redemption.draft as Partial<StaffDetailsValues> | undefined

  // The location tree is a public reference route — no admin session needed.
  const locationsQuery = useQuery({
    queryKey: ['public', 'locations'],
    queryFn: () => publicApi.listLocations(),
    staleTime: 5 * 60 * 1000,
  })

  const locations = useMemo(
    () => locationsQuery.data ?? [],
    [locationsQuery.data],
  )
  const departments = redemption.departments

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<StaffDetailsValues>({
    resolver: zodResolver(staffDetailsSchema),
    mode: 'onTouched',
    defaultValues: {
      first_name:
        draft?.first_name ?? prefill?.first_name ?? application?.first_name ?? '',
      last_name:
        draft?.last_name ?? prefill?.last_name ?? application?.last_name ?? '',
      email: draft?.email ?? prefill?.email ?? application?.email ?? '',
      phone: draft?.phone ?? prefill?.phone ?? application?.phone ?? '',
      gender:
        draft?.gender ??
        toGender(prefill?.gender ?? application?.gender ?? null),
      date_of_birth:
        draft?.date_of_birth ??
        dateInputValue(prefill?.date_of_birth ?? application?.date_of_birth),
      address_line:
        draft?.address_line ??
        prefill?.address_line ??
        application?.address_line ??
        '',
      country_id: draft?.country_id ?? '',
      state_id: draft?.state_id ?? '',
      lga_id: draft?.lga_id ?? '',
      city_id: draft?.city_id ?? '',
      department_id: draft?.department_id ?? prefill?.department_id ?? '',
      position:
        draft?.position ?? prefill?.position ?? application?.job_title ?? '',
      appointment_date:
        draft?.appointment_date ??
        dateInputValue(prefill?.appointment_date),
      employment_category:
        draft?.employment_category ??
        toEmploymentCategory(prefill?.employment_category),
      bank_name: draft?.bank_name ?? prefill?.bank_name ?? '',
      bank_account_name:
        draft?.bank_account_name ?? prefill?.bank_account_name ?? '',
      bank_account_number:
        draft?.bank_account_number ?? prefill?.bank_account_number ?? '',
      guarantor_name: draft?.guarantor_name ?? prefill?.guarantor_name ?? '',
      guarantor_relationship:
        draft?.guarantor_relationship ??
        prefill?.guarantor_relationship ??
        '',
      guarantor_phone:
        draft?.guarantor_phone ?? prefill?.guarantor_phone ?? '',
      guarantor_address:
        draft?.guarantor_address ?? prefill?.guarantor_address ?? '',
      next_of_kin_name:
        draft?.next_of_kin_name ?? prefill?.next_of_kin_name ?? '',
      next_of_kin_relationship:
        draft?.next_of_kin_relationship ??
        prefill?.next_of_kin_relationship ??
        '',
      next_of_kin_phone:
        draft?.next_of_kin_phone ?? prefill?.next_of_kin_phone ?? '',
      // Files are never stored in a draft or prefilled from the application.
      id_document: undefined,
      qualification_certificates: undefined,
      rules_of_engagement: draft?.rules_of_engagement ?? false,
    },
  })

  // Seed the country › state › LGA chain from the application's location
  // once the tree loads; the draft keeps its own chain when it has one.
  useEffect(() => {
    const lgaId = prefill?.location_id
    if (!lgaId || locations.length === 0 || getValues('lga_id')) return
    const lga = locations.find((l) => l.id === lgaId)
    if (!lga) return
    const state = lga.parent_id
      ? locations.find((l) => l.id === lga.parent_id)
      : undefined
    if (!state?.parent_id) return
    setValue('country_id', state.parent_id)
    setValue('state_id', state.id)
    setValue('lga_id', lga.id)
  }, [locations, prefill?.location_id, getValues, setValue])

  // Best-effort draft autosave: the plain fields are snapshotted every ten
  // seconds; files are excluded and re-attached at submission.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const snapshot: Record<string, unknown> = { ...getValues() }
      delete snapshot.id_document
      delete snapshot.qualification_certificates
      void staffApi.saveDraft(redemption.ticket, snapshot).catch(() => {
        // A failed draft save must never interrupt typing.
      })
    }, 10_000)
    return () => window.clearInterval(interval)
  }, [getValues, redemption.ticket])

  const countryId = useWatch({ control, name: 'country_id' })
  const stateId = useWatch({ control, name: 'state_id' })
  const lgaId = useWatch({ control, name: 'lga_id' })
  const cityId = useWatch({ control, name: 'city_id' })
  const idDocument = useWatch({ control, name: 'id_document' })
  const certificates = useWatch({ control, name: 'qualification_certificates' })

  const states = sortLocationsByName(
    locations.filter((l) => l.parent_id === countryId),
  )
  const lgas = sortLocationsByName(
    locations.filter((l) => l.parent_id === stateId),
  )
  const cities = sortLocationsByName(
    locations.filter((l) => l.parent_id === lgaId),
  )

  const locationPath = pathOf(locations, cityId ?? lgaId)

  const displayName =
    [prefill?.first_name ?? application?.first_name, prefill?.last_name ?? application?.last_name]
      .filter(Boolean)
      .join(' ') || 'candidate'

  return (
    <form
      onSubmit={handleSubmit((values) => {
        const missing = policies.filter(
          (policy) =>
            policy.required && !acceptedPolicies.includes(policy.id),
        )
        if (missing.length > 0) {
          setPolicyError(
            `Accept ${missing.map((policy) => policy.title).join(', ')} to continue.`,
          )
          return
        }
        setPolicyError(null)
        onSubmit(values, acceptedPolicies)
      })}
      className="space-y-6"
      noValidate
    >
      <PageHeader
        icon={IdCard}
        title="Your staff details"
        description="Complete every section. Your Staff ID is issued as soon as this form is submitted and cannot be changed afterwards."
        breadcrumb={
          <Link
            to="/staff"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-ink-900"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to staff portal
          </Link>
        }
      />

      {/* -- Redemption receipt -- */}
      <Card className="border-success-100 bg-success-50/60">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success-100 ring-1 ring-success-100">
              <CheckCircle2 className="size-5 text-success-700" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">
                Access code verified — welcome, {displayName}
              </p>
              <p className="mt-0.5 text-sm text-ink-600">
                {application?.job_title ?? 'Staff role'}
                {application?.application_number
                  ? ` · ${application.application_number}`
                  : ''}
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 font-mono text-xs font-medium text-ink-700 ring-1 ring-success-100">
            <BadgeCheck className="size-3.5 text-success-700" aria-hidden />
            Code accepted
          </span>
        </CardContent>
      </Card>

      {/* -- Personal details -- */}
      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>
            Pre-filled from your application. Correct anything that has
            changed.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="first_name" required error={errors.first_name?.message}>
            <Input
              id="first_name"
              autoComplete="given-name"
              invalid={Boolean(errors.first_name)}
              {...register('first_name')}
            />
          </Field>
          <Field label="Last name" htmlFor="last_name" required error={errors.last_name?.message}>
            <Input
              id="last_name"
              autoComplete="family-name"
              invalid={Boolean(errors.last_name)}
              {...register('last_name')}
            />
          </Field>
          <Field label="Email" htmlFor="email" required error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>
          <Field label="Phone" htmlFor="phone" required error={errors.phone?.message}>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+234 803 000 0000"
              invalid={Boolean(errors.phone)}
              {...register('phone')}
            />
          </Field>
          <Field label="Gender" htmlFor="gender" required error={errors.gender?.message}>
            <Select
              id="gender"
              invalid={Boolean(errors.gender)}
              {...register('gender')}
            >
              <option value="">Select a gender</option>
              {GENDERS.map((gender) => (
                <option key={gender} value={gender}>
                  {gender}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Date of birth"
            htmlFor="date_of_birth"
            required
            error={errors.date_of_birth?.message}
          >
            <Input
              id="date_of_birth"
              type="date"
              invalid={Boolean(errors.date_of_birth)}
              {...register('date_of_birth')}
            />
          </Field>
          <Field
            label="Residential address"
            htmlFor="address_line"
            required
            className="sm:col-span-2"
            error={errors.address_line?.message}
          >
            <Input
              id="address_line"
              autoComplete="street-address"
              placeholder="14 Admiralty Way, Victoria Island"
              invalid={Boolean(errors.address_line)}
              {...register('address_line')}
            />
          </Field>
        </CardContent>
      </Card>

      {/* -- Location -- */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>
            Select the location where you are based. These details appear on
            your staff record.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Country" htmlFor="country_id" required error={errors.country_id?.message}>
            <Controller
              control={control}
              name="country_id"
              render={({ field }) => (
                <Select
                  id="country_id"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  invalid={Boolean(errors.country_id)}
                  value={field.value}
                  onChange={(event) => {
                    field.onChange(event.target.value)
                    setValue('state_id', '')
                    setValue('lga_id', '')
                    setValue('city_id', '')
                  }}
                >
                  <option value="">Select a country</option>
                  {locations
                    .filter((l) => l.parent_id === null)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </Select>
              )}
            />
          </Field>

          <Field label="State" htmlFor="state_id" required error={errors.state_id?.message}>
            <Controller
              control={control}
              name="state_id"
              render={({ field }) => (
                <Select
                  id="state_id"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  disabled={!countryId}
                  invalid={Boolean(errors.state_id)}
                  value={field.value}
                  onChange={(event) => {
                    field.onChange(event.target.value)
                    setValue('lga_id', '')
                    setValue('city_id', '')
                  }}
                >
                  <option value="">Select a state</option>
                  {states.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              )}
            />
          </Field>

          <Field label="LGA" htmlFor="lga_id" required error={errors.lga_id?.message}>
            <Controller
              control={control}
              name="lga_id"
              render={({ field }) => (
                <Select
                  id="lga_id"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  disabled={!stateId}
                  invalid={Boolean(errors.lga_id)}
                  value={field.value}
                  onChange={(event) => {
                    field.onChange(event.target.value)
                    setValue('city_id', '')
                  }}
                >
                  <option value="">Select an LGA</option>
                  {lgas.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              )}
            />
          </Field>

          <Field label="City or town" htmlFor="city_id" required error={errors.city_id?.message}>
            <Controller
              control={control}
              name="city_id"
              render={({ field }) => (
                <Select
                  id="city_id"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  disabled={!lgaId}
                  invalid={Boolean(errors.city_id)}
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                >
                  <option value="">Select a city or town</option>
                  {cities.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              )}
            />
          </Field>

          {locationPath && (
            <p className="flex items-center gap-2 text-sm text-ink-500 sm:col-span-2">
              <MapPin className="size-4 shrink-0 text-ink-400" aria-hidden />
              {locationPath}
            </p>
          )}
        </CardContent>
      </Card>

      {/* -- Employment -- */}
      <Card>
        <CardHeader>
          <CardTitle>Employment</CardTitle>
          <CardDescription>
            Your role, department and employment category as recorded by the
            recruitment team.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Department" htmlFor="department_id" required error={errors.department_id?.message}>
            <Select
              id="department_id"
              invalid={Boolean(errors.department_id)}
              {...register('department_id')}
            >
              <option value="">Select a department</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Position" htmlFor="position" required error={errors.position?.message}>
            <Input
              id="position"
              placeholder="Senior Backend Engineer"
              invalid={Boolean(errors.position)}
              {...register('position')}
            />
          </Field>
          <Field
            label="Appointment date"
            htmlFor="appointment_date"
            required
            error={errors.appointment_date?.message}
          >
            <Input
              id="appointment_date"
              type="date"
              invalid={Boolean(errors.appointment_date)}
              {...register('appointment_date')}
            />
          </Field>
          <Field
            label="Employment category"
            htmlFor="employment_category"
            required
            error={errors.employment_category?.message}
          >
            <Select
              id="employment_category"
              invalid={Boolean(errors.employment_category)}
              {...register('employment_category')}
            >
              {EMPLOYMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      {/* -- Bank details -- */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 ring-1 ring-ink-200">
              <Landmark className="size-4.5 text-ink-600" aria-hidden />
            </span>
            <div>
              <CardTitle>Bank details</CardTitle>
              <CardDescription>
                Confidential — visible only to you and administrators. Never
                shown to colleagues, and excluded from staff lists and exports.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Bank name" htmlFor="bank_name" required error={errors.bank_name?.message}>
            <Input
              id="bank_name"
              placeholder="Access Bank"
              invalid={Boolean(errors.bank_name)}
              {...register('bank_name')}
            />
          </Field>
          <Field
            label="Account name"
            htmlFor="bank_account_name"
            required
            error={errors.bank_account_name?.message}
          >
            <Input
              id="bank_account_name"
              invalid={Boolean(errors.bank_account_name)}
              {...register('bank_account_name')}
            />
          </Field>
          <Field
            label="Account number"
            htmlFor="bank_account_number"
            required
            error={errors.bank_account_number?.message}
          >
            <Input
              id="bank_account_number"
              inputMode="numeric"
              placeholder="0123456789"
              className="font-mono"
              invalid={Boolean(errors.bank_account_number)}
              {...register('bank_account_number')}
            />
          </Field>
        </CardContent>
      </Card>

      {/* -- Guarantor -- */}
      <Card>
        <CardHeader>
          <CardTitle>Guarantor</CardTitle>
          <CardDescription>
            A responsible person who has agreed to stand as guarantor for your
            appointment.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Guarantor name"
            htmlFor="guarantor_name"
            required
            error={errors.guarantor_name?.message}
          >
            <Input
              id="guarantor_name"
              invalid={Boolean(errors.guarantor_name)}
              {...register('guarantor_name')}
            />
          </Field>
          <Field
            label="Relationship"
            htmlFor="guarantor_relationship"
            required
            error={errors.guarantor_relationship?.message}
          >
            <Input
              id="guarantor_relationship"
              placeholder="Sibling"
              invalid={Boolean(errors.guarantor_relationship)}
              {...register('guarantor_relationship')}
            />
          </Field>
          <Field
            label="Guarantor phone"
            htmlFor="guarantor_phone"
            required
            error={errors.guarantor_phone?.message}
          >
            <Input
              id="guarantor_phone"
              type="tel"
              placeholder="+234 803 000 0000"
              invalid={Boolean(errors.guarantor_phone)}
              {...register('guarantor_phone')}
            />
          </Field>
          <Field
            label="Guarantor address"
            htmlFor="guarantor_address"
            required
            error={errors.guarantor_address?.message}
          >
            <Input
              id="guarantor_address"
              invalid={Boolean(errors.guarantor_address)}
              {...register('guarantor_address')}
            />
          </Field>
        </CardContent>
      </Card>

      {/* -- Next of kin -- */}
      <Card>
        <CardHeader>
          <CardTitle>Next of kin</CardTitle>
          <CardDescription>
            The person we contact in an emergency.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field
            label="Name"
            htmlFor="next_of_kin_name"
            required
            error={errors.next_of_kin_name?.message}
          >
            <Input
              id="next_of_kin_name"
              invalid={Boolean(errors.next_of_kin_name)}
              {...register('next_of_kin_name')}
            />
          </Field>
          <Field
            label="Relationship"
            htmlFor="next_of_kin_relationship"
            required
            error={errors.next_of_kin_relationship?.message}
          >
            <Input
              id="next_of_kin_relationship"
              placeholder="Spouse"
              invalid={Boolean(errors.next_of_kin_relationship)}
              {...register('next_of_kin_relationship')}
            />
          </Field>
          <Field
            label="Phone"
            htmlFor="next_of_kin_phone"
            required
            error={errors.next_of_kin_phone?.message}
          >
            <Input
              id="next_of_kin_phone"
              type="tel"
              placeholder="+234 803 000 0000"
              invalid={Boolean(errors.next_of_kin_phone)}
              {...register('next_of_kin_phone')}
            />
          </Field>
        </CardContent>
      </Card>

      {/* -- Supporting documents -- */}
      <Card>
        <CardHeader>
          <CardTitle>Supporting documents</CardTitle>
          <CardDescription>
            Upload clear scans or photographs. PNG, JPG or WEBP, up to 2 MB
            each.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Identity document"
            htmlFor="id_document"
            required
            error={errors.id_document?.message}
          >
            <Input
              id="id_document"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              invalid={Boolean(errors.id_document)}
              {...register('id_document')}
            />
            {idDocument && idDocument.length > 0 && (
              <FileSummary
                name={idDocument[0]?.name ?? ''}
                size={idDocument[0]?.size ?? 0}
              />
            )}
          </Field>

          <Field
            label="Qualification certificates"
            htmlFor="qualification_certificates"
            required
            error={errors.qualification_certificates?.message}
          >
            <Input
              id="qualification_certificates"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              invalid={Boolean(errors.qualification_certificates)}
              {...register('qualification_certificates')}
            />
            {certificates && certificates.length > 0 && (
              <FileSummary
                name={certificates[0]?.name ?? ''}
                size={certificates[0]?.size ?? 0}
              />
            )}
          </Field>
        </CardContent>
      </Card>

      {/* -- Rules of engagement -- */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 ring-1 ring-ink-200">
              <ScrollText className="size-4.5 text-ink-600" aria-hidden />
            </span>
            <div>
              <CardTitle>Rules of engagement</CardTitle>
              <CardDescription>
                The Mobigate Group code of conduct covers confidentiality, data
                protection, conflicts of interest and the handling of personnel
                records. Read it before you accept.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-ink-50 px-3.5 py-3 text-sm text-ink-600">
            <p>
              By accepting, you confirm that you have read the rules of
              engagement, that the information you have given is accurate, and
              that you will keep all personnel information confidential.
            </p>
          </div>

          <Controller
            control={control}
            name="rules_of_engagement"
            render={({ field }) => (
              <Checkbox
                id="rules_of_engagement"
                label="I have read and accept the rules of engagement"
                description="Your acceptance is recorded against your staff record with a timestamp."
                checked={field.value}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(event.target.checked)}
                aria-invalid={Boolean(errors.rules_of_engagement)}
              />
            )}
          />

          {errors.rules_of_engagement && (
            <p className="text-xs text-danger-600">
              {errors.rules_of_engagement.message}
            </p>
          )}

          {policies.length > 0 && (
            <div className="space-y-3 border-t border-ink-100 pt-4">
              <div>
                <p className="text-sm font-semibold text-ink-900">
                  Group policies
                </p>
                <p className="mt-0.5 text-xs text-ink-500">
                  These policies are maintained by the Mobigate Group
                  administration team.
                </p>
              </div>
              {policies.map((policy) => (
                <Checkbox
                  key={policy.id}
                  id={`policy-${policy.id}`}
                  label={policy.title}
                  description={policy.body}
                  checked={acceptedPolicies.includes(policy.id)}
                  onChange={(event) => {
                    setPolicyError(null)
                    setAcceptedPolicies((current) =>
                      event.target.checked
                        ? [...current, policy.id]
                        : current.filter((id) => id !== policy.id),
                    )
                  }}
                />
              ))}
              {policyError && (
                <p className="text-xs text-danger-600">{policyError}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col items-start gap-3 rounded-xl border border-ink-200 bg-white px-5 py-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-600">
          By submitting this form you confirm every detail is correct. Your
          Staff ID is issued on submission.
        </p>
        <Button type="submit" loading={isSubmitting} loadingText="Creating record">
          Submit staff details
          <ArrowRight />
        </Button>
      </div>
    </form>
  )
}

/* -------------------------------------------------------------------------- */
/*  Success                                                                   */
/* -------------------------------------------------------------------------- */

function SuccessState({ staffId, name }: { staffId: string; name: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="border-success-100">
        <CardContent className="space-y-6 py-8 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-100 ring-1 ring-success-100">
            <ShieldCheck className="size-7 text-success-700" aria-hidden />
          </span>

          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink-900">
              Your Staff ID
            </h1>
            <p className="mt-1.5 text-sm text-ink-500">
              {name ? `${name}, your` : 'Your'} staff record has been created.
              Keep this reference safe — it identifies your staff record and
              appears on all official documents.
            </p>
          </div>

          <div className="rounded-xl bg-ink-950 px-6 py-5">
            <p className="text-2xs font-semibold tracking-widest text-ink-400 uppercase">
              Staff ID
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {staffId}
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(staffId)
                .then(() => {
                  setCopied(true)
                  toast.success('Staff ID copied to clipboard')
                })
                .catch(() => toast.error('Could not copy the Staff ID'))
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? 'Copied' : 'Copy Staff ID'}
          </Button>

          <p className="text-xs text-ink-500">
            This ID is unique to you and is never reissued. Your access code
            has been consumed and cannot be used again.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Link to="/staff" className={buttonVariants({})}>
          Go to my profile
          <ArrowRight />
        </Link>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function FileSummary({ name, size }: { name: string; size: number }) {
  return (
    <p className="flex items-center gap-2 text-xs text-ink-500">
      <FileCheck2 className="size-3.5 shrink-0 text-success-600" aria-hidden />
      <span className="truncate">{name}</span>
      <span className="shrink-0 text-ink-400">{formatBytes(size)}</span>
    </p>
  )
}

/** Builds the "Country › State › LGA › City" path from a location id. */
function pathOf(
  locations: { id: string; parent_id: string | null; name: string }[],
  id: string,
): string {
  if (!id) return ''
  const parts: string[] = []
  let current = locations.find((l) => l.id === id)
  while (current) {
    parts.unshift(current.name)
    current = current.parent_id
      ? locations.find((l) => l.id === current?.parent_id)
      : undefined
  }
  return parts.join(' › ')
}

/** The date input wants YYYY-MM-DD; the API sends RFC3339 timestamps. */
function dateInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : ''
}

/**
 * Builds the multipart body for POST /staff/onboarding.
 *
 * Field names must match the Go contract exactly: the certificate upload is
 * `qualification_document`, rules acceptance is the string "true", and the
 * single `location_id` carries the deepest selected level (city, else LGA).
 */
function buildOnboardingForm(
  values: StaffDetailsValues,
  policyIds: string[] = [],
): FormData {
  const form = new FormData()
  form.set('first_name', values.first_name)
  form.set('last_name', values.last_name)
  form.set('email', values.email)
  form.set('phone', values.phone)
  form.set('gender', values.gender.toLowerCase())
  form.set('date_of_birth', values.date_of_birth)
  form.set('address_line', values.address_line)
  form.set('location_id', values.city_id || values.lga_id)
  form.set('department_id', values.department_id)
  form.set('position', values.position)
  form.set('appointment_date', values.appointment_date)
  form.set('employment_category', values.employment_category)
  form.set('bank_name', values.bank_name)
  form.set('bank_account_name', values.bank_account_name)
  form.set('bank_account_number', values.bank_account_number)
  form.set('guarantor_name', values.guarantor_name)
  form.set('guarantor_relationship', values.guarantor_relationship)
  form.set('guarantor_phone', values.guarantor_phone)
  form.set('guarantor_address', values.guarantor_address)
  form.set('next_of_kin_name', values.next_of_kin_name)
  form.set('next_of_kin_relationship', values.next_of_kin_relationship)
  form.set('next_of_kin_phone', values.next_of_kin_phone)
  form.set('rules_accepted', 'true')
  if (policyIds.length > 0) form.set('policy_ids', policyIds.join(','))

  const idFile = values.id_document?.[0]
  if (idFile) form.set('id_document', idFile)
  const qualificationFile = values.qualification_certificates?.[0]
  if (qualificationFile) form.set('qualification_document', qualificationFile)
  return form
}
