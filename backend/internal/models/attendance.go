package models

import (
	"time"

	"github.com/google/uuid"
)

// AttendanceStatus is the clock state of one attendance record. It is
// deliberately a single dimension: whether a record still needs an
// administrator's attention is derived from its age, never stored, so that a
// "flagged" record can never escape the one-open-record-per-staff rule.
type AttendanceStatus string

const (
	// AttendanceOpen means the staff member is clocked in.
	AttendanceOpen AttendanceStatus = "open"
	// AttendanceClosed means they have clocked out, or an administrator
	// closed the record on their behalf.
	AttendanceClosed AttendanceStatus = "closed"
)

// WorkSite is the office whose hours define lateness and early leave. The
// group runs one office; the row is per tenant and edited from Settings.
type WorkSite struct {
	ID       uuid.UUID `json:"id"`
	TenantID uuid.UUID `json:"tenant_id"`
	Name     string    `json:"name"`
	Address  *string   `json:"address"`
	// Timezone is an IANA name such as Africa/Lagos. Timestamps are stored in
	// UTC and rendered in this zone.
	Timezone          string `json:"timezone"`
	WorkStart         string `json:"work_start"`
	WorkEnd           string `json:"work_end"`
	LateGraceMinutes  int    `json:"late_grace_minutes"`
	EarlyLeaveMinutes int    `json:"early_leave_minutes"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// AttendanceRecord is one clock-in and the matching clock-out, if any. The
// clock-in timestamps are never absent; the clock-out ones are nil until the
// record is closed.
type AttendanceRecord struct {
	ID              uuid.UUID         `json:"id"`
	TenantID        uuid.UUID         `json:"tenant_id"`
	StaffProfileID  uuid.UUID         `json:"staff_profile_id"`
	WorkSiteID      uuid.UUID         `json:"work_site_id"`
	Status          AttendanceStatus  `json:"status"`

	ClockInAt        time.Time  `json:"clock_in_at"`
	ClockInPhotoKey  *string    `json:"clock_in_photo_key"`
	ClockInIP        *string    `json:"clock_in_ip"`
	ClockInDeviceID  *uuid.UUID `json:"clock_in_device_id"`

	ClockOutAt        *time.Time `json:"clock_out_at"`
	ClockOutPhotoKey  *string    `json:"clock_out_photo_key"`
	ClockOutIP        *string    `json:"clock_out_ip"`
	ClockOutDeviceID  *uuid.UUID `json:"clock_out_device_id"`

	LateMinutes  int `json:"late_minutes"`
	EarlyMinutes int `json:"early_minutes"`

	Note       *string    `json:"note"`
	CorrectedBy *uuid.UUID `json:"corrected_by"`
	CorrectedAt *time.Time `json:"corrected_at"`

	ConsentAt  *time.Time `json:"consent_at"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`

	// Derived for display; not columns on attendance_records.
	StaffID        string  `json:"staff_id"`
	StaffName      string  `json:"staff_name"`
	DepartmentName *string `json:"department_name"`
	WorkSiteName   string  `json:"work_site_name"`
	// NeedsAttention marks an open record whose clock-in happened on an
	// earlier day in the site's timezone: a forgotten clock-out awaiting an
	// administrator, never closed automatically.
	NeedsAttention bool `json:"needs_attention"`
	// HoursWorked is the elapsed time between clock-in and clock-out (or
	// now), in minutes. Derived so the viewer never has to do the arithmetic.
	HoursWorkedMinutes int `json:"hours_worked_minutes"`
}

// KioskStaff is the identity the office laptop confirms before the camera
// opens. It deliberately carries name and department only — nothing
// confidential from the staff record crosses this public route.
type KioskStaff struct {
	StaffProfileID  uuid.UUID `json:"staff_profile_id"`
	StaffID         string    `json:"staff_id"`
	FirstName       string    `json:"first_name"`
	LastName        string    `json:"last_name"`
	DepartmentName  *string   `json:"department_name"`
	Position        *string   `json:"position"`
	// OpenRecordID is set when this person is already clocked in, so the
	// laptop offers clock-out rather than clock-in.
	OpenRecordID *uuid.UUID `json:"open_record_id"`
	// IsClockedIn is the same fact, as a convenience for the UI.
	IsClockedIn bool `json:"is_clocked_in"`
}

// KioskDevice is an office laptop authorised to record clock events. Validity
// is decided by this row, not by the token alone, so a revocation takes
// effect on the very next request.
type KioskDevice struct {
	ID       uuid.UUID  `json:"id"`
	TenantID uuid.UUID  `json:"tenant_id"`
	Label    string     `json:"label"`
	// PairingCode is returned exactly once, when the device is created. It is
	// hashed before storage and cannot be retrieved afterwards.
	PairingCode     *string    `json:"pairing_code,omitempty"`
	PairingExpiresAt *time.Time `json:"pairing_expires_at"`
	PairedAt        *time.Time `json:"paired_at"`
	PairedBy        *uuid.UUID `json:"paired_by"`
	ExpiresAt       time.Time  `json:"expires_at"`
	RevokedAt       *time.Time `json:"revoked_at"`
	LastSeenAt      *time.Time `json:"last_seen_at"`
	CreatedAt       time.Time  `json:"created_at"`

	// Derived for display.
	Status string `json:"status"`
}

// AttendancePhotoKeys carries the storage keys of a record's two photos. The
// handler turns them into short-lived signed URLs; keys are never handed to a
// staff member.
type AttendancePhotoKeys struct {
	ClockIn  *string `json:"clock_in"`
	ClockOut *string `json:"clock_out"`
}
