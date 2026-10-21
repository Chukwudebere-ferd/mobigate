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

// This file holds the candidate-facing persistence: public job listing,
// application submission and editing, the /me reads, access code redemption
// and the atomic staff onboarding transaction (BR-11).

// -- Public jobs ------------------------------------------------------------

// ListPublicJobs returns applications-open jobs for the careers page.
// Draft, closed and archived jobs are never public (README §M3).
func (s *Store) ListPublicJobs(ctx context.Context) ([]models.Job, error) {
	const q = `SELECT ` + jobColumns + `
		FROM jobs j
		LEFT JOIN locations l ON l.id = j.location_id
		WHERE j.status = 'published'
		  AND (j.publish_at IS NULL OR j.publish_at <= now())
		ORDER BY j.created_at DESC`

	rows, err := s.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.Job, 0)
	for rows.Next() {
		job, err := scanJob(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, job)
	}
	return items, rows.Err()
}

// GetPublicJob loads one published job by slug. A non-published job is
// not-found to the public, which avoids leaking draft titles.
func (s *Store) GetPublicJob(ctx context.Context, slug string) (models.Job, error) {
	const q = `SELECT ` + jobColumns + `
		FROM jobs j
		LEFT JOIN locations l ON l.id = j.location_id
		WHERE j.slug = $1
		  AND j.status = 'published'
		  AND (j.publish_at IS NULL OR j.publish_at <= now())`

	job, err := scanJob(s.pool.QueryRow(ctx, q, slug))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Job{}, ErrNotFound
	}
	return job, err
}

// PublicLocations returns the approved location tree for the cascading
// selects on the application and onboarding forms. Pending and inactive
// rows are excluded (README §M1: an Admin-added location appears only
// after Super Admin approval).
func (s *Store) PublicLocations(ctx context.Context) ([]models.Location, error) {
	const q = `
		SELECT id, tenant_id, parent_id, type, name, code, slug, status, created_at
		FROM locations
		WHERE status = 'approved'
		ORDER BY
			CASE type
				WHEN 'country' THEN 1 WHEN 'state' THEN 2 WHEN 'lga' THEN 3
				WHEN 'city' THEN 4 ELSE 5
			END,
			name`

	rows, err := s.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.Location, 0)
	for rows.Next() {
		var (
			location       models.Location
			rawID, rawType string
			rawSlug        string
			rawStatus      string
			rawTenantID    *string
			rawParentID    *string
		)
		if err := rows.Scan(
			&rawID, &rawTenantID, &rawParentID, &rawType, &location.Name,
			&location.Code, &rawSlug, &rawStatus, &location.CreatedAt,
		); err != nil {
			return nil, err
		}
		if location.ID, err = uuid.Parse(rawID); err != nil {
			return nil, err
		}
		if location.TenantID, err = optionalUUID(rawTenantID); err != nil {
			return nil, err
		}
		if location.ParentID, err = optionalUUID(rawParentID); err != nil {
			return nil, err
		}
		location.Type = models.LocationType(rawType)
		location.Slug = rawSlug
		location.Status = models.LocationStatus(rawStatus)
		items = append(items, location)
	}
	return items, rows.Err()
}

// PublicDepartments returns departments for the staff onboarding form.
// Departments are tenant-scoped; without a session this returns the union
// which the onboarding form narrows by the redeemed code's tenant.
func (s *Store) PublicDepartments(ctx context.Context, tenantID *uuid.UUID) ([]models.Department, error) {
	return s.ListDepartments(ctx, tenantID)
}

// -- Applications ------------------------------------------------------------

// DocumentInput describes a file already uploaded to object storage. The
// storage key is the Byteship path; nothing is stored in the clear locally.
type DocumentInput struct {
	FileName  string
	StorageKey string
	MimeType  string
	SizeBytes int64
}

// ConsentNoticeVersion records which privacy-notice wording the applicant
// agreed to at submission time (migration 0005_application_consent). Bump it
// when the consent copy on the apply form changes so the audit trail can tell
// which wording each applicant accepted.
const ConsentNoticeVersion = "2026-10"

// ApplicationInput is a new application submission.
type ApplicationInput struct {
	ApplicantID   uuid.UUID
	Email         string
	JobID         uuid.UUID
	FirstName     string
	LastName      string
	Phone         string
	Gender        *string
	DateOfBirth   *time.Time
	LocationID    *uuid.UUID
	AddressLine   *string
	Qualification *string
	// ConsentAccepted is the NDPA notice checkbox. The store records its own
	// timestamp and the notice version; the browser never supplies a time.
	ConsentAccepted bool
	Photo         *DocumentInput
}

// ApplicationUpdate is an applicant edit of a pending application (README
// §M4: editable while pending, locked at shortlist — BR-10).
type ApplicationUpdate struct {
	FirstName     *string
	LastName      *string
	Phone         *string
	Gender        *string
	DateOfBirth   *time.Time
	LocationID    *uuid.UUID
	AddressLine   *string
	Qualification *string
	Photo         *DocumentInput
	// PhotoDocumentID is the replaced photo, for best-effort storage cleanup.
	ReplacedPhotoKey *string
}

// SubmitApplication creates the application, allocates its number atomically
// (BR-01/BR-03), records the opening event, the audit entry and the receipt
// notification in ONE transaction. The uploaded photo document row joins the
// same transaction; callers upload the bytes first and clean up on error.
func (s *Store) SubmitApplication(ctx context.Context, in ApplicationInput) (models.Application, error) {
	if strings.TrimSpace(in.Email) == "" || strings.TrimSpace(in.FirstName) == "" ||
		strings.TrimSpace(in.LastName) == "" || strings.TrimSpace(in.Phone) == "" {
		return models.Application{}, fmt.Errorf("%w: name, email and phone are required", ErrValidation)
	}
	if !in.ConsentAccepted {
		return models.Application{}, fmt.Errorf("%w: you must accept the data processing notice to apply", ErrValidation)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.Application{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// The job must be open for business (README §M3).
	var (
		rawTenantID string
		jobTitle    string
		status      models.JobStatus
		deadlineAt  *time.Time
	)
	err = tx.QueryRow(ctx, `
		SELECT tenant_id, title, status, deadline_at FROM jobs WHERE id = $1`,
		in.JobID,
	).Scan(&rawTenantID, &jobTitle, &status, &deadlineAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Application{}, ErrNotFound
	}
	if err != nil {
		return models.Application{}, err
	}
	if status != models.JobPublished {
		return models.Application{}, fmt.Errorf("%w: this role is no longer open", ErrValidation)
	}
	if deadlineAt != nil && time.Now().After(*deadlineAt) {
		return models.Application{}, fmt.Errorf("%w: the application deadline has passed", ErrValidation)
	}
	tenantID, err := uuid.Parse(rawTenantID)
	if err != nil {
		return models.Application{}, err
	}

	// BR-09: one open application per email per job. The partial unique
	// index enforces this too; checking first yields a readable error.
	var exists bool
	err = tx.QueryRow(ctx, `
		SELECT true FROM applications
		WHERE job_id = $1 AND email = $2
		  AND status IN ('pending','shortlisted','appointed')`,
		in.JobID, strings.ToLower(strings.TrimSpace(in.Email)),
	).Scan(&exists)
	if err == nil {
		return models.Application{}, fmt.Errorf("%w: you already have an open application for this role", ErrConflict)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return models.Application{}, err
	}

	// Allocate the application number inside the transaction so concurrent
	// submissions cannot collide (BR-03).
	appNumber, err := s.allocateApplicationNumber(ctx, tx, tenantID)
	if err != nil {
		return models.Application{}, err
	}

	var photoID *uuid.UUID
	if in.Photo != nil {
		id, err := insertDocument(ctx, tx, tenantID, "application", uuid.Nil, "photo", in.Photo, in.ApplicantID)
		if err != nil {
			return models.Application{}, err
		}
		photoID = &id
	}

	var (
		rawID string
		app   models.Application
	)
	err = tx.QueryRow(ctx, `
		INSERT INTO applications (
			application_number, tenant_id, job_id, applicant_id,
			first_name, last_name, email, phone, gender, date_of_birth,
			location_id, address_line, qualification, photo_document_id,
			consent_accepted_at, consent_version, status
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now(),$15,'pending')
		RETURNING id, submitted_at`,
		appNumber, tenantID, in.JobID, in.ApplicantID,
		strings.TrimSpace(in.FirstName), strings.TrimSpace(in.LastName),
		strings.ToLower(strings.TrimSpace(in.Email)), strings.TrimSpace(in.Phone),
		in.Gender, in.DateOfBirth, in.LocationID, in.AddressLine,
		in.Qualification, photoID, ConsentNoticeVersion,
	).Scan(&rawID, &app.SubmittedAt)
	if err != nil {
		return models.Application{}, mapWriteError(err)
	}
	applicationID, err := uuid.Parse(rawID)
	if err != nil {
		return models.Application{}, err
	}

	// The photo document row references the application; backfill its owner
	// now that the application exists.
	if photoID != nil {
		if _, err := tx.Exec(ctx, `
			UPDATE documents SET owner_id = $1 WHERE id = $2`,
			applicationID, *photoID,
		); err != nil {
			return models.Application{}, err
		}
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO application_events (application_id, actor_id, from_status, to_status, reason)
		VALUES ($1,$2,NULL,'pending','Application submitted')`,
		applicationID, in.ApplicantID,
	); err != nil {
		return models.Application{}, err
	}

	if err := insertAudit(ctx, tx, tenantID, &in.ApplicantID,
		"application.submitted", "application", applicationID,
		nil, map[string]any{"application_number": appNumber, "job_id": in.JobID},
	); err != nil {
		return models.Application{}, err
	}

	applicantName := strings.TrimSpace(in.FirstName + " " + in.LastName)
	if err := EnqueueNotification(ctx, tx, tenantID, &in.ApplicantID, in.Email,
		"application_received", map[string]any{
			"applicant_name":     applicantName,
			"first_name":         in.FirstName,
			"job_title":          jobTitle,
			"application_number": appNumber,
		},
	); err != nil {
		return models.Application{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.Application{}, err
	}
	return s.GetApplication(ctx, &tenantID, applicationID)
}

// allocateApplicationNumber returns the next APP/{STATE}/{YEAR}/{0001} for
// the tenant, seeded above any number imported outside the API.
func (s *Store) allocateApplicationNumber(ctx context.Context, tx pgx.Tx, tenantID uuid.UUID) (string, error) {
	var stateCode string
	err := tx.QueryRow(ctx, `
		SELECT COALESCE(NULLIF(l.code, ''), NULLIF(l.slug, ''), 'NG')
		FROM tenants t
		LEFT JOIN locations l ON l.id = t.state_location_id
		WHERE t.id = $1`, tenantID).Scan(&stateCode)
	if err != nil {
		return "", err
	}
	stateCode = strings.ToUpper(stateCode)
	year := time.Now().Year()

	startAt := 1
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(MAX((regexp_match(application_number, '/([0-9]+)$'))[1]::int), 0) + 1
		FROM applications
		WHERE tenant_id = $1 AND application_number LIKE $2`,
		tenantID, fmt.Sprintf("APP/%s/%d/%%", stateCode, year),
	).Scan(&startAt); err != nil {
		return "", err
	}

	seq, err := sequence.New(s.pool).Next(
		ctx, tx, sequence.ScopeApplications, tenantID.String(), year, "APP", stateCode, startAt,
	)
	if err != nil {
		return "", err
	}
	return codes.FormatApplicationNumber(stateCode, year, seq), nil
}

// insertDocument writes a documents row. ownerID may be uuid.Nil when the
// owning row does not exist yet; the caller backfills it in the same
// transaction.
func insertDocument(
	ctx context.Context,
	tx pgx.Tx,
	tenantID uuid.UUID,
	ownerType string,
	ownerID uuid.UUID,
	category string,
	in *DocumentInput,
	uploadedBy uuid.UUID,
) (uuid.UUID, error) {
	var rawID string
	err := tx.QueryRow(ctx, `
		INSERT INTO documents (
			tenant_id, owner_type, owner_id, category, file_name,
			storage_key, mime_type, size_bytes, uploaded_by
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id`,
		tenantID, ownerType, ownerID, category, in.FileName,
		in.StorageKey, in.MimeType, in.SizeBytes, uploadedBy,
	).Scan(&rawID)
	if err != nil {
		return uuid.Nil, mapWriteError(err)
	}
	id, err := uuid.Parse(rawID)
	if err != nil {
		return uuid.Nil, err
	}
	return id, nil
}

// MyApplications lists the signed-in applicant's own applications.
func (s *Store) MyApplications(ctx context.Context, applicantID uuid.UUID) ([]models.Application, error) {
	const q = `SELECT ` + applicationColumns + `
		FROM applications a
		JOIN jobs j ON j.id = a.job_id
		LEFT JOIN locations l ON l.id = a.location_id
		LEFT JOIN documents d ON d.id = a.cv_document_id
		WHERE a.applicant_id = $1
		ORDER BY a.submitted_at DESC`

	rows, err := s.pool.Query(ctx, q, applicantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.Application, 0)
	for rows.Next() {
		application, err := scanApplication(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, application)
	}
	return items, rows.Err()
}

// applicationColumns mirrors the select list inside GetApplication so the
// /me reads share one shape with the admin read.
const applicationColumns = `
	a.id, a.application_number, a.tenant_id, a.job_id, a.applicant_id,
	a.first_name, a.last_name, a.email, a.phone, a.gender,
	a.date_of_birth, a.location_id, a.address_line, a.qualification,
	a.cv_document_id, a.photo_document_id, a.status,
	a.submitted_at, a.updated_at,
	j.title AS job_title, j.slug AS job_slug,
	l.name AS location_name, d.file_name AS cv_file_name
`

// GetMyApplication loads one application owned by the applicant. A record
// belonging to someone else is not-found, never forbidden (BR-15).
func (s *Store) GetMyApplication(ctx context.Context, applicantID, id uuid.UUID) (models.Application, error) {
	const q = `SELECT ` + applicationColumns + `
		FROM applications a
		JOIN jobs j ON j.id = a.job_id
		LEFT JOIN locations l ON l.id = a.location_id
		LEFT JOIN documents d ON d.id = a.cv_document_id
		WHERE a.id = $1 AND a.applicant_id = $2`

	application, err := scanApplication(s.pool.QueryRow(ctx, q, id, applicantID))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Application{}, ErrNotFound
	}
	return application, err
}

// UpdateMyApplication applies an applicant edit while the application is
// still pending (BR-10). It returns ErrInvalidTransition once shortlisted.
func (s *Store) UpdateMyApplication(
	ctx context.Context,
	applicantID, id uuid.UUID,
	in ApplicationUpdate,
) (models.Application, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.Application{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		status      models.ApplicationStatus
		rawTenantID string
		currentPhoto *uuid.UUID
	)
	err = tx.QueryRow(ctx, `
		SELECT status, tenant_id, photo_document_id FROM applications
		WHERE id = $1 AND applicant_id = $2
		FOR UPDATE`,
		id, applicantID,
	).Scan(&status, &rawTenantID, &currentPhoto)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Application{}, ErrNotFound
	}
	if err != nil {
		return models.Application{}, err
	}
	if status != models.ApplicationPending {
		return models.Application{}, fmt.Errorf("%w: this application can no longer be edited", ErrInvalidTransition)
	}
	tenantID, err := uuid.Parse(rawTenantID)
	if err != nil {
		return models.Application{}, err
	}

	set := make([]string, 0, 10)
	args := make([]any, 0, 12)
	add := func(column string, value any) {
		args = append(args, value)
		set = append(set, fmt.Sprintf("%s = $%d", column, len(args)))
	}
	if in.FirstName != nil {
		add("first_name", strings.TrimSpace(*in.FirstName))
	}
	if in.LastName != nil {
		add("last_name", strings.TrimSpace(*in.LastName))
	}
	if in.Phone != nil {
		add("phone", strings.TrimSpace(*in.Phone))
	}
	if in.Gender != nil {
		add("gender", *in.Gender)
	}
	if in.DateOfBirth != nil {
		add("date_of_birth", *in.DateOfBirth)
	}
	if in.LocationID != nil {
		add("location_id", *in.LocationID)
	}
	if in.AddressLine != nil {
		add("address_line", *in.AddressLine)
	}
	if in.Qualification != nil {
		add("qualification", *in.Qualification)
	}

	if in.Photo != nil {
		photoID, err := insertDocument(ctx, tx, tenantID, "application", id, "photo", in.Photo, applicantID)
		if err != nil {
			return models.Application{}, err
		}
		add("photo_document_id", photoID)
	}

	if len(set) > 0 {
		add("updated_at", time.Now())
		sql := fmt.Sprintf(`UPDATE applications SET %s WHERE id = $%d`,
			strings.Join(set, ", "), len(args))
		if _, err := tx.Exec(ctx, sql, args...); err != nil {
			return models.Application{}, mapWriteError(err)
		}
	}

	if err := insertAudit(ctx, tx, tenantID, &applicantID,
		"application.updated_by_applicant", "application", id,
		nil, map[string]any{"edited": len(set)},
	); err != nil {
		return models.Application{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.Application{}, err
	}
	return s.GetApplication(ctx, &tenantID, id)
}

// WithdrawApplication lets an applicant pull out of a pending or
// shortlisted application. The transition and the event follow the state
// machine in README §4.5.
func (s *Store) WithdrawApplication(ctx context.Context, applicantID, id uuid.UUID, reason *string) (models.Application, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.Application{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		status      models.ApplicationStatus
		rawTenantID string
	)
	err = tx.QueryRow(ctx, `
		SELECT status, tenant_id FROM applications
		WHERE id = $1 AND applicant_id = $2
		FOR UPDATE`,
		id, applicantID,
	).Scan(&status, &rawTenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Application{}, ErrNotFound
	}
	if err != nil {
		return models.Application{}, err
	}
	if status == models.ApplicationWithdrawn {
		return models.Application{}, fmt.Errorf("%w: this application is already withdrawn", ErrInvalidTransition)
	}
	if status != models.ApplicationPending && status != models.ApplicationShortlisted {
		return models.Application{}, fmt.Errorf("%w: this application can no longer be withdrawn", ErrInvalidTransition)
	}
	tenantID, err := uuid.Parse(rawTenantID)
	if err != nil {
		return models.Application{}, err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE applications SET status = 'withdrawn', updated_at = now() WHERE id = $1`,
		id,
	); err != nil {
		return models.Application{}, err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO application_events (application_id, actor_id, from_status, to_status, reason)
		VALUES ($1,$2,$3,'withdrawn',$4)`,
		id, applicantID, status, reason,
	); err != nil {
		return models.Application{}, err
	}
	if err := insertAudit(ctx, tx, tenantID, &applicantID,
		"application.withdrawn", "application", id,
		map[string]any{"status": status},
		map[string]any{"status": models.ApplicationWithdrawn},
	); err != nil {
		return models.Application{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.Application{}, err
	}
	return s.GetApplication(ctx, &tenantID, id)
}

// MyShortlistMessage returns the confirmation message for an application the
// applicant owns, but ONLY while an active shortlist stands (BR-08). A
// pending, rejected, withdrawn or shortlist-revoked application yields
// ErrNotFound so the message is never disclosed.
func (s *Store) MyShortlistMessage(ctx context.Context, applicantID, applicationID uuid.UUID) (models.Shortlist, error) {
	const q = `
		SELECT
			s.id, s.application_id, s.job_id, s.message, s.message_template_id,
			s.status, s.created_by, s.created_at, s.revoked_at,
			trim(both ' ' FROM a.first_name || ' ' || a.last_name) AS applicant_name,
			j.title AS job_title
		FROM shortlists s
		JOIN applications a ON a.id = s.application_id
		JOIN jobs j ON j.id = s.job_id
		WHERE s.application_id = $1
		  AND a.applicant_id = $2
		  AND s.status = 'active'
		  AND a.status IN ('shortlisted','appointed')
		ORDER BY s.created_at DESC
		LIMIT 1`

	shortlist, err := scanShortlist(s.pool.QueryRow(ctx, q, applicationID, applicantID))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Shortlist{}, ErrNotFound
	}
	return shortlist, err
}

// MyInterviews returns published announcements the applicant is entitled to
// see (README §M6): their job's interviews, plus anything addressed to all
// applicants. shortlisted_only reaches only actually-shortlisted candidates.
func (s *Store) MyInterviews(ctx context.Context, applicantID uuid.UUID) ([]models.InterviewAnnouncement, error) {
	const q = `
		SELECT
			i.id, i.tenant_id, i.job_id, i.interview_at, i.venue,
			i.instructions, i.audience, i.status, i.created_by, i.created_at,
			j.title AS job_title
		FROM interview_announcements i
		JOIN jobs j ON j.id = i.job_id
		WHERE i.status = 'published'
		  AND (
			i.audience = 'all_applicants'
			OR (
				i.audience = 'job_applicants'
				AND EXISTS (
					SELECT 1 FROM applications a
					WHERE a.job_id = i.job_id AND a.applicant_id = $1
					  AND a.status <> 'withdrawn'
				)
			)
			OR (
				i.audience = 'shortlisted_only'
				AND EXISTS (
					SELECT 1 FROM applications a
					WHERE a.job_id = i.job_id AND a.applicant_id = $1
					  AND a.status IN ('shortlisted','appointed')
				)
			)
		  )
		ORDER BY i.interview_at DESC`

	rows, err := s.pool.Query(ctx, q, applicantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.InterviewAnnouncement, 0)
	for rows.Next() {
		var (
			interview               models.InterviewAnnouncement
			rawID, rawTenantID      string
			rawJobID                string
			rawAudience, rawStatus  string
			rawCreatedBy            *string
		)
		if err := rows.Scan(
			&rawID, &rawTenantID, &rawJobID, &interview.InterviewAt,
			&interview.Venue, &interview.Instructions, &rawAudience,
			&rawStatus, &rawCreatedBy, &interview.CreatedAt, &interview.JobTitle,
		); err != nil {
			return nil, err
		}
		if interview.ID, err = uuid.Parse(rawID); err != nil {
			return nil, err
		}
		if interview.TenantID, err = uuid.Parse(rawTenantID); err != nil {
			return nil, err
		}
		if interview.JobID, err = uuid.Parse(rawJobID); err != nil {
			return nil, err
		}
		interview.Audience = models.InterviewAudience(rawAudience)
		interview.Status = models.InterviewStatus(rawStatus)
		if interview.CreatedBy, err = optionalUUID(rawCreatedBy); err != nil {
			return nil, err
		}
		items = append(items, interview)
	}
	return items, rows.Err()
}
