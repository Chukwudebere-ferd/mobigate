/**
 * The API surface the frontend depends on.
 *
 * Every function here is a contract with the Go backend. In mock mode the
 * implementations resolve from the seed data with realistic latency; in live
 * mode they hit the Go server over HTTP. Pages never know the difference.
 *
 * Endpoint paths are proposed here and are expected to be adjusted when the
 * Go API contract is finalised.
 */

import { http } from './client'
import {
  accessCodes,
  applicationEvents,
  applications,
  auditLogs,
  dashboardMetrics,
  departments,
  interviews,
  jobs,
  locations,
  messageTemplates,
  notifications,
  shortlists,
  staffProfiles,
  users,
} from '@/mocks/seed'
import type {
  AccessCode,
  AccessCodeFilters,
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
  StaffFilters,
  StaffProfile,
  StaffStatus,
  User,
} from '@/types/domain'

const API_MODE = import.meta.env.VITE_API_MODE ?? 'mock'

// The dashboard is migrated first. This lets its live queries run while the
// remaining admin pages stay on the mock layer until their endpoints land.
const DASHBOARD_MODE =
  import.meta.env.VITE_DASHBOARD_MODE ?? API_MODE

/** Simulated network latency so loading states are exercised in development. */
const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms))

function paginate<T>(items: T[], page = 1, perPage = 20): Paginated<T> {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const start = (page - 1) * perPage
  return {
    items: items.slice(start, start + perPage),
    total,
    page,
    per_page: perPage,
    total_pages: totalPages,
  }
}

function matchesSearch(haystack: string, needle?: string) {
  if (!needle) return true
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

// -- Location helpers ------------------------------------------------------

export function childrenOf(parentId: string | null): Location[] {
  return locations.filter((l) => l.parent_id === parentId)
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
  return locations.find((l) => l.id === id)
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

// -- Public / applicant ----------------------------------------------------

export const publicApi = {
  async listJobs(): Promise<Job[]> {
    if (API_MODE === 'live') return http.get<Job[]>('/jobs')
    await delay()
    return jobs.filter((j) => j.status === 'published')
  },

  async getJob(slug: string): Promise<Job | undefined> {
    if (API_MODE === 'live') return http.get<Job>(`/jobs/${slug}`)
    await delay()
    return jobs.find((j) => j.slug === slug)
  },

  async submitApplication(payload: {
    job_id: string
    first_name: string
    last_name: string
    email: string
    phone: string
    gender: string
    date_of_birth: string
    location_id: string
    address_line: string
    qualification: string
  }): Promise<Application> {
    if (API_MODE === 'live') {
      return http.post<Application>('/applications', payload)
    }
    await delay(600)
    const seq = applications.length + 1
    const job = jobs.find((j) => j.id === payload.job_id)
    const created: Application = {
      id: `app-new-${seq}`,
      application_number: `APP/LA/2026/${String(seq).padStart(4, '0')}`,
      tenant_id: 'ten-1',
      job_id: payload.job_id,
      applicant_id: 'usr-app-1',
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email,
      phone: payload.phone,
      gender: payload.gender,
      date_of_birth: payload.date_of_birth,
      location_id: payload.location_id,
      address_line: payload.address_line,
      qualification: payload.qualification,
      cv_document_id: null,
      photo_document_id: null,
      status: 'pending',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      job_title: job?.title,
    }
    applications.unshift(created)
    return created
  },

  async myApplications(applicantId: string): Promise<Application[]> {
    if (API_MODE === 'live') return http.get<Application[]>('/me/applications')
    await delay()
    return applications.filter((a) => a.applicant_id === applicantId)
  },

  async shortlistMessageFor(applicationId: string): Promise<Shortlist | undefined> {
    if (API_MODE === 'live') {
      return http.get<Shortlist>(`/me/applications/${applicationId}/shortlist`)
    }
    await delay(150)
    return shortlists.find(
      (s) => s.application_id === applicationId && s.status === 'active',
    )
  },

  async announcementsFor(applicantId: string): Promise<InterviewAnnouncement[]> {
    if (API_MODE === 'live') {
      return http.get<InterviewAnnouncement[]>('/me/interviews')
    }
    await delay()
    const myApps = applications.filter((a) => a.applicant_id === applicantId)
    const myJobIds = new Set(myApps.map((a) => a.job_id))
    return interviews.filter(
      (i) =>
        i.status === 'published' &&
        (i.audience === 'all_applicants' || myJobIds.has(i.job_id)),
    )
  },
}

// -- Admin -----------------------------------------------------------------

export const adminApi = {
  async dashboard(): Promise<DashboardMetrics> {
    if (DASHBOARD_MODE === 'live') {
      return http.get<DashboardMetrics>('/admin/dashboard')
    }
    await delay()
    return dashboardMetrics
  },

  async recentApplications(limit = 5): Promise<Application[]> {
    if (DASHBOARD_MODE === 'live') {
      const page = await http.get<Paginated<Application>>(
        '/admin/applications',
        { per_page: limit },
      )
      return page.items
    }
    await delay()
    return applications.slice(0, limit)
  },

  async listJobs(): Promise<Job[]> {
    if (API_MODE === 'live') return http.get<Job[]>('/admin/jobs')
    await delay()
    return jobs
  },

  async createJob(payload: Partial<Job>): Promise<Job> {
    if (API_MODE === 'live') return http.post<Job>('/admin/jobs', payload)
    await delay(400)
    const created: Job = {
      id: `job-${jobs.length + 1}`,
      tenant_id: 'ten-1',
      title: payload.title ?? 'Untitled role',
      slug: (payload.title ?? 'role')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
      description: payload.description ?? '',
      requirements: payload.requirements ?? '',
      location_id: payload.location_id ?? null,
      employment_category: payload.employment_category ?? null,
      openings: payload.openings ?? 1,
      publish_at: payload.publish_at ?? null,
      deadline_at: payload.deadline_at ?? null,
      status: payload.status ?? 'draft',
      created_by: 'usr-admin-1',
      created_at: new Date().toISOString(),
      applications_count: 0,
      location_name: locationById(payload.location_id)?.name,
    }
    jobs.unshift(created)
    return created
  },

  async updateJob(id: string, payload: Partial<Job>): Promise<Job> {
    if (API_MODE === 'live') return http.patch<Job>(`/admin/jobs/${id}`, payload)
    await delay(400)
    const idx = jobs.findIndex((j) => j.id === id)
    if (idx === -1) throw new Error('Job not found')
    jobs[idx] = { ...jobs[idx], ...payload }
    return jobs[idx]
  },

  async listApplications(
    filters: ApplicationFilters = {},
  ): Promise<Paginated<Application>> {
    if (API_MODE === 'live') {
      return http.get<Paginated<Application>>('/admin/applications', {
        ...filters,
      })
    }
    await delay()

    let rows = [...applications]

    if (filters.status && filters.status !== 'all') {
      rows = rows.filter((a) => a.status === filters.status)
    }
    if (filters.job_id) rows = rows.filter((a) => a.job_id === filters.job_id)
    if (filters.search) {
      rows = rows.filter(
        (a) =>
          matchesSearch(a.first_name, filters.search) ||
          matchesSearch(a.last_name, filters.search) ||
          matchesSearch(a.email, filters.search) ||
          matchesSearch(a.application_number, filters.search),
      )
    }
    if (filters.state_id) {
      const stateChildren = new Set([
        filters.state_id,
        ...descendantsOf(filters.state_id).map((l) => l.id),
      ])
      rows = rows.filter((a) => a.location_id && stateChildren.has(a.location_id))
    }
    if (filters.lga_id) {
      const lgaChildren = new Set([
        filters.lga_id,
        ...descendantsOf(filters.lga_id).map((l) => l.id),
      ])
      rows = rows.filter((a) => a.location_id && lgaChildren.has(a.location_id))
    }
    if (filters.date_from) {
      const from = new Date(filters.date_from).getTime()
      rows = rows.filter((a) => new Date(a.submitted_at).getTime() >= from)
    }
    if (filters.date_to) {
      const to = new Date(filters.date_to).getTime() + 86_400_000
      rows = rows.filter((a) => new Date(a.submitted_at).getTime() <= to)
    }

    const sort = filters.sort ?? 'submitted_at'
    const dir = filters.order === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      if (sort === 'status') return dir * a.status.localeCompare(b.status)
      if (sort === 'job') return dir * (a.job_title ?? '').localeCompare(b.job_title ?? '')
      return dir * (new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime())
    })

    return paginate(rows, filters.page ?? 1, filters.per_page ?? 20)
  },

  async getApplication(id: string): Promise<Application | undefined> {
    if (API_MODE === 'live') return http.get<Application>(`/admin/applications/${id}`)
    await delay(150)
    return applications.find((a) => a.id === id)
  },

  async applicationEvents(applicationId: string): Promise<ApplicationEvent[]> {
    if (API_MODE === 'live') {
      return http.get<ApplicationEvent[]>(`/admin/applications/${applicationId}/events`)
    }
    await delay(150)
    return applicationEvents
      .filter((e) => e.application_id === applicationId)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
  },

  async setApplicationStatus(
    id: string,
    status: ApplicationStatus,
    reason?: string,
  ): Promise<Application> {
    if (API_MODE === 'live') {
      return http.patch<Application>(`/admin/applications/${id}/status`, {
        status,
        reason,
      })
    }
    await delay(450)
    const idx = applications.findIndex((a) => a.id === id)
    if (idx === -1) throw new Error('Application not found')
    const before = applications[idx].status
    applications[idx] = {
      ...applications[idx],
      status,
      updated_at: new Date().toISOString(),
    }
    applicationEvents.unshift({
      id: `ev-${Date.now()}`,
      application_id: id,
      actor_id: 'usr-admin-1',
      from_status: before,
      to_status: status,
      reason: reason ?? null,
      created_at: new Date().toISOString(),
      actor_name: 'Aisha Adeyemi',
    })
    return applications[idx]
  },

  async shortlist(
    applicationIds: string[],
    message: string,
    jobId: string,
  ): Promise<Shortlist[]> {
    if (API_MODE === 'live') {
      return http.post<Shortlist[]>('/admin/shortlists', {
        application_ids: applicationIds,
        message,
        job_id: jobId,
      })
    }
    await delay(600)
    const created: Shortlist[] = []
    for (const id of applicationIds) {
      const app = applications.find((a) => a.id === id)
      if (!app) continue
      const record: Shortlist = {
        id: `sl-${Date.now()}-${id}`,
        application_id: id,
        job_id: jobId,
        message,
        message_template_id: 'tpl-1',
        status: 'active',
        created_by: 'usr-admin-1',
        created_at: new Date().toISOString(),
        revoked_at: null,
        applicant_name: `${app.first_name} ${app.last_name}`,
        job_title: app.job_title,
      }
      shortlists.unshift(record)
      created.push(record)
      const idx = applications.findIndex((a) => a.id === id)
      if (idx !== -1) {
        applications[idx] = {
          ...applications[idx],
          status: 'shortlisted',
          updated_at: new Date().toISOString(),
        }
      }
    }
    return created
  },

  async revokeShortlist(id: string): Promise<Shortlist> {
    if (API_MODE === 'live') {
      return http.patch<Shortlist>(`/admin/shortlists/${id}`, { status: 'revoked' })
    }
    await delay(400)
    const idx = shortlists.findIndex((s) => s.id === id)
    if (idx === -1) throw new Error('Shortlist not found')
    shortlists[idx] = {
      ...shortlists[idx],
      status: 'revoked',
      revoked_at: new Date().toISOString(),
    }
    return shortlists[idx]
  },

  async listShortlists(): Promise<Shortlist[]> {
    if (API_MODE === 'live') return http.get<Shortlist[]>('/admin/shortlists')
    await delay()
    return shortlists
  },

  async listInterviews(): Promise<InterviewAnnouncement[]> {
    if (DASHBOARD_MODE === 'live') {
      const response = await http.get<{ items: InterviewAnnouncement[] }>(
        '/admin/interviews',
      )
      return response.items
    }
    await delay()
    return [...interviews].sort(
      (a, b) => new Date(b.interview_at).getTime() - new Date(a.interview_at).getTime(),
    )
  },

  async createInterview(payload: {
    job_id: string
    interview_at: string
    venue: string
    instructions: string
    audience: string
  }): Promise<InterviewAnnouncement> {
    if (API_MODE === 'live') {
      return http.post<InterviewAnnouncement>('/admin/interviews', payload)
    }
    await delay(450)
    const created: InterviewAnnouncement = {
      id: `int-${Date.now()}`,
      tenant_id: 'ten-1',
      job_id: payload.job_id,
      interview_at: payload.interview_at,
      venue: payload.venue,
      instructions: payload.instructions,
      audience: payload.audience as InterviewAnnouncement['audience'],
      status: 'published',
      created_by: 'usr-admin-1',
      created_at: new Date().toISOString(),
      job_title: jobs.find((j) => j.id === payload.job_id)?.title,
      applicant_count: 0,
    }
    interviews.unshift(created)
    return created
  },

  async updateInterviewStatus(
    id: string,
    status: InterviewAnnouncement['status'],
  ): Promise<InterviewAnnouncement> {
    if (API_MODE === 'live') {
      return http.patch<InterviewAnnouncement>(`/admin/interviews/${id}`, { status })
    }
    await delay(300)
    const idx = interviews.findIndex((i) => i.id === id)
    if (idx === -1) throw new Error('Interview not found')
    interviews[idx] = { ...interviews[idx], status }
    return interviews[idx]
  },

  async listAccessCodes(
    filters: AccessCodeFilters = {},
  ): Promise<Paginated<AccessCode>> {
    if (API_MODE === 'live') {
      return http.get<Paginated<AccessCode>>('/admin/access-codes', { ...filters })
    }
    await delay()
    let rows = [...accessCodes]
    if (filters.status && filters.status !== 'all') {
      rows = rows.filter((c) => c.status === filters.status)
    }
    if (filters.type && filters.type !== 'all') {
      rows = rows.filter((c) => c.type === filters.type)
    }
    if (filters.search) {
      rows = rows.filter(
        (c) =>
          matchesSearch(c.applicant_name ?? '', filters.search) ||
          matchesSearch(c.code_hint, filters.search),
      )
    }
    return paginate(rows, filters.page ?? 1, filters.per_page ?? 20)
  },

  async issueAccessCode(payload: {
    application_id: string
    type: 'applicant' | 'staff'
    expires_at: string
  }): Promise<{ code: string; record: AccessCode }> {
    if (API_MODE === 'live') {
      return http.post<{ code: string; record: AccessCode }>(
        '/admin/access-codes',
        payload,
      )
    }
    await delay(500)
    // Mock stands in for the server-side generator. In production the code is
    // generated and hashed server-side and never round-trips in plaintext.
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)]
    }
    const app = applications.find((a) => a.id === payload.application_id)
    const record: AccessCode = {
      id: `code-${Date.now()}`,
      tenant_id: 'ten-1',
      code_hint: code.slice(-4),
      type: payload.type,
      application_id: payload.application_id,
      issued_to: app?.applicant_id ?? null,
      issued_by: 'usr-admin-1',
      status: 'active',
      expires_at: payload.expires_at,
      used_at: null,
      failed_attempts: 0,
      created_at: new Date().toISOString(),
      applicant_name: app ? `${app.first_name} ${app.last_name}` : undefined,
      job_title: app?.job_title,
    }
    accessCodes.unshift(record)
    return { code, record }
  },

  async revokeAccessCode(id: string): Promise<AccessCode> {
    if (API_MODE === 'live') {
      return http.patch<AccessCode>(`/admin/access-codes/${id}`, { status: 'revoked' })
    }
    await delay(350)
    const idx = accessCodes.findIndex((c) => c.id === id)
    if (idx === -1) throw new Error('Access code not found')
    accessCodes[idx] = { ...accessCodes[idx], status: 'revoked' }
    return accessCodes[idx]
  },

  async redeemAccessCode(code: string): Promise<{ application: Application }> {
    if (API_MODE === 'live') {
      return http.post<{ application: Application }>('/staff/redeem', { code })
    }
    await delay(700)
    const record = accessCodes.find((c) => c.code_hint === code.slice(-4).toUpperCase())
    if (!record) throw new Error('That access code is not recognised.')
    if (record.status !== 'active')
      throw new Error('That access code has already been used or was revoked.')
    if (new Date(record.expires_at).getTime() < Date.now())
      throw new Error('That access code has expired. Please contact the HR department.')
    const app = applications.find((a) => a.id === record.application_id)
    if (!app) throw new Error('No application is linked to this code.')
    return { application: app }
  },

  async listStaff(filters: StaffFilters = {}): Promise<Paginated<StaffProfile>> {
    if (API_MODE === 'live') {
      return http.get<Paginated<StaffProfile>>('/admin/staff', { ...filters })
    }
    await delay()
    let rows = [...staffProfiles]
    if (filters.status && filters.status !== 'all') {
      rows = rows.filter((s) => s.status === filters.status)
    }
    if (filters.employment_category && filters.employment_category !== 'all') {
      rows = rows.filter((s) => s.employment_category === filters.employment_category)
    }
    if (filters.department_id) {
      rows = rows.filter((s) => s.department_id === filters.department_id)
    }
    if (filters.search) {
      rows = rows.filter(
        (s) =>
          matchesSearch(s.first_name, filters.search) ||
          matchesSearch(s.last_name, filters.search) ||
          matchesSearch(s.staff_id, filters.search) ||
          matchesSearch(s.email, filters.search),
      )
    }
    return paginate(rows, filters.page ?? 1, filters.per_page ?? 20)
  },

  async getStaff(id: string): Promise<StaffProfile | undefined> {
    if (API_MODE === 'live') return http.get<StaffProfile>(`/admin/staff/${id}`)
    await delay(150)
    return staffProfiles.find((s) => s.id === id)
  },

  async listLocations(): Promise<Location[]> {
    if (API_MODE === 'live') return http.get<Location[]>('/admin/locations')
    await delay()
    return locations
  },

  async createLocation(payload: {
    type: LocationType
    name: string
    parent_id: string | null
    code?: string
  }): Promise<Location> {
    if (API_MODE === 'live') {
      return http.post<Location>('/admin/locations', payload)
    }
    await delay(350)
    const created: Location = {
      id: `loc-${Date.now()}`,
      tenant_id: 'ten-1',
      parent_id: payload.parent_id,
      type: payload.type,
      name: payload.name,
      code: payload.code ?? null,
      slug: payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      status: 'pending',
      created_at: new Date().toISOString(),
    }
    locations.push(created)
    return created
  },

  async approveLocation(id: string): Promise<Location> {
    if (API_MODE === 'live') {
      return http.patch<Location>(`/admin/locations/${id}`, { status: 'approved' })
    }
    await delay(300)
    const idx = locations.findIndex((l) => l.id === id)
    if (idx === -1) throw new Error('Location not found')
    locations[idx] = { ...locations[idx], status: 'approved' }
    return locations[idx]
  },

  async listDepartments(): Promise<Department[]> {
    if (API_MODE === 'live') return http.get<Department[]>('/admin/departments')
    await delay(150)
    return departments
  },

  async listUsers(): Promise<User[]> {
    if (API_MODE === 'live') return http.get<User[]>('/admin/users')
    await delay()
    return users
  },

  async approveUser(id: string): Promise<User> {
    if (API_MODE === 'live') return http.patch<User>(`/admin/users/${id}`, { status: 'active' })
    await delay(300)
    const idx = users.findIndex((u) => u.id === id)
    if (idx === -1) throw new Error('User not found')
    users[idx] = { ...users[idx], status: 'active' }
    return users[idx]
  },

  async listTemplates(): Promise<MessageTemplate[]> {
    if (API_MODE === 'live') return http.get<MessageTemplate[]>('/admin/templates')
    await delay()
    return messageTemplates
  },

  async listNotifications(): Promise<Notification[]> {
    if (API_MODE === 'live') return http.get<Notification[]>('/admin/notifications')
    await delay()
    return notifications
  },

  async listAuditLogs(): Promise<AuditLog[]> {
    if (DASHBOARD_MODE === 'live') {
      const response = await http.get<{ items: AuditLog[] }>('/admin/audit-logs')
      return response.items
    }
    await delay()
    return auditLogs
  },
}

/** Employment categories exposed in filters. */
export const employmentCategoryLabels: Record<EmploymentCategory, string> = {
  director: 'Director',
  employee: 'Employee',
  contractor: 'Contractor',
  partner: 'Partner',
}

export { paginate }
export type { JobStatus, StaffStatus }
