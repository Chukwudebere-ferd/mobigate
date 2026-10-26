package store

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/mobigate/mgm-portal/internal/models"
)

const payrollListLimit = 200

// SalaryPaymentQuery filters the admin salary list.
type SalaryPaymentQuery struct {
	TenantID       *uuid.UUID
	Year           int
	StaffProfileID *uuid.UUID
}

// AdvanceRequestQuery filters the admin upfront-payment queue.
type AdvanceRequestQuery struct {
	TenantID *uuid.UUID
	Status   models.AdvanceRequestStatus
}

// SalaryPaymentInput is an admin salary assignment.
type SalaryPaymentInput struct {
	StaffProfileID uuid.UUID
	Month          int
	Year           int
	AmountKobo     int64
	Note           *string
}

// AdvanceRequestInput is a staff upfront-payment request.
type AdvanceRequestInput struct {
	AmountKobo int64
	Reason     string
}

const salaryPaymentSelect = `
	SELECT p.id, p.tenant_id, p.staff_profile_id, sp.staff_id,
	       trim(sp.first_name || ' ' || sp.last_name) AS staff_name,
	       p.period_month, p.period_year, p.amount_kobo, p.note,
	       p.created_by, p.created_at, p.updated_at
	FROM salary_payments p
	JOIN staff_profiles sp ON sp.id = p.staff_profile_id`

const advanceRequestSelect = `
	SELECT a.id, a.tenant_id, a.staff_profile_id, sp.staff_id,
	       trim(sp.first_name || ' ' || sp.last_name) AS staff_name,
	       a.amount_kobo, a.reason, a.status, a.decision_note,
	       a.decided_by, a.decided_at, a.created_at, a.updated_at
	FROM advance_requests a
	JOIN staff_profiles sp ON sp.id = a.staff_profile_id`

// StaffPayroll returns the signed-in staff member's salary assignments and
// advance requests.
func (s *Store) StaffPayroll(ctx context.Context, userID uuid.UUID) (models.StaffPayroll, error) {
	staff, err := s.StaffByUserID(ctx, userID)
	if err != nil {
		return models.StaffPayroll{}, err
	}

	salaries, err := s.staffSalaryPayments(ctx, staff.ID)
	if err != nil {
		return models.StaffPayroll{}, err
	}
	advances, err := s.staffAdvanceRequests(ctx, staff.ID)
	if err != nil {
		return models.StaffPayroll{}, err
	}
	return models.StaffPayroll{
		SalaryPayments:  salaries,
		AdvanceRequests: advances,
	}, nil
}

// ListSalaryPaymentsAdmin lists salary assignments across a tenant. A nil
// tenant means group-wide for a Super Admin.
func (s *Store) ListSalaryPaymentsAdmin(ctx context.Context, q SalaryPaymentQuery) ([]models.SalaryPayment, error) {
	rows, err := s.pool.Query(ctx, salaryPaymentSelect+`
		WHERE ($1::uuid IS NULL OR p.tenant_id = $1)
		  AND ($2::integer = 0 OR p.period_year = $2)
		  AND ($3::uuid IS NULL OR p.staff_profile_id = $3)
		ORDER BY p.period_year DESC, p.period_month DESC,
		         sp.first_name, sp.last_name
		LIMIT `+strconv.Itoa(payrollListLimit),
		q.TenantID, q.Year, q.StaffProfileID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	payments := make([]models.SalaryPayment, 0)
	for rows.Next() {
		payment, err := scanSalaryPayment(rows)
		if err != nil {
			return nil, err
		}
		payments = append(payments, payment)
	}
	return payments, rows.Err()
}

// UpsertSalaryPayment creates or updates the one salary record for a staff
// member's month. The staff member is notified either way.
func (s *Store) UpsertSalaryPayment(
	ctx context.Context,
	tenantID uuid.UUID,
	actorID *uuid.UUID,
	in SalaryPaymentInput,
) (models.SalaryPayment, error) {
	if in.StaffProfileID == uuid.Nil {
		return models.SalaryPayment{}, fmt.Errorf("%w: select a staff member", ErrValidation)
	}
	if in.Month < 1 || in.Month > 12 {
		return models.SalaryPayment{}, fmt.Errorf("%w: select a month", ErrValidation)
	}
	if in.Year < 2000 || in.Year > 2100 {
		return models.SalaryPayment{}, fmt.Errorf("%w: enter a valid year", ErrValidation)
	}
	if in.AmountKobo <= 0 {
		return models.SalaryPayment{}, fmt.Errorf("%w: salary must be greater than zero", ErrValidation)
	}
	note, err := cleanPayrollNote(in.Note)
	if err != nil {
		return models.SalaryPayment{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.SalaryPayment{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		staffID   string
		firstName string
		lastName  string
		email     string
		userID    *uuid.UUID
	)
	err = tx.QueryRow(ctx, `
		SELECT staff_id, first_name, last_name, email, user_id
		FROM staff_profiles
		WHERE id = $1 AND tenant_id = $2`,
		in.StaffProfileID, tenantID,
	).Scan(&staffID, &firstName, &lastName, &email, &userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.SalaryPayment{}, ErrNotFound
	}
	if err != nil {
		return models.SalaryPayment{}, err
	}

	var paymentID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO salary_payments (
			tenant_id, staff_profile_id, period_month, period_year,
			amount_kobo, note, created_by
		) VALUES ($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT (staff_profile_id, period_year, period_month)
		DO UPDATE SET
			amount_kobo = EXCLUDED.amount_kobo,
			note = EXCLUDED.note,
			updated_at = now()
		RETURNING id`,
		tenantID, in.StaffProfileID, in.Month, in.Year,
		in.AmountKobo, note, actorID,
	).Scan(&paymentID)
	if err != nil {
		return models.SalaryPayment{}, mapWriteError(err)
	}

	period := fmt.Sprintf("%s %d", time.Month(in.Month).String(), in.Year)
	if err := EnqueueNotification(ctx, tx, tenantID, userID, email,
		"salary_assigned", map[string]any{
			"first_name": firstName,
			"period":     period,
			"amount":     formatKoboNaira(in.AmountKobo),
			"note_line":  payrollNoteLine(note),
		},
	); err != nil {
		return models.SalaryPayment{}, err
	}

	if err := insertAudit(ctx, tx, tenantID, actorID,
		"salary.assigned", "salary_payment", paymentID,
		nil, map[string]any{
			"staff_id":    staffID,
			"staff_name":  strings.TrimSpace(firstName + " " + lastName),
			"period":      period,
			"amount_kobo": in.AmountKobo,
		},
	); err != nil {
		return models.SalaryPayment{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.SalaryPayment{}, err
	}
	return s.salaryPaymentByID(ctx, tenantID, paymentID)
}

// ListAdvanceRequestsAdmin lists upfront-payment requests. Pending requests
// are shown first so the approval queue is easy to work through.
func (s *Store) ListAdvanceRequestsAdmin(ctx context.Context, q AdvanceRequestQuery) ([]models.AdvanceRequest, error) {
	if q.Status != "" && !validAdvanceStatus(q.Status) {
		return nil, fmt.Errorf("%w: unknown advance request status", ErrValidation)
	}

	rows, err := s.pool.Query(ctx, advanceRequestSelect+`
		WHERE ($1::uuid IS NULL OR a.tenant_id = $1)
		  AND ($2::text = '' OR a.status = $2)
		ORDER BY CASE a.status WHEN 'pending' THEN 0 ELSE 1 END,
		         a.created_at DESC
		LIMIT `+strconv.Itoa(payrollListLimit),
		q.TenantID, string(q.Status),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	requests := make([]models.AdvanceRequest, 0)
	for rows.Next() {
		request, err := scanAdvanceRequest(rows)
		if err != nil {
			return nil, err
		}
		requests = append(requests, request)
	}
	return requests, rows.Err()
}

// RequestAdvance records a staff member's upfront-payment request.
func (s *Store) RequestAdvance(ctx context.Context, userID uuid.UUID, in AdvanceRequestInput) (models.AdvanceRequest, error) {
	staff, err := s.StaffByUserID(ctx, userID)
	if err != nil {
		return models.AdvanceRequest{}, err
	}
	if in.AmountKobo <= 0 {
		return models.AdvanceRequest{}, fmt.Errorf("%w: enter an amount greater than zero", ErrValidation)
	}
	reason := strings.TrimSpace(in.Reason)
	if reason == "" {
		return models.AdvanceRequest{}, fmt.Errorf("%w: explain why you need the advance", ErrValidation)
	}
	if len([]rune(reason)) > 500 {
		return models.AdvanceRequest{}, fmt.Errorf("%w: keep the reason to 500 characters or fewer", ErrValidation)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.AdvanceRequest{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var requestID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO advance_requests (tenant_id, staff_profile_id, amount_kobo, reason)
		VALUES ($1,$2,$3,$4)
		RETURNING id`,
		staff.TenantID, staff.ID, in.AmountKobo, reason,
	).Scan(&requestID)
	if err != nil {
		return models.AdvanceRequest{}, err
	}

	if err := insertAudit(ctx, tx, staff.TenantID, &userID,
		"advance.requested", "advance_request", requestID,
		nil, map[string]any{
			"staff_id":    staff.StaffID,
			"amount_kobo": in.AmountKobo,
			"reason":      reason,
		},
	); err != nil {
		return models.AdvanceRequest{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.AdvanceRequest{}, err
	}
	return s.advanceRequestByID(ctx, staff.TenantID, requestID)
}

// DecideAdvanceRequest approves or declines a pending request and queues the
// staff email. Decision is status-only: no salary row is changed.
func (s *Store) DecideAdvanceRequest(
	ctx context.Context,
	tenantID uuid.UUID,
	actorID *uuid.UUID,
	requestID uuid.UUID,
	status models.AdvanceRequestStatus,
	note *string,
) (models.AdvanceRequest, error) {
	if status != models.AdvanceRequestApproved && status != models.AdvanceRequestDeclined {
		return models.AdvanceRequest{}, fmt.Errorf("%w: choose approve or decline", ErrValidation)
	}
	decisionNote, err := cleanPayrollNote(note)
	if err != nil {
		return models.AdvanceRequest{}, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.AdvanceRequest{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		currentStatus models.AdvanceRequestStatus
		firstName     string
		email         string
		userID        *uuid.UUID
		amountKobo    int64
		reason        string
	)
	err = tx.QueryRow(ctx, `
		SELECT a.status, sp.first_name, sp.email, sp.user_id, a.amount_kobo, a.reason
		FROM advance_requests a
		JOIN staff_profiles sp ON sp.id = a.staff_profile_id
		WHERE a.id = $1 AND a.tenant_id = $2
		FOR UPDATE OF a`,
		requestID, tenantID,
	).Scan(&currentStatus, &firstName, &email, &userID, &amountKobo, &reason)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.AdvanceRequest{}, ErrNotFound
	}
	if err != nil {
		return models.AdvanceRequest{}, err
	}
	if currentStatus != models.AdvanceRequestPending {
		return models.AdvanceRequest{}, fmt.Errorf("%w: this request has already been decided", ErrInvalidTransition)
	}

	tag, err := tx.Exec(ctx, `
		UPDATE advance_requests
		SET status = $3, decision_note = $4, decided_by = $5,
		    decided_at = now(), updated_at = now()
		WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
		requestID, tenantID, string(status), decisionNote, actorID,
	)
	if err != nil {
		return models.AdvanceRequest{}, err
	}
	if tag.RowsAffected() == 0 {
		return models.AdvanceRequest{}, fmt.Errorf("%w: this request has already been decided", ErrInvalidTransition)
	}

	templateKey := "advance_request_approved"
	action := "advance.approved"
	if status == models.AdvanceRequestDeclined {
		templateKey = "advance_request_declined"
		action = "advance.declined"
	}
	if err := EnqueueNotification(ctx, tx, tenantID, userID, email,
		templateKey, map[string]any{
			"first_name": firstName,
			"amount":     formatKoboNaira(amountKobo),
			"reason":     reason,
			"note_line":  payrollNoteLine(decisionNote),
		},
	); err != nil {
		return models.AdvanceRequest{}, err
	}

	if err := insertAudit(ctx, tx, tenantID, actorID,
		action, "advance_request", requestID,
		map[string]any{"status": currentStatus},
		map[string]any{"status": status, "decision_note": decisionNote},
	); err != nil {
		return models.AdvanceRequest{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.AdvanceRequest{}, err
	}
	return s.advanceRequestByID(ctx, tenantID, requestID)
}

func (s *Store) staffSalaryPayments(ctx context.Context, staffProfileID uuid.UUID) ([]models.SalaryPayment, error) {
	rows, err := s.pool.Query(ctx, salaryPaymentSelect+`
		WHERE p.staff_profile_id = $1
		ORDER BY p.period_year DESC, p.period_month DESC
		LIMIT 60`,
		staffProfileID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	payments := make([]models.SalaryPayment, 0)
	for rows.Next() {
		payment, err := scanSalaryPayment(rows)
		if err != nil {
			return nil, err
		}
		payments = append(payments, payment)
	}
	return payments, rows.Err()
}

func (s *Store) staffAdvanceRequests(ctx context.Context, staffProfileID uuid.UUID) ([]models.AdvanceRequest, error) {
	rows, err := s.pool.Query(ctx, advanceRequestSelect+`
		WHERE a.staff_profile_id = $1
		ORDER BY a.created_at DESC
		LIMIT 60`,
		staffProfileID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	requests := make([]models.AdvanceRequest, 0)
	for rows.Next() {
		request, err := scanAdvanceRequest(rows)
		if err != nil {
			return nil, err
		}
		requests = append(requests, request)
	}
	return requests, rows.Err()
}

func (s *Store) salaryPaymentByID(ctx context.Context, tenantID, paymentID uuid.UUID) (models.SalaryPayment, error) {
	payment, err := scanSalaryPayment(s.pool.QueryRow(ctx,
		salaryPaymentSelect+` WHERE p.id = $1 AND p.tenant_id = $2`,
		paymentID, tenantID,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.SalaryPayment{}, ErrNotFound
	}
	return payment, err
}

func (s *Store) advanceRequestByID(ctx context.Context, tenantID, requestID uuid.UUID) (models.AdvanceRequest, error) {
	request, err := scanAdvanceRequest(s.pool.QueryRow(ctx,
		advanceRequestSelect+` WHERE a.id = $1 AND a.tenant_id = $2`,
		requestID, tenantID,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.AdvanceRequest{}, ErrNotFound
	}
	return request, err
}

func scanSalaryPayment(row pgx.Row) (models.SalaryPayment, error) {
	var payment models.SalaryPayment
	err := row.Scan(
		&payment.ID, &payment.TenantID, &payment.StaffProfileID,
		&payment.StaffID, &payment.StaffName, &payment.Month, &payment.Year,
		&payment.AmountKobo, &payment.Note, &payment.CreatedBy,
		&payment.CreatedAt, &payment.UpdatedAt,
	)
	return payment, err
}

func scanAdvanceRequest(row pgx.Row) (models.AdvanceRequest, error) {
	var request models.AdvanceRequest
	err := row.Scan(
		&request.ID, &request.TenantID, &request.StaffProfileID,
		&request.StaffID, &request.StaffName, &request.AmountKobo,
		&request.Reason, &request.Status, &request.DecisionNote,
		&request.DecidedBy, &request.DecidedAt, &request.CreatedAt,
		&request.UpdatedAt,
	)
	return request, err
}

func validAdvanceStatus(status models.AdvanceRequestStatus) bool {
	return status == models.AdvanceRequestPending ||
		status == models.AdvanceRequestApproved ||
		status == models.AdvanceRequestDeclined
}

func cleanPayrollNote(note *string) (*string, error) {
	if note == nil {
		return nil, nil
	}
	cleaned := strings.TrimSpace(*note)
	if cleaned == "" {
		return nil, nil
	}
	if len([]rune(cleaned)) > 500 {
		return nil, fmt.Errorf("%w: notes must be 500 characters or fewer", ErrValidation)
	}
	return &cleaned, nil
}

func payrollNoteLine(note *string) string {
	if note == nil || strings.TrimSpace(*note) == "" {
		return ""
	}
	return "Note: " + strings.TrimSpace(*note)
}

// formatKoboNaira renders an integer kobo amount for notification text.
func formatKoboNaira(kobo int64) string {
	negative := kobo < 0
	if negative {
		kobo = -kobo
	}
	whole := kobo / 100
	fraction := kobo % 100
	digits := strconv.FormatInt(whole, 10)

	var b strings.Builder
	if negative {
		b.WriteByte('-')
	}
	b.WriteString("₦")
	for i, digit := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(digit)
	}
	fmt.Fprintf(&b, ".%02d", fraction)
	return b.String()
}
