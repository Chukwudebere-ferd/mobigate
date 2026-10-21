// Package models contains the domain types for the MGM-Portal MVP.
//
// These map one-to-one onto the PostgreSQL schema in README §9 and onto the
// TypeScript types in frontend/src/types/domain.ts. The wire format is
// snake_case JSON in both directions.
package models

import (
	"time"

	"github.com/google/uuid"
)

// -- Enumerations ----------------------------------------------------------

type UserRole string

const (
	RoleSuperAdmin UserRole = "super_admin"
	RoleAdmin      UserRole = "admin"
	RoleStaff      UserRole = "staff"
	RoleApplicant  UserRole = "applicant"
)

type UserStatus string

const (
	UserStatusPending   UserStatus = "pending"
	UserStatusActive    UserStatus = "active"
	UserStatusSuspended UserStatus = "suspended"
	UserStatusDisabled  UserStatus = "disabled"
)

type EmploymentCategory string

const (
	CategoryDirector   EmploymentCategory = "director"
	CategoryEmployee   EmploymentCategory = "employee"
	CategoryContractor EmploymentCategory = "contractor"
	CategoryPartner    EmploymentCategory = "partner"
)

type ApplicationStatus string

const (
	ApplicationPending     ApplicationStatus = "pending"
	ApplicationShortlisted ApplicationStatus = "shortlisted"
	ApplicationRejected    ApplicationStatus = "rejected"
	ApplicationAppointed   ApplicationStatus = "appointed"
	ApplicationWithdrawn   ApplicationStatus = "withdrawn"
)

type JobStatus string

const (
	JobDraft     JobStatus = "draft"
	JobPublished JobStatus = "published"
	JobClosed    JobStatus = "closed"
	JobArchived  JobStatus = "archived"
)

type AccessCodeStatus string

const (
	AccessCodeActive  AccessCodeStatus = "active"
	AccessCodeUsed    AccessCodeStatus = "used"
	AccessCodeRevoked AccessCodeStatus = "revoked"
	AccessCodeExpired AccessCodeStatus = "expired"
)

type AccessCodeType string

const (
	AccessCodeApplicant AccessCodeType = "applicant"
	AccessCodeStaff     AccessCodeType = "staff"
)

type LocationType string

const (
	LocationCountry LocationType = "country"
	LocationState   LocationType = "state"
	LocationLGA     LocationType = "lga"
	LocationCity    LocationType = "city"
	LocationTown    LocationType = "town"
)

type LocationStatus string

const (
	LocationPending  LocationStatus = "pending"
	LocationApproved LocationStatus = "approved"
	LocationInactive LocationStatus = "inactive"
)

type InterviewAudience string

const (
	AudienceJobApplicants   InterviewAudience = "job_applicants"
	AudienceShortlistedOnly InterviewAudience = "shortlisted_only"
	AudienceAllApplicants   InterviewAudience = "all_applicants"
)

type InterviewStatus string

const (
	InterviewDraft     InterviewStatus = "draft"
	InterviewPublished InterviewStatus = "published"
	InterviewCancelled InterviewStatus = "cancelled"
)

type StaffStatus string

const (
	StaffActive    StaffStatus = "active"
	StaffSuspended StaffStatus = "suspended"
	StaffExited    StaffStatus = "exited"
)

// -- Entities --------------------------------------------------------------

type Tenant struct {
	ID              uuid.UUID  `json:"id"`
	Name            string     `json:"name"`
	StateLocationID *uuid.UUID `json:"state_location_id"`
	Status          string     `json:"status"`
	CreatedAt       time.Time  `json:"created_at"`
}

type Location struct {
	ID        uuid.UUID      `json:"id"`
	TenantID  *uuid.UUID     `json:"tenant_id"`
	ParentID  *uuid.UUID     `json:"parent_id"`
	Type      LocationType   `json:"type"`
	Name      string         `json:"name"`
	Code      *string        `json:"code"`
	Slug      string         `json:"slug"`
	Status    LocationStatus `json:"status"`
	CreatedAt time.Time      `json:"created_at"`
}

type User struct {
	ID              uuid.UUID  `json:"id"`
	TenantID        *uuid.UUID `json:"tenant_id"`
	Role            UserRole   `json:"role"`
	Email           string     `json:"email"`
	Phone           *string    `json:"phone"`
	PasswordHash    *string    `json:"-"`
	FirstName       string     `json:"first_name"`
	LastName        string     `json:"last_name"`
	Status          UserStatus `json:"status"`
	EmailVerifiedAt *time.Time `json:"email_verified_at"`
	PhoneVerifiedAt *time.Time `json:"phone_verified_at"`
	LastLoginAt     *time.Time `json:"last_login_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type Job struct {
	ID                 uuid.UUID           `json:"id"`
	TenantID           uuid.UUID           `json:"tenant_id"`
	Title              string              `json:"title"`
	Slug               string              `json:"slug"`
	Description        string              `json:"description"`
	Requirements       *string             `json:"requirements"`
	LocationID         *uuid.UUID          `json:"location_id"`
	EmploymentCategory *EmploymentCategory `json:"employment_category"`
	Openings           int                 `json:"openings"`
	PublishAt          *time.Time          `json:"publish_at"`
	DeadlineAt         *time.Time          `json:"deadline_at"`
	Status             JobStatus           `json:"status"`
	CreatedBy          *uuid.UUID          `json:"created_by"`
	CreatedAt          time.Time           `json:"created_at"`

	// Derived for list display; not columns on jobs.
	ApplicationsCount *int    `json:"applications_count,omitempty"`
	LocationName      *string `json:"location_name,omitempty"`
}

type Application struct {
	ID                uuid.UUID         `json:"id"`
	ApplicationNumber string            `json:"application_number"`
	TenantID          uuid.UUID         `json:"tenant_id"`
	JobID             uuid.UUID         `json:"job_id"`
	ApplicantID       uuid.UUID         `json:"applicant_id"`
	FirstName         string            `json:"first_name"`
	LastName          string            `json:"last_name"`
	Email             string            `json:"email"`
	Phone             string            `json:"phone"`
	Gender            *string           `json:"gender"`
	DateOfBirth       *time.Time        `json:"date_of_birth"`
	LocationID        *uuid.UUID        `json:"location_id"`
	AddressLine       *string           `json:"address_line"`
	Qualification     *string           `json:"qualification"`
	CVDocumentID      *uuid.UUID        `json:"cv_document_id"`
	PhotoDocumentID   *uuid.UUID        `json:"photo_document_id"`
	ConsentAcceptedAt *time.Time        `json:"consent_accepted_at"`
	ConsentVersion    *string           `json:"consent_version"`
	Status            ApplicationStatus `json:"status"`
	SubmittedAt       time.Time         `json:"submitted_at"`
	UpdatedAt         time.Time         `json:"updated_at"`

	// Derived for list display; not columns on applications.
	JobTitle     *string `json:"job_title,omitempty"`
	JobSlug      *string `json:"job_slug,omitempty"`
	LocationName *string `json:"location_name,omitempty"`
	CVFileName   *string `json:"cv_file_name,omitempty"`
}

type ApplicationEvent struct {
	ID            uuid.UUID  `json:"id"`
	ApplicationID uuid.UUID  `json:"application_id"`
	ActorID       *uuid.UUID `json:"actor_id"`
	FromStatus    *string    `json:"from_status"`
	ToStatus      string     `json:"to_status"`
	Reason        *string    `json:"reason"`
	CreatedAt     time.Time  `json:"created_at"`

	// Derived for the application timeline; not a column on application_events.
	ActorName *string `json:"actor_name,omitempty"`
}

type InterviewAnnouncement struct {
	ID           uuid.UUID         `json:"id"`
	TenantID     uuid.UUID         `json:"tenant_id"`
	JobID        uuid.UUID         `json:"job_id"`
	InterviewAt  time.Time         `json:"interview_at"`
	Venue        string            `json:"venue"`
	Instructions *string           `json:"instructions"`
	Audience     InterviewAudience `json:"audience"`
	Status       InterviewStatus   `json:"status"`
	CreatedBy    *uuid.UUID        `json:"created_by"`
	CreatedAt    time.Time         `json:"created_at"`

	// Derived for list display; not columns on interview_announcements.
	JobTitle       *string `json:"job_title,omitempty"`
	ApplicantCount *int    `json:"applicant_count,omitempty"`
}

type Shortlist struct {
	ID                uuid.UUID  `json:"id"`
	ApplicationID     uuid.UUID  `json:"application_id"`
	JobID             uuid.UUID  `json:"job_id"`
	Message           string     `json:"message"`
	MessageTemplateID *uuid.UUID `json:"message_template_id"`
	Status            string     `json:"status"`
	CreatedBy         *uuid.UUID `json:"created_by"`
	CreatedAt         time.Time  `json:"created_at"`
	RevokedAt         *time.Time `json:"revoked_at"`

	// Derived for list display; not columns on shortlists.
	ApplicantName *string `json:"applicant_name,omitempty"`
	JobTitle      *string `json:"job_title,omitempty"`
}

type AccessCode struct {
	ID             uuid.UUID        `json:"id"`
	TenantID       uuid.UUID        `json:"tenant_id"`
	CodeHash       string           `json:"-"`
	CodeHint       string           `json:"code_hint"`
	Type           AccessCodeType   `json:"type"`
	ApplicationID  *uuid.UUID       `json:"application_id"`
	IssuedTo       *uuid.UUID       `json:"issued_to"`
	IssuedBy       *uuid.UUID       `json:"issued_by"`
	Status         AccessCodeStatus `json:"status"`
	ExpiresAt      time.Time        `json:"expires_at"`
	UsedAt         *time.Time       `json:"used_at"`
	UsedBy         *uuid.UUID       `json:"used_by"`
	FailedAttempts int              `json:"failed_attempts"`
	CreatedAt      time.Time        `json:"created_at"`

	// Derived for list display; not columns on access_codes.
	ApplicantName *string `json:"applicant_name,omitempty"`
	JobTitle      *string `json:"job_title,omitempty"`
}

type StaffProfile struct {
	ID                          uuid.UUID          `json:"id"`
	TenantID                    uuid.UUID          `json:"tenant_id"`
	UserID                      *uuid.UUID         `json:"user_id"`
	StaffID                     string             `json:"staff_id"`
	ApplicationID               *uuid.UUID         `json:"application_id"`
	EmploymentCategory          EmploymentCategory `json:"employment_category"`
	FirstName                   string             `json:"first_name"`
	LastName                    string             `json:"last_name"`
	Email                       string             `json:"email"`
	Phone                       string             `json:"phone"`
	Gender                      *string            `json:"gender"`
	DateOfBirth                 *time.Time         `json:"date_of_birth"`
	AddressLine                 *string            `json:"address_line"`
	LocationID                  *uuid.UUID         `json:"location_id"`
	BankName                    *string            `json:"bank_name"`
	BankAccountName             *string            `json:"bank_account_name"`
	BankAccountNumber           *string            `json:"bank_account_number"`
	GuarantorName               *string            `json:"guarantor_name"`
	GuarantorPhone              *string            `json:"guarantor_phone"`
	GuarantorAddress            *string            `json:"guarantor_address"`
	GuarantorRelationship       *string            `json:"guarantor_relationship"`
	NextOfKinName               *string            `json:"next_of_kin_name"`
	NextOfKinPhone              *string            `json:"next_of_kin_phone"`
	NextOfKinRelationship       *string            `json:"next_of_kin_relationship"`
	DepartmentID                *uuid.UUID         `json:"department_id"`
	Position                    *string            `json:"position"`
	AppointmentDate             *time.Time         `json:"appointment_date"`
	RulesOfEngagementAcceptedAt *time.Time         `json:"rules_of_engagement_accepted_at"`
	Status                      StaffStatus        `json:"status"`
	CreatedAt                   time.Time          `json:"created_at"`
	UpdatedAt                   time.Time          `json:"updated_at"`

	// Derived for list display; not columns on staff_profiles.
	LocationName   *string `json:"location_name,omitempty"`
	DepartmentName *string `json:"department_name,omitempty"`
}

type Department struct {
	ID       uuid.UUID `json:"id"`
	TenantID uuid.UUID `json:"tenant_id"`
	Name     string    `json:"name"`
}

type Document struct {
	ID         uuid.UUID  `json:"id"`
	TenantID   *uuid.UUID `json:"tenant_id"`
	OwnerType  string     `json:"owner_type"`
	OwnerID    uuid.UUID  `json:"owner_id"`
	Category   string     `json:"category"`
	FileName   string     `json:"file_name"`
	StorageKey string     `json:"-"`
	MimeType   string     `json:"mime_type"`
	SizeBytes  int64      `json:"size_bytes"`
	UploadedBy *uuid.UUID `json:"uploaded_by"`
	CreatedAt  time.Time  `json:"created_at"`
}

// AdminSettings is the single group-wide configuration row.
type AdminSettings struct {
	AccessCodeLength      int        `json:"access_code_length"`
	AccessCodeTTLDays     int        `json:"access_code_ttl_days"`
	AccessCodeMaxAttempts int        `json:"access_code_max_attempts"`
	UpdatedAt             time.Time  `json:"updated_at"`
	UpdatedBy             *uuid.UUID `json:"updated_by"`
}

type MessageTemplate struct {
	ID        uuid.UUID         `json:"id"`
	TenantID  *uuid.UUID        `json:"tenant_id"`
	Key       string            `json:"key"`
	Channel   string            `json:"channel"`
	Subject   *string           `json:"subject"`
	Body      string            `json:"body"`
	Variables map[string]string `json:"variables"`
	CreatedAt time.Time         `json:"created_at"`
}

type Notification struct {
	ID               uuid.UUID      `json:"id"`
	TenantID         *uuid.UUID     `json:"tenant_id"`
	RecipientUserID  *uuid.UUID     `json:"recipient_user_id"`
	RecipientContact *string        `json:"recipient_contact"`
	Channel          string         `json:"channel"`
	TemplateKey      *string        `json:"template_key"`
	Payload          map[string]any `json:"payload"`
	ProviderRef      *string        `json:"provider_ref"`
	Status           string         `json:"status"`
	Error            *string        `json:"error"`
	SentAt           *time.Time     `json:"sent_at"`
	CreatedAt        time.Time      `json:"created_at"`
}

type AuditLog struct {
	ID         uuid.UUID      `json:"id"`
	TenantID   *uuid.UUID     `json:"tenant_id"`
	ActorID    *uuid.UUID     `json:"actor_id"`
	Action     string         `json:"action"`
	EntityType string         `json:"entity_type"`
	EntityID   *uuid.UUID     `json:"entity_id"`
	BeforeData map[string]any `json:"before_data"`
	AfterData  map[string]any `json:"after_data"`
	IPAddress  *string        `json:"ip_address"`
	UserAgent  *string        `json:"user_agent"`
	CreatedAt  time.Time      `json:"created_at"`

	// Derived for list display; not a column on audit_logs.
	ActorName *string `json:"actor_name,omitempty"`
}

type IDSequence struct {
	ID        uuid.UUID `json:"id"`
	Scope     string    `json:"scope"`
	TenantID  uuid.UUID `json:"tenant_id"`
	Year      int       `json:"year"`
	Prefix    string    `json:"prefix"`
	StateCode string    `json:"state_code"`
	LastValue int       `json:"last_value"`
}
