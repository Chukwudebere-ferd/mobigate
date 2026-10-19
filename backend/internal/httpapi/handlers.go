package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/mobigate/mgm-portal/internal/auth"
	"github.com/mobigate/mgm-portal/internal/codes"
	"github.com/mobigate/mgm-portal/internal/models"
	"github.com/mobigate/mgm-portal/internal/store"
)

// Handler carries the dependencies shared by all route handlers.
type Handler struct {
	Store *store.Store
	// Verifier resolves Better Auth session cookies. It may be nil in
	// development, in which case protected routes are not enforced.
	Verifier *auth.Verifier
}

// Register mounts every MVP route on the given router.
//
// Path groups:
//   - /public/*   unauthenticated careers site
//   - /me/*       the signed-in applicant or staff member
//   - /staff/*    staff onboarding
//   - /admin/*    admin panel, requires an admin session
//   - /api/auth/* Better Auth, proxied or mounted separately
func (h *Handler) Register(r chi.Router) {
	r.Route("/public", func(r chi.Router) {
		r.Get("/jobs", h.listPublicJobs)
		r.Get("/jobs/{slug}", h.getPublicJob)
		r.Post("/applications", h.submitApplication)
	})

	r.Route("/me", h.require(models.RoleApplicant, models.RoleStaff, models.RoleAdmin, models.RoleSuperAdmin),
		func(r chi.Router) {
			r.Get("/applications", h.myApplications)
			r.Get("/applications/{id}", h.myApplication)
			r.Get("/applications/{id}/shortlist", h.myShortlistMessage)
			r.Get("/interviews", h.myInterviews)
		})

	r.Route("/staff", h.require(models.RoleApplicant, models.RoleStaff, models.RoleAdmin, models.RoleSuperAdmin),
		func(r chi.Router) {
			r.Post("/redeem", h.redeemAccessCode)
			r.Post("/onboarding", h.completeOnboarding)
		})

	r.Route("/admin", h.require(models.RoleAdmin, models.RoleSuperAdmin),
		func(r chi.Router) {
			h.registerAdminRoutes(r)
		})
}

// require applies session verification to a route group when a verifier is
// configured. Without one the routes are left open, which is only
// appropriate for local development.
func (h *Handler) require(roles ...models.UserRole) func(chi.Router) {
	return func(r chi.Router) {
		if h.Verifier == nil {
			return
		}
		r.Use(h.Verifier.Middleware(roles...))
	}
}

func (h *Handler) registerAdminRoutes(r chi.Router) {
	r.Get("/dashboard", h.dashboard)

	r.Get("/jobs", h.listJobs)
	r.Post("/jobs", h.createJob)
	r.Patch("/jobs/{id}", h.updateJob)

	r.Get("/applications", h.listApplications)
	r.Get("/applications/{id}", h.getApplication)
	r.Get("/applications/{id}/events", h.applicationEvents)
	r.Patch("/applications/{id}/status", h.setApplicationStatus)

	r.Post("/shortlists", h.createShortlist)
	r.Get("/shortlists", h.listShortlists)
	r.Patch("/shortlists/{id}", h.revokeShortlist)

	r.Get("/interviews", h.listInterviews)
	r.Post("/interviews", h.createInterview)
	r.Patch("/interviews/{id}", h.updateInterview)

	r.Get("/access-codes", h.listAccessCodes)
	r.Post("/access-codes", h.issueAccessCode)
	r.Patch("/access-codes/{id}", h.revokeAccessCode)

	r.Get("/staff", h.listStaff)
	r.Get("/staff/{id}", h.getStaff)

	r.Get("/locations", h.listLocations)
	r.Post("/locations", h.createLocation)
	r.Patch("/locations/{id}", h.approveLocation)

	r.Get("/departments", h.listDepartments)
	r.Get("/users", h.listUsers)
	r.Patch("/users/{id}", h.approveUser)
	r.Get("/templates", h.listTemplates)
	r.Get("/notifications", h.listNotifications)
	r.Get("/audit-logs", h.listAuditLogs)
}

// -- Handlers --------------------------------------------------------------
// Bodies are written here as thin adapters over the store. The store
// implementation lands with the persistence layer; these signatures define
// the contract the frontend already depends on.

func (h *Handler) listPublicJobs(w http.ResponseWriter, r *http.Request) {
	// GET /public/jobs -> 200 { "items": Job[] }
	// Only jobs with status = 'published' are returned.
	writeJSON(w, http.StatusOK, map[string]any{"items": []models.Job{}})
}

func (h *Handler) getPublicJob(w http.ResponseWriter, r *http.Request) {
	// GET /public/jobs/{slug} -> 200 Job | 404
	writeJSON(w, http.StatusOK, models.Job{})
}

func (h *Handler) submitApplication(w http.ResponseWriter, r *http.Request) {
	// POST /public/applications
	// Body: job_id, first_name, last_name, email, phone, gender,
	//       date_of_birth, location_id, address_line, qualification
	// 201 -> Application (includes the generated application_number)
	// 409 -> a duplicate application for the same job and email
	writeJSON(w, http.StatusCreated, models.Application{})
}

func (h *Handler) myApplications(w http.ResponseWriter, r *http.Request) {
	// GET /me/applications -> 200 { "items": Application[] }
	writeJSON(w, http.StatusOK, map[string]any{"items": []models.Application{}})
}

func (h *Handler) myApplication(w http.ResponseWriter, r *http.Request) {
	// GET /me/applications/{id} -> 200 Application | 404
	writeJSON(w, http.StatusOK, models.Application{})
}

func (h *Handler) myShortlistMessage(w http.ResponseWriter, r *http.Request) {
	// GET /me/applications/{id}/shortlist
	// 200 -> Shortlist (the confirmation message, verbatim)
	// 404 -> when the application is not shortlisted, or the shortlist was
	//        revoked. The message is never returned to a non-shortlisted
	//        applicant (BR-08).
	writeJSON(w, http.StatusOK, models.Shortlist{})
}

func (h *Handler) myInterviews(w http.ResponseWriter, r *http.Request) {
	// GET /me/interviews -> 200 { "items": InterviewAnnouncement[] }
	writeJSON(w, http.StatusOK, map[string]any{"items": []models.InterviewAnnouncement{}})
}

func (h *Handler) redeemAccessCode(w http.ResponseWriter, r *http.Request) {
	// POST /staff/redeem  Body: { code }
	// 200 -> { "application": Application }
	// 400 -> unknown, expired, used or revoked code, or too many failures
	//
	// The code is compared against its stored hash. On success the attempt
	// counter resets; on failure it increments, and 5 failures lock the code
	// (BR-06).
	writeJSON(w, http.StatusOK, map[string]any{"application": models.Application{}})
}

func (h *Handler) completeOnboarding(w http.ResponseWriter, r *http.Request) {
	// POST /staff/onboarding
	// Creates the staff profile, allocates the Staff ID, consumes the access
	// code and writes the audit entry in ONE transaction (BR-11).
	// 201 -> { "staff": StaffProfile }
	writeJSON(w, http.StatusCreated, map[string]any{"staff": models.StaffProfile{}})
}

func (h *Handler) dashboard(w http.ResponseWriter, r *http.Request) {
	// GET /admin/dashboard -> 200 DashboardMetrics
	writeJSON(w, http.StatusOK, map[string]any{})
}

func (h *Handler) listJobs(w http.ResponseWriter, r *http.Request) {
	// GET /admin/jobs -> 200 { "items": Job[] }
	writeJSON(w, http.StatusOK, map[string]any{"items": []models.Job{}})
}

func (h *Handler) createJob(w http.ResponseWriter, r *http.Request) {
	// POST /admin/jobs -> 201 Job
	writeJSON(w, http.StatusCreated, models.Job{})
}

func (h *Handler) updateJob(w http.ResponseWriter, r *http.Request) {
	// PATCH /admin/jobs/{id} -> 200 Job
	writeJSON(w, http.StatusOK, models.Job{})
}

func (h *Handler) listApplications(w http.ResponseWriter, r *http.Request) {
	// GET /admin/applications
	// Query: page, per_page, search, status, job_id, state_id, lga_id,
	//        date_from, date_to, sort, order
	// 200 -> Paginated<Application>
	writeJSON(w, http.StatusOK, map[string]any{})
}

func (h *Handler) getApplication(w http.ResponseWriter, r *http.Request) {
	// GET /admin/applications/{id} -> 200 Application | 404
	writeJSON(w, http.StatusOK, models.Application{})
}

func (h *Handler) applicationEvents(w http.ResponseWriter, r *http.Request) {
	// GET /admin/applications/{id}/events -> 200 { "items": ApplicationEvent[] }
	writeJSON(w, http.StatusOK, map[string]any{"items": []models.ApplicationEvent{}})
}

func (h *Handler) setApplicationStatus(w http.ResponseWriter, r *http.Request) {
	// PATCH /admin/applications/{id}/status
	// Body: { status, reason? }
	// 200 -> Application
	// 409 -> illegal transition
	writeJSON(w, http.StatusOK, models.Application{})
}

func (h *Handler) createShortlist(w http.ResponseWriter, r *http.Request) {
	// POST /admin/shortlists
	// Body: { application_ids: []uuid, message: string, job_id: uuid }
	// 201 -> { "items": Shortlist[] }
	// 400 -> message is empty (BR-07)
	writeJSON(w, http.StatusCreated, map[string]any{"items": []models.Shortlist{}})
}

func (h *Handler) listShortlists(w http.ResponseWriter, r *http.Request) {
	// GET /admin/shortlists -> 200 { "items": Shortlist[] }
	writeJSON(w, http.StatusOK, map[string]any{"items": []models.Shortlist{}})
}

func (h *Handler) revokeShortlist(w http.ResponseWriter, r *http.Request) {
	// PATCH /admin/shortlists/{id}  Body: { status: "revoked" }
	// 200 -> Shortlist
	writeJSON(w, http.StatusOK, models.Shortlist{})
}

func (h *Handler) listInterviews(w http.ResponseWriter, r *http.Request) {
	// GET /admin/interviews -> 200 { "items": InterviewAnnouncement[] }
	writeJSON(w, http.StatusOK, map[string]any{"items": []models.InterviewAnnouncement{}})
}

func (h *Handler) createInterview(w http.ResponseWriter, r *http.Request) {
	// POST /admin/interviews
	// Body: { job_id, interview_at, venue, instructions, audience }
	// 201 -> InterviewAnnouncement
	writeJSON(w, http.StatusCreated, models.InterviewAnnouncement{})
}

func (h *Handler) updateInterview(w http.ResponseWriter, r *http.Request) {
	// PATCH /admin/interviews/{id} -> 200 InterviewAnnouncement
	writeJSON(w, http.StatusOK, models.InterviewAnnouncement{})
}

func (h *Handler) listAccessCodes(w http.ResponseWriter, r *http.Request) {
	// GET /admin/access-codes
	// Query: page, per_page, status, type, job_id, search
	// 200 -> Paginated<AccessCode>
	//
	// Only code_hint is ever returned. The plaintext is not recoverable
	// because it is not stored (BR-17).
	writeJSON(w, http.StatusOK, map[string]any{})
}

func (h *Handler) issueAccessCode(w http.ResponseWriter, r *http.Request) {
	// POST /admin/access-codes
	// Body: { application_id, type, expires_at }
	// 201 -> { "code": "K7M2Q9", "record": AccessCode }
	//
	// The plaintext code is returned exactly once, in this response. It is
	// hashed before storage and cannot be retrieved afterwards.
	writeJSON(w, http.StatusCreated, map[string]any{
		"code":   codes.GenerateAccessCodeMock(),
		"record": models.AccessCode{},
	})
}

func (h *Handler) revokeAccessCode(w http.ResponseWriter, r *http.Request) {
	// PATCH /admin/access-codes/{id} -> 200 AccessCode
	writeJSON(w, http.StatusOK, models.AccessCode{})
}

func (h *Handler) listStaff(w http.ResponseWriter, r *http.Request) {
	// GET /admin/staff -> 200 Paginated<StaffProfile>
	writeJSON(w, http.StatusOK, map[string]any{})
}

func (h *Handler) getStaff(w http.ResponseWriter, r *http.Request) {
	// GET /admin/staff/{id} -> 200 StaffProfile | 404
	writeJSON(w, http.StatusOK, models.StaffProfile{})
}

func (h *Handler) listLocations(w http.ResponseWriter, r *http.Request) {
	// GET /admin/locations -> 200 { "items": Location[] }
	writeJSON(w, http.StatusOK, map[string]any{"items": []models.Location{}})
}

func (h *Handler) createLocation(w http.ResponseWriter, r *http.Request) {
	// POST /admin/locations
	// Body: { type, name, parent_id, code? }
	// 201 -> Location (status = "pending", awaiting Super Admin approval)
	writeJSON(w, http.StatusCreated, models.Location{})
}

func (h *Handler) approveLocation(w http.ResponseWriter, r *http.Request) {
	// PATCH /admin/locations/{id} -> 200 Location
	writeJSON(w, http.StatusOK, models.Location{})
}

func (h *Handler) listDepartments(w http.ResponseWriter, r *http.Request) {
	// GET /admin/departments -> 200 { "items": Department[] }
	writeJSON(w, http.StatusOK, map[string]any{"items": []models.Department{}})
}

func (h *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	// GET /admin/users -> 200 { "items": User[] }
	writeJSON(w, http.StatusOK, map[string]any{"items": []models.User{}})
}

func (h *Handler) approveUser(w http.ResponseWriter, r *http.Request) {
	// PATCH /admin/users/{id} -> 200 User
	writeJSON(w, http.StatusOK, models.User{})
}

func (h *Handler) listTemplates(w http.ResponseWriter, r *http.Request) {
	// GET /admin/templates -> 200 { "items": MessageTemplate[] }
	writeJSON(w, http.StatusOK, map[string]any{"items": []models.MessageTemplate{}})
}

func (h *Handler) listNotifications(w http.ResponseWriter, r *http.Request) {
	// GET /admin/notifications -> 200 { "items": Notification[] }
	writeJSON(w, http.StatusOK, map[string]any{"items": []models.Notification{}})
}

func (h *Handler) listAuditLogs(w http.ResponseWriter, r *http.Request) {
	// GET /admin/audit-logs -> 200 { "items": AuditLog[] }
	writeJSON(w, http.StatusOK, map[string]any{"items": []models.AuditLog{}})
}

// -- Helpers ---------------------------------------------------------------

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		// The status line is already written, so log and move on.
		return
	}
}

// writeError renders a consistent error envelope.
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// translateStoreError maps store errors onto HTTP status codes.
func translateStoreError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "not found")
	case errors.Is(err, store.ErrConflict):
		writeError(w, http.StatusConflict, "conflict")
	default:
		writeError(w, http.StatusInternalServerError, "internal error")
	}
}

// parseUUIDParam reads a UUID path parameter.
func parseUUIDParam(r *http.Request, name string) (string, error) {
	raw := chi.URLParam(r, name)
	if raw == "" {
		return "", fmt.Errorf("missing %s", name)
	}
	return raw, nil
}

// queryInt reads an integer query parameter with a default.
func queryInt(r *http.Request, name string, def int) int {
	raw := strings.TrimSpace(r.URL.Query().Get(name))
	if raw == "" {
		return def
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	return v
}
