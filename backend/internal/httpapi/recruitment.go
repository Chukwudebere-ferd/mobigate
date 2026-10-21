package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mobigate/mgm-portal/internal/auth"
	"github.com/mobigate/mgm-portal/internal/models"
	"github.com/mobigate/mgm-portal/internal/store"
)

type jobPayload struct {
	Title              *string `json:"title"`
	Slug               *string `json:"slug"`
	Description        *string `json:"description"`
	Requirements       *string `json:"requirements"`
	LocationID         *string `json:"location_id"`
	EmploymentCategory *string `json:"employment_category"`
	Openings           *int    `json:"openings"`
	PublishAt          *string `json:"publish_at"`
	DeadlineAt         *string `json:"deadline_at"`
	Status             *string `json:"status"`
}

func (h *Handler) listJobsAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	items, err := h.Store.ListJobs(r.Context(), scope)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load jobs")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) saveJob(w http.ResponseWriter, r *http.Request, update bool) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}

	payload, present, err := decodeJobPayload(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	input, err := buildJobInput(payload, present, !update)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	actorID := adminActorID(r)
	if update {
		id, err := uuid.Parse(chi.URLParam(r, "id"))
		if err != nil {
			writeError(w, http.StatusNotFound, "job not found")
			return
		}
		job, err := h.Store.UpdateJob(r.Context(), scope, actorID, id, input)
		if err != nil {
			writeStoreError(w, err, "could not update job")
			return
		}
		writeJSON(w, http.StatusOK, job)
		return
	}

	tenantID := scope
	if tenantID == nil {
		tenantID = adminTenantID(r)
	}
	if tenantID == nil {
		writeError(w, http.StatusForbidden, "account has no tenant scope")
		return
	}
	job, err := h.Store.CreateJob(r.Context(), *tenantID, actorID, input)
	if err != nil {
		writeStoreError(w, err, "could not create job")
		return
	}
	writeJSON(w, http.StatusCreated, job)
}

func decodeJobPayload(r *http.Request) (jobPayload, map[string]bool, error) {
	var payload jobPayload
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		return payload, nil, errors.New("could not read request")
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		return payload, nil, errors.New("invalid JSON body")
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return payload, nil, errors.New("invalid job fields")
	}
	present := make(map[string]bool, len(raw))
	for key := range raw {
		present[key] = true
	}
	return payload, present, nil
}

func buildJobInput(payload jobPayload, present map[string]bool, creating bool) (store.JobInput, error) {
	var input store.JobInput

	title := trimmed(payload.Title)
	slug := trimmed(payload.Slug)
	description := trimmed(payload.Description)

	if creating {
		if title == "" {
			return input, errors.New("title is required")
		}
		if description == "" {
			return input, errors.New("description is required")
		}
		if slug == "" {
			slug = slugify(title)
		}
		input.Title = &title
		input.Description = &description
		input.Slug = &slug
		input.SetRequirements = true
		input.SetLocation = true
		input.SetCategory = true
		input.SetPublishAt = true
		input.SetDeadlineAt = true
		status := models.JobDraft
		input.Status = &status
		openings := 1
		input.Openings = &openings
	} else {
		if present["title"] {
			if title == "" {
				return input, errors.New("title is required")
			}
			input.Title = &title
		}
		if present["description"] {
			if description == "" {
				return input, errors.New("description is required")
			}
			input.Description = &description
		}
		if present["slug"] {
			if slug == "" {
				if title == "" {
					return input, errors.New("slug is required")
				}
				slug = slugify(title)
			}
			input.Slug = &slug
		}
		if present["requirements"] {
			input.SetRequirements = true
			if raw := trimmed(payload.Requirements); raw != "" {
				input.Requirements = &raw
			}
		}
		if present["location_id"] {
			input.SetLocation = true
		}
		if present["employment_category"] {
			input.SetCategory = true
		}
		if present["publish_at"] {
			input.SetPublishAt = true
		}
		if present["deadline_at"] {
			input.SetDeadlineAt = true
		}
	}

	if creating || present["location_id"] {
		if raw := trimmed(payload.LocationID); raw != "" {
			locationID, err := uuid.Parse(raw)
			if err != nil {
				return input, errors.New("invalid location_id")
			}
			input.LocationID = &locationID
		}
	}

	if creating || present["employment_category"] {
		if raw := trimmed(payload.EmploymentCategory); raw != "" {
			category := models.EmploymentCategory(raw)
			switch category {
			case models.CategoryDirector, models.CategoryEmployee,
				models.CategoryContractor, models.CategoryPartner:
				input.EmploymentCategory = &category
			default:
				return input, errors.New("invalid employment_category")
			}
		}
	}

	if (creating || present["openings"]) && payload.Openings != nil {
		if *payload.Openings < 1 {
			return input, errors.New("openings must be at least 1")
		}
		input.Openings = payload.Openings
	}

	if creating || present["status"] {
		raw := trimmed(payload.Status)
		if raw == "" && creating {
			raw = string(models.JobDraft)
		}
		if raw != "" {
			status := models.JobStatus(raw)
			switch status {
			case models.JobDraft, models.JobPublished,
				models.JobClosed, models.JobArchived:
				input.Status = &status
			default:
				return input, errors.New("invalid status")
			}
		}
	}

	if creating || present["publish_at"] {
		publishAt, err := parseOptionalTime(payload.PublishAt)
		if err != nil {
			return input, errors.New("invalid publish_at")
		}
		input.PublishAt = publishAt
	}
	if creating || present["deadline_at"] {
		deadlineAt, err := parseOptionalTime(payload.DeadlineAt)
		if err != nil {
			return input, errors.New("invalid deadline_at")
		}
		input.DeadlineAt = deadlineAt
	}
	if input.PublishAt != nil && input.DeadlineAt != nil &&
		!input.DeadlineAt.After(*input.PublishAt) {
		return input, errors.New("deadline_at must be after publish_at")
	}

	return input, nil
}

func (h *Handler) getApplicationAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "application not found")
		return
	}
	application, err := h.Store.GetApplication(r.Context(), scope, id)
	if err != nil {
		writeStoreError(w, err, "could not load application")
		return
	}
	writeJSON(w, http.StatusOK, application)
}

func (h *Handler) applicationEventsAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "application not found")
		return
	}
	items, err := h.Store.ListApplicationEvents(r.Context(), scope, id)
	if err != nil {
		writeStoreError(w, err, "could not load application events")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) setApplicationStatusAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "application not found")
		return
	}

	var payload struct {
		Status string  `json:"status"`
		Reason *string `json:"reason"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	status := models.ApplicationStatus(strings.TrimSpace(payload.Status))
	switch status {
	case models.ApplicationPending, models.ApplicationShortlisted,
		models.ApplicationRejected, models.ApplicationAppointed,
		models.ApplicationWithdrawn:
	default:
		writeError(w, http.StatusBadRequest, "invalid status")
		return
	}

	reason := ""
	if payload.Reason != nil {
		reason = strings.TrimSpace(*payload.Reason)
	}
	if status == models.ApplicationRejected && reason == "" {
		writeError(w, http.StatusBadRequest, "a rejection reason is required")
		return
	}
	var reasonPtr *string
	if reason != "" {
		reasonPtr = &reason
	}

	application, err := h.Store.SetApplicationStatus(
		r.Context(), scope, adminActorID(r), id, status, reasonPtr,
	)
	if err != nil {
		writeStoreError(w, err, "could not update application")
		return
	}
	writeJSON(w, http.StatusOK, application)
}

func (h *Handler) createShortlistAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}

	var payload struct {
		ApplicationIDs []string `json:"application_ids"`
		Message        string   `json:"message"`
		JobID          string   `json:"job_id"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	message := strings.TrimSpace(payload.Message)
	if message == "" {
		writeError(w, http.StatusBadRequest, "a shortlist message is required")
		return
	}
	if len(payload.ApplicationIDs) == 0 {
		writeError(w, http.StatusBadRequest, "select at least one application")
		return
	}
	jobID, err := uuid.Parse(payload.JobID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid job_id")
		return
	}
	applicationIDs := make([]uuid.UUID, 0, len(payload.ApplicationIDs))
	for _, raw := range payload.ApplicationIDs {
		id, err := uuid.Parse(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid application id")
			return
		}
		applicationIDs = append(applicationIDs, id)
	}

	items, err := h.Store.CreateShortlists(
		r.Context(), scope, adminActorID(r), applicationIDs, message, jobID,
	)
	if err != nil {
		writeStoreError(w, err, "could not shortlist applications")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"items": items})
}

func (h *Handler) listShortlistsAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	items, err := h.Store.ListShortlists(r.Context(), scope)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load shortlists")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) revokeShortlistAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "shortlist not found")
		return
	}
	var payload struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if payload.Status != "" && payload.Status != "revoked" {
		writeError(w, http.StatusBadRequest, "only revoked is supported")
		return
	}
	shortlist, err := h.Store.RevokeShortlist(r.Context(), scope, adminActorID(r), id)
	if err != nil {
		writeStoreError(w, err, "could not revoke shortlist")
		return
	}
	writeJSON(w, http.StatusOK, shortlist)
}

func (h *Handler) listLocationsAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	items, err := h.Store.ListLocations(r.Context(), scope)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load locations")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) listTemplatesAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	items, err := h.Store.ListTemplates(r.Context(), scope)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load templates")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func adminActorID(r *http.Request) *uuid.UUID {
	session, ok := auth.FromContext(r.Context())
	if !ok {
		return nil
	}
	id, err := uuid.Parse(session.User.ID)
	if err != nil {
		return nil
	}
	return &id
}

func adminTenantID(r *http.Request) *uuid.UUID {
	session, ok := auth.FromContext(r.Context())
	if !ok || session.User.TenantID == "" {
		return nil
	}
	id, err := uuid.Parse(session.User.TenantID)
	if err != nil {
		return nil
	}
	return &id
}

func writeStoreError(w http.ResponseWriter, err error, fallback string) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "record not found")
	case errors.Is(err, store.ErrInvalidTransition):
		writeError(w, http.StatusConflict, "that status change is not allowed")
	case errors.Is(err, store.ErrConflict):
		writeError(w, http.StatusConflict, "record already exists")
	case errors.Is(err, store.ErrValidation):
		writeError(w, http.StatusBadRequest, err.Error())
	default:
		writeError(w, http.StatusInternalServerError, fallback)
	}
}

func parseOptionalTime(raw *string) (*time.Time, error) {
	if raw == nil {
		return nil, nil
	}
	value := strings.TrimSpace(*raw)
	if value == "" {
		return nil, nil
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02"} {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return &parsed, nil
		}
	}
	return nil, fmt.Errorf("unsupported time %q", value)
}

func trimmed(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
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
