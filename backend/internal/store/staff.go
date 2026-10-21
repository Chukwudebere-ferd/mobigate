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

// This file holds the staff onboarding persistence: access code redemption
// with attempt lockout (BR-05/BR-06), the draft/resume snapshot and the
// atomic profile-creation transaction that allocates the Staff ID (BR-11).

// Redemption is the result of a successful code check: the ticket the
// onboarding form is authorised by, and the context it needs.
type Redemption struct {
	CodeID      uuid.UUID
	TenantID    uuid.UUID
	IssuedTo    *uuid.UUID
	CodeType    models.AccessCodeType
	Application *models.Application
	// Staff is the existing staff record the code targets, when any. Its
	// details prefill the form and onboarding updates the same profile.
	Staff *models.StaffProfile
	// Departments is the tenant's list for the employment section.
	Departments []models.Department
}

// RedeemAccessCode validates a code and returns its redemption context.
//
// The code is normalised (BR-04), hashed and looked up by hash; the
// plaintext is never stored or logged (BR-17). A wrong code increments the
// failed-attempt counter, and reaching the configured threshold locks the
// code until an admin reissues it (BR-06). Expiry and single-use are
// enforced here (BR-05).
func (s *Store) RedeemAccessCode(ctx context.Context, enteredCode, remoteIP string) (Redemption, error) {
	normalised := codes.Normalise(enteredCode)
	// Forgiving entry: drop internal whitespace and common separators so a
	// code copied from an SMS still validates.
	normalised = strings.Map(func(r rune) rune {
		switch {
		case r >= '0' && r <= '9', r >= 'A' && r <= 'Z':
			return r
		case r >= 'a' && r <= 'z':
			return r - 32
		default:
			return -1
		}
	}, normalised)
	if len(normalised) < 6 {
		return Redemption{}, fmt.Errorf("%w: enter the 6-character code from your appointment message", ErrValidation)
	}
	hash := codes.HashAccessCode(normalised)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Redemption{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		maxAttempts    int
		codeIDRaw      string
		tenantRaw      string
		status         models.AccessCodeStatus
		expiresAt      time.Time
		failedCount    int
		issuedTo       *string
		codeType       models.AccessCodeType
		applicationID  *uuid.UUID
		staffProfileID *uuid.UUID
	)
	err = tx.QueryRow(ctx, `
		SELECT c.id, c.tenant_id, c.status, c.expires_at, c.failed_attempts,
		       c.issued_to, c.type, c.application_id, c.staff_profile_id,
		       s.access_code_max_attempts
		FROM access_codes c
		CROSS JOIN admin_settings s
		WHERE c.code_hash = $1
		FOR UPDATE`,
		hash,
	).Scan(&codeIDRaw, &tenantRaw, &status, &expiresAt, &failedCount,
		&issuedTo, &codeType, &applicationID, &staffProfileID, &maxAttempts)
	if errors.Is(err, pgx.ErrNoRows) {
		// Unknown code: no row to increment, but the attempt is still
		// auditable through rate limiting at the HTTP layer.
		return Redemption{}, fmt.Errorf("%w: that code is not recognised", ErrValidation)
	}
	if err != nil {
		return Redemption{}, err
	}

	codeID, err := uuid.Parse(codeIDRaw)
	if err != nil {
		return Redemption{}, err
	}
	tenantID, err := uuid.Parse(tenantRaw)
	if err != nil {
		return Redemption{}, err
	}

	// A locked code reports lockout rather than silently failing again.
	if failedCount >= maxAttempts {
		return Redemption{}, fmt.Errorf("%w: too many attempts on this code; contact your administrator for a new one", ErrLocked)
	}

	// Expiry is checked on read; an elapsed code is stamped expired so the
	// admin list reflects reality (BR-05).
	if status == models.AccessCodeActive && time.Now().After(expiresAt) {
		if _, err := tx.Exec(ctx, `
			UPDATE access_codes SET status = 'expired' WHERE id = $1`, codeID,
		); err != nil {
			return Redemption{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return Redemption{}, err
		}
		return Redemption{}, fmt.Errorf("%w: this code has expired; contact your administrator", ErrValidation)
	}

	if status != models.AccessCodeActive {
		if _, err := tx.Exec(ctx, `
			UPDATE access_codes SET failed_attempts = failed_attempts + 1
			WHERE id = $1`, codeID,
		); err != nil {
			return Redemption{}, err
		}
		_ = tx.Commit(ctx) // persist the attempt count
		switch status {
		case models.AccessCodeUsed:
			return Redemption{}, fmt.Errorf("%w: this code has already been used", ErrValidation)
		case models.AccessCodeRevoked:
			return Redemption{}, fmt.Errorf("%w: this code was revoked; contact your administrator", ErrValidation)
		case models.AccessCodeExpired:
			return Redemption{}, fmt.Errorf("%w: this code has expired; contact your administrator", ErrValidation)
		default:
			return Redemption{}, fmt.Errorf("%w: that code is not recognised", ErrValidation)
		}
	}

	// Success resets the attempt counter (README §M8).
	if _, err := tx.Exec(ctx, `
		UPDATE access_codes SET failed_attempts = 0 WHERE id = $1`, codeID,
	); err != nil {
		return Redemption{}, err
	}

	redemption := Redemption{
		CodeID:   codeID,
		TenantID: tenantID,
		CodeType: codeType,
	}
	if issuedTo != nil {
		if parsed, err := uuid.Parse(*issuedTo); err == nil {
			redemption.IssuedTo = &parsed
		}
	}

	// The application behind the code, when there is one, seeds the
	// onboarding form so the candidate does not retype their details.
	if applicationID != nil {
		application, err := applicationByID(ctx, tx, applicationID)
		if err != nil && !errors.Is(err, ErrNotFound) {
			return Redemption{}, err
		}
		if err == nil {
			redemption.Application = &application
		}
	}
	if staffProfileID != nil {
		staff, err := staffByIDUsing(ctx, tx, &tenantID, *staffProfileID)
		if err != nil && !errors.Is(err, ErrNotFound) {
			return Redemption{}, err
		}
		if err == nil {
			redemption.Staff = &staff
		}
	}

	departments, err := s.ListDepartments(ctx, &tenantID)
	if err != nil {
		return Redemption{}, err
	}
	redemption.Departments = departments

	if err := insertAudit(ctx, tx, tenantID, redemption.IssuedTo,
		"access_code.redeemed", "access_code", codeID,
		nil, map[string]any{"ip": remoteIP},
	); err != nil {
		return Redemption{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Redemption{}, err
	}
	return redemption, nil
}

// applicationByID loads an application using any querier — a transaction in
// the onboarding path, the pool in the ticket-revalidation path.
func applicationByID(ctx context.Context, q queryer, id *uuid.UUID) (models.Application, error) {
	const sql = `SELECT ` + applicationColumns + `
		FROM applications a
		JOIN jobs j ON j.id = a.job_id
		LEFT JOIN locations l ON l.id = a.location_id
		LEFT JOIN documents d ON d.id = a.cv_document_id
		WHERE a.id = $1`

	application, err := scanApplication(q.QueryRow(ctx, sql, *id))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Application{}, ErrNotFound
	}
	return application, err
}

// -- Onboarding drafts -------------------------------------------------------

// GetStaffDraft returns the saved form snapshot for a user and code.
func (s *Store) GetStaffDraft(ctx context.Context, userID, codeID uuid.UUID) (map[string]any, error) {
	var data map[string]any
	err := s.pool.QueryRow(ctx, `
		SELECT data FROM staff_drafts
		WHERE user_id = $1 AND access_code_id = $2`,
		userID, codeID,
	).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return data, nil
}

// SaveStaffDraft upserts the form snapshot so onboarding can resume across
// sessions (README §M9).
func (s *Store) SaveStaffDraft(ctx context.Context, userID, codeID, tenantID uuid.UUID, data map[string]any) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO staff_drafts (user_id, access_code_id, tenant_id, data)
		VALUES ($1,$2,$3,$4)
		ON CONFLICT (user_id, access_code_id)
		DO UPDATE SET data = $4, updated_at = now()`,
		userID, codeID, tenantID, data,
	)
	return err
}

// DeleteStaffDraft removes a snapshot once the profile is committed.
func (s *Store) DeleteStaffDraft(ctx context.Context, tx pgx.Tx, userID, codeID uuid.UUID) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM staff_drafts
		WHERE user_id = $1 AND access_code_id = $2`,
		userID, codeID,
	)
	return err
}

// RedeemAccessCodeByID re-validates an already-redeemed code for the ticket
// holder. Unlike RedeemAccessCode it takes no plaintext code: the ticket
// already proved possession, so this only re-checks that the code is still
// active and unexpired and reloads the onboarding context. A code consumed
// or expired since the ticket was issued fails here, which stops a stale
// ticket from completing onboarding twice.
func (s *Store) RedeemAccessCodeByID(ctx context.Context, codeID, userID uuid.UUID) (Redemption, error) {
	var (
		rawTenantID    string
		status         models.AccessCodeStatus
		expiresAt      time.Time
		codeType       models.AccessCodeType
		issuedTo       *string
		applicationID  *uuid.UUID
		staffProfileID *uuid.UUID
	)
	err := s.pool.QueryRow(ctx, `
		SELECT tenant_id, status, expires_at, type, issued_to, application_id,
		       staff_profile_id
		FROM access_codes
		WHERE id = $1`,
		codeID,
	).Scan(&rawTenantID, &status, &expiresAt, &codeType, &issuedTo,
		&applicationID, &staffProfileID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Redemption{}, ErrNotFound
	}
	if err != nil {
		return Redemption{}, err
	}
	if status != models.AccessCodeActive || time.Now().After(expiresAt) {
		return Redemption{}, fmt.Errorf("%w: the access code is no longer valid; contact your administrator", ErrValidation)
	}
	tenantID, err := uuid.Parse(rawTenantID)
	if err != nil {
		return Redemption{}, err
	}

	// The ticket is bound to one account; a different session cannot reuse it.
	if issuedTo != nil {
		issued, err := uuid.Parse(*issuedTo)
		if err != nil {
			return Redemption{}, err
		}
		if issued != userID {
			return Redemption{}, ErrNotFound
		}
	}

	redemption := Redemption{
		CodeID:   codeID,
		TenantID: tenantID,
		CodeType: codeType,
	}
	if issuedTo != nil {
		if parsed, err := uuid.Parse(*issuedTo); err == nil {
			redemption.IssuedTo = &parsed
		}
	}
	if applicationID != nil {
		application, err := applicationByID(ctx, s.pool, applicationID)
		if err != nil && !errors.Is(err, ErrNotFound) {
			return Redemption{}, err
		}
		if err == nil {
			redemption.Application = &application
		}
	}
	if staffProfileID != nil {
		staff, err := staffByIDUsing(ctx, s.pool, &tenantID, *staffProfileID)
		if err != nil && !errors.Is(err, ErrNotFound) {
			return Redemption{}, err
		}
		if err == nil {
			redemption.Staff = &staff
		}
	}
	departments, err := s.ListDepartments(ctx, &tenantID)
	if err != nil {
		return Redemption{}, err
	}
	redemption.Departments = departments
	return redemption, nil
}

// DocumentByID loads one document record by id, including its storage key.
// It is used only for best-effort cleanup of replaced uploads.
func (s *Store) DocumentByID(ctx context.Context, id uuid.UUID) (models.Document, error) {
	var (
		document  models.Document
		rawID     string
		rawTenant *string
		rawOwner  string
	)
	const q = `
		SELECT id, tenant_id, owner_type, owner_id, category, file_name,
		       storage_key, mime_type, size_bytes, uploaded_by, created_at
		FROM documents WHERE id = $1`
	err := s.pool.QueryRow(ctx, q, id).Scan(
		&rawID, &rawTenant, &document.OwnerType, &rawOwner, &document.Category,
		&document.FileName, &document.StorageKey, &document.MimeType,
		&document.SizeBytes, &document.UploadedBy, &document.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Document{}, ErrNotFound
	}
	if err != nil {
		return models.Document{}, err
	}
	if document.ID, err = uuid.Parse(rawID); err != nil {
		return models.Document{}, err
	}
	if document.TenantID, err = optionalUUID(rawTenant); err != nil {
		return models.Document{}, err
	}
	if document.OwnerID, err = uuid.Parse(rawOwner); err != nil {
		return models.Document{}, err
	}
	return document, nil
}

// -- Onboarding submission ---------------------------------------------------

// OnboardingInput is the full staff details form (README §4.4 step 5).
type OnboardingInput struct {
	CodeID      uuid.UUID
	UserID      uuid.UUID
	StaffUserID uuid.UUID

	FirstName   string
	LastName    string
	Email       string
	Phone       string
	Gender      *string
	DateOfBirth *time.Time
	AddressLine *string
	LocationID  *uuid.UUID

	EmploymentCategory models.EmploymentCategory
	DepartmentID       *uuid.UUID
	Position           *string
	AppointmentDate    *time.Time

	BankName          *string
	BankAccountName   *string
	BankAccountNumber *string

	GuarantorName         *string
	GuarantorPhone        *string
	GuarantorAddress      *string
	GuarantorRelationship *string

	NextOfKinName         *string
	NextOfKinPhone        *string
	NextOfKinRelationship *string

	Documents []OnboardingDocument

	// applicationID is the application the redeemed code was issued for,
	// set from the redemption before the transaction runs.
	applicationID *uuid.UUID
}

// OnboardingDocument is a supporting file already uploaded to storage.
type OnboardingDocument struct {
	Category string
	File     DocumentInput
}

// CompleteOnboarding runs BR-11: the staff profile, the Staff ID allocation,
// the access code consumption, the draft removal and the audit entry happen
// in ONE transaction. A failure in any one rolls back all of them.
func (s *Store) CompleteOnboarding(ctx context.Context, in OnboardingInput) (models.StaffProfile, error) {
	if strings.TrimSpace(in.FirstName) == "" || strings.TrimSpace(in.LastName) == "" ||
		strings.TrimSpace(in.Email) == "" || strings.TrimSpace(in.Phone) == "" {
		return models.StaffProfile{}, fmt.Errorf("%w: name, email and phone are required", ErrValidation)
	}
	switch in.EmploymentCategory {
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

	// The code must still be active; redemption may have been a while ago.
	// A code linked to a staff profile may be unbound until that member signs
	// in, so issued_to NULL is accepted only for the staff-profile path.
	var (
		rawTenantID    string
		status         models.AccessCodeStatus
		expiresAt      time.Time
		staffProfileID *uuid.UUID
	)
	err = tx.QueryRow(ctx, `
		SELECT tenant_id, status, expires_at, staff_profile_id
		FROM access_codes
		WHERE id = $1
		  AND (issued_to = $2 OR (issued_to IS NULL AND staff_profile_id IS NOT NULL))
		FOR UPDATE`,
		in.CodeID, in.UserID,
	).Scan(&rawTenantID, &status, &expiresAt, &staffProfileID)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.StaffProfile{}, ErrNotFound
	}
	if err != nil {
		return models.StaffProfile{}, err
	}
	if status != models.AccessCodeActive || time.Now().After(expiresAt) {
		return models.StaffProfile{}, fmt.Errorf("%w: the access code is no longer valid; contact your administrator", ErrValidation)
	}
	tenantID, err := uuid.Parse(rawTenantID)
	if err != nil {
		return models.StaffProfile{}, err
	}

	var (
		profileID uuid.UUID
		staffID   string
	)
	if staffProfileID != nil {
		profileID, staffID, err = updateOnboardingStaffProfile(
			ctx, tx, tenantID, *staffProfileID, &in,
		)
	} else {
		profileID, staffID, err = s.createOnboardingStaffProfile(
			ctx, tx, tenantID, &in,
		)
	}
	if err != nil {
		return models.StaffProfile{}, err
	}

	// Supporting documents belong to the staff record.
	for _, doc := range in.Documents {
		if _, err := insertDocument(ctx, tx, tenantID, "staff", profileID, doc.Category, &doc.File, in.StaffUserID); err != nil {
			return models.StaffProfile{}, err
		}
	}

	// Consume the code in the same transaction (BR-05/BR-11).
	if _, err := tx.Exec(ctx, `
		UPDATE access_codes
		SET status = 'used', used_at = now(), used_by = $2
		WHERE id = $1`,
		in.CodeID, in.StaffUserID,
	); err != nil {
		return models.StaffProfile{}, err
	}

	// The domain user becomes staff of this tenant, so the next request
	// carries the staff role and scope.
	if _, err := tx.Exec(ctx, `
		UPDATE users SET role = 'staff', tenant_id = $2, updated_at = now()
		WHERE id = $1`,
		in.StaffUserID, tenantID,
	); err != nil {
		return models.StaffProfile{}, err
	}

	// Better Auth mirrors the Staff ID so the login response carries it.
	if _, err := tx.Exec(ctx, `
		UPDATE "user" SET "staffId" = $2, "updatedAt" = now() WHERE id = $1`,
		in.StaffUserID, staffID,
	); err != nil {
		return models.StaffProfile{}, err
	}

	// The application behind the code, when present, becomes appointed.
	if applicationID := in.ApplicationID(); applicationID != nil {
		if _, err := tx.Exec(ctx, `
			UPDATE applications SET status = 'appointed', updated_at = now()
			WHERE id = $1 AND status IN ('pending','shortlisted')`,
			*applicationID,
		); err != nil {
			return models.StaffProfile{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO application_events (application_id, actor_id, from_status, to_status, reason)
			VALUES ($1,$2,NULL,'appointed','Access code redeemed; staff profile created')`,
			*applicationID, in.StaffUserID,
		); err != nil {
			return models.StaffProfile{}, err
		}
	}

	if err := s.DeleteStaffDraft(ctx, tx, in.StaffUserID, in.CodeID); err != nil {
		return models.StaffProfile{}, err
	}

	if err := insertAudit(ctx, tx, tenantID, &in.StaffUserID,
		"staff.onboarded", "staff_profile", profileID,
		nil, map[string]any{"staff_id": staffID, "email": in.Email},
	); err != nil {
		return models.StaffProfile{}, err
	}

	staffName := strings.TrimSpace(in.FirstName + " " + in.LastName)
	if err := EnqueueNotification(ctx, tx, tenantID, &in.StaffUserID, in.Email,
		"staff_created", map[string]any{
			"staff_name": staffName,
			"first_name": in.FirstName,
			"staff_id":   staffID,
		},
	); err != nil {
		return models.StaffProfile{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.StaffProfile{}, err
	}
	return s.GetStaff(ctx, &tenantID, profileID)
}

// createOnboardingStaffProfile allocates a fresh Staff ID and inserts the
// completed profile. It is used when the code targets a job application.
func (s *Store) createOnboardingStaffProfile(
	ctx context.Context,
	tx pgx.Tx,
	tenantID uuid.UUID,
	in *OnboardingInput,
) (uuid.UUID, string, error) {
	// Allocate the Staff ID atomically, seeded above imported records.
	var stateCode string
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(NULLIF(l.code, ''), NULLIF(l.slug, ''), 'NG')
		FROM tenants t
		LEFT JOIN locations l ON l.id = t.state_location_id
		WHERE t.id = $1`, tenantID).Scan(&stateCode); err != nil {
		return uuid.Nil, "", err
	}
	stateCode = strings.ToUpper(stateCode)
	year := time.Now().Year()

	startAt := 1
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(MAX((regexp_match(staff_id, '/([0-9]+)$'))[1]::int), 0) + 1
		FROM staff_profiles
		WHERE tenant_id = $1 AND staff_id LIKE $2`,
		tenantID, fmt.Sprintf("STA/%s/%d/%%", stateCode, year),
	).Scan(&startAt); err != nil {
		return uuid.Nil, "", err
	}
	seq, err := sequence.New(s.pool).Next(
		ctx, tx, sequence.ScopeStaff, tenantID.String(), year, "STA", stateCode, startAt,
	)
	if err != nil {
		return uuid.Nil, "", err
	}
	staffID := codes.FormatStaffID(stateCode, year, seq)

	var rawProfileID string
	err = tx.QueryRow(ctx, `
		INSERT INTO staff_profiles (
			tenant_id, user_id, staff_id, application_id, employment_category,
			first_name, last_name, email, phone, gender, date_of_birth,
			address_line, location_id, bank_name, bank_account_name,
			bank_account_number, guarantor_name, guarantor_phone,
			guarantor_address, guarantor_relationship, next_of_kin_name,
			next_of_kin_phone, next_of_kin_relationship, department_id,
			position, appointment_date, rules_of_engagement_accepted_at,
			status
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
			$19,$20,$21,$22,$23,$24,$25,$26,$27,'active'
		)
		RETURNING id`,
		tenantID, in.StaffUserID, staffID, in.ApplicationID(), in.EmploymentCategory,
		strings.TrimSpace(in.FirstName), strings.TrimSpace(in.LastName),
		strings.ToLower(strings.TrimSpace(in.Email)), strings.TrimSpace(in.Phone),
		in.Gender, in.DateOfBirth, in.AddressLine, in.LocationID,
		in.BankName, in.BankAccountName, in.BankAccountNumber,
		in.GuarantorName, in.GuarantorPhone, in.GuarantorAddress,
		in.GuarantorRelationship, in.NextOfKinName, in.NextOfKinPhone,
		in.NextOfKinRelationship, in.DepartmentID, in.Position,
		in.AppointmentDate, time.Now(),
	).Scan(&rawProfileID)
	if err != nil {
		return uuid.Nil, "", mapWriteError(err)
	}
	profileID, err := uuid.Parse(rawProfileID)
	if err != nil {
		return uuid.Nil, "", err
	}
	return profileID, staffID, nil
}

// updateOnboardingStaffProfile completes an existing staff record created by
// an admin. The Staff ID and application link are preserved; only the account
// attachment and the details from the form change.
func updateOnboardingStaffProfile(
	ctx context.Context,
	tx pgx.Tx,
	tenantID uuid.UUID,
	profileID uuid.UUID,
	in *OnboardingInput,
) (uuid.UUID, string, error) {
	var (
		rawID, staffID string
		rawUserID      *string
	)
	err := tx.QueryRow(ctx, `
		SELECT id, staff_id, user_id FROM staff_profiles
		WHERE id = $1 AND tenant_id = $2
		FOR UPDATE`, profileID, tenantID,
	).Scan(&rawID, &staffID, &rawUserID)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, "", ErrNotFound
	}
	if err != nil {
		return uuid.Nil, "", err
	}
	if rawUserID != nil {
		linkedUserID, err := uuid.Parse(*rawUserID)
		if err != nil {
			return uuid.Nil, "", err
		}
		if linkedUserID != in.StaffUserID {
			return uuid.Nil, "", fmt.Errorf("%w: this staff record is already linked to another account", ErrValidation)
		}
	}

	var updatedID string
	err = tx.QueryRow(ctx, `
		UPDATE staff_profiles SET
			user_id = $2, employment_category = $3, first_name = $4,
			last_name = $5, email = $6, phone = $7, gender = $8,
			date_of_birth = $9, address_line = $10, location_id = $11,
			bank_name = $12, bank_account_name = $13, bank_account_number = $14,
			guarantor_name = $15, guarantor_phone = $16,
			guarantor_address = $17, guarantor_relationship = $18,
			next_of_kin_name = $19, next_of_kin_phone = $20,
			next_of_kin_relationship = $21, department_id = $22,
			position = $23, appointment_date = $24,
			rules_of_engagement_accepted_at =
				COALESCE(rules_of_engagement_accepted_at, now()),
			status = 'active', updated_at = now()
		WHERE id = $1
		RETURNING id`,
		profileID, in.StaffUserID, in.EmploymentCategory,
		strings.TrimSpace(in.FirstName), strings.TrimSpace(in.LastName),
		strings.ToLower(strings.TrimSpace(in.Email)), strings.TrimSpace(in.Phone),
		in.Gender, in.DateOfBirth, in.AddressLine, in.LocationID,
		in.BankName, in.BankAccountName, in.BankAccountNumber,
		in.GuarantorName, in.GuarantorPhone, in.GuarantorAddress,
		in.GuarantorRelationship, in.NextOfKinName, in.NextOfKinPhone,
		in.NextOfKinRelationship, in.DepartmentID, in.Position,
		in.AppointmentDate,
	).Scan(&updatedID)
	if err != nil {
		return uuid.Nil, "", mapWriteError(err)
	}
	updatedUUID, err := uuid.Parse(updatedID)
	if err != nil {
		return uuid.Nil, "", err
	}
	return updatedUUID, staffID, nil
}

// ApplicationID derives the pointer for the profile insert; kept as a
// method so the long insert statement stays readable.
func (in *OnboardingInput) ApplicationID() *uuid.UUID {
	return in.applicationID
}

// SetApplicationID records the application the redeemed code was issued for.
func (in *OnboardingInput) SetApplicationID(id *uuid.UUID) {
	in.applicationID = id
}

// -- Staff self-service ------------------------------------------------------

// StaffByUserID loads the staff profile belonging to a signed-in user.
func (s *Store) StaffByUserID(ctx context.Context, userID uuid.UUID) (models.StaffProfile, error) {
	const q = `
		SELECT
			sp.id, sp.tenant_id, sp.user_id, sp.staff_id, sp.application_id,
			sp.employment_category, sp.first_name, sp.last_name, sp.email,
			sp.phone, sp.gender, sp.date_of_birth, sp.address_line,
			sp.location_id, sp.bank_name, sp.bank_account_name,
			sp.bank_account_number, sp.guarantor_name, sp.guarantor_phone,
			sp.guarantor_address, sp.guarantor_relationship,
			sp.next_of_kin_name, sp.next_of_kin_phone,
			sp.next_of_kin_relationship, sp.department_id, sp.position,
			sp.appointment_date, sp.rules_of_engagement_accepted_at,
			sp.status, sp.created_at, sp.updated_at,
			l.name AS location_name, d.name AS department_name
		FROM staff_profiles sp
		LEFT JOIN locations l ON l.id = sp.location_id
		LEFT JOIN departments d ON d.id = sp.department_id
		WHERE sp.user_id = $1
		ORDER BY sp.created_at DESC
		LIMIT 1`

	staff, err := scanStaff(s.pool.QueryRow(ctx, q, userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.StaffProfile{}, ErrNotFound
	}
	return staff, err
}

// StaffDocuments lists the documents attached to a staff profile.
func (s *Store) StaffDocuments(ctx context.Context, staffID uuid.UUID) ([]models.Document, error) {
	return s.documentsFor(ctx, "staff", staffID)
}

// MyApplicationPhoto resolves the photo document of an application the
// applicant owns, returning its storage key for a signed URL.
func (s *Store) MyApplicationPhoto(ctx context.Context, applicantID, applicationID uuid.UUID) (models.Document, error) {
	var (
		document  models.Document
		rawID     string
		rawTenant *string
		rawOwner  string
	)
	const q = `
		SELECT d.id, d.tenant_id, d.owner_type, d.owner_id, d.category,
		       d.file_name, d.storage_key, d.mime_type, d.size_bytes,
		       d.uploaded_by, d.created_at
		FROM documents d
		JOIN applications a ON a.photo_document_id = d.id
		WHERE a.id = $1 AND a.applicant_id = $2`
	err := s.pool.QueryRow(ctx, q, applicationID, applicantID).Scan(
		&rawID, &rawTenant, &document.OwnerType, &rawOwner, &document.Category,
		&document.FileName, &document.StorageKey, &document.MimeType,
		&document.SizeBytes, &document.UploadedBy, &document.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Document{}, ErrNotFound
	}
	if err != nil {
		return models.Document{}, err
	}
	if document.ID, err = uuid.Parse(rawID); err != nil {
		return models.Document{}, err
	}
	if document.TenantID, err = optionalUUID(rawTenant); err != nil {
		return models.Document{}, err
	}
	if document.OwnerID, err = uuid.Parse(rawOwner); err != nil {
		return models.Document{}, err
	}
	return document, nil
}

// documentsFor lists documents attached to one owner.
func (s *Store) documentsFor(ctx context.Context, ownerType string, ownerID uuid.UUID) ([]models.Document, error) {
	const q = `
		SELECT id, tenant_id, owner_type, owner_id, category, file_name,
		       storage_key, mime_type, size_bytes, uploaded_by, created_at
		FROM documents
		WHERE owner_type = $1 AND owner_id = $2
		ORDER BY created_at DESC`

	rows, err := s.pool.Query(ctx, q, ownerType, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.Document, 0)
	for rows.Next() {
		var (
			document  models.Document
			rawID     string
			rawTenant *string
			rawOwner  string
		)
		if err := rows.Scan(
			&rawID, &rawTenant, &document.OwnerType, &rawOwner,
			&document.Category, &document.FileName, &document.StorageKey,
			&document.MimeType, &document.SizeBytes, &document.UploadedBy,
			&document.CreatedAt,
		); err != nil {
			return nil, err
		}
		if document.ID, err = uuid.Parse(rawID); err != nil {
			return nil, err
		}
		if document.TenantID, err = optionalUUID(rawTenant); err != nil {
			return nil, err
		}
		if document.OwnerID, err = uuid.Parse(rawOwner); err != nil {
			return nil, err
		}
		items = append(items, document)
	}
	return items, rows.Err()
}
