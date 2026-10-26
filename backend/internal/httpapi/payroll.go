package httpapi

import (
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/mobigate/mgm-portal/internal/models"
	"github.com/mobigate/mgm-portal/internal/store"
)

// This file holds the payroll endpoints shared by the staff portal and the
// admin payroll workspace. Amounts cross the wire as integer kobo; the
// frontend is responsible for naira formatting.

type salaryPaymentRequest struct {
	StaffProfileID string  `json:"staff_profile_id"`
	Month          int     `json:"month"`
	Year           int     `json:"year"`
	AmountKobo     int64   `json:"amount_kobo"`
	Note           *string `json:"note"`
}

type advanceRequestPayload struct {
	AmountKobo int64  `json:"amount_kobo"`
	Reason     string `json:"reason"`
}

type advanceDecisionRequest struct {
	Status models.AdvanceRequestStatus `json:"status"`
	Note   *string                     `json:"note"`
}

// staffPayroll handles GET /staff/payroll.
func (h *Handler) staffPayroll(w http.ResponseWriter, r *http.Request) {
	session, ok := h.publicSession(w, r)
	if !ok {
		return
	}
	userID, ok := sessionUserID(w, session)
	if !ok {
		return
	}
	if !h.requireStore(w) {
		return
	}

	payroll, err := h.Store.StaffPayroll(r.Context(), userID)
	if err != nil {
		writeCandidateError(w, err, "could not load your payroll details")
		return
	}
	writeJSON(w, http.StatusOK, payroll)
}

// requestAdvance handles POST /staff/payroll/advances.
func (h *Handler) requestAdvance(w http.ResponseWriter, r *http.Request) {
	session, ok := h.publicSession(w, r)
	if !ok {
		return
	}
	userID, ok := sessionUserID(w, session)
	if !ok {
		return
	}
	if !h.requireStore(w) {
		return
	}

	var req advanceRequestPayload
	if err := decodeJSONBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "the request could not be read")
		return
	}

	advance, err := h.Store.RequestAdvance(r.Context(), userID, store.AdvanceRequestInput{
		AmountKobo: req.AmountKobo,
		Reason:     req.Reason,
	})
	if err != nil {
		writeCandidateError(w, err, "could not submit your advance request")
		return
	}
	writeJSON(w, http.StatusCreated, advance)
}

// listSalaryPayments handles GET /admin/payroll/salary.
func (h *Handler) listSalaryPayments(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}

	var staffProfileID *uuid.UUID
	if raw := strings.TrimSpace(r.URL.Query().Get("staff_profile_id")); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid staff member")
			return
		}
		staffProfileID = &parsed
	}

	payments, err := h.Store.ListSalaryPaymentsAdmin(r.Context(), store.SalaryPaymentQuery{
		TenantID:       scope,
		Year:           queryInt(r, "year", 0),
		StaffProfileID: staffProfileID,
	})
	if err != nil {
		writeStoreError(w, err, "could not load salary payments")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": payments})
}

// upsertSalaryPayment handles POST /admin/payroll/salary. Saving the same
// staff/month/year again updates the assignment instead of creating a second
// record.
func (h *Handler) upsertSalaryPayment(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	tenantID := scope
	if tenantID == nil {
		tenantID = adminTenantID(r)
	}
	if tenantID == nil {
		writeError(w, http.StatusForbidden, "choose a tenant before assigning salary")
		return
	}

	var req salaryPaymentRequest
	if err := decodeJSONBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "the request could not be read")
		return
	}
	staffProfileID, err := uuid.Parse(strings.TrimSpace(req.StaffProfileID))
	if err != nil {
		writeError(w, http.StatusBadRequest, "choose a staff member")
		return
	}

	payment, err := h.Store.UpsertSalaryPayment(r.Context(), *tenantID, adminActorID(r),
		store.SalaryPaymentInput{
			StaffProfileID: staffProfileID,
			Month:          req.Month,
			Year:           req.Year,
			AmountKobo:     req.AmountKobo,
			Note:           req.Note,
		})
	if err != nil {
		writeStoreError(w, err, "could not save the salary assignment")
		return
	}
	writeJSON(w, http.StatusOK, payment)
}

// listAdvanceRequests handles GET /admin/payroll/advances.
func (h *Handler) listAdvanceRequests(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}

	status := models.AdvanceRequestStatus(strings.TrimSpace(r.URL.Query().Get("status")))
	requests, err := h.Store.ListAdvanceRequestsAdmin(r.Context(), store.AdvanceRequestQuery{
		TenantID: scope,
		Status:   status,
	})
	if err != nil {
		writeStoreError(w, err, "could not load advance requests")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": requests})
}

// decideAdvanceRequest handles PATCH /admin/payroll/advances/{id}.
func (h *Handler) decideAdvanceRequest(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	tenantID := scope
	if tenantID == nil {
		tenantID = adminTenantID(r)
	}
	if tenantID == nil {
		writeError(w, http.StatusForbidden, "choose a tenant before deciding a request")
		return
	}
	id, ok := h.uuidParam(w, r, "id")
	if !ok {
		return
	}

	var req advanceDecisionRequest
	if err := decodeJSONBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "the request could not be read")
		return
	}

	advance, err := h.Store.DecideAdvanceRequest(r.Context(), *tenantID, adminActorID(r),
		id, req.Status, req.Note)
	if err != nil {
		writeStoreError(w, err, "could not update the advance request")
		return
	}
	writeJSON(w, http.StatusOK, advance)
}
