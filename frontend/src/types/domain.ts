/**
 * Domain types for the MGM-Portal MVP.
 *
 * These mirror the Go API contract (README §9). Field names are snake_case
 * on the wire; the UI layer uses them as-is to avoid a mapping layer until
 * the backend contract is frozen.
 */

// -- Enumerations ----------------------------------------------------------

export const USER_ROLES = ['super_admin', 'admin', 'staff', 'applicant'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const EMPLOYMENT_CATEGORIES = [
  'director',
  'employee',
  'contractor',
  'partner',
] as const
/**
 * The four values above are the suggested categories. Admin-created jobs may
 * also carry a custom category typed by the admin.
 */
export type EmploymentCategory = string

export const APPLICATION_STATUSES = [
  'pending',
  'shortlisted',
  'rejected',
  'appointed',
  'withdrawn',
] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const JOB_STATUSES = ['draft', 'published', 'closed', 'archived'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export const ACCESS_CODE_STATUSES = [
  'active',
  'used',
  'revoked',
  'expired',
] as const
export type AccessCodeStatus = (typeof ACCESS_CODE_STATUSES)[number]

export const ACCESS_CODE_TYPES = ['applicant', 'staff'] as const
export type AccessCodeType = (typeof ACCESS_CODE_TYPES)[number]

export const LOCATION_TYPES = ['country', 'state', 'lga', 'city', 'town'] as const
export type LocationType = (typeof LOCATION_TYPES)[number]

export const INTERVIEW_AUDIENCES = [
  'job_applicants',
  'shortlisted_only',
  'all_applicants',
] as const
export type InterviewAudience = (typeof INTERVIEW_AUDIENCES)[number]

export const INTERVIEW_STATUSES = ['draft', 'published', 'cancelled'] as const
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number]

export const USER_STATUSES = ['pending', 'active', 'suspended', 'disabled'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const STAFF_STATUSES = ['active', 'suspended', 'exited'] as const
export type StaffStatus = (typeof STAFF_STATUSES)[number]

export const NOTIFICATION_CHANNELS = ['email', 'sms', 'whatsapp'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

// -- Entities --------------------------------------------------------------

export interface User {
  id: string
  tenant_id: string | null
  role: UserRole
  email: string
  phone: string | null
  first_name: string
  last_name: string
  status: UserStatus
  email_verified_at: string | null
  last_login_at: string | null
  created_at: string
}

/** A state-scoped tenant a Super Admin can assign to a delegated Admin. */
export interface Tenant {
  id: string
  name: string
  state_location_id: string | null
  status: string
  created_at: string
}

export interface Location {
  id: string
  tenant_id: string | null
  parent_id: string | null
  type: LocationType
  name: string
  code: string | null
  slug: string
  status: 'pending' | 'approved' | 'inactive'
  created_at: string
}

export interface Job {
  id: string
  tenant_id: string
  title: string
  slug: string
  description: string
  requirements: string | null
  location_id: string | null
  employment_category: EmploymentCategory | null
  openings: number
  publish_at: string | null
  deadline_at: string | null
  status: JobStatus
  created_by: string | null
  created_at: string
  /** Derived for display; populated by the API. */
  applications_count?: number
  location_name?: string
}

export interface Application {
  id: string
  application_number: string
  tenant_id: string
  job_id: string
  applicant_id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  gender: string | null
  date_of_birth: string | null
  location_id: string | null
  address_line: string | null
  qualification: string | null
  cv_document_id: string | null
  photo_document_id: string | null
  consent_accepted_at?: string | null
  consent_version?: string | null
  status: ApplicationStatus
  submitted_at: string
  updated_at: string
  /** Derived for display. */
  job_title?: string
  job_slug?: string
  location_name?: string
  cv_file_name?: string
  photo_url?: string
}

export interface ApplicationEvent {
  id: string
  application_id: string
  actor_id: string | null
  from_status: string | null
  to_status: string
  reason: string | null
  created_at: string
  /** Derived for display. */
  actor_name?: string
}

export interface InterviewAnnouncement {
  id: string
  tenant_id: string
  job_id: string
  interview_at: string
  venue: string
  instructions: string | null
  audience: InterviewAudience
  status: InterviewStatus
  created_by: string | null
  created_at: string
  /** Derived for display. */
  job_title?: string
  applicant_count?: number
}

export interface Shortlist {
  id: string
  application_id: string
  job_id: string
  message: string
  message_template_id: string | null
  status: 'active' | 'revoked'
  created_by: string | null
  created_at: string
  revoked_at: string | null  /** Derived for display. */
  applicant_name?: string
  job_title?: string
}

export interface AccessCode {
  id: string
  tenant_id: string
  code_hint: string
  type: AccessCodeType
  application_id: string | null
  staff_profile_id: string | null
  issued_to: string | null
  issued_by: string | null
  status: AccessCodeStatus
  expires_at: string
  used_at: string | null
  failed_attempts: number
  created_at: string
  /** Derived for display. */
  applicant_name?: string
  job_title?: string
}

export interface StaffProfile {
  id: string
  tenant_id: string
  user_id: string | null
  staff_id: string
  application_id: string | null
  employment_category: EmploymentCategory
  first_name: string
  last_name: string
  email: string
  phone: string
  gender: string | null
  date_of_birth: string | null
  address_line: string | null
  location_id: string | null
  bank_name: string | null
  bank_account_name: string | null
  bank_account_number: string | null
  guarantor_name: string | null
  guarantor_phone: string | null
  guarantor_address: string | null
  guarantor_relationship: string | null
  next_of_kin_name: string | null
  next_of_kin_phone: string | null
  next_of_kin_relationship: string | null
  department_id: string | null
  position: string | null
  appointment_date: string | null
  rules_of_engagement_accepted_at: string | null
  status: StaffStatus
  created_at: string
  updated_at: string
  /** Derived for display. */
  location_name?: string
  department_name?: string
}

export interface Department {
  id: string
  tenant_id: string
  name: string
}

export type PolicyAudience = 'applicant' | 'staff' | 'both'

export interface Policy {
  id: string
  title: string
  body: string
  audience: PolicyAudience
  required: boolean
  active: boolean
  version: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  tenant_id: string | null
  owner_type: 'application' | 'staff'
  owner_id: string
  category: string
  file_name: string
  storage_key: string
  mime_type: string
  size_bytes: number
  uploaded_by: string | null
  created_at: string
}

export interface MessageTemplate {
  id: string
  tenant_id: string | null
  key: string
  channel: NotificationChannel
  subject: string | null
  body: string
  variables: Record<string, string>
  created_at: string
}

export interface AdminSettings {
  access_code_length: number
  access_code_ttl_days: number
  access_code_max_attempts: number
  updated_at: string
  updated_by: string | null
}

export interface Notification {
  id: string
  tenant_id: string | null
  recipient_user_id: string | null
  recipient_contact: string | null
  channel: NotificationChannel
  template_key: string | null
  payload: Record<string, unknown>
  provider_ref: string | null
  status: 'pending' | 'sent' | 'failed' | 'read'
  error: string | null
  sent_at: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  tenant_id: string | null
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  /** Derived for display. */
  actor_name?: string
}

// -- Dashboard -------------------------------------------------------------

export interface DashboardMetrics {
  total_applications: number
  pending: number
  shortlisted: number
  rejected: number
  appointed: number
  total_staff: number
  active_access_codes: number
  expiring_codes: number
  upcoming_interviews: number
  applications_delta: number
  /** Applications per day for the last 30 days, oldest first. */
  applications_trend: { date: string; count: number }[]
}

// -- List responses --------------------------------------------------------

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface ApplicationFilters {
  page?: number
  per_page?: number
  search?: string
  status?: ApplicationStatus | 'all'
  job_id?: string
  state_id?: string
  lga_id?: string
  date_from?: string
  date_to?: string
  sort?: 'submitted_at' | 'status' | 'job'
  order?: 'asc' | 'desc'
}

export interface StaffFilters {
  page?: number
  per_page?: number
  search?: string
  status?: StaffStatus | 'all'
  department_id?: string
  employment_category?: EmploymentCategory | 'all'
  state_id?: string
}

export interface AccessCodeFilters {
  page?: number
  per_page?: number
  status?: AccessCodeStatus | 'all'
  type?: AccessCodeType | 'all'
  job_id?: string
  search?: string
}

/** The signed-in user, as returned by the session endpoint. */
export interface Session {
  user: {
    id: string
    email: string
    first_name: string
    last_name: string
    role: UserRole
    status: UserStatus
    tenant_id: string | null
    /** Present for staff sessions. */
    staff_id?: string
  }
  /** State scope label shown in the admin shell. */
  tenant_name?: string | null
}

/** Response from GET /me (Go API). */
export interface MeResponse {
  user: Session['user']
  tenant: { id: string; name: string } | null
}

/**
 * Applicant details recovered from an application when a staff access code
 * is redeemed, used to prefill the onboarding form.
 */
export interface StaffRedeemPrefill {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  gender?: string | null
  /** RFC3339 from the API; the date input needs the YYYY-MM-DD prefix. */
  date_of_birth?: string | null
  location_id?: string | null
  address_line?: string | null
  employment_category?: EmploymentCategory | null
  department_id?: string | null
  position?: string | null
  appointment_date?: string | null
  bank_name?: string | null
  bank_account_name?: string | null
  bank_account_number?: string | null
  guarantor_name?: string | null
  guarantor_phone?: string | null
  guarantor_address?: string | null
  guarantor_relationship?: string | null
  next_of_kin_name?: string | null
  next_of_kin_phone?: string | null
  next_of_kin_relationship?: string | null
}

/** Response from POST /staff/redeem. */
export interface StaffRedemption {
  /** Short-lived ticket authorising the draft and submission routes. */
  ticket: string
  ticket_expires_at: string
  departments: Department[]
  application?: Application
  prefill?: StaffRedeemPrefill
  /** Active admin-managed staff policies shown as checkboxes. */
  policies?: Policy[]
  /** Earlier form snapshot saved as a draft, if any. */
  draft?: Record<string, unknown>
}

/** A staff document row as returned by GET /staff/me (no download URL). */
export interface StaffDocument {
  id: string
  category: string
  file_name: string
  mime_type: string
  size_bytes: number
  created_at: string
}

/** Response from GET /staff/me. */
export interface StaffMeResponse {
  staff: StaffProfile
  documents: StaffDocument[]
}

/** Response from GET /staff/onboarding/draft. */
export interface StaffDraftResponse {
  draft: Record<string, unknown>
}

/** Response from PUT /staff/onboarding/draft. */
export interface StaffDraftSaveResponse {
  saved: boolean
}

/** Response from POST /staff/onboarding. */
export interface StaffOnboardingResponse {
  staff: StaffProfile
}
