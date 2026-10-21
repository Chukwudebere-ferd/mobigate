package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/mobigate/mgm-portal/internal/models"
)

// JobInput carries a create or partial update. Set* flags distinguish "leave
// unchanged" from "clear this optional field" on PATCH.
type JobInput struct {
	Title              *string
	Slug               *string
	Description        *string
	Requirements       *string
	SetRequirements    bool
	LocationID         *uuid.UUID
	SetLocation        bool
	EmploymentCategory *models.EmploymentCategory
	SetCategory        bool
	Openings           *int
	PublishAt          *time.Time
	SetPublishAt       bool
	DeadlineAt         *time.Time
	SetDeadlineAt      bool
	Status             *models.JobStatus
}

const jobColumns = `
	j.id, j.tenant_id, j.title, j.slug, j.description, j.requirements,
	j.location_id, j.employment_category, j.openings, j.publish_at,
	j.deadline_at, j.status, j.created_by, j.created_at,
	(
		SELECT count(*)::int FROM applications a WHERE a.job_id = j.id
	) AS applications_count,
	l.name AS location_name
`

type queryer interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// ListJobs returns jobs in the tenant scope with derived display fields.
func (s *Store) ListJobs(ctx context.Context, tenantID *uuid.UUID) ([]models.Job, error) {
	q := `SELECT ` + jobColumns + `
		FROM jobs j
		LEFT JOIN locations l ON l.id = j.location_id
		WHERE ($1::uuid IS NULL OR j.tenant_id = $1)
		ORDER BY j.created_at DESC`

	rows, err := s.pool.Query(ctx, q, tenantID)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

// GetJob loads one job in the tenant scope.
func (s *Store) GetJob(ctx context.Context, tenantID *uuid.UUID, id uuid.UUID) (models.Job, error) {
	return jobByID(ctx, s.pool, tenantID, id)
}

func jobByID(ctx context.Context, q queryer, tenantID *uuid.UUID, id uuid.UUID) (models.Job, error) {
	sql := `SELECT ` + jobColumns + `
		FROM jobs j
		LEFT JOIN locations l ON l.id = j.location_id
		WHERE j.id = $1 AND ($2::uuid IS NULL OR j.tenant_id = $2)`

	job, err := scanJob(q.QueryRow(ctx, sql, id, tenantID))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Job{}, ErrNotFound
	}
	return job, err
}

// CreateJob inserts a posting and records an audit entry.
func (s *Store) CreateJob(
	ctx context.Context,
	tenantID uuid.UUID,
	actorID *uuid.UUID,
	in JobInput,
) (models.Job, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.Job{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var rawID string
	err = tx.QueryRow(ctx, `
		INSERT INTO jobs (
			tenant_id, title, slug, description, requirements, location_id,
			employment_category, openings, publish_at, deadline_at, status,
			created_by
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING id`,
		tenantID, derefString(in.Title), derefString(in.Slug),
		derefString(in.Description), in.Requirements, in.LocationID,
		in.EmploymentCategory, derefInt(in.Openings, 1), in.PublishAt,
		in.DeadlineAt, derefStatus(in.Status), actorID,
	).Scan(&rawID)
	if err != nil {
		return models.Job{}, mapWriteError(err)
	}
	id, err := uuid.Parse(rawID)
	if err != nil {
		return models.Job{}, err
	}

	if err := insertAudit(ctx, tx, tenantID, actorID, "job.created", "job", id, nil, in); err != nil {
		return models.Job{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.Job{}, err
	}
	return s.GetJob(ctx, &tenantID, id)
}

// UpdateJob applies the supplied fields and records an audit entry.
func (s *Store) UpdateJob(
	ctx context.Context,
	tenantID *uuid.UUID,
	actorID *uuid.UUID,
	id uuid.UUID,
	in JobInput,
) (models.Job, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.Job{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	before, err := jobByID(ctx, tx, tenantID, id)
	if err != nil {
		return models.Job{}, err
	}

	set := make([]string, 0, 12)
	args := make([]any, 0, 14)
	add := func(column string, value any) {
		args = append(args, value)
		set = append(set, fmt.Sprintf("%s = $%d", column, len(args)))
	}

	if in.Title != nil {
		add("title", *in.Title)
	}
	if in.Slug != nil {
		add("slug", *in.Slug)
	}
	if in.Description != nil {
		add("description", *in.Description)
	}
	if in.SetRequirements {
		add("requirements", in.Requirements)
	}
	if in.SetLocation {
		add("location_id", in.LocationID)
	}
	if in.SetCategory {
		add("employment_category", in.EmploymentCategory)
	}
	if in.Openings != nil {
		add("openings", *in.Openings)
	}
	if in.SetPublishAt {
		add("publish_at", in.PublishAt)
	}
	if in.SetDeadlineAt {
		add("deadline_at", in.DeadlineAt)
	}
	if in.Status != nil {
		add("status", *in.Status)
	}

	if len(set) == 0 {
		if err := tx.Commit(ctx); err != nil {
			return models.Job{}, err
		}
		return before, nil
	}

	args = append(args, id)
	idParam := len(args)
	args = append(args, tenantID)
	tenantParam := len(args)

	sql := fmt.Sprintf(
		`UPDATE jobs SET %s WHERE id = $%d AND ($%d::uuid IS NULL OR tenant_id = $%d)`,
		strings.Join(set, ", "), idParam, tenantParam, tenantParam,
	)
	if _, err := tx.Exec(ctx, sql, args...); err != nil {
		return models.Job{}, mapWriteError(err)
	}

	after, err := jobByID(ctx, tx, tenantID, id)
	if err != nil {
		return models.Job{}, err
	}
	if err := insertAudit(ctx, tx, after.TenantID, actorID, "job.updated", "job", id, before, after); err != nil {
		return models.Job{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.Job{}, err
	}
	return after, nil
}

// GetApplication loads one application in the tenant scope. Cross-tenant
// reads surface as ErrNotFound (BR-15).
func (s *Store) GetApplication(
	ctx context.Context,
	tenantID *uuid.UUID,
	id uuid.UUID,
) (models.Application, error) {
	const q = `
		SELECT
			a.id, a.application_number, a.tenant_id, a.job_id, a.applicant_id,
			a.first_name, a.last_name, a.email, a.phone, a.gender,
			a.date_of_birth, a.location_id, a.address_line, a.qualification,
			a.cv_document_id, a.photo_document_id, a.status,
			a.submitted_at, a.updated_at,
			j.title AS job_title, j.slug AS job_slug,
			l.name AS location_name, d.file_name AS cv_file_name
		FROM applications a
		JOIN jobs j ON j.id = a.job_id
		LEFT JOIN locations l ON l.id = a.location_id
		LEFT JOIN documents d ON d.id = a.cv_document_id
		WHERE a.id = $1 AND ($2::uuid IS NULL OR a.tenant_id = $2)`

	application, err := scanApplication(s.pool.QueryRow(ctx, q, id, tenantID))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Application{}, ErrNotFound
	}
	return application, err
}

// ListApplicationEvents returns the status timeline for one application.
func (s *Store) ListApplicationEvents(
	ctx context.Context,
	tenantID *uuid.UUID,
	applicationID uuid.UUID,
) ([]models.ApplicationEvent, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `
		SELECT true FROM applications
		WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2)`,
		applicationID, tenantID,
	).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	const q = `
		SELECT
			e.id, e.application_id, e.actor_id, e.from_status, e.to_status,
			e.reason, e.created_at,
			CASE
				WHEN u.id IS NULL THEN NULL
				ELSE trim(both ' ' FROM u.first_name || ' ' || u.last_name)
			END AS actor_name
		FROM application_events e
		JOIN applications a ON a.id = e.application_id
		LEFT JOIN users u ON u.id = e.actor_id
		WHERE e.application_id = $1
		  AND ($2::uuid IS NULL OR a.tenant_id = $2)
		ORDER BY e.created_at DESC`

	rows, err := s.pool.Query(ctx, q, applicationID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.ApplicationEvent, 0)
	for rows.Next() {
		var (
			event                   models.ApplicationEvent
			rawID, rawApplicationID string
			rawActorID              *string
		)
		if err := rows.Scan(
			&rawID, &rawApplicationID, &rawActorID, &event.FromStatus,
			&event.ToStatus, &event.Reason, &event.CreatedAt, &event.ActorName,
		); err != nil {
			return nil, err
		}
		if event.ID, err = uuid.Parse(rawID); err != nil {
			return nil, err
		}
		if event.ApplicationID, err = uuid.Parse(rawApplicationID); err != nil {
			return nil, err
		}
		if event.ActorID, err = optionalUUID(rawActorID); err != nil {
			return nil, err
		}
		items = append(items, event)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

// SetApplicationStatus performs a guarded status transition, writes the
// timeline event and the audit entry in one transaction.
func (s *Store) SetApplicationStatus(
	ctx context.Context,
	tenantID *uuid.UUID,
	actorID *uuid.UUID,
	id uuid.UUID,
	status models.ApplicationStatus,
	reason *string,
) (models.Application, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.Application{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		current     models.ApplicationStatus
		rawTenantID string
	)
	err = tx.QueryRow(ctx, `
		SELECT status, tenant_id FROM applications
		WHERE id = $1 AND ($2::uuid IS NULL OR tenant_id = $2)
		FOR UPDATE`,
		id, tenantID,
	).Scan(&current, &rawTenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Application{}, ErrNotFound
	}
	if err != nil {
		return models.Application{}, err
	}
	applicationTenant, err := uuid.Parse(rawTenantID)
	if err != nil {
		return models.Application{}, err
	}

	if current != status {
		if !canTransition(current, status) {
			return models.Application{}, ErrInvalidTransition
		}
		if _, err := tx.Exec(ctx, `
			UPDATE applications SET status = $1, updated_at = now() WHERE id = $2`,
			status, id,
		); err != nil {
			return models.Application{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO application_events (
				application_id, actor_id, from_status, to_status, reason
			) VALUES ($1,$2,$3,$4,$5)`,
			id, actorID, current, status, reason,
		); err != nil {
			return models.Application{}, err
		}
	}

	action := "application.status_changed"
	if err := insertAudit(ctx, tx, applicationTenant, actorID, action, "application", id,
		map[string]any{"status": current},
		map[string]any{"status": status, "reason": reason},
	); err != nil {
		return models.Application{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return models.Application{}, err
	}
	return s.GetApplication(ctx, tenantID, id)
}

func canTransition(from, to models.ApplicationStatus) bool {
	if from == to {
		return true
	}
	switch from {
	case models.ApplicationPending:
		return to == models.ApplicationShortlisted ||
			to == models.ApplicationRejected ||
			to == models.ApplicationAppointed ||
			to == models.ApplicationWithdrawn
	case models.ApplicationShortlisted:
		return to == models.ApplicationAppointed ||
			to == models.ApplicationRejected ||
			to == models.ApplicationWithdrawn
	default:
		return false
	}
}

// CreateShortlists shortlists a set of applications for one job. Each
// application gets its own confirmation message copy (BR-07/BR-08).
func (s *Store) CreateShortlists(
	ctx context.Context,
	tenantID *uuid.UUID,
	actorID *uuid.UUID,
	applicationIDs []uuid.UUID,
	message string,
	jobID uuid.UUID,
) ([]models.Shortlist, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	created := make([]models.Shortlist, 0, len(applicationIDs))
	for _, applicationID := range applicationIDs {
		var (
			rawTenantID, rawJobID, rawApplicantID string
			status                                models.ApplicationStatus
			firstName, lastName, email            string
			jobTitle                              string
		)
		err := tx.QueryRow(ctx, `
			SELECT a.tenant_id, a.job_id, a.applicant_id, a.status,
			       a.first_name, a.last_name, a.email, j.title
			FROM applications a
			JOIN jobs j ON j.id = a.job_id
			WHERE a.id = $1 AND ($2::uuid IS NULL OR a.tenant_id = $2)
			FOR UPDATE`,
			applicationID, tenantID,
		).Scan(&rawTenantID, &rawJobID, &rawApplicantID, &status,
			&firstName, &lastName, &email, &jobTitle)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		if err != nil {
			return nil, err
		}
		applicationTenant, err := uuid.Parse(rawTenantID)
		if err != nil {
			return nil, err
		}
		applicationJob, err := uuid.Parse(rawJobID)
		if err != nil {
			return nil, err
		}
		applicantID, err := uuid.Parse(rawApplicantID)
		if err != nil {
			return nil, err
		}
		if applicationJob != jobID {
			return nil, fmt.Errorf("%w: application and shortlist job do not match", ErrValidation)
		}
		if status != models.ApplicationPending && status != models.ApplicationShortlisted {
			return nil, ErrInvalidTransition
		}

		var exists bool
		err = tx.QueryRow(ctx, `
			SELECT true FROM shortlists
			WHERE application_id = $1 AND status = 'active' LIMIT 1`,
			applicationID,
		).Scan(&exists)
		if err == nil {
			return nil, fmt.Errorf("%w: application already has an active shortlist", ErrConflict)
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}

		var (
			rawShortlistID string
			createdAt      time.Time
		)
		err = tx.QueryRow(ctx, `
			INSERT INTO shortlists (
				application_id, job_id, message, created_by
			) VALUES ($1,$2,$3,$4)
			RETURNING id, created_at`,
			applicationID, jobID, message, actorID,
		).Scan(&rawShortlistID, &createdAt)
		if err != nil {
			return nil, mapWriteError(err)
		}
		shortlistID, err := uuid.Parse(rawShortlistID)
		if err != nil {
			return nil, err
		}

		if _, err := tx.Exec(ctx, `
			INSERT INTO notifications (
				tenant_id, recipient_user_id, recipient_contact, channel,
				template_key, payload, status
			) VALUES ($1,$2,$3,'email','shortlist_confirmation',$4,'pending')`,
			applicationTenant, applicantID, email, map[string]any{
				"first_name": firstName,
				"job_title":  jobTitle,
				"message":    message,
			},
		); err != nil {
			return nil, err
		}

		if status != models.ApplicationShortlisted {
			if _, err := tx.Exec(ctx, `
				UPDATE applications SET status = 'shortlisted', updated_at = now()
				WHERE id = $1`, applicationID,
			); err != nil {
				return nil, err
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO application_events (
					application_id, actor_id, from_status, to_status, reason
				) VALUES ($1,$2,$3,$4,$5)`,
				applicationID, actorID, status, models.ApplicationShortlisted,
				"Shortlisted by admin",
			); err != nil {
				return nil, err
			}
		}

		if err := insertAudit(ctx, tx, applicationTenant, actorID,
			"application.shortlisted", "application", applicationID,
			map[string]any{"status": status},
			map[string]any{"status": models.ApplicationShortlisted, "shortlist_id": shortlistID},
		); err != nil {
			return nil, err
		}

		applicantName := strings.TrimSpace(firstName + " " + lastName)
		title := jobTitle
		created = append(created, models.Shortlist{
			ID:            shortlistID,
			ApplicationID: applicationID,
			JobID:         jobID,
			Message:       message,
			Status:        "active",
			CreatedBy:     actorID,
			CreatedAt:     createdAt,
			ApplicantName: &applicantName,
			JobTitle:      &title,
		})
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return created, nil
}

// ListShortlists returns shortlists in the tenant scope, newest first.
func (s *Store) ListShortlists(ctx context.Context, tenantID *uuid.UUID) ([]models.Shortlist, error) {
	const q = `
		SELECT
			s.id, s.application_id, s.job_id, s.message, s.message_template_id,
			s.status, s.created_by, s.created_at, s.revoked_at,
			trim(both ' ' FROM a.first_name || ' ' || a.last_name) AS applicant_name,
			j.title AS job_title
		FROM shortlists s
		JOIN applications a ON a.id = s.application_id
		JOIN jobs j ON j.id = s.job_id
		WHERE ($1::uuid IS NULL OR a.tenant_id = $1)
		ORDER BY s.created_at DESC`

	rows, err := s.pool.Query(ctx, q, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.Shortlist, 0)
	for rows.Next() {
		shortlist, err := scanShortlist(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, shortlist)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

// RevokeShortlist marks a shortlist revoked; the application status is left
// intact because the candidate may still be under consideration.
func (s *Store) RevokeShortlist(
	ctx context.Context,
	tenantID *uuid.UUID,
	actorID *uuid.UUID,
	id uuid.UUID,
) (models.Shortlist, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.Shortlist{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		rawTenantID string
		status      string
	)
	err = tx.QueryRow(ctx, `
		SELECT a.tenant_id, s.status
		FROM shortlists s
		JOIN applications a ON a.id = s.application_id
		WHERE s.id = $1 AND ($2::uuid IS NULL OR a.tenant_id = $2)
		FOR UPDATE`,
		id, tenantID,
	).Scan(&rawTenantID, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Shortlist{}, ErrNotFound
	}
	if err != nil {
		return models.Shortlist{}, err
	}
	tenant, err := uuid.Parse(rawTenantID)
	if err != nil {
		return models.Shortlist{}, err
	}

	if status != "revoked" {
		if _, err := tx.Exec(ctx, `
			UPDATE shortlists SET status = 'revoked', revoked_at = now()
			WHERE id = $1`, id,
		); err != nil {
			return models.Shortlist{}, err
		}
		if err := insertAudit(ctx, tx, tenant, actorID,
			"shortlist.revoked", "shortlist", id,
			map[string]any{"status": "active"},
			map[string]any{"status": "revoked"},
		); err != nil {
			return models.Shortlist{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return models.Shortlist{}, err
	}
	return s.GetShortlist(ctx, tenantID, id)
}

// GetShortlist loads one shortlist with display fields.
func (s *Store) GetShortlist(
	ctx context.Context,
	tenantID *uuid.UUID,
	id uuid.UUID,
) (models.Shortlist, error) {
	const q = `
		SELECT
			s.id, s.application_id, s.job_id, s.message, s.message_template_id,
			s.status, s.created_by, s.created_at, s.revoked_at,
			trim(both ' ' FROM a.first_name || ' ' || a.last_name) AS applicant_name,
			j.title AS job_title
		FROM shortlists s
		JOIN applications a ON a.id = s.application_id
		JOIN jobs j ON j.id = s.job_id
		WHERE s.id = $1 AND ($2::uuid IS NULL OR a.tenant_id = $2)`

	shortlist, err := scanShortlist(s.pool.QueryRow(ctx, q, id, tenantID))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.Shortlist{}, ErrNotFound
	}
	return shortlist, err
}

// ListLocations returns global and tenant-owned locations for pickers.
func (s *Store) ListLocations(ctx context.Context, tenantID *uuid.UUID) ([]models.Location, error) {
	const q = `
		SELECT id, tenant_id, parent_id, type, name, code, slug, status, created_at
		FROM locations
		WHERE ($1::uuid IS NULL OR tenant_id IS NULL OR tenant_id = $1)
		ORDER BY
			CASE type
				WHEN 'country' THEN 1 WHEN 'state' THEN 2 WHEN 'lga' THEN 3
				WHEN 'city' THEN 4 ELSE 5
			END,
			name`

	rows, err := s.pool.Query(ctx, q, tenantID)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

// ListTemplates returns global and tenant-owned message templates.
func (s *Store) ListTemplates(ctx context.Context, tenantID *uuid.UUID) ([]models.MessageTemplate, error) {
	const q = `
		SELECT id, tenant_id, key, channel, subject, body, variables, created_at
		FROM message_templates
		WHERE ($1::uuid IS NULL OR tenant_id IS NULL OR tenant_id = $1)
		ORDER BY key, channel`

	rows, err := s.pool.Query(ctx, q, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.MessageTemplate, 0)
	for rows.Next() {
		var (
			template    models.MessageTemplate
			rawID       string
			rawTenantID *string
		)
		if err := rows.Scan(
			&rawID, &rawTenantID, &template.Key, &template.Channel,
			&template.Subject, &template.Body, &template.Variables,
			&template.CreatedAt,
		); err != nil {
			return nil, err
		}
		if template.ID, err = uuid.Parse(rawID); err != nil {
			return nil, err
		}
		if template.TenantID, err = optionalUUID(rawTenantID); err != nil {
			return nil, err
		}
		items = append(items, template)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func scanJob(row rowScanner) (models.Job, error) {
	var (
		job                         models.Job
		rawID, rawTenantID          string
		rawStatus                   string
		rawLocationID, rawCreatedBy *string
		rawCategory                 *string
	)
	err := row.Scan(
		&rawID, &rawTenantID, &job.Title, &job.Slug, &job.Description,
		&job.Requirements, &rawLocationID, &rawCategory, &job.Openings,
		&job.PublishAt, &job.DeadlineAt, &rawStatus, &rawCreatedBy,
		&job.CreatedAt, &job.ApplicationsCount, &job.LocationName,
	)
	if err != nil {
		return models.Job{}, err
	}
	if job.ID, err = uuid.Parse(rawID); err != nil {
		return models.Job{}, err
	}
	if job.TenantID, err = uuid.Parse(rawTenantID); err != nil {
		return models.Job{}, err
	}
	if job.LocationID, err = optionalUUID(rawLocationID); err != nil {
		return models.Job{}, err
	}
	if rawCategory != nil {
		category := models.EmploymentCategory(*rawCategory)
		job.EmploymentCategory = &category
	}
	job.Status = models.JobStatus(rawStatus)
	if job.CreatedBy, err = optionalUUID(rawCreatedBy); err != nil {
		return models.Job{}, err
	}
	return job, nil
}

func scanShortlist(row rowScanner) (models.Shortlist, error) {
	var (
		shortlist                   models.Shortlist
		rawID, rawApplicationID     string
		rawJobID                    string
		rawTemplateID, rawCreatedBy *string
	)
	err := row.Scan(
		&rawID, &rawApplicationID, &rawJobID, &shortlist.Message,
		&rawTemplateID, &shortlist.Status, &rawCreatedBy,
		&shortlist.CreatedAt, &shortlist.RevokedAt,
		&shortlist.ApplicantName, &shortlist.JobTitle,
	)
	if err != nil {
		return models.Shortlist{}, err
	}
	if shortlist.ID, err = uuid.Parse(rawID); err != nil {
		return models.Shortlist{}, err
	}
	if shortlist.ApplicationID, err = uuid.Parse(rawApplicationID); err != nil {
		return models.Shortlist{}, err
	}
	if shortlist.JobID, err = uuid.Parse(rawJobID); err != nil {
		return models.Shortlist{}, err
	}
	if shortlist.MessageTemplateID, err = optionalUUID(rawTemplateID); err != nil {
		return models.Shortlist{}, err
	}
	if shortlist.CreatedBy, err = optionalUUID(rawCreatedBy); err != nil {
		return models.Shortlist{}, err
	}
	return shortlist, nil
}

func insertAudit(
	ctx context.Context,
	tx pgx.Tx,
	tenantID uuid.UUID,
	actorID *uuid.UUID,
	action, entityType string,
	entityID uuid.UUID,
	before, after any,
) error {
	beforeJSON, err := auditJSON(before)
	if err != nil {
		return err
	}
	afterJSON, err := auditJSON(after)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO audit_logs (
			tenant_id, actor_id, action, entity_type, entity_id,
			before_data, after_data
		) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		tenantID, actorID, action, entityType, entityID, beforeJSON, afterJSON,
	)
	return err
}

func auditJSON(value any) ([]byte, error) {
	if value == nil {
		return nil, nil
	}
	return json.Marshal(value)
}

func mapWriteError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return ErrConflict
	}
	return err
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func derefInt(value *int, fallback int) int {
	if value == nil {
		return fallback
	}
	return *value
}

func derefStatus(value *models.JobStatus) models.JobStatus {
	if value == nil {
		return models.JobDraft
	}
	return *value
}
