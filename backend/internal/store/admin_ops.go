package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/mobigate/mgm-portal/internal/codes"
	"github.com/mobigate/mgm-portal/internal/models"
	"github.com/mobigate/mgm-portal/internal/sequence"
)

// AccessCodeQuery describes the admin access-code list request.
type AccessCodeQuery struct {
	TenantID *uuid.UUID
	Page     int
	PerPage  int
	Status   string
	Type     string
	Search   string
	JobID    *uuid.UUID
}

// PaginatedAccessCodes is the wire shape for GET /admin/access-codes.
type PaginatedAccessCodes struct {
	Items      []models.AccessCode `json:"items"`
	Total      int                 `json:"total"`
	Page       int                 `json:"page"`
	PerPage    int                 `json:"per_page"`
	TotalPages int                 `json:"total_pages"`
}

// ListAccessCodes returns tenant-scoped access codes. Plaintext codes are
// never recoverable; only the hint is returned (BR-17).
func (s *Store) ListAccessCodes(ctx context.Context, q AccessCodeQuery) (PaginatedAccessCodes, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PerPage < 1 || q.PerPage > 200 {
		q.PerPage = 20
	}

	args := []any{q.TenantID}
	where := []string{"($1::uuid IS NULL OR c.tenant_id = $1)"}
	add := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}
	if q.Status != "" && q.Status != "all" {
		where = append(where, "c.status = "+add(q.Status))
	}
	if q.Type != "" && q.Type != "all" {
		where = append(where, "c.type = "+add(q.Type))
	}
	if q.JobID != nil {
		where = append(where, "a.job_id = "+add(*q.JobID))
	}
	if q.Search != "" {
		p := add("%" + q.Search + "%")
		where = append(where, fmt.Sprintf(
			`(c.code_hint ILIKE %s OR a.first_name ILIKE %s
			  OR a.last_name ILIKE %s OR a.application_number ILIKE %s)`,
			p, p, p, p,
		))
	}
	whereSQL := strings.Join(where, " AND ")

	const from = `
		FROM access_codes c
		LEFT JOIN applications a ON a.id = c.application_id
		LEFT JOIN jobs j ON j.id = a.job_id`
	var total int
	if err := s.pool.QueryRow(ctx, `SELECT count(*)::int `+from+` WHERE `+whereSQL, args...).Scan(&total); err != nil {
		return PaginatedAccessCodes{}, err
	}

	limitParam := add(q.PerPage)
	offsetParam := add((q.Page - 1) * q.PerPage)
	dataSQL := `
		SELECT
			c.id, c.tenant_id, c.code_hint, c.type, c.application_id,
			c.issued_to, c.issued_by, c.status, c.expires_at, c.used_at,
			c.failed_attempts, c.created_at,
			CASE WHEN a.id IS NULL THEN NULL
			     ELSE trim(both ' ' FROM a.first_name || ' ' || a.last_name)
			END AS applicant_name,
			j.title AS job_title
		` + from + `
		WHERE ` + whereSQL + `
		ORDER BY c.created_at DESC
		LIMIT ` + limitParam + ` OFFSET ` + offsetParam

	rows, err := s.pool.Query(ctx, dataSQL, args...)
	if err != nil {
		return PaginatedAccessCodes{}, err
	}
	defer rows.Close()

	items := make([]models.AccessCode, 0, q.PerPage)
	for rows.Next() {
		var (
			code                          models.AccessCode
			rawID, rawTenantID            string
			rawApplicationID, rawIssuedTo *string
			rawIssuedBy                   *string
			rawStatus, rawType            string
		)
		if err := rows.Scan(
			&rawID, &rawTenantID, &code.CodeHint, &rawType,
			&rawApplicationID, &rawIssuedTo, &rawIssuedBy, &rawStatus,
			&code.ExpiresAt, &code.UsedAt, &code.FailedAttempts,
			&code.CreatedAt, &code.ApplicantName, &code.JobTitle,
		); err != nil {
			return PaginatedAccessCodes{}, err
		}
		if code.ID, err = uuid.Parse(rawID); err != nil {
			return PaginatedAccessCodes{}, err
		}
		if code.TenantID, err = uuid.Parse(rawTenantID); err != nil {
			return PaginatedAccessCodes{}, err
		}
		code.Type = models.AccessCodeType(rawType)
		code.Status = models.AccessCodeStatus(rawStatus)
		if code.ApplicationID, err = optionalUUID(rawApplicationID); err != nil {
			return PaginatedAccessCodes{}, err
		}
		if code.IssuedTo, err = optionalUUID(rawIssuedTo); err != nil {
			return PaginatedAccessCodes{}, err
		}
		if code.IssuedBy, err = optionalUUID(rawIssuedBy); err != nil {
			return PaginatedAccessCodes{}, err
		}
		items = append(items, code)
	}
	if err := rows.Err(); err != nil {
		return PaginatedAccessCodes{}, err
	}

	totalPages := (total + q.PerPage - 1) / q.PerPage
	if totalPages < 1 {
		totalPages = 1
	}
	return PaginatedAccessCodes{
		Items: items, Total: total, Page: q.Page,
		PerPage: q.PerPage, TotalPages: totalPages,
	}, nil
}

// IssueAccessCode creates a single-use code and returns the plaintext once.
func (s *Store) IssueAccessCode(
	ctx context.Context,
	tenantID *uuid.UUID,
	actorID *uuid.UUID,
	applicationID uuid.UUID,
	codeType models.AccessCodeType,
	expiresAt time.Time,
) (string, models.AccessCode, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", models.AccessCode{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		rawTenantID, rawApplicantID string
		firstName, lastName         string
		jobTitle                    string
	)
	err = tx.QueryRow(ctx, `
		SELECT a.tenant_id, a.applicant_id, a.first_name, a.last_name, j.title
		FROM applications a
		JOIN jobs j ON j.id = a.job_id
		WHERE a.id = $1 AND ($2::uuid IS NULL OR a.tenant_id = $2)`,
		applicationID, tenantID,
	).Scan(&rawTenantID, &rawApplicantID, &firstName, &lastName, &jobTitle)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", models.AccessCode{}, ErrNotFound
	}
	if err != nil {
		return "", models.AccessCode{}, err
	}
	applicationTenant, err := uuid.Parse(rawTenantID)
	if err != nil {
		return "", models.AccessCode{}, err
	}
	applicantID, err := uuid.Parse(rawApplicantID)
	if err != nil {
		return "", models.AccessCode{}, err
	}

	var (
		codeLength int
		ttlDays    int
	)
	if err := tx.QueryRow(ctx, `
		SELECT access_code_length, access_code_ttl_days
		FROM admin_settings WHERE id = 1`,
	).Scan(&codeLength, &ttlDays); err != nil {
		return "", models.AccessCode{}, err
	}
	if expiresAt.IsZero() {
		expiresAt = time.Now().AddDate(0, 0, ttlDays)
	}

	plaintext, err := codes.GenerateAccessCode(codeLength)
	if err != nil {
		return "", models.AccessCode{}, err
	}
	hash := codes.HashAccessCode(plaintext)
	hint := codes.Hint(plaintext)

	var (
		rawID     string
		createdAt time.Time
	)
	err = tx.QueryRow(ctx, `
		INSERT INTO access_codes (
			tenant_id, code_hash, code_hint, type, application_id,
			issued_to, issued_by, status, expires_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8)
		RETURNING id, created_at`,
		applicationTenant, hash, hint, codeType, applicationID,
		applicantID, actorID, expiresAt,
	).Scan(&rawID, &createdAt)
	if err != nil {
		return "", models.AccessCode{}, mapWriteError(err)
	}
	codeID, err := uuid.Parse(rawID)
	if err != nil {
		return "", models.AccessCode{}, err
	}

	if err := insertAudit(ctx, tx, applicationTenant, actorID,
		"access_code.issued", "access_code", codeID,
		nil,
		map[string]any{"type": codeType, "hint": hint, "expires_at": expiresAt},
	); err != nil {
		return "", models.AccessCode{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return "", models.AccessCode{}, err
	}

	applicantName := strings.TrimSpace(firstName + " " + lastName)
	title := jobTitle
	return plaintext, models.AccessCode{
		ID: codeID, TenantID: applicationTenant, CodeHint: hint,
		Type: codeType, ApplicationID: &applicationID, IssuedTo: &applicantID,
		IssuedBy: actorID, Status: models.AccessCodeActive,
		ExpiresAt: expiresAt, CreatedAt: createdAt,
		ApplicantName: &applicantName, JobTitle: &title,
	}, nil
}

// RevokeAccessCode marks an active code revoked.
func (s *Store) RevokeAccessCode(
	ctx context.Context,
	tenantID *uuid.UUID,
	actorID *uuid.UUID,
	id uuid.UUID,
) (models.AccessCode, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.AccessCode{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		rawTenantID string
		status      string
	)
	err = tx.QueryRow(ctx, `
		SELECT tenant_id, status FROM access_codes
		WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2)
		FOR UPDATE`,
		id, tenantID,
	).Scan(&rawTenantID, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.AccessCode{}, ErrNotFound
	}
	if err != nil {
		return models.AccessCode{}, err
	}
	tenant, err := uuid.Parse(rawTenantID)
	if err != nil {
		return models.AccessCode{}, err
	}

	if status != string(models.AccessCodeRevoked) {
		if _, err := tx.Exec(ctx,
			`UPDATE access_codes SET status = 'revoked' WHERE id = $1`, id,
		); err != nil {
			return models.AccessCode{}, err
		}
		if err := insertAudit(ctx, tx, tenant, actorID,
			"access_code.revoked", "access_code", id,
			map[string]any{"status": status},
			map[string]any{"status": "revoked"},
		); err != nil {
			return models.AccessCode{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return models.AccessCode{}, err
	}
	return s.GetAccessCode(ctx, tenantID, id)
}

// GetAccessCode loads one code with its display fields.
func (s *Store) GetAccessCode(
	ctx context.Context,
	tenantID *uuid.UUID,
	id uuid.UUID,
) (models.AccessCode, error) {
	const q = `
		SELECT
			c.id, c.tenant_id, c.code_hint, c.type, c.application_id,
			c.issued_to, c.issued_by, c.status, c.expires_at, c.used_at,
			c.failed_attempts, c.created_at,
			CASE WHEN a.id IS NULL THEN NULL
			     ELSE trim(both ' ' FROM a.first_name || ' ' || a.last_name)
			END AS applicant_name,
			j.title AS job_title
		FROM access_codes c
		LEFT JOIN applications a ON a.id = c.application_id
		LEFT JOIN jobs j ON j.id = a.job_id
		WHERE c.id = $1 AND ($2::uuid IS NULL OR c.tenant_id = $2)`

	var (
		code                                   models.AccessCode
		rawID, rawTenantID, rawType, rawStatus string
		rawApplicationID, rawIssuedTo          *string
		rawIssuedBy                            *string
	)
	err := s.pool.QueryRow(ctx, q, id, tenantID).Scan(
		&rawID, &rawTenantID, &code.CodeHint, &rawType,
		&rawApplicationID, &rawIssuedTo, &rawIssuedBy, &rawStatus,
		&code.ExpiresAt, &code.UsedAt, &code.FailedAttempts,
		&code.CreatedAt, &code.ApplicantName, &code.JobTitle,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.AccessCode{}, ErrNotFound
	}
	if err != nil {
		return models.AccessCode{}, err
	}
	if code.ID, err = uuid.Parse(rawID); err != nil {
		return models.AccessCode{}, err
	}
	if code.TenantID, err = uuid.Parse(rawTenantID); err != nil {
		return models.AccessCode{}, err
	}
	code.Type = models.AccessCodeType(rawType)
	code.Status = models.AccessCodeStatus(rawStatus)
	if code.ApplicationID, err = optionalUUID(rawApplicationID); err != nil {
		return models.AccessCode{}, err
	}
	if code.IssuedTo, err = optionalUUID(rawIssuedTo); err != nil {
		return models.AccessCode{}, err
	}
	if code.IssuedBy, err = optionalUUID(rawIssuedBy); err != nil {
		return models.AccessCode{}, err
	}
	return code, nil
}

// StaffQuery describes the admin staff list request.
type StaffQuery struct {
	TenantID           *uuid.UUID
	Page               int
	PerPage            int
	Search             string
	Status             string
	EmploymentCategory string
	DepartmentID       *uuid.UUID
}

// PaginatedStaff is the wire shape for GET /admin/staff.
type PaginatedStaff struct {
	Items      []models.StaffProfile `json:"items"`
	Total      int                   `json:"total"`
	Page       int                   `json:"page"`
	PerPage    int                   `json:"per_page"`
	TotalPages int                   `json:"total_pages"`
}

// ListStaff returns tenant-scoped staff records with display joins.
func (s *Store) ListStaff(ctx context.Context, q StaffQuery) (PaginatedStaff, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PerPage < 1 || q.PerPage > 200 {
		q.PerPage = 20
	}

	args := []any{q.TenantID}
	where := []string{"($1::uuid IS NULL OR sp.tenant_id = $1)"}
	add := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}
	if q.Status != "" && q.Status != "all" {
		where = append(where, "sp.status = "+add(q.Status))
	}
	if q.EmploymentCategory != "" && q.EmploymentCategory != "all" {
		where = append(where, "sp.employment_category = "+add(q.EmploymentCategory))
	}
	if q.DepartmentID != nil {
		where = append(where, "sp.department_id = "+add(*q.DepartmentID))
	}
	if q.Search != "" {
		p := add("%" + q.Search + "%")
		where = append(where, fmt.Sprintf(
			`(sp.first_name ILIKE %s OR sp.last_name ILIKE %s
			  OR sp.staff_id ILIKE %s OR sp.email::text ILIKE %s)`,
			p, p, p, p,
		))
	}
	whereSQL := strings.Join(where, " AND ")

	var total int
	if err := s.pool.QueryRow(ctx,
		`SELECT count(*)::int FROM staff_profiles sp WHERE `+whereSQL, args...,
	).Scan(&total); err != nil {
		return PaginatedStaff{}, err
	}

	limitParam := add(q.PerPage)
	offsetParam := add((q.Page - 1) * q.PerPage)
	dataSQL := staffSelect + `
		WHERE ` + whereSQL + `
		ORDER BY sp.last_name, sp.first_name
		LIMIT ` + limitParam + ` OFFSET ` + offsetParam

	rows, err := s.pool.Query(ctx, dataSQL, args...)
	if err != nil {
		return PaginatedStaff{}, err
	}
	defer rows.Close()

	items := make([]models.StaffProfile, 0, q.PerPage)
	for rows.Next() {
		staff, err := scanStaff(rows)
		if err != nil {
			return PaginatedStaff{}, err
		}
		items = append(items, staff)
	}
	if err := rows.Err(); err != nil {
		return PaginatedStaff{}, err
	}

	totalPages := (total + q.PerPage - 1) / q.PerPage
	if totalPages < 1 {
		totalPages = 1
	}
	return PaginatedStaff{
		Items: items, Total: total, Page: q.Page,
		PerPage: q.PerPage, TotalPages: totalPages,
	}, nil
}

const staffSelect = `
	SELECT
		sp.id, sp.tenant_id, sp.user_id, sp.staff_id, sp.application_id,
		sp.employment_category, sp.first_name, sp.last_name, sp.email,
		sp.phone, sp.gender, sp.date_of_birth, sp.address_line,
		sp.location_id, sp.bank_name, sp.bank_account_name,
		sp.bank_account_number, sp.guarantor_name, sp.guarantor_phone,
		sp.guarantor_address, sp.guarantor_relationship, sp.next_of_kin_name,
		sp.next_of_kin_phone, sp.next_of_kin_relationship, sp.department_id,
		sp.position, sp.appointment_date, sp.rules_of_engagement_accepted_at,
		sp.status, sp.created_at, sp.updated_at,
		l.name AS location_name, d.name AS department_name
	FROM staff_profiles sp
	LEFT JOIN locations l ON l.id = sp.location_id
	LEFT JOIN departments d ON d.id = sp.department_id
`

// GetStaff loads one staff record in the tenant scope.
func (s *Store) GetStaff(
	ctx context.Context,
	tenantID *uuid.UUID,
	id uuid.UUID,
) (models.StaffProfile, error) {
	q := staffSelect + ` WHERE sp.id = $1 AND ($2::uuid IS NULL OR sp.tenant_id = $2)`
	staff, err := scanStaff(s.pool.QueryRow(ctx, q, id, tenantID))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.StaffProfile{}, ErrNotFound
	}
	return staff, err
}

func scanStaff(row rowScanner) (models.StaffProfile, error) {
	var (
		staff                                                models.StaffProfile
		rawID, rawTenantID, rawEmploymentCategory, rawStatus string
		rawUserID, rawApplicationID, rawLocationID           *string
		rawDepartmentID                                      *string
	)
	err := row.Scan(
		&rawID, &rawTenantID, &rawUserID, &staff.StaffID,
		&rawApplicationID, &rawEmploymentCategory, &staff.FirstName,
		&staff.LastName, &staff.Email, &staff.Phone, &staff.Gender,
		&staff.DateOfBirth, &staff.AddressLine, &rawLocationID,
		&staff.BankName, &staff.BankAccountName, &staff.BankAccountNumber,
		&staff.GuarantorName, &staff.GuarantorPhone, &staff.GuarantorAddress,
		&staff.GuarantorRelationship, &staff.NextOfKinName,
		&staff.NextOfKinPhone, &staff.NextOfKinRelationship, &rawDepartmentID,
		&staff.Position, &staff.AppointmentDate,
		&staff.RulesOfEngagementAcceptedAt, &rawStatus,
		&staff.CreatedAt, &staff.UpdatedAt,
		&staff.LocationName, &staff.DepartmentName,
	)
	if err != nil {
		return models.StaffProfile{}, err
	}
	if staff.ID, err = uuid.Parse(rawID); err != nil {
		return models.StaffProfile{}, err
	}
	if staff.TenantID, err = uuid.Parse(rawTenantID); err != nil {
		return models.StaffProfile{}, err
	}
	if staff.UserID, err = optionalUUID(rawUserID); err != nil {
		return models.StaffProfile{}, err
	}
	if staff.ApplicationID, err = optionalUUID(rawApplicationID); err != nil {
		return models.StaffProfile{}, err
	}
	if staff.LocationID, err = optionalUUID(rawLocationID); err != nil {
		return models.StaffProfile{}, err
	}
	if staff.DepartmentID, err = optionalUUID(rawDepartmentID); err != nil {
		return models.StaffProfile{}, err
	}
	staff.EmploymentCategory = models.EmploymentCategory(rawEmploymentCategory)
	staff.Status = models.StaffStatus(rawStatus)
	return staff, nil
}

// ListDepartments returns departments in the tenant scope.
func (s *Store) ListDepartments(ctx context.Context, tenantID *uuid.UUID) ([]models.Department, error) {
	const q = `
		SELECT id, tenant_id, name FROM departments
		WHERE ($1::uuid IS NULL OR tenant_id = $1)
		ORDER BY name`
	rows, err := s.pool.Query(ctx, q, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.Department, 0)
	for rows.Next() {
		var (
			department         models.Department
			rawID, rawTenantID string
		)
		if err := rows.Scan(&rawID, &rawTenantID, &department.Name); err != nil {
			return nil, err
		}
		if department.ID, err = uuid.Parse(rawID); err != nil {
			return nil, err
		}
		if department.TenantID, err = uuid.Parse(rawTenantID); err != nil {
			return nil, err
		}
		items = append(items, department)
	}
	return items, rows.Err()
}

// ListUsers returns domain user accounts in the tenant scope.
func (s *Store) ListUsers(ctx context.Context, tenantID *uuid.UUID) ([]models.User, error) {
	const q = `
		SELECT id, tenant_id, role, email, phone, first_name, last_name,
		       status, email_verified_at, last_login_at, created_at, updated_at
		FROM users
		WHERE role <> 'applicant'
		  AND ($1::uuid IS NULL OR tenant_id = $1)
		ORDER BY created_at DESC`
	rows, err := s.pool.Query(ctx, q, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.User, 0)
	for rows.Next() {
		user, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, user)
	}
	return items, rows.Err()
}

// ApproveUser activates a pending account.
func (s *Store) ApproveUser(
	ctx context.Context,
	tenantID *uuid.UUID,
	actorID *uuid.UUID,
	id uuid.UUID,
) (models.User, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.User{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		rawTenantID *string
		status      string
	)
	err = tx.QueryRow(ctx, `
		SELECT tenant_id, status FROM users
		WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2)
		FOR UPDATE`,
		id, tenantID,
	).Scan(&rawTenantID, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.User{}, ErrNotFound
	}
	if err != nil {
		return models.User{}, err
	}

	if status != string(models.UserStatusActive) {
		if _, err := tx.Exec(ctx,
			`UPDATE users SET status = 'active', updated_at = now() WHERE id = $1`, id,
		); err != nil {
			return models.User{}, err
		}
		userTenant, err := optionalUUID(rawTenantID)
		if err == nil && userTenant != nil {
			if err := insertAudit(ctx, tx, *userTenant, actorID,
				"user.approved", "user", id,
				map[string]any{"status": status},
				map[string]any{"status": "active"},
			); err != nil {
				return models.User{}, err
			}
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return models.User{}, err
	}

	return s.getUser(ctx, tenantID, id)
}

func (s *Store) getUser(
	ctx context.Context,
	tenantID *uuid.UUID,
	id uuid.UUID,
) (models.User, error) {
	const q = `
		SELECT id, tenant_id, role, email, phone, first_name, last_name,
		       status, email_verified_at, last_login_at, created_at, updated_at
		FROM users
		WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2)`
	user, err := scanUser(s.pool.QueryRow(ctx, q, id, tenantID))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.User{}, ErrNotFound
	}
	return user, err
}

func scanUser(row rowScanner) (models.User, error) {
	var (
		user               models.User
		rawID              string
		rawTenantID        *string
		rawRole, rawStatus string
	)
	err := row.Scan(
		&rawID, &rawTenantID, &rawRole, &user.Email, &user.Phone,
		&user.FirstName, &user.LastName, &rawStatus, &user.EmailVerifiedAt,
		&user.LastLoginAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return models.User{}, err
	}
	if user.ID, err = uuid.Parse(rawID); err != nil {
		return models.User{}, err
	}
	if user.TenantID, err = optionalUUID(rawTenantID); err != nil {
		return models.User{}, err
	}
	user.Role = models.UserRole(rawRole)
	user.Status = models.UserStatus(rawStatus)
	return user, nil
}

// ListNotifications returns the notification delivery log.
func (s *Store) ListNotifications(
	ctx context.Context,
	tenantID *uuid.UUID,
	limit int,
) ([]models.Notification, error) {
	if limit < 1 || limit > 200 {
		limit = 100
	}
	const q = `
		SELECT id, tenant_id, recipient_user_id, recipient_contact, channel,
		       template_key, payload, provider_ref, status, error, sent_at,
		       created_at
		FROM notifications
		WHERE ($1::uuid IS NULL OR tenant_id = $1)
		ORDER BY created_at DESC
		LIMIT $2`
	rows, err := s.pool.Query(ctx, q, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.Notification, 0)
	for rows.Next() {
		var (
			notification       models.Notification
			rawID              string
			rawTenantID        *string
			rawRecipientUserID *string
		)
		if err := rows.Scan(
			&rawID, &rawTenantID, &rawRecipientUserID,
			&notification.RecipientContact, &notification.Channel,
			&notification.TemplateKey, &notification.Payload,
			&notification.ProviderRef, &notification.Status,
			&notification.Error, &notification.SentAt, &notification.CreatedAt,
		); err != nil {
			return nil, err
		}
		if notification.ID, err = uuid.Parse(rawID); err != nil {
			return nil, err
		}
		if notification.TenantID, err = optionalUUID(rawTenantID); err != nil {
			return nil, err
		}
		if notification.RecipientUserID, err = optionalUUID(rawRecipientUserID); err != nil {
			return nil, err
		}
		items = append(items, notification)
	}
	return items, rows.Err()
}

// CreateInterview publishes (or drafts) an interview announcement.
func (s *Store) CreateInterview(
	ctx context.Context,
	tenantID *uuid.UUID,
	actorID *uuid.UUID,
	jobID uuid.UUID,
	interviewAt time.Time,
	venue, instructions string,
	audience models.InterviewAudience,
) (models.InterviewAnnouncement, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.InterviewAnnouncement{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var rawTenantID string
	err = tx.QueryRow(ctx, `
		SELECT tenant_id FROM jobs
		WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2)`,
		jobID, tenantID,
	).Scan(&rawTenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.InterviewAnnouncement{}, ErrNotFound
	}
	if err != nil {
		return models.InterviewAnnouncement{}, err
	}
	jobTenant, err := uuid.Parse(rawTenantID)
	if err != nil {
		return models.InterviewAnnouncement{}, err
	}

	var rawID string
	var createdAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO interview_announcements (
			tenant_id, job_id, interview_at, venue, instructions, audience,
			status, created_by
		) VALUES ($1,$2,$3,$4,$5,$6,'published',$7)
		RETURNING id, created_at`,
		jobTenant, jobID, interviewAt, venue, instructions, audience, actorID,
	).Scan(&rawID, &createdAt)
	if err != nil {
		return models.InterviewAnnouncement{}, mapWriteError(err)
	}
	interviewID, err := uuid.Parse(rawID)
	if err != nil {
		return models.InterviewAnnouncement{}, err
	}
	if err := insertAudit(ctx, tx, jobTenant, actorID,
		"interview.published", "interview", interviewID,
		nil, map[string]any{"job_id": jobID, "interview_at": interviewAt},
	); err != nil {
		return models.InterviewAnnouncement{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.InterviewAnnouncement{}, err
	}
	return s.GetInterview(ctx, tenantID, interviewID)
}

// UpdateInterviewStatus changes an announcement between draft, published and
// cancelled.
func (s *Store) UpdateInterviewStatus(
	ctx context.Context,
	tenantID *uuid.UUID,
	actorID *uuid.UUID,
	id uuid.UUID,
	status models.InterviewStatus,
) (models.InterviewAnnouncement, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.InterviewAnnouncement{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		rawTenantID string
		current     string
	)
	err = tx.QueryRow(ctx, `
		SELECT tenant_id, status FROM interview_announcements
		WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2)
		FOR UPDATE`,
		id, tenantID,
	).Scan(&rawTenantID, &current)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.InterviewAnnouncement{}, ErrNotFound
	}
	if err != nil {
		return models.InterviewAnnouncement{}, err
	}
	tenant, err := uuid.Parse(rawTenantID)
	if err != nil {
		return models.InterviewAnnouncement{}, err
	}

	if current != string(status) {
		if _, err := tx.Exec(ctx,
			`UPDATE interview_announcements SET status = $1 WHERE id = $2`,
			status, id,
		); err != nil {
			return models.InterviewAnnouncement{}, err
		}
		if err := insertAudit(ctx, tx, tenant, actorID,
			"interview.status_changed", "interview", id,
			map[string]any{"status": current},
			map[string]any{"status": status},
		); err != nil {
			return models.InterviewAnnouncement{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return models.InterviewAnnouncement{}, err
	}
	return s.GetInterview(ctx, tenantID, id)
}

// GetInterview loads one announcement with display fields.
func (s *Store) GetInterview(
	ctx context.Context,
	tenantID *uuid.UUID,
	id uuid.UUID,
) (models.InterviewAnnouncement, error) {
	q := `
		SELECT
			i.id, i.tenant_id, i.job_id, i.interview_at, i.venue,
			i.instructions, i.audience, i.status, i.created_by, i.created_at,
			j.title AS job_title,
			(
				SELECT count(*)::int FROM applications a
				WHERE a.job_id = i.job_id
				  AND (
					i.audience = 'all_applicants'
					OR (i.audience = 'shortlisted_only'
						AND a.status IN ('shortlisted','appointed'))
					OR (i.audience = 'job_applicants'
						AND a.status <> 'withdrawn')
				  )
			) AS applicant_count
		FROM interview_announcements i
		JOIN jobs j ON j.id = i.job_id
		WHERE i.id = $1 AND ($2::uuid IS NULL OR i.tenant_id = $2)`
	return scanInterview(s.pool.QueryRow(ctx, q, id, tenantID))
}

func scanInterview(row rowScanner) (models.InterviewAnnouncement, error) {
	var (
		interview                    models.InterviewAnnouncement
		rawID, rawTenantID, rawJobID string
		rawCreatedBy                 *string
	)
	err := row.Scan(
		&rawID, &rawTenantID, &rawJobID, &interview.InterviewAt,
		&interview.Venue, &interview.Instructions, &interview.Audience,
		&interview.Status, &rawCreatedBy, &interview.CreatedAt,
		&interview.JobTitle, &interview.ApplicantCount,
	)
	if err != nil {
		return models.InterviewAnnouncement{}, err
	}
	if interview.ID, err = uuid.Parse(rawID); err != nil {
		return models.InterviewAnnouncement{}, err
	}
	if interview.TenantID, err = uuid.Parse(rawTenantID); err != nil {
		return models.InterviewAnnouncement{}, err
	}
	if interview.JobID, err = uuid.Parse(rawJobID); err != nil {
		return models.InterviewAnnouncement{}, err
	}
	if interview.CreatedBy, err = optionalUUID(rawCreatedBy); err != nil {
		return models.InterviewAnnouncement{}, err
	}
	return interview, nil
}

// CreateLocation adds a pending location to the tree.
func (s *Store) CreateLocation(
	ctx context.Context,
	tenantID *uuid.UUID,
	actorID *uuid.UUID,
	locationType models.LocationType,
	name string,
	parentID *uuid.UUID,
	code *string,
) (models.Location, error) {
	slug := slugify(name)
	if slug == "" {
		return models.Location{}, fmt.Errorf("%w: location name is required", ErrValidation)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.Location{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var rawID string
	err = tx.QueryRow(ctx, `
		INSERT INTO locations (
			tenant_id, parent_id, type, name, code, slug, status
		) VALUES ($1,$2,$3,$4,$5,$6,'pending')
		RETURNING id`,
		tenantID, parentID, locationType, name, code, slug,
	).Scan(&rawID)
	if err != nil {
		return models.Location{}, mapWriteError(err)
	}
	id, err := uuid.Parse(rawID)
	if err != nil {
		return models.Location{}, err
	}
	if tenantID != nil {
		if err := insertAudit(ctx, tx, *tenantID, actorID,
			"location.created", "location", id,
			nil, map[string]any{"name": name, "type": locationType},
		); err != nil {
			return models.Location{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return models.Location{}, err
	}
	return s.GetLocation(ctx, tenantID, id)
}

// ApproveLocation moves a pending location to approved.
func (s *Store) ApproveLocation(
	ctx context.Context,
	tenantID *uuid.UUID,
	actorID *uuid.UUID,
	id uuid.UUID,
) (models.Location, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.Location{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		rawTenantID *string
		status      string
	)
	err = tx.QueryRow(ctx, `
		SELECT tenant_id, status FROM locations
		WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id IS NULL OR tenant_id = $2)
		FOR UPDATE`,
		id, tenantID,
	).Scan(&rawTenantID, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Location{}, ErrNotFound
	}
	if err != nil {
		return models.Location{}, err
	}

	if status != string(models.LocationApproved) {
		if _, err := tx.Exec(ctx,
			`UPDATE locations SET status = 'approved' WHERE id = $1`, id,
		); err != nil {
			return models.Location{}, err
		}
	}

	locationTenant, err := optionalUUID(rawTenantID)
	if err != nil {
		return models.Location{}, err
	}
	auditTenant := tenantID
	if auditTenant == nil && locationTenant != nil {
		auditTenant = locationTenant
	}
	if auditTenant != nil {
		if err := insertAudit(ctx, tx, *auditTenant, actorID,
			"location.approved", "location", id,
			map[string]any{"status": status},
			map[string]any{"status": "approved"},
		); err != nil {
			return models.Location{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return models.Location{}, err
	}
	return s.GetLocation(ctx, tenantID, id)
}

// GetLocation loads one location in the tenant/global scope.
func (s *Store) GetLocation(
	ctx context.Context,
	tenantID *uuid.UUID,
	id uuid.UUID,
) (models.Location, error) {
	location, err := scanLocation(s.pool.QueryRow(ctx, `
		SELECT id, tenant_id, parent_id, type, name, code, slug, status,
		       created_at
		FROM locations
		WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id IS NULL OR tenant_id = $2)`,
		id, tenantID,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Location{}, ErrNotFound
	}
	return location, err
}

// -- Group settings -------------------------------------------------------

// AccessCodeSettingsInput is the editable part of the group settings.
type AccessCodeSettingsInput struct {
	CodeLength  int
	TTLDays     int
	MaxAttempts int
}

// GetAccessCodeSettings returns the single settings row.
func (s *Store) GetAccessCodeSettings(ctx context.Context) (models.AdminSettings, error) {
	const q = `
		SELECT access_code_length, access_code_ttl_days,
		       access_code_max_attempts, updated_at, updated_by
		FROM admin_settings WHERE id = 1`
	var (
		settings  models.AdminSettings
		updatedBy *string
	)
	if err := s.pool.QueryRow(ctx, q).Scan(
		&settings.AccessCodeLength, &settings.AccessCodeTTLDays,
		&settings.AccessCodeMaxAttempts, &settings.UpdatedAt, &updatedBy,
	); err != nil {
		return models.AdminSettings{}, err
	}
	var err error
	if settings.UpdatedBy, err = optionalUUID(updatedBy); err != nil {
		return models.AdminSettings{}, err
	}
	return settings, nil
}

// UpdateAccessCodeSettings persists the access-code policy.
func (s *Store) UpdateAccessCodeSettings(
	ctx context.Context,
	auditTenant *uuid.UUID,
	actorID *uuid.UUID,
	input AccessCodeSettingsInput,
) (models.AdminSettings, error) {
	if input.CodeLength < 4 || input.CodeLength > 12 {
		return models.AdminSettings{}, fmt.Errorf("%w: code length must be between 4 and 12", ErrValidation)
	}
	if input.TTLDays < 1 || input.TTLDays > 90 {
		return models.AdminSettings{}, fmt.Errorf("%w: expiry must be between 1 and 90 days", ErrValidation)
	}
	if input.MaxAttempts < 1 || input.MaxAttempts > 10 {
		return models.AdminSettings{}, fmt.Errorf("%w: failed attempts must be between 1 and 10", ErrValidation)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.AdminSettings{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	before, err := scanSettings(tx.QueryRow(ctx, `
		SELECT access_code_length, access_code_ttl_days,
		       access_code_max_attempts, updated_at, updated_by
		FROM admin_settings WHERE id = 1 FOR UPDATE`))
	if err != nil {
		return models.AdminSettings{}, err
	}

	after, err := scanSettings(tx.QueryRow(ctx, `
		UPDATE admin_settings
		SET access_code_length = $1,
		    access_code_ttl_days = $2,
		    access_code_max_attempts = $3,
		    updated_at = now(),
		    updated_by = $4
		WHERE id = 1
		RETURNING access_code_length, access_code_ttl_days,
		          access_code_max_attempts, updated_at, updated_by`,
		input.CodeLength, input.TTLDays, input.MaxAttempts, actorID,
	))
	if err != nil {
		return models.AdminSettings{}, err
	}
	if auditTenant != nil {
		if err := insertAudit(ctx, tx, *auditTenant, actorID,
			"settings.access_codes_updated", "admin_settings", uuid.Nil,
			map[string]any{
				"length":   before.AccessCodeLength,
				"ttl":      before.AccessCodeTTLDays,
				"attempts": before.AccessCodeMaxAttempts,
			},
			map[string]any{
				"length":   after.AccessCodeLength,
				"ttl":      after.AccessCodeTTLDays,
				"attempts": after.AccessCodeMaxAttempts,
			},
		); err != nil {
			return models.AdminSettings{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return models.AdminSettings{}, err
	}
	return after, nil
}

func scanSettings(row rowScanner) (models.AdminSettings, error) {
	var (
		settings  models.AdminSettings
		updatedBy *string
	)
	if err := row.Scan(
		&settings.AccessCodeLength, &settings.AccessCodeTTLDays,
		&settings.AccessCodeMaxAttempts, &settings.UpdatedAt, &updatedBy,
	); err != nil {
		return models.AdminSettings{}, err
	}
	var err error
	if settings.UpdatedBy, err = optionalUUID(updatedBy); err != nil {
		return models.AdminSettings{}, err
	}
	return settings, nil
}

// -- Message templates ----------------------------------------------------

const templateSelect = `
	SELECT id, tenant_id, key, channel, subject, body, variables, created_at
	FROM message_templates`

func scanTemplate(row rowScanner) (models.MessageTemplate, error) {
	var (
		template    models.MessageTemplate
		rawID       string
		rawTenantID *string
	)
	if err := row.Scan(
		&rawID, &rawTenantID, &template.Key, &template.Channel,
		&template.Subject, &template.Body, &template.Variables,
		&template.CreatedAt,
	); err != nil {
		return models.MessageTemplate{}, err
	}
	var err error
	if template.ID, err = uuid.Parse(rawID); err != nil {
		return models.MessageTemplate{}, err
	}
	if template.TenantID, err = optionalUUID(rawTenantID); err != nil {
		return models.MessageTemplate{}, err
	}
	return template, nil
}

// UpdateTemplate edits a tenant template, or a global template for a Super
// Admin. Global templates cannot be changed from a tenant-scoped session.
func (s *Store) UpdateTemplate(
	ctx context.Context,
	scope *uuid.UUID,
	auditTenant *uuid.UUID,
	actorID *uuid.UUID,
	id uuid.UUID,
	subject *string,
	body string,
) (models.MessageTemplate, error) {
	if strings.TrimSpace(body) == "" {
		return models.MessageTemplate{}, fmt.Errorf("%w: template body is required", ErrValidation)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.MessageTemplate{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var rawTenantID *string
	err = tx.QueryRow(ctx, `
		SELECT tenant_id FROM message_templates
		WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id IS NULL OR tenant_id = $2)
		FOR UPDATE`, id, scope).Scan(&rawTenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.MessageTemplate{}, ErrNotFound
	}
	if err != nil {
		return models.MessageTemplate{}, err
	}
	templateTenant, err := optionalUUID(rawTenantID)
	if err != nil {
		return models.MessageTemplate{}, err
	}
	if templateTenant == nil && scope != nil {
		return models.MessageTemplate{}, fmt.Errorf("%w: only a Super Admin can edit a Group template", ErrValidation)
	}

	after, err := scanTemplate(tx.QueryRow(ctx, `
		UPDATE message_templates
		SET subject = $2, body = $3
		WHERE id = $1
		RETURNING id, tenant_id, key, channel, subject, body, variables, created_at`,
		id, subject, body,
	))
	if err != nil {
		return models.MessageTemplate{}, err
	}

	auditFor := templateTenant
	if auditFor == nil {
		auditFor = auditTenant
	}
	if auditFor != nil {
		if err := insertAudit(ctx, tx, *auditFor, actorID,
			"template.updated", "message_template", id,
			nil, map[string]any{"subject": subject, "body": body},
		); err != nil {
			return models.MessageTemplate{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return models.MessageTemplate{}, err
	}
	return after, nil
}

// QueueTemplateTest records a test delivery for the signed-in admin.
func (s *Store) QueueTemplateTest(
	ctx context.Context,
	scope *uuid.UUID,
	auditTenant *uuid.UUID,
	actorID *uuid.UUID,
	id uuid.UUID,
) (models.Notification, error) {
	if actorID == nil {
		return models.Notification{}, fmt.Errorf("%w: actor is required", ErrValidation)
	}

	template, err := scanTemplate(s.pool.QueryRow(ctx,
		templateSelect+` WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id IS NULL OR tenant_id = $2)`,
		id, scope,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Notification{}, ErrNotFound
	}
	if err != nil {
		return models.Notification{}, err
	}

	var email string
	var phone *string
	if err := s.pool.QueryRow(ctx,
		`SELECT email, phone FROM users WHERE id = $1`, *actorID,
	).Scan(&email, &phone); err != nil {
		return models.Notification{}, err
	}
	contact := email
	if template.Channel != "email" {
		if phone == nil || strings.TrimSpace(*phone) == "" {
			return models.Notification{}, fmt.Errorf("%w: your account has no phone number for %s tests", ErrValidation, template.Channel)
		}
		contact = *phone
	}

	tenantID := template.TenantID
	if tenantID == nil {
		tenantID = auditTenant
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.Notification{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var rawID string
	var notification models.Notification
	err = tx.QueryRow(ctx, `
		INSERT INTO notifications (
			tenant_id, recipient_user_id, recipient_contact, channel,
			template_key, payload, status
		) VALUES ($1,$2,$3,$4,$5,$6,'pending')
		RETURNING id, created_at`,
		tenantID, actorID, contact, template.Channel, template.Key,
		map[string]any{"test": true, "subject": template.Subject},
	).Scan(&rawID, &notification.CreatedAt)
	if err != nil {
		return models.Notification{}, mapWriteError(err)
	}
	notification.ID, err = uuid.Parse(rawID)
	if err != nil {
		return models.Notification{}, err
	}
	notification.TenantID = tenantID
	notification.RecipientUserID = actorID
	notification.RecipientContact = &contact
	notification.Channel = template.Channel
	notification.TemplateKey = &template.Key
	notification.Payload = map[string]any{"test": true, "subject": template.Subject}
	notification.Status = "pending"

	if tenantID != nil {
		if err := insertAudit(ctx, tx, *tenantID, actorID,
			"template.test_queued", "message_template", id,
			nil, map[string]any{"channel": template.Channel, "contact": contact},
		); err != nil {
			return models.Notification{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return models.Notification{}, err
	}
	return notification, nil
}

// -- User lifecycle -------------------------------------------------------

// UpdateUserStatus activates, suspends or disables a domain account.
func (s *Store) UpdateUserStatus(
	ctx context.Context,
	tenantID *uuid.UUID,
	actorID *uuid.UUID,
	id uuid.UUID,
	status models.UserStatus,
) (models.User, error) {
	if status != models.UserStatusActive && status != models.UserStatusSuspended && status != models.UserStatusDisabled {
		return models.User{}, fmt.Errorf("%w: unsupported user status", ErrValidation)
	}
	if actorID != nil && *actorID == id && status != models.UserStatusActive {
		return models.User{}, fmt.Errorf("%w: you cannot suspend your own account", ErrValidation)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.User{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		rawTenantID, rawRole string
		current              string
	)
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(tenant_id::text, ''), role, status
		FROM users
		WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2)
		FOR UPDATE`, id, tenantID).Scan(&rawTenantID, &rawRole, &current)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.User{}, ErrNotFound
	}
	if err != nil {
		return models.User{}, err
	}

	if rawRole == string(models.RoleSuperAdmin) && status != models.UserStatusActive {
		var activeSupers int
		if err := tx.QueryRow(ctx,
			`SELECT count(*)::int FROM users WHERE role = 'super_admin' AND status = 'active'`,
		).Scan(&activeSupers); err != nil {
			return models.User{}, err
		}
		if activeSupers <= 1 {
			return models.User{}, fmt.Errorf("%w: the last active Super Admin cannot be suspended", ErrValidation)
		}
	}

	if current != string(status) {
		if _, err := tx.Exec(ctx,
			`UPDATE users SET status = $1, updated_at = now() WHERE id = $2`,
			status, id,
		); err != nil {
			return models.User{}, err
		}
	}

	var auditTenant *uuid.UUID
	if rawTenantID != "" {
		parsed, parseErr := uuid.Parse(rawTenantID)
		if parseErr != nil {
			return models.User{}, parseErr
		}
		auditTenant = &parsed
	}
	if auditTenant == nil {
		auditTenant = tenantID
	}
	if auditTenant != nil {
		if err := insertAudit(ctx, tx, *auditTenant, actorID,
			"user.status_changed", "user", id,
			map[string]any{"status": current},
			map[string]any{"status": status},
		); err != nil {
			return models.User{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return models.User{}, err
	}
	return s.getUser(ctx, tenantID, id)
}

// CreateDomainUser mirrors a newly-created Better Auth identity into the
// domain users table. The account starts pending until approved.
func (s *Store) CreateDomainUser(
	ctx context.Context,
	tenantID *uuid.UUID,
	actorID *uuid.UUID,
	authUserID uuid.UUID,
	role models.UserRole,
	email, firstName, lastName string,
) (models.User, error) {
	if role != models.RoleAdmin && role != models.RoleStaff {
		return models.User{}, fmt.Errorf("%w: only admin or staff accounts can be invited here", ErrValidation)
	}
	if tenantID == nil {
		return models.User{}, fmt.Errorf("%w: an account tenant is required", ErrValidation)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.User{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if _, err := tx.Exec(ctx, `
		INSERT INTO users (
			id, tenant_id, role, email, first_name, last_name, status,
			email_verified_at
		) VALUES ($1,$2,$3,$4,$5,$6,'pending',now())`,
		authUserID, tenantID, role, email, firstName, lastName,
	); err != nil {
		return models.User{}, mapWriteError(err)
	}
	if err := insertAudit(ctx, tx, *tenantID, actorID,
		"user.invited", "user", authUserID,
		nil, map[string]any{"email": email, "role": role},
	); err != nil {
		return models.User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.User{}, err
	}
	return s.getUser(ctx, tenantID, authUserID)
}

// -- Manual staff entry ---------------------------------------------------

// StaffInput is the payload for manually adding a staff record.
type StaffInput struct {
	FirstName          string
	LastName           string
	Email              string
	Phone              string
	EmploymentCategory models.EmploymentCategory
	DepartmentID       *uuid.UUID
	LocationID         *uuid.UUID
	Position           *string
	AppointmentDate    *time.Time
}

// CreateStaff manually adds a staff record and allocates a Staff ID.
func (s *Store) CreateStaff(
	ctx context.Context,
	tenantID uuid.UUID,
	actorID *uuid.UUID,
	input StaffInput,
) (models.StaffProfile, error) {
	if strings.TrimSpace(input.FirstName) == "" ||
		strings.TrimSpace(input.LastName) == "" ||
		strings.TrimSpace(input.Email) == "" ||
		strings.TrimSpace(input.Phone) == "" {
		return models.StaffProfile{}, fmt.Errorf("%w: name, email and phone are required", ErrValidation)
	}
	switch input.EmploymentCategory {
	case models.CategoryDirector, models.CategoryEmployee,
		models.CategoryContractor, models.CategoryPartner:
	default:
		return models.StaffProfile{}, fmt.Errorf("%w: invalid employment category", ErrValidation)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.StaffProfile{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var stateCode string
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(NULLIF(l.code, ''), NULLIF(l.slug, ''), 'NG')
		FROM tenants t
		LEFT JOIN locations l ON l.id = t.state_location_id
		WHERE t.id = $1`, tenantID).Scan(&stateCode)
	if err != nil {
		return models.StaffProfile{}, err
	}
	stateCode = strings.ToUpper(stateCode)
	year := time.Now().Year()

	// Seed a fresh counter above any Staff IDs imported outside the API, so
	// the first generated ID in a seeded database does not collide.
	startAt := 1
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(MAX((regexp_match(staff_id, '/([0-9]+)$'))[1]::int), 0) + 1
		FROM staff_profiles
		WHERE tenant_id = $1 AND staff_id LIKE $2`,
		tenantID, fmt.Sprintf("STA/%s/%d/%%", stateCode, year),
	).Scan(&startAt); err != nil {
		return models.StaffProfile{}, err
	}

	seq, err := sequence.New(s.pool).Next(
		ctx, tx, sequence.ScopeStaff, tenantID.String(), year, "STA", stateCode,
		startAt,
	)
	if err != nil {
		return models.StaffProfile{}, err
	}
	staffID := codes.FormatStaffID(stateCode, year, seq)

	var rawID string
	err = tx.QueryRow(ctx, `
		INSERT INTO staff_profiles (
			tenant_id, staff_id, employment_category, first_name, last_name,
			email, phone, location_id, department_id, position, appointment_date,
			status
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active')
		RETURNING id`,
		tenantID, staffID, input.EmploymentCategory,
		strings.TrimSpace(input.FirstName), strings.TrimSpace(input.LastName),
		strings.TrimSpace(input.Email), strings.TrimSpace(input.Phone),
		input.LocationID, input.DepartmentID, input.Position,
		input.AppointmentDate,
	).Scan(&rawID)
	if err != nil {
		return models.StaffProfile{}, mapWriteError(err)
	}
	staffUUID, err := uuid.Parse(rawID)
	if err != nil {
		return models.StaffProfile{}, err
	}
	if err := insertAudit(ctx, tx, tenantID, actorID,
		"staff.created_manually", "staff_profile", staffUUID,
		nil, map[string]any{"staff_id": staffID, "email": input.Email},
	); err != nil {
		return models.StaffProfile{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.StaffProfile{}, err
	}
	return s.GetStaff(ctx, &tenantID, staffUUID)
}

// QueueShortlistResend records a fresh delivery of the stored shortlist
// confirmation message. The message itself is never edited by a resend.
func (s *Store) QueueShortlistResend(
	ctx context.Context,
	scope *uuid.UUID,
	actorID *uuid.UUID,
	id uuid.UUID,
) (models.Notification, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.Notification{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		rawTenantID, rawApplicantID string
		email, firstName, jobTitle  string
		message, status             string
	)
	err = tx.QueryRow(ctx, `
		SELECT a.tenant_id, a.applicant_id, a.email, a.first_name, j.title,
		       sl.message, sl.status
		FROM shortlists sl
		JOIN applications a ON a.id = sl.application_id
		JOIN jobs j ON j.id = sl.job_id
		WHERE sl.id = $1 AND ($2::uuid IS NULL OR a.tenant_id = $2)
		FOR UPDATE`, id, scope,
	).Scan(&rawTenantID, &rawApplicantID, &email, &firstName, &jobTitle,
		&message, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Notification{}, ErrNotFound
	}
	if err != nil {
		return models.Notification{}, err
	}
	if status != "active" {
		return models.Notification{}, fmt.Errorf("%w: a revoked shortlist cannot be resent", ErrValidation)
	}
	tenantID, err := uuid.Parse(rawTenantID)
	if err != nil {
		return models.Notification{}, err
	}
	applicantID, err := uuid.Parse(rawApplicantID)
	if err != nil {
		return models.Notification{}, err
	}

	payload := map[string]any{
		"first_name": firstName,
		"job_title":  jobTitle,
		"message":    message,
	}
	var (
		rawID        string
		notification models.Notification
	)
	err = tx.QueryRow(ctx, `
		INSERT INTO notifications (
			tenant_id, recipient_user_id, recipient_contact, channel,
			template_key, payload, status
		) VALUES ($1,$2,$3,'email','shortlist_confirmation',$4,'pending')
		RETURNING id, created_at`,
		tenantID, applicantID, email, payload,
	).Scan(&rawID, &notification.CreatedAt)
	if err != nil {
		return models.Notification{}, mapWriteError(err)
	}
	notification.ID, err = uuid.Parse(rawID)
	if err != nil {
		return models.Notification{}, err
	}
	notification.TenantID = &tenantID
	notification.RecipientUserID = &applicantID
	notification.RecipientContact = &email
	notification.Channel = "email"
	templateKey := "shortlist_confirmation"
	notification.TemplateKey = &templateKey
	notification.Payload = payload
	notification.Status = "pending"

	if err := insertAudit(ctx, tx, tenantID, actorID,
		"shortlist.message_resent", "shortlist", id,
		nil, map[string]any{"recipient": email},
	); err != nil {
		return models.Notification{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.Notification{}, err
	}
	return notification, nil
}

// -- Interview notifications ---------------------------------------------

// QueueInterviewNotifications records one email delivery per applicant in the
// announcement audience. Delivery is performed by the notification worker.
func (s *Store) QueueInterviewNotifications(
	ctx context.Context,
	scope *uuid.UUID,
	actorID *uuid.UUID,
	id uuid.UUID,
) (int, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		rawTenantID, rawJobID         string
		jobTitle, venue, instructions string
		status                        string
		audience                      models.InterviewAudience
		interviewAt                   time.Time
	)
	err = tx.QueryRow(ctx, `
		SELECT i.tenant_id, i.job_id, j.title, i.interview_at, i.venue,
		       i.instructions, i.audience, i.status
		FROM interview_announcements i
		JOIN jobs j ON j.id = i.job_id
		WHERE i.id = $1 AND ($2::uuid IS NULL OR i.tenant_id = $2)
		FOR UPDATE`, id, scope,
	).Scan(&rawTenantID, &rawJobID, &jobTitle, &interviewAt, &venue,
		&instructions, &audience, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	}
	if err != nil {
		return 0, err
	}
	if status != string(models.InterviewPublished) {
		return 0, fmt.Errorf("%w: publish the announcement before notifying candidates", ErrValidation)
	}
	tenantID, err := uuid.Parse(rawTenantID)
	if err != nil {
		return 0, err
	}
	jobID, err := uuid.Parse(rawJobID)
	if err != nil {
		return 0, err
	}

	rows, err := tx.Query(ctx, `
		SELECT a.applicant_id, a.email, a.first_name
		FROM applications a
		WHERE a.job_id = $1
		  AND a.status <> 'withdrawn'
		  AND (
			$2 = 'all_applicants'
			OR ($2 = 'shortlisted_only' AND a.status IN ('shortlisted','appointed'))
			OR ($2 = 'job_applicants')
		  )`, jobID, string(audience))
	if err != nil {
		return 0, err
	}
	type recipient struct {
		ID        string
		Email     string
		FirstName string
	}
	recipients := make([]recipient, 0)
	for rows.Next() {
		var item recipient
		if err := rows.Scan(&item.ID, &item.Email, &item.FirstName); err != nil {
			rows.Close()
			return 0, err
		}
		recipients = append(recipients, item)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	queued := 0
	for _, item := range recipients {
		applicantID, err := uuid.Parse(item.ID)
		if err != nil {
			return 0, err
		}
		payload := map[string]any{
			"interview_id": id.String(),
			"first_name":   item.FirstName,
			"job_title":    jobTitle,
			"interview_at": interviewAt.Format(time.RFC3339),
			"venue":        venue,
			"instructions": instructions,
		}
		tag, err := tx.Exec(ctx, `
			INSERT INTO notifications (
				tenant_id, recipient_user_id, recipient_contact, channel,
				template_key, payload, status
			)
			SELECT $1,$2,$3,'email','interview_announcement',$4,'pending'
			WHERE NOT EXISTS (
				SELECT 1 FROM notifications n
				WHERE n.tenant_id = $1
				  AND n.recipient_user_id = $2
				  AND n.template_key = 'interview_announcement'
				  AND n.payload->>'interview_id' = $5
			)`,
			tenantID, applicantID, item.Email, payload, id.String(),
		)
		if err != nil {
			return 0, err
		}
		queued += int(tag.RowsAffected())
	}

	if err := insertAudit(ctx, tx, tenantID, actorID,
		"interview.notifications_queued", "interview", id,
		nil, map[string]any{"queued": queued},
	); err != nil {
		return 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return queued, nil
}

func slugify(value string) string {
	var b strings.Builder
	lastDash := false
	for _, r := range strings.ToLower(value) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			lastDash = false
		case !lastDash:
			b.WriteByte('-')
			lastDash = true
		}
	}
	return strings.Trim(b.String(), "-")
}

func scanLocation(row rowScanner) (models.Location, error) {
	var (
		location                 models.Location
		rawID, rawType, rawSlug  string
		rawStatus                string
		rawTenantID, rawParentID *string
	)
	err := row.Scan(
		&rawID, &rawTenantID, &rawParentID, &rawType, &location.Name,
		&location.Code, &rawSlug, &rawStatus, &location.CreatedAt,
	)
	if err != nil {
		return models.Location{}, err
	}
	if location.ID, err = uuid.Parse(rawID); err != nil {
		return models.Location{}, err
	}
	if location.TenantID, err = optionalUUID(rawTenantID); err != nil {
		return models.Location{}, err
	}
	if location.ParentID, err = optionalUUID(rawParentID); err != nil {
		return models.Location{}, err
	}
	location.Type = models.LocationType(rawType)
	location.Slug = rawSlug
	location.Status = models.LocationStatus(rawStatus)
	return location, nil
}
