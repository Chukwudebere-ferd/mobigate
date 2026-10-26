/**
 * Admin › Settings (README M13).
 *
 * Covers the configuration surface: the shortlist confirmation message and
 * the other message templates, access-code settings, admin accounts, and the
 * notification delivery log where a failed SMS surfaces.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  FileText,
  KeyRound,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Type,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserStatusBadge } from '@/components/ui/status-badges'
import { adminApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, fullName } from '@/lib/format'
import {
  ADMIN_FONT_SIZES,
  useAdminDisplay,
  type AdminFontSize,
} from '@/lib/admin-display'
import { useSession } from '@/providers/session-provider'
import type {
  MessageTemplate,
  Notification,
  NotificationChannel,
  Policy,
  PolicyAudience,
  User,
  UserRole,
} from '@/types/domain'

const CONFIRMATION_KEY = 'shortlist_confirmation'

const channelLabels: Record<NotificationChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
}

const channelVariants: Record<
  NotificationChannel,
  'brand' | 'info' | 'success'
> = {
  email: 'brand',
  sms: 'info',
  whatsapp: 'success',
}

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
  applicant: 'Applicant',
}

const roleVariants: Record<
  UserRole,
  'accent' | 'brand' | 'neutral' | 'outline'
> = {
  super_admin: 'accent',
  admin: 'brand',
  staff: 'neutral',
  applicant: 'outline',
}

const notificationStatusTone: Record<
  Notification['status'],
  'success' | 'warning' | 'danger' | 'info'
> = {
  sent: 'success',
  failed: 'danger',
  pending: 'warning',
  read: 'info',
}

export function AdminSettingsPage() {
  const { role } = useSession()
  const isSuperAdmin = role === 'super_admin'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Message templates, access-code rules, admin accounts and the notification delivery log for the Group."
        icon={ShieldCheck}
      />

      <Tabs defaultValue="confirmation">
        <TabsList>
          <TabsTrigger value="confirmation">Confirmation messages</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
          <TabsTrigger value="email">Email templates</TabsTrigger>
          <TabsTrigger value="codes">Access code settings</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="users">Users &amp; admins</TabsTrigger>
          )}
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="confirmation" className="pt-5">
          <ConfirmationTemplates />
        </TabsContent>
        <TabsContent value="display" className="pt-5">
          <DisplaySettings />
        </TabsContent>
        <TabsContent value="email" className="pt-5">
          <EmailTemplates />
        </TabsContent>
        <TabsContent value="codes" className="pt-5">
          <AccessCodeSettings />
        </TabsContent>
        <TabsContent value="policies" className="pt-5">
          <PoliciesPanel />
        </TabsContent>
        {isSuperAdmin && (
          <TabsContent value="users" className="pt-5">
            <UsersAndAdmins />
          </TabsContent>
        )}
        <TabsContent value="notifications" className="pt-5">
          <NotificationLog />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* -- Display ------------------------------------------------------------- */

const FONT_SIZE_LABELS: Record<AdminFontSize, { label: string; hint: string }> = {
  14: { label: 'Compact', hint: 'More content on screen' },
  16: { label: 'Default', hint: 'Balanced reading size' },
  18: { label: 'Large', hint: 'Easier on the eyes' },
}

function DisplaySettings() {
  const { fontSize, setFontSize } = useAdminDisplay()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Type className="size-4 text-ink-400" aria-hidden />
          Admin text size
        </CardTitle>
        <p className="text-sm text-ink-500">
          Choose how large the admin dashboard text appears. This preference
          is saved in this browser only.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          role="radiogroup"
          aria-label="Admin text size"
          className="grid gap-3 sm:grid-cols-3"
        >
          {ADMIN_FONT_SIZES.map((size) => {
            const active = fontSize === size
            return (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setFontSize(size)}
                className={cn(
                  'rounded-lg border p-4 text-left transition-colors',
                  active
                    ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-200'
                    : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-900">
                    {FONT_SIZE_LABELS[size].label}
                  </span>
                  {active && (
                    <span className="text-2xs font-semibold text-brand-700">
                      Selected
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs text-ink-500">
                  {FONT_SIZE_LABELS[size].hint}
                </span>
                <span
                  className="mt-3 block font-semibold text-ink-800"
                  style={{ fontSize: `${size}px` }}
                >
                  Aa · {size}px
                </span>
              </button>
            )
          })}
        </div>

        <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-4">
          <p className="text-2xs font-semibold tracking-wider text-ink-400 uppercase">
            Preview
          </p>
          <p
            className="mt-1.5 font-semibold text-ink-900"
            style={{ fontSize: `${fontSize}px` }}
          >
            Applications and staff records
          </p>
          <p className="mt-1 text-ink-600" style={{ fontSize: `${fontSize}px` }}>
            This is how body text will appear across the admin workspace.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/* -- Templates ----------------------------------------------------------- */

function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => adminApi.listTemplates(),
  })
}

function TemplateCard({
  template,
  onEdit,
  onTest,
  testing,
}: {
  template: MessageTemplate
  onEdit: (template: MessageTemplate) => void
  onTest: (template: MessageTemplate) => void
  testing: boolean
}) {
  const body = template.body
  const subject = template.subject
  const variables = Object.keys(template.variables)

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-ink-700">{template.key}</span>
            <Badge variant={channelVariants[template.channel]}>
              {channelLabels[template.channel]}
            </Badge>
          </CardTitle>
          {subject && (
            <p className="mt-1.5 text-sm text-ink-700">{subject}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(template)}
          >
            <Pencil />
            Edit template
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={testing}
            onClick={() => onTest(template)}
          >
            <Send />
            Send test
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-ink-200 bg-ink-50/70 p-3">
          <p className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
            Body
          </p>
          <p className="mt-1.5 text-sm whitespace-pre-wrap text-ink-800">
            {body}
          </p>
        </div>

        <div>
          <p className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
            Available variables
          </p>
          {variables.length === 0 ? (
            <p className="mt-1 text-sm text-ink-500">None.</p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {variables.map((variable) => (
                <span
                  key={variable}
                  title={template.variables[variable]}
                  className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-2xs text-brand-700 ring-1 ring-brand-100"
                >
                  {`{{${variable}}}`}
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function TemplatesPanel({
  templates,
  hint,
}: {
  templates: MessageTemplate[]
  hint: string
}) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = React.useState<MessageTemplate | null>(null)

  const updateMutation = useMutation({
    mutationFn: (input: {
      id: string
      subject: string | null
      body: string
    }) => adminApi.updateTemplate(input.id, input),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast.success(`${updated.key} updated.`)
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not update the template.',
      )
    },
  })

  const testMutation = useMutation({
    mutationFn: (template: MessageTemplate) => adminApi.testTemplate(template.id),
    onSuccess: (notification) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success(
        `Test message queued for ${notification.recipient_contact ?? 'your account'}.`,
      )
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not queue the test message.',
      )
    },
  })

  if (templates.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No templates configured"
        description="There are no message templates in this view yet."
      />
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-600">{hint}</p>
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          onEdit={setEditing}
          onTest={testMutation.mutate}
          testing={
            testMutation.isPending && testMutation.variables?.id === template.id
          }
        />
      ))}

      {editing && (
        <EditTemplateDialog
          key={editing.id}
          template={editing}
          saving={updateMutation.isPending}
          onClose={() => setEditing(null)}
          onSave={(id, subject, body) => {
            updateMutation.mutate(
              { id, subject, body },
              { onSuccess: () => setEditing(null) },
            )
          }}
        />
      )}
    </div>
  )
}

function ConfirmationTemplates() {
  const templatesQuery = useTemplates()
  const templates = templatesQuery.data ?? []
  const confirmations = templates.filter((t) => t.key === CONFIRMATION_KEY)
  const others = templates.filter((t) => t.key !== CONFIRMATION_KEY)

  if (templatesQuery.isLoading) {
    return (
      <div className="rounded-xl border border-ink-200 bg-white shadow-xs">
        <TableSkeleton rows={4} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-info-500/30 bg-info-50 p-3">
        <p className="text-sm text-info-900">
          The shortlist confirmation message is visible{' '}
          <span className="font-semibold">only</span> to shortlisted
          applicants, and a shortlist cannot be saved without one (README
          BR-07, BR-08).
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-900">
          Shortlist confirmation
        </h2>
        <TemplatesPanel
          templates={confirmations}
          hint="The message sent to a candidate the moment they are shortlisted."
        />
      </section>

      {others.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-900">
            Other confirmation messages
          </h2>
          <TemplatesPanel
            templates={others}
            hint="Reusable confirmations for the remaining events — application receipt, access code issue and interview announcement."
          />
        </section>
      )}
    </div>
  )
}

function EmailTemplates() {
  const templatesQuery = useTemplates()
  const templates = (templatesQuery.data ?? []).filter(
    (t) => t.channel === 'email' && t.key !== CONFIRMATION_KEY,
  )

  if (templatesQuery.isLoading) {
    return (
      <div className="rounded-xl border border-ink-200 bg-white shadow-xs">
        <TableSkeleton rows={4} />
      </div>
    )
  }

  return (
    <TemplatesPanel
      templates={templates}
      hint="Email templates for application receipt, access code issue, interview announcement and staff creation."
    />
  )
}

function EditTemplateDialog({
  template,
  saving,
  onClose,
  onSave,
}: {
  template: MessageTemplate
  saving: boolean
  onClose: () => void
  onSave: (id: string, subject: string | null, body: string) => void
}) {
  // Mounted fresh per template, so the fields start from the saved values.
  const [subject, setSubject] = React.useState(template.subject ?? '')
  const [body, setBody] = React.useState(template.body)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogHeader>
        <div className="min-w-0">
          <DialogTitle>Edit template</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs">{template.key}</span> ·{' '}
            {channelLabels[template.channel]}
          </DialogDescription>
        </div>
        <DialogClose onClick={onClose} />
      </DialogHeader>
      <DialogBody className="space-y-4">
        <Field
          label="Subject"
          htmlFor="template-subject"
          hint="Leave empty for channels without a subject line, such as SMS."
        >
          <Input
            id="template-subject"
            value={subject}
            placeholder="e.g. You have been shortlisted — {{job_title}}"
            onChange={(e) => setSubject(e.target.value)}
          />
        </Field>
        <Field
          label="Body"
          htmlFor="template-body"
          required
          hint="Use {{variable_name}} placeholders — they are replaced when the message is sent."
        >
          <Textarea
            id="template-body"
            value={body}
            rows={10}
            className="font-mono text-xs"
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          loading={saving}
          disabled={body.trim().length === 0}
          onClick={() => {
            onSave(
              template.id,
              subject.trim().length > 0 ? subject.trim() : null,
              body,
            )
          }}
        >
          Save template
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

/* -- Policies ------------------------------------------------------------ */

const policyAudienceLabels: Record<PolicyAudience, string> = {
  applicant: 'Applicants',
  staff: 'Staff',
  both: 'Applicants & staff',
}

function PoliciesPanel() {
  const queryClient = useQueryClient()
  const policiesQuery = useQuery({
    queryKey: ['policies'],
    queryFn: () => adminApi.listPolicies(),
  })
  const [editing, setEditing] = React.useState<Policy | 'new' | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deletePolicy(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['policies'] })
      toast.success('Policy deleted.')
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not delete the policy.',
      )
    },
  })

  const policies = policiesQuery.data ?? []
  const activeCount = policies.filter((policy) => policy.active).length

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-ink-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
            <FileText className="size-4.5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">
              Policy acknowledgements
            </p>
            <p className="mt-0.5 text-sm text-ink-600">
              Active policies appear as checkboxes on the applicant and staff
              forms. {activeCount} active of {policies.length}.
            </p>
          </div>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus />
          Add policy
        </Button>
      </div>

      {policiesQuery.isLoading ? (
        <div className="rounded-xl border border-ink-200 bg-white shadow-xs">
          <TableSkeleton rows={4} />
        </div>
      ) : policies.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No policies yet"
          description="Add a policy to show it as a required checkbox on the applicant or staff forms."
          action={
            <Button variant="outline" onClick={() => setEditing('new')}>
              <Plus />
              Add the first policy
            </Button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell>
                    <p className="text-sm font-medium text-ink-900">
                      {policy.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 max-w-xl text-xs text-ink-500">
                      {policy.body}
                    </p>
                  </TableCell>
                  <TableCell>
                    {policyAudienceLabels[policy.audience]}
                  </TableCell>
                  <TableCell>
                    {policy.required ? (
                      <Badge variant="warning">Required</Badge>
                    ) : (
                      <Badge variant="neutral">Optional</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {policy.active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="neutral">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular">v{policy.version}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(policy)}
                        aria-label={`Edit ${policy.title}`}
                      >
                        <Pencil />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger-700 hover:bg-danger-50"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Delete “${policy.title}”? Existing acceptance records will also be removed.`,
                            )
                          ) {
                            deleteMutation.mutate(policy.id)
                          }
                        }}
                        aria-label={`Delete ${policy.title}`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <PolicyDialog
          policy={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void queryClient.invalidateQueries({ queryKey: ['policies'] })
            void queryClient.invalidateQueries({
              queryKey: ['public', 'policies'],
            })
          }}
        />
      )}
    </div>
  )
}

function PolicyDialog({
  policy,
  onClose,
  onSaved,
}: {
  policy: Policy | null
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = React.useState(policy?.title ?? '')
  const [body, setBody] = React.useState(policy?.body ?? '')
  const [audience, setAudience] = React.useState<PolicyAudience>(
    policy?.audience ?? 'both',
  )
  const [required, setRequired] = React.useState(policy?.required ?? true)
  const [active, setActive] = React.useState(policy?.active ?? true)

  const saveMutation = useMutation({
    mutationFn: () =>
      policy
        ? adminApi.updatePolicy(policy.id, {
            title: title.trim(),
            body: body.trim(),
            audience,
            required,
            active,
          })
        : adminApi.createPolicy({
            title: title.trim(),
            body: body.trim(),
            audience,
            required,
            active,
          }),
    onSuccess: () => {
      toast.success(policy ? 'Policy updated.' : 'Policy added.')
      onSaved()
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not save the policy.',
      )
    },
  })

  const valid = title.trim().length > 0 && body.trim().length > 0

  return (
    <Dialog open onOpenChange={onClose} className="sm:max-w-2xl">
      <DialogHeader>
        <div className="min-w-0">
          <DialogTitle>{policy ? 'Edit policy' : 'Add policy'}</DialogTitle>
          <DialogDescription>
            {policy
              ? 'Saving increments the version and asks users to acknowledge the updated wording.'
              : 'The policy appears immediately as a checkbox on the selected forms.'}
          </DialogDescription>
        </div>
        <DialogClose onClick={onClose} />
      </DialogHeader>
      <DialogBody className="space-y-4">
        <Field label="Title" htmlFor="policy-title" required>
          <Input
            id="policy-title"
            value={title}
            maxLength={160}
            placeholder="e.g. Code of conduct"
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field
          label="Policy text"
          htmlFor="policy-body"
          required
          hint="Keep it concise; this wording is shown beside the checkbox."
        >
          <Textarea
            id="policy-body"
            value={body}
            rows={6}
            placeholder="Explain what the user is acknowledging…"
            onChange={(event) => setBody(event.target.value)}
          />
        </Field>
        <Field label="Audience" htmlFor="policy-audience" required>
          <Select
            id="policy-audience"
            value={audience}
            onChange={(event) =>
              setAudience(event.target.value as PolicyAudience)
            }
          >
            {(Object.keys(policyAudienceLabels) as PolicyAudience[]).map(
              (value) => (
                <option key={value} value={value}>
                  {policyAudienceLabels[value]}
                </option>
              ),
            )}
          </Select>
        </Field>
        <div className="space-y-3 rounded-lg border border-ink-200 bg-ink-50/60 p-3">
          <Checkbox
            id="policy-required"
            label="Required"
            description="Users must tick this policy before submitting the form."
            checked={required}
            onChange={(event) => setRequired(event.target.checked)}
          />
          <Checkbox
            id="policy-active"
            label="Active"
            description="Inactive policies stay on record but are hidden from users."
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          loading={saveMutation.isPending}
          disabled={!valid}
          onClick={() => saveMutation.mutate()}
        >
          {policy ? 'Save policy' : 'Add policy'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

/* -- Access code settings ------------------------------------------------ */

function AccessCodeSettings() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({
    queryKey: ['access-code-settings'],
    queryFn: () => adminApi.getAccessCodeSettings(),
  })

  const [codeLengthDraft, setCodeLengthDraft] = React.useState<number | null>(
    null,
  )
  const [ttlDaysDraft, setTtlDaysDraft] = React.useState<number | null>(null)
  const [maxAttemptsDraft, setMaxAttemptsDraft] = React.useState<number | null>(
    null,
  )

  const codeLength =
    codeLengthDraft ?? settingsQuery.data?.access_code_length ?? 6
  const ttlDays = ttlDaysDraft ?? settingsQuery.data?.access_code_ttl_days ?? 14
  const maxAttempts =
    maxAttemptsDraft ?? settingsQuery.data?.access_code_max_attempts ?? 3

  const saveMutation = useMutation({
    mutationFn: () =>
      adminApi.updateAccessCodeSettings({
        access_code_length: codeLength,
        access_code_ttl_days: ttlDays,
        access_code_max_attempts: maxAttempts,
      }),
    onSuccess: (settings) => {
      queryClient.setQueryData(['access-code-settings'], settings)
      toast.success('Access code settings saved.')
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not save the settings.',
      )
    },
  })

  if (settingsQuery.isLoading) {
    return (
      <div className="rounded-xl border border-ink-200 bg-white shadow-xs">
        <TableSkeleton rows={4} />
      </div>
    )
  }

  if (settingsQuery.isError) {
    return (
      <EmptyState
        icon={KeyRound}
        title="Settings could not be loaded"
        description={
          settingsQuery.error instanceof Error
            ? settingsQuery.error.message
            : 'Try again in a moment.'
        }
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-ink-400" aria-hidden />
          Access code settings
        </CardTitle>
        <p className="mt-1 text-sm text-ink-500">
          These values are stored in the group settings and used immediately
          when the next access code is issued.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Code length"
            htmlFor="code-length"
            hint="Characters in a generated code (Crockford base32)."
          >
            <Input
              id="code-length"
              type="number"
              min={4}
              max={12}
              value={codeLength}
              onChange={(e) => setCodeLengthDraft(Number(e.target.value))}
            />
          </Field>
          <Field
            label="Expiry (days)"
            htmlFor="code-ttl"
            hint="Time-to-live stamped on each issued code."
          >
            <Input
              id="code-ttl"
              type="number"
              min={1}
              max={90}
              value={ttlDays}
              onChange={(e) => setTtlDaysDraft(Number(e.target.value))}
            />
          </Field>
          <Field
            label="Failed attempts before lockout"
            htmlFor="code-attempts"
            hint="Redeem attempts allowed before the code is locked."
          >
            <Input
              id="code-attempts"
              type="number"
              min={1}
              max={10}
              value={maxAttempts}
              onChange={(e) => setMaxAttemptsDraft(Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="rounded-lg border border-ink-200 bg-ink-50/70 p-3">
          <p className="text-2xs font-medium tracking-wide text-ink-500 uppercase">
            Effective configuration
          </p>
          <p className="mt-1.5 text-sm text-ink-800">
            {codeLength}-character codes, valid for {ttlDays}{' '}
            {ttlDays === 1 ? 'day' : 'days'}, locked after {maxAttempts}{' '}
            failed redemption attempts. Codes are single-use and stored hashed —
            the plaintext is shown once at issue time (README BR-05, BR-17).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            Save
          </Button>
          <p className="text-xs text-ink-500">
            Last saved{' '}
            {settingsQuery.data?.updated_at
              ? formatDateTime(settingsQuery.data.updated_at)
              : 'at first setup'}
            .
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/* -- Users & admins ------------------------------------------------------ */

function UsersAndAdmins() {
  const queryClient = useQueryClient()
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => adminApi.listUsers(),
  })
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [resetUser, setResetUser] = React.useState<User | null>(null)

  const statusMutation = useMutation({
    mutationFn: (input: {
      id: string
      status: 'active' | 'suspended' | 'disabled'
    }) => adminApi.updateUserStatus(input.id, input.status),
    onSuccess: (updated) => {
      queryClient.setQueryData<User[]>(['users'], (old) =>
        (old ?? []).map((u) => (u.id === updated.id ? updated : u)),
      )
      void queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success(
        `${fullName(updated.first_name, updated.last_name)} ${
          updated.status === 'active' ? 'reactivated' : 'suspended'
        }.`,
      )
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not update the account.',
      )
    },
  })

  const users = usersQuery.data ?? []

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-ink-200 bg-white p-3 text-sm text-ink-600 shadow-xs">
        Admin accounts are created and approved by the{' '}
        <span className="font-medium text-ink-800">Super Admin</span>. A new
        Admin can sign in but cannot act until the account is approved.
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xs">
        {usersQuery.isLoading ? (
          <TableSkeleton rows={5} />
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No accounts yet"
            description="Accounts appear here once the Super Admin creates them."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <span className="font-medium text-ink-900">
                      {fullName(user.first_name, user.last_name)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="break-all text-ink-600">{user.email}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={roleVariants[user.role]}>
                      {roleLabels[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <UserStatusBadge status={user.status} />
                  </TableCell>
                  <TableCell>
                    <span className="tabular">
                      {user.last_login_at
                        ? formatDateTime(user.last_login_at)
                        : 'Never'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="tabular">{formatDate(user.created_at)}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      {user.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="success"
                          loading={
                            statusMutation.isPending &&
                            statusMutation.variables?.id === user.id
                          }
                          onClick={() =>
                            statusMutation.mutate({
                              id: user.id,
                              status: 'active',
                            })
                          }
                        >
                          <UserCheck />
                          Approve
                        </Button>
                      )}
                      {user.status === 'active' ? (
                        <Button
                          size="sm"
                          variant="danger-outline"
                          loading={
                            statusMutation.isPending &&
                            statusMutation.variables?.id === user.id
                          }
                          onClick={() =>
                            statusMutation.mutate({
                              id: user.id,
                              status: 'suspended',
                            })
                          }
                        >
                          Suspend
                        </Button>
                      ) : user.status !== 'pending' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={
                            statusMutation.isPending &&
                            statusMutation.variables?.id === user.id
                          }
                          onClick={() =>
                            statusMutation.mutate({
                              id: user.id,
                              status: 'active',
                            })
                          }
                        >
                          <UserCheck />
                          Reactivate
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setResetUser(user)}
                      >
                        Reset password
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Button variant="outline" onClick={() => setInviteOpen(true)}>
        <UserPlus />
        Invite an admin
      </Button>

      {inviteOpen && (
        <InviteAdminDialog
          onClose={() => setInviteOpen(false)}
          onCreated={(user) => {
            queryClient.setQueryData<User[]>(['users'], (old) => [
              user,
              ...(old ?? []),
            ])
            void queryClient.invalidateQueries({ queryKey: ['users'] })
            setInviteOpen(false)
          }}
        />
      )}

      {resetUser && (
        <ResetPasswordDialog
          user={resetUser}
          onClose={() => setResetUser(null)}
          onSaved={() => {
            toast.success(
              `Password reset for ${fullName(resetUser.first_name, resetUser.last_name)}.`,
            )
            setResetUser(null)
          }}
        />
      )}
    </div>
  )
}

function InviteAdminDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (user: User) => void
}) {
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [tenantId, setTenantId] = React.useState('')

  const tenantsQuery = useQuery({
    queryKey: ['tenants'],
    queryFn: () => adminApi.listTenants(),
  })
  const tenants = tenantsQuery.data ?? []
  const selectedTenantId = tenantId || (tenants.length === 1 ? tenants[0].id : '')

  const createMutation = useMutation({
    mutationFn: () =>
      adminApi.createAdminUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        role: 'admin',
        tenant_id: selectedTenantId,
      }),
    onSuccess: onCreated,
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not create the account.',
      )
    },
  })

  const valid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    selectedTenantId.length > 0

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogHeader>
        <div>
          <DialogTitle>Invite an admin</DialogTitle>
          <DialogDescription>
            Creates an Admin login in the selected state. The account stays
            pending until a Super Admin approves it.
          </DialogDescription>
        </div>
        <DialogClose onClick={onClose} />
      </DialogHeader>
      <DialogBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" htmlFor="invite-first-name" required>
            <Input
              id="invite-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </Field>
          <Field label="Last name" htmlFor="invite-last-name" required>
            <Input
              id="invite-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Email" htmlFor="invite-email" required>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="State scope"
            htmlFor="invite-tenant"
            required
            hint="The Admin will only see records in this state."
          >
            <Select
              id="invite-tenant"
              value={selectedTenantId}
              disabled={tenantsQuery.isLoading || tenants.length === 0}
              onChange={(e) => setTenantId(e.target.value)}
            >
              <option value="">
                {tenantsQuery.isLoading
                  ? 'Loading states…'
                  : tenants.length === 0
                    ? 'No active states available'
                    : 'Select a state'}
              </option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Initial password"
            htmlFor="invite-password"
            required
            hint="At least 8 characters. Share it securely."
          >
            <Input
              id="invite-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          loading={createMutation.isPending}
          disabled={!valid}
          onClick={() => createMutation.mutate()}
        >
          Create account
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

function ResetPasswordDialog({
  user,
  onClose,
  onSaved,
}: {
  user: User
  onClose: () => void
  onSaved: () => void
}) {
  const [password, setPassword] = React.useState('')
  const [confirmation, setConfirmation] = React.useState('')

  const resetMutation = useMutation({
    mutationFn: () => adminApi.resetUserPassword(user.id, password),
    onSuccess: onSaved,
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : 'Could not reset the password.',
      )
    },
  })

  const valid = password.length >= 8 && password === confirmation

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogHeader>
        <div>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for {fullName(user.first_name, user.last_name)}{' '}
            ({user.email}) and share it securely.
          </DialogDescription>
        </div>
        <DialogClose onClick={onClose} />
      </DialogHeader>
      <DialogBody className="space-y-4">
        <Field
          label="New password"
          htmlFor="reset-password"
          required
          hint="At least 8 characters."
        >
          <Input
            id="reset-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Confirm password" htmlFor="reset-confirm" required>
          <Input
            id="reset-confirm"
            type="password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          loading={resetMutation.isPending}
          disabled={!valid}
          onClick={() => resetMutation.mutate()}
        >
          Reset password
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

/* -- Notification log ---------------------------------------------------- */

function NotificationLog() {
  const queryClient = useQueryClient()
  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => adminApi.listNotifications(),
  })

  const retryMutation = useMutation({
    mutationFn: (id: string) => adminApi.retryNotification(id),
    onSuccess: (notification) => {
      queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
        (old ?? []).map((item) =>
          item.id === notification.id ? notification : item,
        ),
      )
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success(
        `Retry queued for ${notification.recipient_contact ?? 'the recipient'}.`,
      )
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not retry the notification.',
      )
    },
  })

  const notifications = notificationsQuery.data ?? []
  const failedCount = notifications.filter((n) => n.status === 'failed').length
  const pendingCount = notifications.filter((n) => n.status === 'pending').length
  const sentCount = notifications.filter((n) => n.status === 'sent').length

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'rounded-lg border p-3 text-sm',
          failedCount > 0
            ? 'border-danger-500/30 bg-danger-50 text-danger-900'
            : pendingCount > 0
              ? 'border-warning-500/30 bg-warning-50 text-warning-900'
              : 'border-ink-200 bg-white text-ink-600 shadow-xs',
        )}
      >
        {failedCount > 0 ? (
          <p>
            <span className="font-semibold">
              {failedCount} delivery{' '}
              {failedCount === 1 ? 'has' : 'have'} failed.
            </span>{' '}
            {pendingCount > 0
              ? `${pendingCount} more ${pendingCount === 1 ? 'is' : 'are'} still queued. `
              : ''}
            Failed messages are listed with the provider error below; use Retry
            to put one back on the queue.
          </p>
        ) : pendingCount > 0 ? (
          <p>
            <span className="font-semibold">
              {pendingCount} {pendingCount === 1 ? 'message is' : 'messages are'}{' '}
              waiting to be delivered.
            </span>{' '}
            The email worker will pick them up automatically.
          </p>
        ) : sentCount > 0 ? (
          <p>
            All {sentCount} queued{' '}
            {sentCount === 1 ? 'message has' : 'messages have'} been delivered
            successfully.
          </p>
        ) : (
          <p>No delivery has been recorded yet.</p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-xs">
        {notificationsQuery.isLoading ? (
          <TableSkeleton rows={5} />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="Messages sent by the portal appear here with their delivery status."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((notification) => (
                <TableRow key={notification.id}>
                  <TableCell>
                    <Badge variant={channelVariants[notification.channel]}>
                      {notification.channel === 'sms' ? (
                        <MessageSquare className="size-3" aria-hidden />
                      ) : (
                        <Mail className="size-3" aria-hidden />
                      )}
                      {channelLabels[notification.channel]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="break-all text-ink-700">
                      {notification.recipient_contact ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-ink-700">
                      {notification.template_key ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={notificationStatusTone[notification.status]}
                      dot
                    >
                      {notification.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="tabular">
                      {notification.sent_at
                        ? formatDateTime(notification.sent_at)
                        : '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {notification.status === 'failed' && notification.error ? (
                      <span className="text-danger-700">
                        {notification.error}
                      </span>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {notification.status === 'failed' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          loading={
                            retryMutation.isPending &&
                            retryMutation.variables === notification.id
                          }
                          onClick={() => retryMutation.mutate(notification.id)}
                        >
                          <RefreshCw />
                          Retry
                        </Button>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
