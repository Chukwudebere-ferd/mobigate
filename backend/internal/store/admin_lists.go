package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/mobigate/mgm-portal/internal/models"
)

// ApplicationQuery describes the admin application list request. Values are
// supplied by the HTTP layer after validation; the store still parameterises
// every user-controlled value.
type ApplicationQuery struct {
	TenantID   *uuid.UUID
	Page       int
	PerPage    int
	Search     string
	Status     string
	JobID      *uuid.UUID
	LocationID *uuid.UUID
	DateFrom   *time.Time
	DateTo     *time.Time
	Sort       string
	Order      string
}

// PaginatedApplications is the wire shape for GET /admin/applications.
type PaginatedApplications struct {
	Items      []models.Application `json:"items"`
	Total      int                  `json:"total"`
	Page       int                  `json:"page"`
	PerPage    int                  `json:"per_page"`
	TotalPages int                  `json:"total_pages"`
}

// ListApplications returns a tenant-scoped, filtered page of applications.
func (s *Store) ListApplications(ctx context.Context, q ApplicationQuery) (PaginatedApplications, error) {
	if q.Page < 1 {
		q.Page = 1
	}
	if q.PerPage < 1 || q.PerPage > 100 {
		q.PerPage = 20
	}

	args := []any{q.TenantID}
	where := []string{"($1::uuid IS NULL OR a.tenant_id = $1)"}

	addArg := func(value any) string {
		args = append(args, value)
		return fmt.Sprintf("$%d", len(args))
	}

	if q.Status != "" {
		p := addArg(q.Status)
		where = append(where, "a.status = "+p)
	}
	if q.JobID != nil {
		p := addArg(*q.JobID)
		where = append(where, "a.job_id = "+p)
	}
	if q.LocationID != nil {
		p := addArg(*q.LocationID)
		where = append(where, fmt.Sprintf(`
			a.location_id IN (
				WITH RECURSIVE subtree AS (
					SELECT id FROM locations WHERE id = %s
					UNION ALL
					SELECT l.id
					FROM locations l
					JOIN subtree s ON l.parent_id = s.id
				)
				SELECT id FROM subtree
			)`, p))
	}
	if q.Search != "" {
		p := addArg("%" + q.Search + "%")
		where = append(where, fmt.Sprintf(
			`(a.first_name ILIKE %s OR a.last_name ILIKE %s
			  OR a.email::text ILIKE %s OR a.application_number ILIKE %s)`,
			p, p, p, p,
		))
	}
	if q.DateFrom != nil {
		p := addArg(*q.DateFrom)
		where = append(where, "a.submitted_at >= "+p)
	}
	if q.DateTo != nil {
		p := addArg(*q.DateTo)
		where = append(where, "a.submitted_at < "+p)
	}

	whereSQL := strings.Join(where, " AND ")

	countSQL := `
		SELECT count(*)::int
		FROM applications a
		JOIN jobs j ON j.id = a.job_id
		WHERE ` + whereSQL

	var total int
	if err := s.pool.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return PaginatedApplications{}, err
	}

	orderColumn := "a.submitted_at"
	switch q.Sort {
	case "status":
		orderColumn = "a.status"
	case "job":
		orderColumn = "j.title"
	}
	orderDirection := "DESC"
	if strings.EqualFold(q.Order, "asc") {
		orderDirection = "ASC"
	}

	offset := (q.Page - 1) * q.PerPage
	limitParam := addArg(q.PerPage)
	offsetParam := addArg(offset)

	dataSQL := `
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
		WHERE ` + whereSQL + `
		ORDER BY ` + orderColumn + ` ` + orderDirection + `, a.id DESC
		LIMIT ` + limitParam + ` OFFSET ` + offsetParam

	rows, err := s.pool.Query(ctx, dataSQL, args...)
	if err != nil {
		return PaginatedApplications{}, err
	}
	defer rows.Close()

	items := make([]models.Application, 0, q.PerPage)
	for rows.Next() {
		application, err := scanApplication(rows)
		if err != nil {
			return PaginatedApplications{}, err
		}
		items = append(items, application)
	}
	if err := rows.Err(); err != nil {
		return PaginatedApplications{}, err
	}

	totalPages := (total + q.PerPage - 1) / q.PerPage
	if totalPages < 1 {
		totalPages = 1
	}

	return PaginatedApplications{
		Items:      items,
		Total:      total,
		Page:       q.Page,
		PerPage:    q.PerPage,
		TotalPages: totalPages,
	}, nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanApplication(row rowScanner) (models.Application, error) {
	var (
		application              models.Application
		rawID, rawTenantID       string
		rawJobID, rawApplicantID string
		rawLocationID            *string
		rawCVDocumentID          *string
		rawPhotoDocumentID       *string
	)

	err := row.Scan(
		&rawID,
		&application.ApplicationNumber,
		&rawTenantID,
		&rawJobID,
		&rawApplicantID,
		&application.FirstName,
		&application.LastName,
		&application.Email,
		&application.Phone,
		&application.Gender,
		&application.DateOfBirth,
		&rawLocationID,
		&application.AddressLine,
		&application.Qualification,
		&rawCVDocumentID,
		&rawPhotoDocumentID,
		&application.Status,
		&application.SubmittedAt,
		&application.UpdatedAt,
		&application.JobTitle,
		&application.JobSlug,
		&application.LocationName,
		&application.CVFileName,
	)
	if err != nil {
		return models.Application{}, err
	}

	if application.ID, err = uuid.Parse(rawID); err != nil {
		return models.Application{}, err
	}
	if application.TenantID, err = uuid.Parse(rawTenantID); err != nil {
		return models.Application{}, err
	}
	if application.JobID, err = uuid.Parse(rawJobID); err != nil {
		return models.Application{}, err
	}
	if application.ApplicantID, err = uuid.Parse(rawApplicantID); err != nil {
		return models.Application{}, err
	}
	if application.LocationID, err = optionalUUID(rawLocationID); err != nil {
		return models.Application{}, err
	}
	if application.CVDocumentID, err = optionalUUID(rawCVDocumentID); err != nil {
		return models.Application{}, err
	}
	if application.PhotoDocumentID, err = optionalUUID(rawPhotoDocumentID); err != nil {
		return models.Application{}, err
	}
	return application, nil
}

func optionalUUID(raw *string) (*uuid.UUID, error) {
	if raw == nil {
		return nil, nil
	}
	parsed, err := uuid.Parse(*raw)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

// ListAuditLogs returns the most recent audit entries in the tenant scope.
func (s *Store) ListAuditLogs(ctx context.Context, tenantID *uuid.UUID, limit int) ([]models.AuditLog, error) {
	if limit < 1 || limit > 100 {
		limit = 50
	}

	const q = `
		SELECT
			al.id, al.tenant_id, al.actor_id, al.action, al.entity_type,
			al.entity_id, al.before_data, al.after_data,
			host(al.ip_address) AS ip_address, al.user_agent, al.created_at,
			CASE
				WHEN u.id IS NULL THEN NULL
				ELSE trim(both ' ' FROM u.first_name || ' ' || u.last_name)
			END AS actor_name
		FROM audit_logs al
		LEFT JOIN users u ON u.id = al.actor_id
		WHERE ($1::uuid IS NULL OR al.tenant_id = $1)
		ORDER BY al.created_at DESC
		LIMIT $2
	`

	rows, err := s.pool.Query(ctx, q, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.AuditLog, 0, limit)
	for rows.Next() {
		var (
			log                     models.AuditLog
			rawID, rawTenantID      *string
			rawActorID, rawEntityID *string
		)
		if err := rows.Scan(
			&rawID,
			&rawTenantID,
			&rawActorID,
			&log.Action,
			&log.EntityType,
			&rawEntityID,
			&log.BeforeData,
			&log.AfterData,
			&log.IPAddress,
			&log.UserAgent,
			&log.CreatedAt,
			&log.ActorName,
		); err != nil {
			return nil, err
		}

		if rawID != nil {
			if log.ID, err = uuid.Parse(*rawID); err != nil {
				return nil, err
			}
		}
		if log.TenantID, err = optionalUUID(rawTenantID); err != nil {
			return nil, err
		}
		if log.ActorID, err = optionalUUID(rawActorID); err != nil {
			return nil, err
		}
		if log.EntityID, err = optionalUUID(rawEntityID); err != nil {
			return nil, err
		}
		items = append(items, log)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

// ListInterviews returns interviews in the tenant scope, with the job title
// and audience-specific applicant count used by the dashboard.
func (s *Store) ListInterviews(ctx context.Context, tenantID *uuid.UUID) ([]models.InterviewAnnouncement, error) {
	const q = `
		SELECT
			i.id, i.tenant_id, i.job_id, i.interview_at, i.venue,
			i.instructions, i.audience, i.status, i.created_by, i.created_at,
			j.title AS job_title,
			(
				SELECT count(*)::int
				FROM applications a
				WHERE a.job_id = i.job_id
				  AND (
					i.audience = 'all_applicants'
					OR (i.audience = 'shortlisted_only'
						AND a.status IN ('shortlisted', 'appointed'))
					OR (i.audience = 'job_applicants'
						AND a.status <> 'withdrawn')
				  )
			) AS applicant_count
		FROM interview_announcements i
		JOIN jobs j ON j.id = i.job_id
		WHERE ($1::uuid IS NULL OR i.tenant_id = $1)
		ORDER BY i.interview_at ASC
	`

	rows, err := s.pool.Query(ctx, q, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.InterviewAnnouncement, 0)
	for rows.Next() {
		var (
			interview                    models.InterviewAnnouncement
			rawID, rawTenantID, rawJobID string
			rawCreatedBy                 *string
		)
		if err := rows.Scan(
			&rawID,
			&rawTenantID,
			&rawJobID,
			&interview.InterviewAt,
			&interview.Venue,
			&interview.Instructions,
			&interview.Audience,
			&interview.Status,
			&rawCreatedBy,
			&interview.CreatedAt,
			&interview.JobTitle,
			&interview.ApplicantCount,
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
		if interview.CreatedBy, err = optionalUUID(rawCreatedBy); err != nil {
			return nil, err
		}
		items = append(items, interview)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}
