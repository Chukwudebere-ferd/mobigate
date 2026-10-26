package models

import (
	"time"

	"github.com/google/uuid"
)

// AdvanceRequestStatus is the lifecycle of a staff upfront-payment request.
// Approval is a decision only; salary deduction and payout happen outside
// this system.
type AdvanceRequestStatus string

const (
	AdvanceRequestPending  AdvanceRequestStatus = "pending"
	AdvanceRequestApproved AdvanceRequestStatus = "approved"
	AdvanceRequestDeclined AdvanceRequestStatus = "declined"
)

// SalaryPayment is one staff member's salary assignment for a month.
// Amounts are stored in kobo so the wire format never carries a float.
type SalaryPayment struct {
	ID             uuid.UUID  `json:"id"`
	TenantID       uuid.UUID  `json:"tenant_id"`
	StaffProfileID uuid.UUID  `json:"staff_profile_id"`
	StaffID        string     `json:"staff_id"`
	StaffName      string     `json:"staff_name"`
	Month          int        `json:"month"`
	Year           int        `json:"year"`
	AmountKobo     int64      `json:"amount_kobo"`
	Note           *string    `json:"note"`
	CreatedBy      *uuid.UUID `json:"created_by"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// AdvanceRequest is a staff member's request for part of their salary before
// the normal pay date.
type AdvanceRequest struct {
	ID             uuid.UUID            `json:"id"`
	TenantID       uuid.UUID            `json:"tenant_id"`
	StaffProfileID uuid.UUID            `json:"staff_profile_id"`
	StaffID        string               `json:"staff_id"`
	StaffName      string               `json:"staff_name"`
	AmountKobo     int64                `json:"amount_kobo"`
	Reason         string               `json:"reason"`
	Status         AdvanceRequestStatus `json:"status"`
	DecisionNote   *string              `json:"decision_note"`
	DecidedBy      *uuid.UUID           `json:"decided_by"`
	DecidedAt      *time.Time           `json:"decided_at"`
	CreatedAt      time.Time            `json:"created_at"`
	UpdatedAt      time.Time            `json:"updated_at"`
}

// StaffPayroll is the staff-portal view of assigned salaries and advance
// requests.
type StaffPayroll struct {
	SalaryPayments  []SalaryPayment  `json:"salary_payments"`
	AdvanceRequests []AdvanceRequest `json:"advance_requests"`
}
