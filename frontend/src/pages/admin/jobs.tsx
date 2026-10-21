import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Archive,
  Briefcase,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, Spinner } from '@/components/ui/empty-state'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import {
  EmploymentCategoryBadge,
  JobStatusBadge,
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
  locationPath,
  sortLocationsByPath,
} from '@/lib/api'
import { formatDate } from '@/lib/format'
import { EMPLOYMENT_CATEGORIES, JOB_STATUSES } from '@/types/domain'
import type { EmploymentCategory, Job, JobStatus } from '@/types/domain'

const STATUS_LABELS: Record<JobStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  closed: 'Closed',
  archived: 'Archived',
}

const CATEGORY_LABELS: Record<EmploymentCategory, string> = {
  director: 'Director',
  employee: 'Employee',
  contractor: 'Contractor',
  partner: 'Partner',
}

/** Sentinel value for the "type your own category" option. */
const CUSTOM_CATEGORY = '__custom__'

interface JobForm {
  title: string
  slug: string
  description: string
  requirements: string
  location_id: string
  employment_category: string
  custom_category: string
  openings: string
  publish_at: string
  deadline_at: string
  status: JobStatus
}

const EMPTY_FORM: JobForm = {
  title: '',
  slug: '',
  description: '',
  requirements: '',
  location_id: '',
  employment_category: '',
  custom_category: '',
  openings: '1',
  publish_at: '',
  deadline_at: '',
  status: 'draft',
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** `2026-04-01` → `2026-04-01` for date inputs; ISO strings are trimmed. */
function toDateInput(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 10)
}

function jobToForm(job: Job | null): JobForm {
  if (!job) return EMPTY_FORM
  const category = job.employment_category ?? ''
  const isPreset = (EMPLOYMENT_CATEGORIES as readonly string[]).includes(category)
  return {
    title: job.title,
    slug: job.slug,
    description: job.description,
    requirements: job.requirements ?? '',
    location_id: job.location_id ?? '',
    employment_category:
      category === '' ? '' : isPreset ? category : CUSTOM_CATEGORY,
    custom_category: category !== '' && !isPreset ? category : '',
    openings: String(job.openings ?? 1),
    publish_at: toDateInput(job.publish_at),
    deadline_at: toDateInput(job.deadline_at),
    status: job.status,
  }
}

function JobEditorDialog({
  open,
  job,
  onOpenChange,
}: {
  open: boolean
  job: Job | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<JobForm>(() => jobToForm(job))
  const [errors, setErrors] = useState<Record<string, string>>({})
  // An existing posting keeps its slug unless the admin edits the field.
  const [slugTouched, setSlugTouched] = useState(() => Boolean(job))

  const locationsQuery = useQuery({
    queryKey: ['admin', 'locations'],
    queryFn: () => adminApi.listLocations(),
    enabled: open,
  })

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Job>) =>
      job ? adminApi.updateJob(job.id, payload) : adminApi.createJob(payload),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] })
      toast.success(
        job
          ? `“${saved.title}” updated.`
          : `“${saved.title}” created as ${STATUS_LABELS[saved.status].toLowerCase()}.`,
      )
      onOpenChange(false)
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not save the job posting.',
      )
    },
  })

  function update<K extends keyof JobForm>(key: K, value: JobForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }))
    setErrors((previous) => {
      if (!previous[key as string]) return previous
      const next = { ...previous }
      delete next[key as string]
      return next
    })
  }

  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!form.title.trim()) next.title = 'A title is required.'
    if (!form.description.trim()) next.description = 'A description is required.'
    if (form.employment_category === CUSTOM_CATEGORY) {
      const custom = form.custom_category.trim()
      if (!custom) {
        next.custom_category = 'Enter a category name.'
      } else if (custom.length > 80) {
        next.custom_category = 'Keep the category to 80 characters or fewer.'
      }
    }
    if (form.publish_at && form.deadline_at) {
      if (form.deadline_at <= form.publish_at) {
        next.deadline_at = 'The deadline must fall after the publish date.'
      }
    }
    if (form.openings !== '') {
      const openings = Number(form.openings)
      if (!Number.isFinite(openings) || openings < 1) {
        next.openings = 'There must be at least one opening.'
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function submit() {
    if (!validate()) return
    const employmentCategory =
      form.employment_category === CUSTOM_CATEGORY
        ? form.custom_category.trim()
        : form.employment_category
    const payload: Partial<Job> = {
      title: form.title.trim(),
      slug: form.slug.trim() || slugify(form.title),
      description: form.description.trim(),
      requirements: form.requirements.trim(),
      location_id: form.location_id || null,
      employment_category: employmentCategory || null,
      openings: Number(form.openings) || 1,
      publish_at: form.publish_at ? new Date(form.publish_at).toISOString() : null,
      deadline_at: form.deadline_at
        ? new Date(form.deadline_at).toISOString()
        : null,
      status: form.status,
    }
    saveMutation.mutate(payload)
  }

  const locations = sortLocationsByPath(locationsQuery.data ?? [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="sm:max-w-3xl">
      <DialogHeader>
        <div className="min-w-0">
          <DialogTitle>{job ? 'Edit job posting' : 'Post a new role'}</DialogTitle>
          <DialogDescription>
            {job
              ? 'Update the details of this posting.'
              : 'Create a posting and publish it when you are ready.'}
          </DialogDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onOpenChange(false)}
          aria-label="Close job editor"
        >
          <X />
        </Button>
      </DialogHeader>

      <DialogBody className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Job title"
            htmlFor="job-title"
            required
            error={errors.title}
          >
            <Input
              id="job-title"
              value={form.title}
              onChange={(event) => {
                const title = event.target.value
                setForm((previous) => ({
                  ...previous,
                  title,
                  slug: slugTouched
                    ? previous.slug
                    : slugify(title),
                }))
                setErrors((previous) => {
                  const next = { ...previous }
                  delete next.title
                  return next
                })
              }}
              invalid={Boolean(errors.title)}
              placeholder="Senior Backend Engineer"
            />
          </Field>

          <Field
            label="Slug"
            htmlFor="job-slug"
            hint="Used in the public URL: /jobs/<slug>"
          >
            <Input
              id="job-slug"
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true)
                update('slug', event.target.value)
              }}
              placeholder="senior-backend-engineer"
            />
          </Field>
        </div>

        <Field
          label="Description"
          htmlFor="job-description"
          required
          error={errors.description}
        >
          <Textarea
            id="job-description"
            rows={5}
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            invalid={Boolean(errors.description)}
            placeholder="What the role involves and who you are looking for."
          />
        </Field>

        <Field
          label="Requirements"
          htmlFor="job-requirements"
          hint="One requirement per line."
        >
          <Textarea
            id="job-requirements"
            rows={4}
            value={form.requirements}
            onChange={(event) => update('requirements', event.target.value)}
            placeholder={'5+ years in backend engineering\nStrong Go or TypeScript experience'}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Location" htmlFor="job-location">
            <Select
              id="job-location"
              value={form.location_id}
              onChange={(event) => update('location_id', event.target.value)}
            >
              <option value="">Not specified</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {locationPath(location.id)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Employment category" htmlFor="job-category">
            <Select
              id="job-category"
              value={form.employment_category}
              onChange={(event) => {
                const value = event.target.value
                update('employment_category', value)
                if (value !== CUSTOM_CATEGORY) {
                  update('custom_category', '')
                }
              }}
            >
              <option value="">Not specified</option>
              {EMPLOYMENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </option>
              ))}
              <option value={CUSTOM_CATEGORY}>Other / custom…</option>
            </Select>
          </Field>

          {form.employment_category === CUSTOM_CATEGORY && (
            <Field
              label="Custom category"
              htmlFor="job-custom-category"
              error={errors.custom_category}
              hint="Type the category exactly as it should appear."
            >
              <Input
                id="job-custom-category"
                value={form.custom_category}
                maxLength={80}
                onChange={(event) =>
                  update('custom_category', event.target.value)
                }
                placeholder="e.g. Intern, Consultant, Apprentice"
                invalid={Boolean(errors.custom_category)}
              />
            </Field>
          )}

          <Field
            label="Openings"
            htmlFor="job-openings"
            error={errors.openings}
          >
            <Input
              id="job-openings"
              type="number"
              min={1}
              value={form.openings}
              onChange={(event) => update('openings', event.target.value)}
              invalid={Boolean(errors.openings)}
            />
          </Field>

          <Field label="Status" htmlFor="job-status">
            <Select
              id="job-status"
              value={form.status}
              onChange={(event) =>
                update('status', event.target.value as JobStatus)
              }
            >
              {JOB_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Publish date" htmlFor="job-publish-at">
            <Input
              id="job-publish-at"
              type="date"
              value={form.publish_at}
              onChange={(event) => update('publish_at', event.target.value)}
            />
          </Field>

          <Field
            label="Deadline"
            htmlFor="job-deadline-at"
            error={errors.deadline_at}
          >
            <Input
              id="job-deadline-at"
              type="date"
              value={form.deadline_at}
              onChange={(event) => update('deadline_at', event.target.value)}
              invalid={Boolean(errors.deadline_at)}
            />
          </Field>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={submit}
          loading={saveMutation.isPending}
          loadingText="Saving…"
        >
          {job ? 'Save changes' : 'Create posting'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

export function AdminJobsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Job | null>(null)

  const statusFilter = searchParams.get('status') as JobStatus | null
  const search = searchParams.get('search') ?? ''

  const jobsQuery = useQuery({
    queryKey: ['admin', 'jobs'],
    queryFn: () => adminApi.listJobs(),
  })

  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; status: JobStatus }) =>
      adminApi.updateJob(vars.id, { status: vars.status }),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] })
      toast.success(`Posting marked as ${STATUS_LABELS[variables.status].toLowerCase()}.`)
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not update the posting.',
      )
    },
  })

  const jobs = useMemo(() => {
    const all = jobsQuery.data ?? []
    const needle = search.trim().toLowerCase()
    return all.filter((job) => {
      if (statusFilter && job.status !== statusFilter) return false
      if (!needle) return true
      return (
        job.title.toLowerCase().includes(needle) ||
        job.slug.toLowerCase().includes(needle)
      )
    })
  }, [jobsQuery.data, search, statusFilter])

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams)
    if (!value) params.delete(key)
    else params.set(key, value)
    setSearchParams(params, { replace: true })
  }

  function openCreate() {
    setEditing(null)
    setEditorOpen(true)
  }

  function openEdit(job: Job) {
    setEditing(job)
    setEditorOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job postings"
        description="Create, publish and close the roles you are recruiting for."
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus />
            Post new role
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>
            {jobsQuery.isLoading
              ? 'Loading postings…'
              : `${jobs.length} posting${jobs.length === 1 ? '' : 's'}.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-2/3">
            <Field label="Search" htmlFor="jobs-search">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-400"
                  aria-hidden
                />
                <Input
                  id="jobs-search"
                  type="search"
                  className="pl-8"
                  placeholder="Search by title or slug"
                  value={search}
                  onChange={(event) =>
                    setParam('search', event.target.value || null)
                  }
                />
              </div>
            </Field>

            <Field label="Status" htmlFor="jobs-status">
              <Select
                id="jobs-status"
                value={statusFilter ?? 'all'}
                onChange={(event) =>
                  setParam(
                    'status',
                    event.target.value === 'all' ? null : event.target.value,
                  )
                }
              >
                <option value="all">All statuses</option>
                {JOB_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {jobsQuery.isLoading ? (
            <Spinner />
          ) : jobs.length === 0 ? (
            (jobsQuery.data ?? []).length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No job postings yet"
                description="Post your first role to start receiving applications."
                action={
                  <Button type="button" onClick={openCreate}>
                    <Plus />
                    Post your first role
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Search}
                title="No postings match these filters"
                description="Try a different search term or clear the status filter."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setSearchParams(new URLSearchParams(), { replace: true })
                    }
                  >
                    <X />
                    Clear filters
                  </Button>
                }
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Openings</TableHead>
                  <TableHead className="text-right">Applications</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead className="w-56 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>
                      <p className="text-sm font-medium text-ink-900">
                        {job.title}
                      </p>
                      <p className="font-mono text-2xs text-ink-500">
                        /{job.slug}
                      </p>
                    </TableCell>
                    <TableCell>
                      <JobStatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="max-w-52 truncate text-ink-600">
                      {job.location_name ??
                        (job.location_id ? locationPath(job.location_id) : '—')}
                    </TableCell>
                    <TableCell>
                      {job.employment_category ? (
                        <EmploymentCategoryBadge
                          category={job.employment_category}
                        />
                      ) : (
                        <span className="text-2xs text-ink-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular">
                      {job.openings}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={`/admin/applications?job_id=${job.id}`}
                        className="text-sm font-medium text-brand-700 tabular hover:underline"
                      >
                        {job.applications_count ?? 0}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-ink-600">
                      {job.deadline_at ? formatDate(job.deadline_at) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(job)}
                        >
                          <Pencil />
                          Edit
                        </Button>

                        {job.status === 'published' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              statusMutation.mutate({
                                id: job.id,
                                status: 'closed',
                              })
                            }
                            disabled={statusMutation.isPending}
                          >
                            <EyeOff />
                            Close
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              statusMutation.mutate({
                                id: job.id,
                                status: 'published',
                              })
                            }
                            disabled={statusMutation.isPending}
                          >
                            <Eye />
                            Publish
                          </Button>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Archive ${job.title}`}
                          onClick={() =>
                            statusMutation.mutate({
                              id: job.id,
                              status: 'archived',
                            })
                          }
                          disabled={
                            job.status === 'archived' ||
                            statusMutation.isPending
                          }
                        >
                          <Archive />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <JobEditorDialog
        key={`${editing?.id ?? 'new'}-${editorOpen ? 'open' : 'closed'}`}
        open={editorOpen}
        job={editing}
        onOpenChange={setEditorOpen}
      />
    </div>
  )
}
