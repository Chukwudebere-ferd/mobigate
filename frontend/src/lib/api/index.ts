/**
 * The API surface the frontend depends on.
 *
 * Every function here is a contract with the Go backend in
 * `backend/internal/httpapi`. Pages never call fetch directly.
 *
 * Path groups follow the Go API: /public for the careers surface, /me for
 * the signed-in applicant or staff member, /staff for staff onboarding and
 * /admin for the admin panel.
 */

import { ApiError, http } from './client'
import type {
  AccessCode,
  AccessCodeFilters,
  AdminSettings,
  Application,
  ApplicationEvent,
  ApplicationFilters,
  ApplicationStatus,
  AuditLog,
  DashboardMetrics,
  Department,
  EmploymentCategory,
  InterviewAnnouncement,
  Job,
  JobStatus,
  Location,
  LocationType,
  MessageTemplate,
  Notification,
  Paginated,
  Shortlist,
  StaffDraftResponse,
  StaffDraftSaveResponse,
  StaffFilters,
  StaffMeResponse,
  StaffOnboardingResponse,
  StaffProfile,
  StaffRedemption,
  StaffStatus,
  User,
} from '@/types/domain'

// -- Location helpers ------------------------------------------------------

/**
 * Locations remembered from /public and /admin reads. Live IDs are database
 * UUIDs, so helpers such as `locationPath` can only resolve them after a
 * locations query has loaded; an unknown ID renders as a dash.
 */
const fetchedLocations = new Map<string, Location>()

function rememberLocations(items: Location[]) {
  for (const item of items) fetchedLocations.set(item.id, item)
}

function locationUniverse(): Location[] {
  return [...fetchedLocations.values()]
}

export function childrenOf(parentId: string | null): Location[] {
  return locationUniverse().filter((l) => l.parent_id === parentId)
}

export function descendantsOf(locationId: string): Location[] {
  const out: Location[] = []
  const walk = (id: string) => {
    for (const child of childrenOf(id)) {
      out.push(child)
      walk(child.id)
    }
  }
  walk(locationId)
  return out
}

export function locationById(id: string | null | undefined): Location | undefined {
  if (!id) return undefined
  return fetchedLocations.get(id)
}

export function locationPath(id: string | null | undefined): string {
  if (!id) return '—'
  const parts: string[] = []
  let current = locationById(id)
  while (current) {
    parts.unshift(current.name)
    current = current.parent_id ? locationById(current.parent_id) : undefined
  }
  return parts.join(' › ')
}

/** Alphabetical by display name, ignoring case. */
export function sortLocationsByName(items: Location[]): Location[] {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }),
  )
}

/** Alphabetical by full path, so a state precedes its LGAs and towns. */
export function sortLocationsByPath(items: Location[]): Location[] {
  return [...items].sort((a, b) =>
    locationPath(a.id).localeCompare(locationPath(b.id), 'en', {
      sensitivity: 'base',
    }),
  )
}

// -- Public / applicant ----------------------------------------------------

/**
 * The apply form payload. Email is deliberately absent: the backend takes it
 * from the session (register-before-apply, BR-09), and consent is a required
 * checkbox whose timestamp the server records itself (NDPA).
 */
export interface ApplicationSubmission {
  job_id: string
  first_name: string
  last_name: string
  phone: string
  gender: string
  /** YYYY-MM-DD for the date input. */
  date_of_birth: string
  location_id: string
  address_line: string
  qualification: string
  consent: boolean
  photo?: File
}

export const publicApi = {
  /** GET /public/jobs — published roles for the careers site. */
  async listJobs(): Promise<Job[]> {
    const response = await http.get<{ items: Job[] }>('/public/jobs')
    return response.items
  },

  /** GET /public/jobs/{slug}; an unknown slug resolves to undefined. */
  async getJob(slug: string): Promise<Job | undefined> {
    try {
      return await http.get<Job>(`/public/jobs/${slug}`)
    } catch (error) {
      // A missing slug is a 404; the careers pages render their own
      // "not found" state rather than surfacing an error.
      if (error instanceof ApiError && error.isNotFound) return undefined
      throw error
    }
  },

  /** GET /public/locations — the country/state/LGA/town tree. */
  async listLocations(): Promise<Location[]> {
    const response = await http.get<{ items: Location[] }>('/public/locations')
    rememberLocations(response.items)
    return response.items
  },

  /** GET /public/departments — also used by staff onboarding. */
  async listDepartments(): Promise<Department[]> {
    const response = await http.get<{ items: Department[] }>('/public/departments')
    return response.items
  },

  /**
   * POST /public/applications as multipart/form-data, rate-limited by the
   * server. Returns 409 when an open application already exists (BR-09).
   */
  async submitApplication(payload: ApplicationSubmission): Promise<Application> {
    const form = new FormData()
    form.set('job_id', payload.job_id)
    form.set('first_name', payload.first_name)
    form.set('last_name', payload.last_name)
    form.set('phone', payload.phone)
    form.set('gender', payload.gender)
    form.set('date_of_birth', payload.date_of_birth)
    form.set('location_id', payload.location_id)
    form.set('address_line', payload.address_line)
    form.set('qualification', payload.qualification)
    form.set('consent', payload.consent ? 'true' : 'false')
    if (payload.photo) form.set('photo', payload.photo)
    return http.post<Application>('/public/applications', form)
  },

  /** GET /me/applications — the signed-in applicant's own applications. */
  async myApplications(): Promise<Application[]> {
    const response = await http.get<{ items: Application[] }>('/me/applications')
    return response.items
  },

  /** GET /me/applications/{id} — ownership enforced server-side. */
  async myApplication(id: string): Promise<Application> {
    return http.get<Application>(`/me/applications/${id}`)
  },

  /** GET /me/applications/{id}/events — the applicant's status timeline. */
  async myApplicationEvents(id: string): Promise<ApplicationEvent[]> {
    const response = await http.get<{ items: ApplicationEvent[] }>(
      `/me/applications/${id}/events`,
    )
    return response.items
  },

  /** POST /me/applications/{id}/withdraw with a form-encoded reason. */
  async withdrawApplication(id: string, reason?: string): Promise<Application> {
    // The backend reads the reason with r.FormValue, so the body is sent
    // form-encoded rather than JSON.
    const body = new URLSearchParams()
    if (reason) body.set('reason', reason)
    return http.post<Application>(`/me/applications/${id}/withdraw`, body)
  },

  /** GET /me/applications/{id}/shortlist — 404 when none is active (BR-08). */
  async shortlistMessageFor(applicationId: string): Promise<Shortlist> {
    return http.get<Shortlist>(`/me/applications/${applicationId}/shortlist`)
  },

  /** GET /me/interviews — announcements addressed to this applicant. */
  async announcementsFor(): Promise<InterviewAnnouncement[]> {
    const response = await http.get<{ items: InterviewAnnouncement[] }>(
      '/me/interviews',
    )
    return response.items
  },
}

// -- Staff onboarding ------------------------------------------------------

export const staffApi = {
  /** POST /staff/redeem — exchange an admin-issued access code for a ticket. */
  async redeem(code: string): Promise<StaffRedemption> {
    return http.post<StaffRedemption>('/staff/redeem', { code })
  },

  /** GET /staff/onboarding/draft — authorised by the ticket header. */
  async getDraft(ticket: string): Promise<StaffDraftResponse> {
    return http.get<StaffDraftResponse>(
      '/staff/onboarding/draft',
      undefined,
      { 'X-Onboarding-Ticket': ticket },
    )
  },

  /** PUT /staff/onboarding/draft — autosave target for the onboarding form. */
  async saveDraft(
    ticket: string,
    draft: Record<string, unknown>,
  ): Promise<StaffDraftSaveResponse> {
    return http.put<StaffDraftSaveResponse>(
      '/staff/onboarding/draft',
      { draft },
      { 'X-Onboarding-Ticket': ticket },
    )
  },

  /** POST /staff/onboarding — the atomic multipart submission (201). */
  async completeOnboarding(
    ticket: string,
    form: FormData,
  ): Promise<StaffOnboardingResponse> {
    return http.post<StaffOnboardingResponse>('/staff/onboarding', form, {
      'X-Onboarding-Ticket': ticket,
    })
  },

  /** GET /staff/me — the completed staff record and its documents. */
  async me(): Promise<StaffMeResponse> {
    return http.get<StaffMeResponse>('/staff/me')
  },
}

// -- Admin -----------------------------------------------------------------

export const adminApi = {
  async dashboard(): Promise<DashboardMetrics> {
    return http.get<DashboardMetrics>('/admin/dashboard')
  },

  async recentApplications(limit = 5): Promise<Application[]> {
    const page = await http.get<Paginated<Application>>(
      '/admin/applications',
      { per_page: limit },
    )
    return page.items
  },

  async listJobs(): Promise<Job[]> {
    const response = await http.get<{ items: Job[] }>('/admin/jobs')
    return response.items
  },

  async createJob(payload: Partial<Job>): Promise<Job> {
    return http.post<Job>('/admin/jobs', payload)
  },

  async updateJob(id: string, payload: Partial<Job>): Promise<Job> {
    return http.patch<Job>(`/admin/jobs/${id}`, payload)
  },

  async listApplications(
    filters: ApplicationFilters = {},
  ): Promise<Paginated<Application>> {
    return http.get<Paginated<Application>>('/admin/applications', {
      ...filters,
    })
  },

  async getApplication(id: string): Promise<Application> {
    return http.get<Application>(`/admin/applications/${id}`)
  },

  async applicationEvents(applicationId: string): Promise<ApplicationEvent[]> {
    const response = await http.get<{ items: ApplicationEvent[] }>(
      `/admin/applications/${applicationId}/events`,
    )
    return response.items
  },

  async setApplicationStatus(
    id: string,
    status: ApplicationStatus,
    reason?: string,
  ): Promise<Application> {
    return http.patch<Application>(`/admin/applications/${id}/status`, {
      status,
      reason,
    })
  },

  async shortlist(
    applicationIds: string[],
    message: string,
    jobId: string,
  ): Promise<Shortlist[]> {
    const response = await http.post<{ items: Shortlist[] }>(
      '/admin/shortlists',
      {
        application_ids: applicationIds,
        message,
        job_id: jobId,
      },
    )
    return response.items
  },

  async revokeShortlist(id: string): Promise<Shortlist> {
    return http.patch<Shortlist>(`/admin/shortlists/${id}`, {
      status: 'revoked',
    })
  },

  async resendShortlist(id: string): Promise<Notification> {
    return http.post<Notification>(`/admin/shortlists/${id}/resend`, {})
  },

  async listShortlists(): Promise<Shortlist[]> {
    const response = await http.get<{ items: Shortlist[] }>('/admin/shortlists')
    return response.items
  },

  async listInterviews(): Promise<InterviewAnnouncement[]> {
    const response = await http.get<{ items: InterviewAnnouncement[] }>(
      '/admin/interviews',
    )
    return response.items
  },

  async createInterview(payload: {
    job_id: string
    interview_at: string
    venue: string
    instructions: string
    audience: string
  }): Promise<InterviewAnnouncement> {
    return http.post<InterviewAnnouncement>('/admin/interviews', payload)
  },

  async updateInterviewStatus(
    id: string,
    status: InterviewAnnouncement['status'],
  ): Promise<InterviewAnnouncement> {
    return http.patch<InterviewAnnouncement>(`/admin/interviews/${id}`, {
      status,
    })
  },

  async notifyInterview(id: string): Promise<{ queued: number }> {
    return http.post<{ queued: number }>(`/admin/interviews/${id}/notify`, {})
  },

  async listAccessCodes(
    filters: AccessCodeFilters = {},
  ): Promise<Paginated<AccessCode>> {
    return http.get<Paginated<AccessCode>>('/admin/access-codes', { ...filters })
  },

  async issueAccessCode(payload: {
    application_id: string
    type: 'applicant' | 'staff'
    expires_at?: string
  }): Promise<{ code: string; record: AccessCode }> {
    return http.post<{ code: string; record: AccessCode }>(
      '/admin/access-codes',
      payload,
    )
  },

  async revokeAccessCode(id: string): Promise<AccessCode> {
    return http.patch<AccessCode>(`/admin/access-codes/${id}`, {
      status: 'revoked',
    })
  },

  async listStaff(filters: StaffFilters = {}): Promise<Paginated<StaffProfile>> {
    return http.get<Paginated<StaffProfile>>('/admin/staff', { ...filters })
  },

  async getStaff(id: string): Promise<StaffProfile> {
    return http.get<StaffProfile>(`/admin/staff/${id}`)
  },

  async createStaff(payload: {
    first_name: string
    last_name: string
    email: string
    phone: string
    employment_category: EmploymentCategory
    department_id?: string
    location_id?: string
    position?: string
    appointment_date?: string
  }): Promise<StaffProfile> {
    return http.post<StaffProfile>('/admin/staff', payload)
  },

  async listLocations(): Promise<Location[]> {
    const response = await http.get<{ items: Location[] }>('/admin/locations')
    rememberLocations(response.items)
    return response.items
  },

  async createLocation(payload: {
    type: LocationType
    name: string
    parent_id: string | null
    code?: string
  }): Promise<Location> {
    return http.post<Location>('/admin/locations', payload)
  },

  async approveLocation(id: string): Promise<Location> {
    return http.patch<Location>(`/admin/locations/${id}`, {
      status: 'approved',
    })
  },

  async listDepartments(): Promise<Department[]> {
    const response = await http.get<{ items: Department[] }>(
      '/admin/departments',
    )
    return response.items
  },

  async ensureDepartment(name: string): Promise<Department> {
    return http.post<Department>('/admin/departments', { name })
  },

  async listUsers(): Promise<User[]> {
    const response = await http.get<{ items: User[] }>('/admin/users')
    return response.items
  },

  async approveUser(id: string): Promise<User> {
    return this.updateUserStatus(id, 'active')
  },

  async updateUserStatus(
    id: string,
    status: 'active' | 'suspended' | 'disabled',
  ): Promise<User> {
    return http.patch<User>(`/admin/users/${id}`, { status })
  },

  async createAdminUser(payload: {
    first_name: string
    last_name: string
    email: string
    password: string
    role: 'admin' | 'staff'
  }): Promise<User> {
    return http.post<User>('/admin/users', payload)
  },

  async resetUserPassword(id: string, newPassword: string): Promise<void> {
    await http.post<{ updated: boolean }>(`/admin/users/${id}/reset-password`, {
      new_password: newPassword,
    })
  },

  async listTemplates(): Promise<MessageTemplate[]> {
    const response = await http.get<{ items: MessageTemplate[] }>(
      '/admin/templates',
    )
    return response.items
  },

  async updateTemplate(
    id: string,
    payload: { subject: string | null; body: string },
  ): Promise<MessageTemplate> {
    return http.patch<MessageTemplate>(`/admin/templates/${id}`, payload)
  },

  async testTemplate(id: string): Promise<Notification> {
    return http.post<Notification>(`/admin/templates/${id}/test`, {})
  },

  async getAccessCodeSettings(): Promise<AdminSettings> {
    return http.get<AdminSettings>('/admin/settings/access-codes')
  },

  async updateAccessCodeSettings(payload: {
    access_code_length: number
    access_code_ttl_days: number
    access_code_max_attempts: number
  }): Promise<AdminSettings> {
    return http.patch<AdminSettings>('/admin/settings/access-codes', payload)
  },

  async listNotifications(): Promise<Notification[]> {
    const response = await http.get<{ items: Notification[] }>(
      '/admin/notifications',
    )
    return response.items
  },

  async listAuditLogs(): Promise<AuditLog[]> {
    const response = await http.get<{ items: AuditLog[] }>('/admin/audit-logs')
    return response.items
  },
}

/** Known employment categories, used as select suggestions and filter labels. */
export const employmentCategoryLabels: Record<EmploymentCategory, string> = {
  director: 'Director',
  employee: 'Employee',
  contractor: 'Contractor',
  partner: 'Partner',
}

/** Display label for a known or admin-created custom category. */
export function employmentCategoryLabel(category: string): string {
  return (
    employmentCategoryLabels[category] ??
    category.replace(/\b\w/g, (character) => character.toUpperCase())
  )
}

export type { JobStatus, StaffStatus }
