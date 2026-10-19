import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  Lock,
  Upload,
  X,
} from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, Spinner } from '@/components/ui/empty-state'
import { Field, Input, Select } from '@/components/ui/input'
import { adminApi, publicApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatBytes } from '@/lib/format'

const MAX_CV_BYTES = 5 * 1024 * 1024
const MAX_PHOTO_BYTES = 2 * 1024 * 1024

const GENDERS = ['Male', 'Female', 'Other'] as const

const applicationSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required'),
  last_name: z.string().trim().min(1, 'Last name is required'),
  email: z.email('Enter a valid email address'),
  phone: z
    .string()
    .trim()
    .min(7, 'Enter a valid phone number')
    .regex(/^[\d+][\d\s-]{6,}$/, 'Enter a valid phone number'),
  gender: z.enum(GENDERS, { error: 'Select a gender' }),
  date_of_birth: z.string().min(1, 'Date of birth is required'),
  country_id: z.string().min(1, 'Select a country'),
  state_id: z.string().min(1, 'Select a state'),
  lga_id: z.string().min(1, 'Select an LGA'),
  city_id: z.string().min(1, 'Select a city or town'),
  address_line: z.string().trim().min(1, 'Address is required'),
  qualification: z.string().trim().min(1, 'Enter your highest qualification'),
  cv: z
    .custom<FileList>(
      (value) => {
        if (!value || typeof value !== 'object') return false
        const list = value as { length?: number }
        return typeof list.length === 'number' && list.length > 0
      },
      'Attach your CV',
    )
    .refine(
      (files) => (files?.[0]?.size ?? 0) <= MAX_CV_BYTES,
      'Your CV must be 5 MB or smaller',
    )
    .refine(
      (files) => {
        const file = files?.[0]
        if (!file) return false
        return [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ].includes(file.type)
      },
      'Your CV must be a PDF, DOC or DOCX file',
    ),
  photo: z
    .custom<FileList>(
      (value) => {
        if (!value || typeof value !== 'object') return false
        const list = value as { length?: number }
        return typeof list.length === 'number' && list.length > 0
      },
      'Attach a recent photograph',
    )
    .refine(
      (files) => (files?.[0]?.size ?? 0) <= MAX_PHOTO_BYTES,
      'Your photograph must be 2 MB or smaller',
    )
    .refine(
      (files) => {
        const file = files?.[0]
        if (!file) return false
        return ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
      },
      'Your photograph must be a JPG, PNG or WEBP file',
    ),
})

type ApplicationValues = z.infer<typeof applicationSchema>

export function ApplyPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const jobQuery = useQuery({
    queryKey: ['public', 'job', slug],
    queryFn: () => publicApi.getJob(slug ?? ''),
    enabled: Boolean(slug),
  })

  const locationsQuery = useQuery({
    queryKey: ['public', 'locations'],
    queryFn: () => adminApi.listLocations(),
  })

  const job = jobQuery.data
  const locations = locationsQuery.data ?? []

  const countries = React.useMemo(
    () => locations.filter((l) => l.parent_id === null),
    [locations],
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ApplicationValues>({
    resolver: zodResolver(applicationSchema),
    mode: 'onTouched',
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      gender: 'Female',
      date_of_birth: '',
      country_id: '',
      state_id: '',
      lga_id: '',
      city_id: '',
      address_line: '',
      qualification: '',
    },
  })

  const countryId = watch('country_id')
  const stateId = watch('state_id')
  const lgaId = watch('lga_id')

  const states = React.useMemo(
    () => locations.filter((l) => l.parent_id === countryId),
    [locations, countryId],
  )
  const lgas = React.useMemo(
    () => locations.filter((l) => l.parent_id === stateId),
    [locations, stateId],
  )
  const cities = React.useMemo(
    () => locations.filter((l) => l.parent_id === lgaId),
    [locations, lgaId],
  )

  const submitMutation = useMutation({
    mutationFn: (values: ApplicationValues) =>
      publicApi.submitApplication({
        job_id: job?.id ?? '',
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email,
        phone: values.phone,
        gender: values.gender,
        date_of_birth: values.date_of_birth,
        location_id: values.city_id,
        address_line: values.address_line,
        qualification: values.qualification,
      }),
    onSuccess: (application) => {
      toast.success('Application received')
      navigate('/application/received', { state: { application } })
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'We could not submit your application. Please try again.',
      )
    },
  })

  if (jobQuery.isLoading) return <Spinner />

  if (!job) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <Card>
          <EmptyState
            icon={FileText}
            title="That role is not accepting applications"
            description="The vacancy may have been closed. Browse the current openings and pick another."
            action={
              <Link to="/" className={buttonVariants({})}>
                Browse open roles
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        to={`/jobs/${job.slug}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to the role
      </Link>

      <header className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
          Apply for {job.title}
        </h1>
        <p className="mt-2 text-sm text-ink-500 text-balance">
          Fields marked with an asterisk are required. Your application is
          reviewed by a person, and you will receive an application number as
          soon as you submit.
        </p>
      </header>

      <form
        onSubmit={handleSubmit((values) => submitMutation.mutate(values))}
        className="mt-8 space-y-6"
      >
        {/* -- Personal -- */}
        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <CardDescription>
              Enter your details exactly as they appear on your identification.
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
                {...register('first_name')}
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
                {...register('last_name')}
              />
            </Field>

            <Field
              label="Email address"
              htmlFor="email"
              required
              error={errors.email?.message}
              hint="We will send your application number here."
            >
              <Input
                id="email"
                type="email"
                autoComplete="email"
                invalid={Boolean(errors.email)}
                {...register('email')}
              />
            </Field>

            <Field
              label="Phone number"
              htmlFor="phone"
              required
              error={errors.phone?.message}
              hint="Used for SMS and WhatsApp updates."
            >
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+234 803 000 0000"
                invalid={Boolean(errors.phone)}
                {...register('phone')}
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
                autoComplete="bday"
                invalid={Boolean(errors.date_of_birth)}
                {...register('date_of_birth')}
              />
            </Field>
          </CardContent>
        </Card>

        {/* -- Location -- */}
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
            <CardDescription>
              Your local government area determines which regional office your
              application is considered for.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Country"
              htmlFor="country_id"
              required
              error={errors.country_id?.message}
            >
              <Select
                id="country_id"
                invalid={Boolean(errors.country_id)}
                value={countryId}
                onChange={(event) => {
                  setValue('country_id', event.target.value, { shouldValidate: true })
                  setValue('state_id', '')
                  setValue('lga_id', '')
                  setValue('city_id', '')
                }}
              >
                <option value="">Select a country</option>
                {countries.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="State"
              htmlFor="state_id"
              required
              error={errors.state_id?.message}
            >
              <Select
                id="state_id"
                invalid={Boolean(errors.state_id)}
                value={stateId}
                disabled={!countryId}
                onChange={(event) => {
                  setValue('state_id', event.target.value, { shouldValidate: true })
                  setValue('lga_id', '')
                  setValue('city_id', '')
                }}
              >
                <option value="">
                  {countryId ? 'Select a state' : 'Select a country first'}
                </option>
                {states.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Local Government Area"
              htmlFor="lga_id"
              required
              error={errors.lga_id?.message}
            >
              <Select
                id="lga_id"
                invalid={Boolean(errors.lga_id)}
                value={lgaId}
                disabled={!stateId}
                onChange={(event) => {
                  setValue('lga_id', event.target.value, { shouldValidate: true })
                  setValue('city_id', '')
                }}
              >
                <option value="">
                  {stateId ? 'Select an LGA' : 'Select a state first'}
                </option>
                {lgas.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="City or town"
              htmlFor="city_id"
              required
              error={errors.city_id?.message}
            >
              <Select
                id="city_id"
                invalid={Boolean(errors.city_id)}
                disabled={!lgaId}
                onChange={(event) =>
                  setValue('city_id', event.target.value, {
                    shouldValidate: true,
                  })
                }
              >
                <option value="">
                  {lgaId ? 'Select a city or town' : 'Select an LGA first'}
                </option>
                {cities.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Residential address"
              htmlFor="address_line"
              required
              error={errors.address_line?.message}
              className="sm:col-span-2"
            >
              <Input
                id="address_line"
                autoComplete="street-address"
                placeholder="12 Admiralty Way, Victoria Island"
                invalid={Boolean(errors.address_line)}
                {...register('address_line')}
              />
            </Field>
          </CardContent>
        </Card>

        {/* -- Qualification and documents -- */}
        <Card>
          <CardHeader>
            <CardTitle>Qualification and documents</CardTitle>
            <CardDescription>
              Your CV and photograph are visible only to the recruitment team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field
              label="Highest qualification"
              htmlFor="qualification"
              required
              error={errors.qualification?.message}
              hint="For example: BSc Computer Science, HND Business Administration"
            >
              <Input
                id="qualification"
                invalid={Boolean(errors.qualification)}
                {...register('qualification')}
              />
            </Field>

            <FileField
              id="cv"
              label="Curriculum vitae"
              required
              error={errors.cv?.message}
              accept=".pdf,.doc,.docx"
              hint="PDF, DOC or DOCX. Maximum 5 MB."
              icon={FileText}
              {...register('cv')}
            />

            <FileField
              id="photo"
              label="Recent photograph"
              required
              error={errors.photo?.message}
              accept="image/png,image/jpeg,image/webp"
              hint="JPG, PNG or WEBP. Maximum 2 MB."
              icon={ImageIcon}
              {...register('photo')}
            />
          </CardContent>
        </Card>

        {/* -- Role -- */}
        <Card>
          <CardHeader>
            <CardTitle>Role applied for</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink-900">{job.title}</p>
                <p className="mt-0.5 text-sm text-ink-500">
                  {job.location_name ?? 'Location to be confirmed'}
                </p>
              </div>
              <Link
                to={`/jobs/${job.slug}`}
                className="shrink-0 text-sm font-medium text-brand-700 hover:underline"
              >
                Change
              </Link>
            </div>
            <p className="text-sm text-ink-500">
              Applying for a different role? Return to the careers page and
              choose another vacancy.
            </p>
          </CardContent>
        </Card>

        {/* -- Privacy -- */}
        <div className="flex gap-3 rounded-xl border border-ink-200 bg-ink-50 p-4">
          <Lock className="mt-0.5 size-4 shrink-0 text-ink-400" aria-hidden />
          <p className="text-sm text-ink-600">
            Your application is used only to assess your suitability for this
            role and for the recruitment process. It is handled in line with
            the Nigeria Data Protection Act. If you are not shortlisted, your
            details are removed once the retention period expires.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link to="/" className={buttonVariants({ variant: 'outline' })}>
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className={buttonVariants({ size: 'lg' })}
          >
            {submitMutation.isPending ? 'Submitting…' : 'Submit application'}
          </button>
        </div>
      </form>
    </div>
  )
}

function FileField({
  id,
  label,
  hint,
  error,
  required,
  accept,
  icon: Icon,
  value,
  ...props
}: {
  id: string
  label: string
  hint?: string
  error?: string
  required?: boolean
  accept: string
  icon: typeof FileText
  value?: FileList
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [file, setFile] = React.useState<File | null>(null)

  return (
    <Field label={label} htmlFor={id} required={required} error={error} hint={hint}>
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border border-dashed border-ink-300 bg-ink-50/60 p-4',
          'transition-colors hover:border-brand-400 hover:bg-brand-50/40',
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-ink-500 ring-1 ring-ink-200">
          <Icon className="size-5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          {file ? (
            <>
              <p className="truncate text-sm font-medium text-ink-900">
                {file.name}
              </p>
              <p className="text-xs text-ink-500">{formatBytes(file.size)}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-ink-800">Choose a file</p>
              <p className="text-xs text-ink-500">
                {hint ?? 'No file selected'}
              </p>
            </>
          )}
        </div>

        <label
          htmlFor={id}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          <Upload />
          {file ? 'Replace' : 'Browse'}
        </label>

        {file && (
          <button
            type="button"
            onClick={() => setFile(null)}
            className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label={`Remove ${label}`}
          >
            <X className="size-4" />
          </button>
        )}

        <input
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null
            setFile(selected)
            props.onChange?.(event)
          }}
          {...props}
        />
      </div>
    </Field>
  )
}
