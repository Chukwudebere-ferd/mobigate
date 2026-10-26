package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mobigate/mgm-portal/internal/auth"
	"github.com/mobigate/mgm-portal/internal/models"
	"github.com/mobigate/mgm-portal/internal/storage"
	"github.com/mobigate/mgm-portal/internal/store"
)

// Handler carries the dependencies shared by all route handlers.
type Handler struct {
	Store *store.Store
	// Verifier resolves Better Auth session cookies. It may be nil in
	// development, in which case protected routes are not enforced.
	Verifier *auth.Verifier
	// AllowedOrigins lists browser origins permitted to make state-changing
	// requests. Same-origin requests are always allowed.
	AllowedOrigins []string
	// AuthBaseURL is the Better Auth service used for identity operations
	// that must stay inside Better Auth (password changes, account creation).
	AuthBaseURL string
	// ApplicationLimiter protects public application submission from bursts
	// and simple spam. Nil disables limiting, which is useful in tests.
	ApplicationLimiter *ApplicationLimiter

	// Storage persists uploaded photos and staff documents in Byteship.
	// Upload routes fail closed when it is nil.
	Storage *storage.Store
	// TicketSecret signs the short-lived onboarding tickets handed out by
	// code redemption. It should be derived from, but not equal to,
	// AUTH_SECRET.
	TicketSecret string
	// redeemAttempts throttles code redemption per IP, the backstop against
	// guessing before a code row exists to lock (BR-06).
	redeemAttempts *attemptLimiter
}

// Register mounts every MVP route on the given router.
//
// Path groups:
//   - /public/*   unauthenticated careers site
//   - /me/*       the signed-in applicant or staff member
//   - /staff/*    staff onboarding and the active-staff workspace
//   - /admin/*    admin panel, requires an admin session
//   - /api/auth/* Better Auth, proxied or mounted separately
func (h *Handler) Register(r chi.Router) {
	r.Route("/public", func(r chi.Router) {
		r.Get("/jobs", h.listPublicJobs)
		r.Get("/jobs/{slug}", h.getPublicJob)
		r.Get("/locations", h.publicLocations)
		r.Get("/departments", h.publicDepartments)
		r.Get("/policies", h.listPublicPolicies)
		r.Post("/provision", h.provisionApplicant)
		r.With(h.ApplicationLimiter.Middleware).Post("/applications", h.submitApplication)
	})

	r.Route("/me", func(r chi.Router) {
		h.requireAllowPending(models.RoleApplicant, models.RoleStaff, models.RoleAdmin, models.RoleSuperAdmin)(r)
		r.Get("/", h.currentUser)
		r.Get("/applications", h.myApplications)
		r.Get("/applications/{id}", h.myApplication)
		r.Get("/applications/{id}/events", h.myApplicationEvents)
		r.Patch("/applications/{id}", h.editMyApplication)
		r.Post("/applications/{id}/withdraw", h.withdrawMyApplication)
		r.Get("/applications/{id}/shortlist", h.myShortlistMessage)
		r.Get("/applications/{id}/photo", h.myApplicationPhoto)
		r.Get("/interviews", h.myInterviews)
	})

	r.Route("/staff", func(r chi.Router) {
		// Onboarding starts with an admin-issued code. Applicants redeem it
		// before completing the form promotes them to the staff role.
		r.Group(func(r chi.Router) {
			h.require(models.RoleApplicant, models.RoleStaff, models.RoleAdmin, models.RoleSuperAdmin)(r)
			r.Post("/redeem", h.redeemAccessCode)
			r.Get("/onboarding/draft", h.getOnboardingDraft)
			r.Put("/onboarding/draft", h.saveOnboardingDraft)
			r.Post("/onboarding", h.completeOnboarding)
		})

		// The staff workspace is staff-only. The store lookup returns
		// ErrNotFound for a missing, suspended or exited staff record, so the
		// handlers respond 404 rather than exposing an inactive record.
		r.Group(func(r chi.Router) {
			h.require(models.RoleStaff)(r)
			r.Get("/me", h.staffMe)
			r.Get("/payroll", h.staffPayroll)
			r.Post("/payroll/advances", h.requestAdvance)
			r.Get("/documents/{id}", h.staffDocumentURL)
		})
	})

	r.Route("/admin", func(r chi.Router) {
		h.require(models.RoleAdmin, models.RoleSuperAdmin)(r)
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

// requireAllowPending is the self-service variant of require. A pending
// account may read its own status but cannot perform role-restricted work.
func (h *Handler) requireAllowPending(roles ...models.UserRole) func(chi.Router) {
	return func(r chi.Router) {
		if h.Verifier == nil {
			return
		}
		r.Use(h.Verifier.MiddlewareAllowPending(roles...))
	}
}

// OriginGuard rejects cross-origin state-changing requests. Cookie sessions
// rely on this in addition to SameSite to prevent CSRF. It must be installed
// with the router's other middleware, before any route is registered.
func (h *Handler) OriginGuard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			next.ServeHTTP(w, r)
			return
		}

		origin := r.Header.Get("Origin")
		if origin == "" {
			next.ServeHTTP(w, r)
			return
		}

		parsed, err := url.Parse(origin)
		if err != nil {
			writeError(w, http.StatusForbidden, "invalid origin")
			return
		}
		if strings.EqualFold(parsed.Host, r.Host) {
			next.ServeHTTP(w, r)
			return
		}
		for _, allowed := range h.AllowedOrigins {
			if strings.EqualFold(strings.TrimSpace(allowed), origin) {
				next.ServeHTTP(w, r)
				return
			}
		}
		writeError(w, http.StatusForbidden, "origin not allowed")
	})
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
	r.Post("/shortlists/{id}/resend", h.resendShortlist)

	r.Get("/interviews", h.listInterviews)
	r.Post("/interviews", h.createInterview)
	r.Patch("/interviews/{id}", h.updateInterview)
	r.Post("/interviews/{id}/notify", h.notifyInterview)

	r.Get("/access-codes", h.listAccessCodes)
	r.Post("/access-codes", h.issueAccessCode)
	r.Patch("/access-codes/{id}", h.revokeAccessCode)
	r.Get("/settings/access-codes", h.getAccessCodeSettings)
	r.Patch("/settings/access-codes", h.updateAccessCodeSettings)

	r.Get("/staff", h.listStaff)
	r.Post("/staff", h.createStaff)
	r.Get("/staff/{id}", h.getStaff)

	r.Get("/payroll/salary", h.listSalaryPayments)
	r.Post("/payroll/salary", h.upsertSalaryPayment)
	r.Get("/payroll/advances", h.listAdvanceRequests)
	r.Patch("/payroll/advances/{id}", h.decideAdvanceRequest)

	r.Get("/locations", h.listLocations)
	r.Post("/locations", h.createLocation)
	r.Patch("/locations/{id}", h.approveLocation)

	r.Get("/departments", h.listDepartments)
	r.Post("/departments", h.createDepartment)
	r.Get("/tenants", h.listTenants)
	r.Get("/users", h.listUsers)
	r.Post("/users", h.createAdminUser)
	r.Patch("/users/{id}", h.updateUser)
	r.Post("/users/{id}/reset-password", h.resetUserPassword)
	r.Get("/templates", h.listTemplates)
	r.Patch("/templates/{id}", h.updateTemplate)
	r.Post("/templates/{id}/test", h.testTemplate)
	r.Get("/policies", h.listAdminPolicies)
	r.Post("/policies", h.createPolicy)
	r.Patch("/policies/{id}", h.updatePolicy)
	r.Delete("/policies/{id}", h.deletePolicy)
	r.Get("/notifications", h.listNotifications)
	r.Post("/notifications/{id}/retry", h.retryNotification)
	r.Get("/audit-logs", h.listAuditLogs)
}

// -- Handlers --------------------------------------------------------------
// Candidate-facing handlers (public careers, /me, staff onboarding) live in
// public.go and staff.go; only admin handlers remain in this file.

// adminScope resolves the tenant filter for an admin request. A nil UUID
// means "all tenants" and is reserved for Super Admins; a state Admin must
// have a tenant. The session role was already checked by middleware.
func (h *Handler) adminScope(w http.ResponseWriter, r *http.Request) (*uuid.UUID, bool) {
	session, ok := auth.FromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return nil, false
	}
	if h.Store == nil {
		writeError(w, http.StatusServiceUnavailable, "database unavailable")
		return nil, false
	}
	if session.User.Role == models.RoleSuperAdmin {
		return nil, true
	}
	if session.User.TenantID == "" {
		writeError(w, http.StatusForbidden, "account has no tenant scope")
		return nil, false
	}
	tenantID, err := uuid.Parse(session.User.TenantID)
	if err != nil {
		writeError(w, http.StatusForbidden, "account has an invalid tenant scope")
		return nil, false
	}
	return &tenantID, true
}

// currentUser returns the signed-in user's domain profile and state scope.
// Better Auth owns the session; this response is the frontend's view of the
// MGM user, including pending/suspended status.
func (h *Handler) currentUser(w http.ResponseWriter, r *http.Request) {
	session, ok := auth.FromContext(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	h.writeCurrentUser(w, r, session)
}

// writeCurrentUser renders the /me payload for a resolved session. Shared
// with applicant provisioning, whose first /me response is built from the
// freshly created domain row.
func (h *Handler) writeCurrentUser(w http.ResponseWriter, r *http.Request, session auth.Context) {
	user := map[string]any{
		"id":         session.User.ID,
		"email":      session.User.Email,
		"first_name": session.User.FirstName,
		"last_name":  session.User.LastName,
		"role":       session.User.Role,
		"status":     session.User.Status,
		"tenant_id":  nil,
		"staff_id":   nil,
	}
	if session.User.TenantID != "" {
		user["tenant_id"] = session.User.TenantID
	}
	if session.User.StaffID != "" {
		user["staff_id"] = session.User.StaffID
	}

	payload := map[string]any{"user": user}
	if session.User.TenantID != "" && h.Store != nil {
		tenant, err := h.Store.TenantByID(r.Context(), session.User.TenantID)
		if err == nil {
			payload["tenant"] = map[string]any{
				"id":   tenant.ID.String(),
				"name": tenant.Name,
			}
		}
	}
	writeJSON(w, http.StatusOK, payload)
}

func (h *Handler) dashboard(w http.ResponseWriter, r *http.Request) {
	// GET /admin/dashboard -> 200 DashboardMetrics
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	metrics, err := h.Store.Dashboard(r.Context(), scope)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load dashboard")
		return
	}
	writeJSON(w, http.StatusOK, metrics)
}

func (h *Handler) listJobs(w http.ResponseWriter, r *http.Request) {
	// GET /admin/jobs -> 200 { "items": Job[] }
	h.listJobsAdmin(w, r)
}

func (h *Handler) createJob(w http.ResponseWriter, r *http.Request) {
	// POST /admin/jobs -> 201 Job
	h.saveJob(w, r, false)
}

func (h *Handler) updateJob(w http.ResponseWriter, r *http.Request) {
	// PATCH /admin/jobs/{id} -> 200 Job
	h.saveJob(w, r, true)
}

func (h *Handler) listApplications(w http.ResponseWriter, r *http.Request) {
	// GET /admin/applications
	// Query: page, per_page, search, status, job_id, state_id, lga_id,
	//        date_from, date_to, sort, order
	// 200 -> Paginated<Application>
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}

	status := strings.TrimSpace(r.URL.Query().Get("status"))
	switch status {
	case "", "all", "pending", "shortlisted", "rejected", "appointed", "withdrawn":
	default:
		writeError(w, http.StatusBadRequest, "invalid status filter")
		return
	}

	query := store.ApplicationQuery{
		TenantID: scope,
		Page:     queryInt(r, "page", 1),
		PerPage:  queryInt(r, "per_page", 20),
		Search:   strings.TrimSpace(r.URL.Query().Get("search")),
		Status:   status,
		Sort:     strings.TrimSpace(r.URL.Query().Get("sort")),
		Order:    strings.TrimSpace(r.URL.Query().Get("order")),
	}
	if query.Status == "all" {
		query.Status = ""
	}
	if query.Page < 1 {
		query.Page = 1
	}
	if query.PerPage < 1 || query.PerPage > 100 {
		query.PerPage = 20
	}

	for _, param := range []struct {
		name string
		dest **uuid.UUID
	}{
		{"job_id", &query.JobID},
		{"lga_id", &query.LocationID},
		{"state_id", &query.LocationID},
	} {
		raw := strings.TrimSpace(r.URL.Query().Get(param.name))
		if raw == "" {
			continue
		}
		parsed, err := uuid.Parse(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid "+param.name)
			return
		}
		// lga_id takes precedence because it is more specific.
		*param.dest = &parsed
		if param.name == "lga_id" {
			break
		}
	}

	if raw := strings.TrimSpace(r.URL.Query().Get("date_from")); raw != "" {
		parsed, err := time.Parse("2006-01-02", raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid date_from")
			return
		}
		query.DateFrom = &parsed
	}
	if raw := strings.TrimSpace(r.URL.Query().Get("date_to")); raw != "" {
		parsed, err := time.Parse("2006-01-02", raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid date_to")
			return
		}
		end := parsed.Add(24 * time.Hour)
		query.DateTo = &end
	}

	page, err := h.Store.ListApplications(r.Context(), query)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load applications")
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (h *Handler) getApplication(w http.ResponseWriter, r *http.Request) {
	// GET /admin/applications/{id} -> 200 Application | 404
	h.getApplicationAdmin(w, r)
}

func (h *Handler) applicationEvents(w http.ResponseWriter, r *http.Request) {
	// GET /admin/applications/{id}/events -> 200 { "items": ApplicationEvent[] }
	h.applicationEventsAdmin(w, r)
}

func (h *Handler) setApplicationStatus(w http.ResponseWriter, r *http.Request) {
	// PATCH /admin/applications/{id}/status
	// Body: { status, reason? }
	// 200 -> Application
	// 409 -> illegal transition
	h.setApplicationStatusAdmin(w, r)
}

func (h *Handler) createShortlist(w http.ResponseWriter, r *http.Request) {
	// POST /admin/shortlists
	// Body: { application_ids: []uuid, message: string, job_id: uuid }
	// 201 -> { "items": Shortlist[] }
	// 400 -> message is empty (BR-07)
	h.createShortlistAdmin(w, r)
}

func (h *Handler) listShortlists(w http.ResponseWriter, r *http.Request) {
	// GET /admin/shortlists -> 200 { "items": Shortlist[] }
	h.listShortlistsAdmin(w, r)
}

func (h *Handler) revokeShortlist(w http.ResponseWriter, r *http.Request) {
	// PATCH /admin/shortlists/{id}  Body: { status: "revoked" }
	// 200 -> Shortlist
	h.revokeShortlistAdmin(w, r)
}

func (h *Handler) listInterviews(w http.ResponseWriter, r *http.Request) {
	// GET /admin/interviews -> 200 { "items": InterviewAnnouncement[] }
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	items, err := h.Store.ListInterviews(r.Context(), scope)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load interviews")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createInterview(w http.ResponseWriter, r *http.Request) {
	// POST /admin/interviews
	// Body: { job_id, interview_at, venue, instructions, audience }
	// 201 -> InterviewAnnouncement
	h.createInterviewAdmin(w, r)
}

func (h *Handler) updateInterview(w http.ResponseWriter, r *http.Request) {
	// PATCH /admin/interviews/{id} -> 200 InterviewAnnouncement
	h.updateInterviewAdmin(w, r)
}

func (h *Handler) listAccessCodes(w http.ResponseWriter, r *http.Request) {
	// GET /admin/access-codes
	// Query: page, per_page, status, type, job_id, search
	// 200 -> Paginated<AccessCode>
	//
	// Only code_hint is ever returned. The plaintext is not recoverable
	// because it is not stored (BR-17).
	h.listAccessCodesAdmin(w, r)
}

func (h *Handler) issueAccessCode(w http.ResponseWriter, r *http.Request) {
	// POST /admin/access-codes
	// Body: { application_id, type, expires_at }
	// 201 -> { "code": "K7M2Q9", "record": AccessCode }
	//
	// The plaintext code is returned exactly once, in this response. It is
	// hashed before storage and cannot be retrieved afterwards.
	h.issueAccessCodeAdmin(w, r)
}

func (h *Handler) revokeAccessCode(w http.ResponseWriter, r *http.Request) {
	// PATCH /admin/access-codes/{id} -> 200 AccessCode
	h.revokeAccessCodeAdmin(w, r)
}

func (h *Handler) listStaff(w http.ResponseWriter, r *http.Request) {
	// GET /admin/staff -> 200 Paginated<StaffProfile>
	h.listStaffAdmin(w, r)
}

func (h *Handler) getStaff(w http.ResponseWriter, r *http.Request) {
	// GET /admin/staff/{id} -> 200 StaffProfile | 404
	h.getStaffAdmin(w, r)
}

func (h *Handler) listLocations(w http.ResponseWriter, r *http.Request) {
	// GET /admin/locations -> 200 { "items": Location[] }
	h.listLocationsAdmin(w, r)
}

func (h *Handler) createLocation(w http.ResponseWriter, r *http.Request) {
	// POST /admin/locations
	// Body: { type, name, parent_id, code? }
	// 201 -> Location (status = "pending", awaiting Super Admin approval)
	h.createLocationAdmin(w, r)
}

func (h *Handler) approveLocation(w http.ResponseWriter, r *http.Request) {
	// PATCH /admin/locations/{id} -> 200 Location
	h.approveLocationAdmin(w, r)
}

func (h *Handler) listDepartments(w http.ResponseWriter, r *http.Request) {
	// GET /admin/departments -> 200 { "items": Department[] }
	h.listDepartmentsAdmin(w, r)
}

func (h *Handler) listTenants(w http.ResponseWriter, r *http.Request) {
	// GET /admin/tenants -> 200 { "items": Tenant[] }
	h.listTenantsAdmin(w, r)
}

func (h *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	// GET /admin/users -> 200 { "items": User[] }
	h.listUsersAdmin(w, r)
}

func (h *Handler) approveUser(w http.ResponseWriter, r *http.Request) {
	// PATCH /admin/users/{id} -> 200 User
	h.approveUserAdmin(w, r)
}

func (h *Handler) listTemplates(w http.ResponseWriter, r *http.Request) {
	// GET /admin/templates -> 200 { "items": MessageTemplate[] }
	h.listTemplatesAdmin(w, r)
}

func (h *Handler) listNotifications(w http.ResponseWriter, r *http.Request) {
	// GET /admin/notifications -> 200 { "items": Notification[] }
	h.listNotificationsAdmin(w, r)
}

func (h *Handler) retryNotification(w http.ResponseWriter, r *http.Request) {
	// POST /admin/notifications/{id}/retry -> 200 Notification
	h.retryNotificationAdmin(w, r)
}

func (h *Handler) listAuditLogs(w http.ResponseWriter, r *http.Request) {
	// GET /admin/audit-logs -> 200 { "items": AuditLog[] }
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	limit := queryInt(r, "limit", 50)
	items, err := h.Store.ListAuditLogs(r.Context(), scope, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load audit logs")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
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
