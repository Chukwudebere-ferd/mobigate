import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  FileCheck,
  FileUp,
  Image as ImageIcon,
  Info,
  Lock,
  MapPin,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import * as React from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
import { EmptyState, Spinner } from '@/components/ui/empty-state'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/input'
import { EmploymentCategoryBadge } from '@/components/ui/status-badges'
import {
  locationPath,
  publicApi,
  sortLocationsByName,
} from '@/lib/api'
import { ApiError } from '@/lib/api/client'
import { formatBytes, formatDate, untilNow } from '@/lib/format'
import { useSession } from '@/providers/session-provider'

const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const PHOTO_EXTENSIONS = /\.(png|jpe?g|webp)$/i

const applicationSchema = z
  .object({
    first_name: z.string().trim().min(1, 'First name is required'),
    last_name: z.string().trim().min(1, 'Last name is required'),
    phone: z
      .string()
      .trim()
      .min(7, 'Enter a valid phone number')
      .regex(/^[+0-9\s()-]{7,20}$/, 'Enter a valid phone number'),
    gender: z.enum(['Male', 'Female', 'Other'], {
      error: 'Select your gender',
    }),
    date_of_birth: z
      .string()
      .min(1, 'Date of birth is required')
      .refine(
        (value) =>
          !Number.isNaN(Date.parse(value)) && new Date(value) < new Date(),
        'Enter a valid date of birth',
      ),
    state_id: z.string().min(1, 'Select a state'),
    lga_id: z.string().min(1, 'Select an LGA'),
    town: z.string().trim().max(120).optional(),
    address_line: z.string().trim().min(3, 'Enter your residential address'),
    qualification: z
      .string()
      .trim()
      .min(2, 'Enter your highest qualification'),
    photo: z.custom<File | undefined>(
      (value) => value instanceof File,
      'Attach a passport photograph',
    ),
    consent: z
      .boolean()
      .refine(
        (value) => value,
        'Confirm that you agree to the data processing notice',
      ),
  })
  .superRefine((values, ctx) => {
    if (values.photo) {
      if (values.photo.size > MAX_PHOTO_BYTES) {
        ctx.addIssue({
          code: 'custom',
          path: ['photo'],
          message: 'Photograph must be 2 MB or smaller',
        })
      }
      if (!PHOTO_EXTENSIONS.test(values.photo.name)) {
        ctx.addIssue({
          code: 'custom',
          path: ['photo'],
          message: 'Attach a PNG, JPG or WEBP image',
        })
      }
    }
  })

type ApplicationFormValues = z.infer<typeof applicationSchema>

const GENDER_OPTIONS = ['Male', 'Female', 'Other'] as const

export function ApplyPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  // Register-before-apply (BR-09): the form is only offered to a signed-in
  // account, and the email is taken from that session — never the form.
  const { session, isLoading: sessionLoading } = useSession()

  const {
    data: job,
    isLoading: jobLoading,
  } = useQuery({
    queryKey: ['public', 'job', slug],
    queryFn: async () => (await publicApi.getJob(slug ?? '')) ?? null,
    enabled: Boolean(slug),
    retry: false,
  })

  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    mode: 'onTouched',
    defaultValues: {
      first_name: session?.user.first_name ?? '',
      last_name: session?.user.last_name ?? '',
      phone: '',
      gender: 'Male',
      date_of_birth: '',
      state_id: '',
      lga_id: '',
      town: '',
      address_line: '',
      qualification: '',
      photo: undefined,
      consent: false,
    },
  })

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = form

  const stateId = useWatch({ control, name: 'state_id' })
  const photoValue = useWatch({ control, name: 'photo' })

  const policiesQuery = useQuery({
    queryKey: ['public', 'policies', 'applicant'],
    queryFn: () => publicApi.listPolicies('applicant'),
  })
  const policies = policiesQuery.data ?? []
  const [acceptedPolicies, setAcceptedPolicies] = React.useState<string[]>([])
  const [policyError, setPolicyError] = React.useState<string | null>(null)

  const locationsQuery = useQuery({
    queryKey: ['public', 'locations'],
    queryFn: () => publicApi.listLocations(),
    staleTime: 5 * 60 * 1000,
  })

  const locationItems = locationsQuery.data
  const country = locationItems?.find((item) => item.type === 'country')
  const states = React.useMemo(() => {
    if (!locationItems || !country) return []
    return sortLocationsByName(
      locationItems.filter(
        (item) => item.type === 'state' && item.parent_id === country.id,
      ),
    )
  }, [country, locationItems])
  const lgas = React.useMemo(() => {
    if (!locationItems || !stateId) return []
    return sortLocationsByName(
      locationItems.filter(
        (item) => item.type === 'lga' && item.parent_id === stateId,
      ),
    )
  }, [locationItems, stateId])

  const mutation = useMutation({
    mutationFn: publicApi.submitApplication,
    onSuccess: (application) => {
      toast.success('Application submitted successfully')
      navigate('/application/received', { state: { application } })
    },
    onError: (error: unknown) => {
      // 409 is the server's duplicate guard (BR-09): one open application
      // per role.
      if (error instanceof ApiError && error.status === 409) {
        toast.error(
          'You already have an open application for this role. Track it from your portal.',
        )
        return
      }
      toast.error(
        error instanceof Error
          ? error.message
          : 'We could not submit your application. Please try again.',
      )
    },
  })

  const onSubmit = handleSubmit((values) => {
    if (!job) return
    const missing = policies.filter(
      (policy) => policy.required && !acceptedPolicies.includes(policy.id),
    )
    if (missing.length > 0) {
      setPolicyError(
        `Accept ${missing.map((policy) => policy.title).join(', ')} to continue.`,
      )
      return
    }
    setPolicyError(null)
    mutation.mutate({
      job_id: job.id,
      policy_ids: acceptedPolicies,
      first_name: values.first_name,
      last_name: values.last_name,
      phone: values.phone,
      gender: values.gender.toLowerCase(),
      date_of_birth: values.date_of_birth,
      location_id: values.lga_id,
      address_line: values.town
        ? `${values.town}, ${values.address_line}`
        : values.address_line,
      qualification: values.qualification,
      consent: values.consent,
      photo: values.photo,
    })
  })

  if (sessionLoading || jobLoading) {
    return (
      <div className="bg-ink-50">
        <Spinner />
      </div>
    )
  }

  // Register-before-apply: an anonymous visitor is pointed at the account
  // pages instead of a form they could not submit anyway.
  if (!session) {
    return (
      <div className="bg-ink-50">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <Card>
            <EmptyState
              icon={Lock}
              title="Create an account to apply"
              description={
                job
                  ? `Applying for ${job.title} requires an account — it keeps your applications and their status in one place.`
                  : 'Applying for a role requires an account — it keeps your applications and their status in one place.'
              }
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Link
                    to="/signup"
                    className={buttonVariants({ variant: 'primary' })}
                  >
                    Create an account
                  </Link>
                  <Link
                    to={`/login?next=${encodeURIComponent(`/apply/${slug ?? ''}`)}`}
                    className={buttonVariants({ variant: 'outline' })}
                  >
                    I already have an account
                  </Link>
                </div>
              }
            />
          </Card>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="bg-ink-50">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <Card>
            <EmptyState
              icon={Info}
              title="This role is not accepting applications"
              description="The position may have been closed or the link is incorrect. Browse the current openings to apply for another role."
              action={
                <Link to="/" className={buttonVariants({})}>
                  Back to open roles
                </Link>
              }
            />
          </Card>
        </div>
      </div>
    )
  }

  const locationLabel = job.location_name ?? locationPath(job.location_id)

  return (
    <div className="bg-ink-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          to={`/jobs/${job.slug}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 transition-colors hover:text-ink-900"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Back to role details
        </Link>

        <div className="mt-4">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            Application form
          </h1>
          <p className="mt-1.5 text-sm text-ink-500">
            Applying for{' '}
            <span className="font-medium text-ink-700">{job.title}</span> —{' '}
            {locationLabel}. Fields marked with{' '}
            <span className="font-semibold text-danger-600">*</span> are
            required.
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
          {/* -- 1. Personal details -- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-xs font-semibold text-brand-700">
                  1
                </span>
                Personal details
              </CardTitle>
              <CardDescription>
                As printed on your identification.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field
                label="First name"
                htmlFor="first_name"
                required
                error={errors.first_name?.message}
              >
                <Input
                  id="first_name"
                  autoComplete="given-name"
                  invalid={Boolean(errors.first_name)}
                  {...form.register('first_name')}
                />
              </Field>

              <Field
                label="Last name"
                htmlFor="last_name"
                required
                error={errors.last_name?.message}
              >
                <Input
                  id="last_name"
                  autoComplete="family-name"
                  invalid={Boolean(errors.last_name)}
                  {...form.register('last_name')}
                />
              </Field>

              <Field
                label="Email address"
                htmlFor="email"
                required
                hint="Taken from your account. Applications are tied to it."
              >
                <Input
                  id="email"
                  type="email"
                  value={session.user.email}
                  readOnly
                  aria-readonly
                />
              </Field>

              <Field
                label="Phone number"
                htmlFor="phone"
                required
                error={errors.phone?.message}
                hint="We call shortlisted candidates on this number."
              >
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+234 803 000 0000"
                  invalid={Boolean(errors.phone)}
                  {...form.register('phone')}
                />
              </Field>

              <Field
                label="Gender"
                htmlFor="gender"
                required
                error={errors.gender?.message}
              >
                <Select
                  id="gender"
                  invalid={Boolean(errors.gender)}
                  {...form.register('gender')}
                >
                  {GENDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
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
                  autoComplete="bday"
                  invalid={Boolean(errors.date_of_birth)}
                  {...form.register('date_of_birth')}
                />
              </Field>
            </CardContent>
          </Card>

          {/* -- 2. Location -- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-xs font-semibold text-brand-700">
                  2
                </span>
                Location
              </CardTitle>
              <CardDescription>Where you currently live.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Country" htmlFor="country" required>
                <Input
                  id="country"
                  value={country?.name ?? 'Nigeria'}
                  readOnly
                  aria-readonly
                />
              </Field>

              <Field
                label="State"
                htmlFor="state_id"
                required
                error={errors.state_id?.message}
              >
                <Controller
                  control={control}
                  name="state_id"
                  render={({ field }) => (
                    <Select
                      id="state_id"
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onBlur={field.onBlur}
                      disabled={locationsQuery.isLoading || states.length === 0}
                      onChange={(event) => {
                        field.onChange(event.target.value)
                        setValue('lga_id', '')
                      }}
                      invalid={Boolean(errors.state_id)}
                    >
                      <option value="">
                        {locationsQuery.isLoading
                          ? 'Loading states…'
                          : 'Select a state'}
                      </option>
                      {states.map((state) => (
                        <option key={state.id} value={state.id}>
                          {state.name}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </Field>

              <Field
                label="Local government area"
                htmlFor="lga_id"
                required
                error={errors.lga_id?.message}
              >
                <Controller
                  control={control}
                  name="lga_id"
                  render={({ field }) => (
                    <Select
                      id="lga_id"
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onBlur={field.onBlur}
                      disabled={!stateId || lgas.length === 0}
                      onChange={(event) => field.onChange(event.target.value)}
                      invalid={Boolean(errors.lga_id)}
                    >
                      <option value="">
                        {stateId ? 'Select an LGA' : 'Select a state first'}
                      </option>
                      {lgas.map((lga) => (
                        <option key={lga.id} value={lga.id}>
                          {lga.name}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </Field>

              <Field
                label="City / town"
                htmlFor="town"
                error={errors.town?.message}
                hint="Optional. Added to your residential address."
              >
                <Input
                  id="town"
                  autoComplete="address-level2"
                  placeholder="e.g. Ikeja"
                  invalid={Boolean(errors.town)}
                  {...form.register('town')}
                />
              </Field>

              <Field
                label="Residential address"
                htmlFor="address_line"
                required
                error={errors.address_line?.message}
                className="sm:col-span-2"
                hint="Street and area, as it appears on your utility bill."
              >
                <Textarea
                  id="address_line"
                  autoComplete="street-address"
                  rows={2}
                  invalid={Boolean(errors.address_line)}
                  {...form.register('address_line')}
                />
              </Field>

              {locationsQuery.isError && (
                <p
                  className="text-sm text-danger-600 sm:col-span-2"
                  role="alert"
                >
                  We could not load the location list. Refresh the page and try
                  again.
                </p>
              )}
            </CardContent>
          </Card>

          {/* -- 3. Qualification & documents -- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-xs font-semibold text-brand-700">
                  3
                </span>
                Qualification &amp; photograph
              </CardTitle>
              <CardDescription>
                Your highest qualification and a passport photograph.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                label="Highest qualification"
                htmlFor="qualification"
                required
                error={errors.qualification?.message}
                hint="For example: BSc Computer Science, HND Accounting, MBA."
              >
                <Input
                  id="qualification"
                  invalid={Boolean(errors.qualification)}
                  {...form.register('qualification')}
                />
              </Field>

              <Field
                label="Passport photograph"
                htmlFor="photo"
                required
                error={errors.photo?.message}
              >
                <FileDropzone
                  id="photo"
                  icon={ImageIcon}
                  title="Upload a photograph"
                  hint="PNG, JPG or WEBP — up to 2 MB"
                  accept="image/png,image/jpeg,image/webp"
                  file={photoValue}
                  onSelect={(file) =>
                    setValue('photo', file, { shouldValidate: true })
                  }
                  onClear={() =>
                    setValue('photo', undefined, { shouldValidate: true })
                  }
                />
              </Field>
            </CardContent>
          </Card>

          {/* -- 4. Role applied for -- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-xs font-semibold text-brand-700">
                  4
                </span>
                Role applied for
              </CardTitle>
              <CardDescription>
                Taken from the link you opened — it cannot be changed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-2xs font-semibold tracking-wide text-ink-400 uppercase">
                    Role
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-ink-900">
                    {job.title}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs font-semibold tracking-wide text-ink-400 uppercase">
                    Location
                  </dt>
                  <dd className="mt-1 flex items-center gap-1.5 text-sm text-ink-700">
                    <MapPin aria-hidden className="size-3.5" />
                    {locationLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs font-semibold tracking-wide text-ink-400 uppercase">
                    Employment category
                  </dt>
                  <dd className="mt-1">
                    {job.employment_category ? (
                      <EmploymentCategoryBadge
                        category={job.employment_category}
                      />
                    ) : (
                      <span className="text-sm text-ink-700">Not specified</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-2xs font-semibold tracking-wide text-ink-400 uppercase">
                    Applications close
                  </dt>
                  <dd className="mt-1 text-sm text-ink-700">
                    {formatDate(job.deadline_at)} ({untilNow(job.deadline_at)})
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* -- Submit -- */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex gap-2.5 text-xs text-ink-500">
                <ShieldCheck
                  aria-hidden
                  className="size-4 shrink-0 text-ink-400"
                />
                <p>
                  Your details are used only for this recruitment exercise, in
                  line with the Nigeria Data Protection Act. We never share them
                  outside Mobigate Group without your consent.
                </p>
              </div>

              <div>
                <Checkbox
                  id="consent"
                  label="I agree to Mobigate Group processing my personal data for this recruitment exercise."
                  description="This includes my contact details, qualifications and uploaded documents. I can request access or erasure after the retention period."
                  {...form.register('consent')}
                />
                {errors.consent?.message ? (
                  <p className="mt-1.5 text-xs text-danger-600">
                    {errors.consent.message}
                  </p>
                ) : null}
              </div>

              {policies.length > 0 && (
                <div className="space-y-3 rounded-lg border border-ink-200 bg-ink-50/60 p-3.5">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">
                      Group policies
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      Please read and accept each policy before submitting.
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

              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="lg"
                  loading={mutation.isPending || isSubmitting}
                  loadingText="Submitting…"
                  className="w-full shrink-0 sm:w-auto"
                >
                  Submit application
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="pb-2 text-center text-xs text-ink-500">
            <Lock aria-hidden className="mr-1 inline size-3.5" />
            Your application is stored securely and reviewed by the recruitment
            team only.
          </p>
        </form>
      </div>
    </div>
  )
}

function FileDropzone({
  id,
  icon: Icon,
  title,
  hint,
  accept,
  file,
  onSelect,
  onClear,
}: {
  id: string
  icon: typeof FileUp
  title: string
  hint: string
  accept: string
  file: File | undefined
  onSelect: (file: File) => void
  onClear: () => void
}) {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!file) {
      // oxlint-disable-next-line react/set-state-in-effect
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    // The preview URL is an external resource created for the selected File;
    // it must be regenerated on every StrictMode effect run.
    // oxlint-disable-next-line react/set-state-in-effect
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="rounded-lg border border-dashed border-ink-300 bg-ink-50/60 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white ring-1 ring-ink-200">
          <Icon aria-hidden className="size-4 text-ink-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-800">{title}</p>
          <p className="text-xs text-ink-500">{hint}</p>
        </div>
      </div>

      {file ? (
        <div className="mt-3 flex items-center gap-2.5 rounded-md border border-ink-200 bg-white px-3 py-2">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className="size-9 shrink-0 rounded-md object-cover ring-1 ring-ink-200"
            />
          ) : (
            <FileCheck aria-hidden className="size-4 shrink-0 text-success-600" />
          )}
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink-700">
            {file.name}
          </span>
          <span className="text-2xs text-ink-500">{formatBytes(file.size)}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-6 shrink-0 px-1.5 text-2xs"
          >
            Remove
          </Button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-ink-700 ring-1 ring-ink-200 transition-colors hover:bg-ink-50 focus-within:ring-brand-500"
        >
          <Upload aria-hidden className="size-3.5" />
          Choose file
        </label>
      )}

      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          const selected = event.target.files?.[0]
          if (selected) onSelect(selected)
          event.target.value = ''
        }}
      />
    </div>
  )
}
