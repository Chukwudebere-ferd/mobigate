package httpapi

import (
	"bytes"
	"encoding/json"
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

func (h *Handler) listAccessCodesAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	query := store.AccessCodeQuery{
		TenantID: scope,
		Page:     queryInt(r, "page", 1),
		PerPage:  queryInt(r, "per_page", 20),
		Status:   strings.TrimSpace(r.URL.Query().Get("status")),
		Type:     strings.TrimSpace(r.URL.Query().Get("type")),
		Search:   strings.TrimSpace(r.URL.Query().Get("search")),
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("job_id")); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid job_id")
			return
		}
		query.JobID = &id
	}
	page, err := h.Store.ListAccessCodes(r.Context(), query)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load access codes")
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (h *Handler) issueAccessCodeAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	var payload struct {
		ApplicationID string `json:"application_id"`
		Type          string `json:"type"`
		ExpiresAt     string `json:"expires_at"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	applicationID, err := uuid.Parse(payload.ApplicationID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid application_id")
		return
	}
	codeType := models.AccessCodeType(payload.Type)
	if codeType != models.AccessCodeApplicant && codeType != models.AccessCodeStaff {
		writeError(w, http.StatusBadRequest, "invalid type")
		return
	}
	var expiresAt time.Time
	if raw := strings.TrimSpace(payload.ExpiresAt); raw != "" {
		expiresAt, err = time.Parse(time.RFC3339, raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid expires_at")
			return
		}
		if !expiresAt.After(time.Now()) {
			writeError(w, http.StatusBadRequest, "expires_at must be in the future")
			return
		}
	}
	tenantID := scope
	if tenantID == nil {
		tenantID = adminTenantID(r)
	}
	if tenantID == nil {
		writeError(w, http.StatusForbidden, "account has no tenant scope")
		return
	}

	code, record, err := h.Store.IssueAccessCode(
		r.Context(), tenantID, adminActorID(r), applicationID, codeType, expiresAt,
	)
	if err != nil {
		writeStoreError(w, err, "could not issue access code")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"code": code, "record": record})
}

func (h *Handler) revokeAccessCodeAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "access code not found")
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
	record, err := h.Store.RevokeAccessCode(r.Context(), scope, adminActorID(r), id)
	if err != nil {
		writeStoreError(w, err, "could not revoke access code")
		return
	}
	writeJSON(w, http.StatusOK, record)
}

func (h *Handler) listStaffAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	query := store.StaffQuery{
		TenantID:           scope,
		Page:               queryInt(r, "page", 1),
		PerPage:            queryInt(r, "per_page", 20),
		Search:             strings.TrimSpace(r.URL.Query().Get("search")),
		Status:             strings.TrimSpace(r.URL.Query().Get("status")),
		EmploymentCategory: strings.TrimSpace(r.URL.Query().Get("employment_category")),
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("department_id")); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid department_id")
			return
		}
		query.DepartmentID = &id
	}
	page, err := h.Store.ListStaff(r.Context(), query)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load staff")
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (h *Handler) getStaffAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "staff record not found")
		return
	}
	staff, err := h.Store.GetStaff(r.Context(), scope, id)
	if err != nil {
		writeStoreError(w, err, "could not load staff record")
		return
	}
	writeJSON(w, http.StatusOK, staff)
}

func (h *Handler) listDepartmentsAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	items, err := h.Store.ListDepartments(r.Context(), scope)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load departments")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) listUsersAdmin(w http.ResponseWriter, r *http.Request) {
	if !requireSuperAdmin(w, r) {
		return
	}
	items, err := h.Store.ListUsers(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load users")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) approveUserAdmin(w http.ResponseWriter, r *http.Request) {
	if !requireSuperAdmin(w, r) {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	user, err := h.Store.ApproveUser(r.Context(), nil, adminActorID(r), id)
	if err != nil {
		writeStoreError(w, err, "could not approve user")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) listNotificationsAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	items, err := h.Store.ListNotifications(r.Context(), scope, queryInt(r, "limit", 100))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load notifications")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createInterviewAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	var payload struct {
		JobID        string `json:"job_id"`
		InterviewAt  string `json:"interview_at"`
		Venue        string `json:"venue"`
		Instructions string `json:"instructions"`
		Audience     string `json:"audience"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	jobID, err := uuid.Parse(payload.JobID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid job_id")
		return
	}
	interviewAt, err := time.Parse(time.RFC3339, payload.InterviewAt)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid interview_at")
		return
	}
	venue := strings.TrimSpace(payload.Venue)
	if venue == "" {
		writeError(w, http.StatusBadRequest, "venue is required")
		return
	}
	audience := models.InterviewAudience(payload.Audience)
	switch audience {
	case models.AudienceJobApplicants, models.AudienceShortlistedOnly,
		models.AudienceAllApplicants:
	default:
		writeError(w, http.StatusBadRequest, "invalid audience")
		return
	}

	item, err := h.Store.CreateInterview(
		r.Context(), scope, adminActorID(r), jobID, interviewAt,
		venue, strings.TrimSpace(payload.Instructions), audience,
	)
	if err != nil {
		writeStoreError(w, err, "could not create interview")
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (h *Handler) updateInterviewAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "interview not found")
		return
	}
	var payload struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	status := models.InterviewStatus(payload.Status)
	switch status {
	case models.InterviewDraft, models.InterviewPublished, models.InterviewCancelled:
	default:
		writeError(w, http.StatusBadRequest, "invalid status")
		return
	}
	item, err := h.Store.UpdateInterviewStatus(
		r.Context(), scope, adminActorID(r), id, status,
	)
	if err != nil {
		writeStoreError(w, err, "could not update interview")
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func (h *Handler) createLocationAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	var payload struct {
		Type     string  `json:"type"`
		Name     string  `json:"name"`
		ParentID *string `json:"parent_id"`
		Code     *string `json:"code"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	locationType := models.LocationType(payload.Type)
	switch locationType {
	case models.LocationCountry, models.LocationState, models.LocationLGA,
		models.LocationCity, models.LocationTown:
	default:
		writeError(w, http.StatusBadRequest, "invalid location type")
		return
	}
	name := strings.TrimSpace(payload.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	var parentID *uuid.UUID
	if payload.ParentID != nil && strings.TrimSpace(*payload.ParentID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*payload.ParentID))
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid parent_id")
			return
		}
		parentID = &parsed
	}
	var code *string
	if payload.Code != nil {
		trimmed := strings.TrimSpace(*payload.Code)
		if trimmed != "" {
			code = &trimmed
		}
	}

	tenantID := scope
	if tenantID == nil {
		tenantID = adminTenantID(r)
	}
	location, err := h.Store.CreateLocation(
		r.Context(), tenantID, adminActorID(r), locationType, name, parentID, code,
	)
	if err != nil {
		writeStoreError(w, err, "could not create location")
		return
	}
	writeJSON(w, http.StatusCreated, location)
}

func (h *Handler) approveLocationAdmin(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "location not found")
		return
	}
	location, err := h.Store.ApproveLocation(
		r.Context(), scope, adminActorID(r), id,
	)
	if err != nil {
		writeStoreError(w, err, "could not approve location")
		return
	}
	writeJSON(w, http.StatusOK, location)
}

func (h *Handler) getAccessCodeSettings(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.adminScope(w, r); !ok {
		return
	}
	settings, err := h.Store.GetAccessCodeSettings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load settings")
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (h *Handler) updateAccessCodeSettings(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.adminScope(w, r); !ok {
		return
	}
	var payload struct {
		CodeLength  int `json:"access_code_length"`
		TTLDays     int `json:"access_code_ttl_days"`
		MaxAttempts int `json:"access_code_max_attempts"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	settings, err := h.Store.UpdateAccessCodeSettings(
		r.Context(), adminTenantID(r), adminActorID(r),
		store.AccessCodeSettingsInput{
			CodeLength:  payload.CodeLength,
			TTLDays:     payload.TTLDays,
			MaxAttempts: payload.MaxAttempts,
		},
	)
	if err != nil {
		writeStoreError(w, err, "could not save settings")
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (h *Handler) updateTemplate(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "template not found")
		return
	}
	var payload struct {
		Subject *string `json:"subject"`
		Body    *string `json:"body"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if payload.Body == nil {
		writeError(w, http.StatusBadRequest, "body is required")
		return
	}
	template, err := h.Store.UpdateTemplate(
		r.Context(), scope, adminTenantID(r), adminActorID(r), id,
		payload.Subject, *payload.Body,
	)
	if err != nil {
		writeStoreError(w, err, "could not update template")
		return
	}
	writeJSON(w, http.StatusOK, template)
}

func (h *Handler) testTemplate(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "template not found")
		return
	}
	notification, err := h.Store.QueueTemplateTest(
		r.Context(), scope, adminTenantID(r), adminActorID(r), id,
	)
	if err != nil {
		writeStoreError(w, err, "could not queue test message")
		return
	}
	writeJSON(w, http.StatusAccepted, notification)
}

func (h *Handler) resendShortlist(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "shortlist not found")
		return
	}
	notification, err := h.Store.QueueShortlistResend(
		r.Context(), scope, adminActorID(r), id,
	)
	if err != nil {
		writeStoreError(w, err, "could not queue the message")
		return
	}
	writeJSON(w, http.StatusAccepted, notification)
}

func (h *Handler) notifyInterview(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "interview not found")
		return
	}
	queued, err := h.Store.QueueInterviewNotifications(
		r.Context(), scope, adminActorID(r), id,
	)
	if err != nil {
		writeStoreError(w, err, "could not queue candidate notifications")
		return
	}
	writeJSON(w, http.StatusAccepted, map[string]any{"queued": queued})
}

func (h *Handler) createStaff(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	var payload struct {
		FirstName          string  `json:"first_name"`
		LastName           string  `json:"last_name"`
		Email              string  `json:"email"`
		Phone              string  `json:"phone"`
		EmploymentCategory string  `json:"employment_category"`
		DepartmentID       *string `json:"department_id"`
		LocationID         *string `json:"location_id"`
		Position           *string `json:"position"`
		AppointmentDate    *string `json:"appointment_date"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	input := store.StaffInput{
		FirstName:          strings.TrimSpace(payload.FirstName),
		LastName:           strings.TrimSpace(payload.LastName),
		Email:              strings.TrimSpace(payload.Email),
		Phone:              strings.TrimSpace(payload.Phone),
		EmploymentCategory: models.EmploymentCategory(payload.EmploymentCategory),
		Position:           payload.Position,
	}
	if raw := payload.DepartmentID; raw != nil && strings.TrimSpace(*raw) != "" {
		id, err := uuid.Parse(strings.TrimSpace(*raw))
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid department_id")
			return
		}
		input.DepartmentID = &id
	}
	if raw := payload.LocationID; raw != nil && strings.TrimSpace(*raw) != "" {
		id, err := uuid.Parse(strings.TrimSpace(*raw))
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid location_id")
			return
		}
		input.LocationID = &id
	}
	if raw := payload.AppointmentDate; raw != nil && strings.TrimSpace(*raw) != "" {
		value, err := time.Parse("2006-01-02", strings.TrimSpace(*raw))
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid appointment_date")
			return
		}
		input.AppointmentDate = &value
	}

	tenantID := scope
	if tenantID == nil {
		tenantID = adminTenantID(r)
	}
	if tenantID == nil {
		writeError(w, http.StatusForbidden, "account has no tenant scope")
		return
	}
	staff, err := h.Store.CreateStaff(r.Context(), *tenantID, adminActorID(r), input)
	if err != nil {
		writeStoreError(w, err, "could not create staff record")
		return
	}
	writeJSON(w, http.StatusCreated, staff)
}

func (h *Handler) updateUser(w http.ResponseWriter, r *http.Request) {
	if !requireSuperAdmin(w, r) {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	var payload struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	status := models.UserStatus(strings.TrimSpace(payload.Status))
	if status == "" {
		status = models.UserStatusActive
	}
	user, err := h.Store.UpdateUserStatus(
		r.Context(), nil, adminActorID(r), id, status,
	)
	if err != nil {
		writeStoreError(w, err, "could not update user")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) createAdminUser(w http.ResponseWriter, r *http.Request) {
	if !requireSuperAdmin(w, r) {
		return
	}
	var payload struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Email     string `json:"email"`
		Password  string `json:"password"`
		Role      string `json:"role"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	payload.FirstName = strings.TrimSpace(payload.FirstName)
	payload.LastName = strings.TrimSpace(payload.LastName)
	payload.Email = strings.ToLower(strings.TrimSpace(payload.Email))
	role := models.UserRole(payload.Role)
	if role != models.RoleAdmin && role != models.RoleStaff {
		writeError(w, http.StatusBadRequest, "role must be admin or staff")
		return
	}
	if payload.FirstName == "" || payload.LastName == "" || payload.Email == "" {
		writeError(w, http.StatusBadRequest, "name and email are required")
		return
	}
	if len(payload.Password) < 8 {
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	tenantID := adminTenantID(r)
	if tenantID == nil {
		writeError(w, http.StatusForbidden, "account has no tenant scope")
		return
	}

	authRole := "admin"
	if role == models.RoleStaff {
		authRole = "user"
	}
	body := map[string]any{
		"email":    payload.Email,
		"password": payload.Password,
		"name":     payload.FirstName + " " + payload.LastName,
		"role":     authRole,
		"data": map[string]any{
			"tenantId": tenantID.String(),
		},
	}
	raw, status, err := h.authCall(r, http.MethodPost, "/api/auth/admin/create-user", body)
	if err != nil {
		writeError(w, http.StatusBadGateway, "authentication service unavailable")
		return
	}
	if status != http.StatusOK {
		writeError(w, http.StatusBadRequest, authMessage(raw, "could not create the account"))
		return
	}
	var created struct {
		User struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	if err := json.Unmarshal(raw, &created); err != nil || created.User.ID == "" {
		writeError(w, http.StatusBadGateway, "authentication service returned an unexpected response")
		return
	}
	authID, err := uuid.Parse(created.User.ID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "authentication service returned an invalid account id")
		return
	}
	user, err := h.Store.CreateDomainUser(
		r.Context(), tenantID, adminActorID(r), authID, role,
		payload.Email, payload.FirstName, payload.LastName,
	)
	if err != nil {
		// Do not leave an orphaned credential if the domain row cannot be
		// written. Best effort: the auth service will reject if it also fails.
		_, _, _ = h.authCall(r, http.MethodPost, "/api/auth/admin/remove-user",
			map[string]any{"userId": authID.String()})
		writeStoreError(w, err, "could not create the domain account")
		return
	}
	writeJSON(w, http.StatusCreated, user)
}

func (h *Handler) resetUserPassword(w http.ResponseWriter, r *http.Request) {
	if !requireSuperAdmin(w, r) {
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	if _, err := h.Store.UserByID(r.Context(), id.String()); err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	var payload struct {
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if len(payload.NewPassword) < 8 {
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}
	raw, status, err := h.authCall(r, http.MethodPost, "/api/auth/admin/set-user-password",
		map[string]any{"userId": id.String(), "newPassword": payload.NewPassword})
	if err != nil {
		writeError(w, http.StatusBadGateway, "authentication service unavailable")
		return
	}
	if status != http.StatusOK {
		writeError(w, http.StatusBadRequest, authMessage(raw, "could not reset the password"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"updated": true})
}

func (h *Handler) authCall(
	r *http.Request,
	method, path string,
	payload any,
) ([]byte, int, error) {
	base := strings.TrimRight(h.AuthBaseURL, "/")
	if base == "" {
		base = "http://localhost:3000"
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, 0, err
	}
	req, err := http.NewRequestWithContext(
		r.Context(), method, base+path, bytes.NewReader(body),
	)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	if cookie := r.Header.Get("Cookie"); cookie != "" {
		req.Header.Set("Cookie", cookie)
	}
	if origin := r.Header.Get("Origin"); origin != "" {
		req.Header.Set("Origin", origin)
	}
	if referer := r.Header.Get("Referer"); referer != "" {
		req.Header.Set("Referer", referer)
	}
	resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, resp.StatusCode, err
	}
	return raw, resp.StatusCode, nil
}

func authMessage(raw []byte, fallback string) string {
	var payload struct {
		Message string `json:"message"`
		Error   string `json:"error"`
	}
	if json.Unmarshal(raw, &payload) == nil {
		if payload.Message != "" {
			return payload.Message
		}
		if payload.Error != "" {
			return payload.Error
		}
	}
	return fallback
}

func requireSuperAdmin(w http.ResponseWriter, r *http.Request) bool {
	session, ok := auth.FromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return false
	}
	if session.User.Role != models.RoleSuperAdmin {
		writeError(w, http.StatusForbidden, "super admin access required")
		return false
	}
	return true
}
