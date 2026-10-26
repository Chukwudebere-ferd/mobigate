package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/mobigate/mgm-portal/internal/models"
	"github.com/mobigate/mgm-portal/internal/store"
)

// This file holds the admin-managed policy endpoints and the shared helpers
// used by the applicant and staff forms to enforce policy acknowledgements.

type policyRequest struct {
	Title    string `json:"title"`
	Body     string `json:"body"`
	Audience string `json:"audience"`
	Required *bool  `json:"required"`
	Active   *bool  `json:"active"`
}

func (r policyRequest) input(required, active bool) store.PolicyInput {
	if r.Required != nil {
		required = *r.Required
	}
	if r.Active != nil {
		active = *r.Active
	}
	return store.PolicyInput{
		Title:    r.Title,
		Body:     r.Body,
		Audience: models.PolicyAudience(strings.TrimSpace(r.Audience)),
		Required: required,
		Active:   active,
	}
}

// listPublicPolicies serves the active policies for one audience. It is used
// by the applicant form and the staff onboarding form; no personal data is
// exposed.
func (h *Handler) listPublicPolicies(w http.ResponseWriter, r *http.Request) {
	if !h.requireStore(w) {
		return
	}
	audience := models.PolicyAudience(strings.TrimSpace(r.URL.Query().Get("audience")))
	switch audience {
	case models.PolicyApplicant, models.PolicyStaff:
	default:
		writeError(w, http.StatusBadRequest, "choose an applicant or staff audience")
		return
	}
	items, err := h.Store.ApplicablePolicies(r.Context(), audience)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load policies")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) listAdminPolicies(w http.ResponseWriter, r *http.Request) {
	if !h.requireStore(w) {
		return
	}
	items, err := h.Store.ListPolicies(r.Context(), false)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load policies")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) createPolicy(w http.ResponseWriter, r *http.Request) {
	session, ok := h.publicSession(w, r)
	if !ok {
		return
	}
	actorID, ok := sessionUserID(w, session)
	if !ok {
		return
	}
	if !h.requireStore(w) {
		return
	}
	var req policyRequest
	if err := decodeJSONBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "the request could not be read")
		return
	}
	policy, err := h.Store.CreatePolicy(r.Context(), actorID, req.input(true, true))
	if err != nil {
		if errors.Is(err, store.ErrValidation) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "could not create the policy")
		return
	}
	writeJSON(w, http.StatusCreated, policy)
}

func (h *Handler) updatePolicy(w http.ResponseWriter, r *http.Request) {
	if !h.requireStore(w) {
		return
	}
	id, ok := h.uuidParam(w, r, "id")
	if !ok {
		return
	}
	var req policyRequest
	if err := decodeJSONBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "the request could not be read")
		return
	}
	policy, err := h.Store.UpdatePolicy(r.Context(), id, req.input(true, true))
	if err != nil {
		if errors.Is(err, store.ErrValidation) {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		translateStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, policy)
}

func (h *Handler) deletePolicy(w http.ResponseWriter, r *http.Request) {
	if !h.requireStore(w) {
		return
	}
	id, ok := h.uuidParam(w, r, "id")
	if !ok {
		return
	}
	if err := h.Store.DeletePolicy(r.Context(), id); err != nil {
		translateStoreError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// parsePolicyIDs reads the comma-separated policy_ids form field.
func parsePolicyIDs(raw string) ([]uuid.UUID, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	parts := strings.Split(raw, ",")
	ids := make([]uuid.UUID, 0, len(parts))
	seen := make(map[uuid.UUID]struct{}, len(parts))
	for _, part := range parts {
		id, err := uuid.Parse(strings.TrimSpace(part))
		if err != nil {
			return nil, errors.New("one of the selected policies is invalid")
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids, nil
}

// requirePolicies validates that every required policy for the audience was
// acknowledged, and records the acceptance for the signed-in user.
func (h *Handler) requirePolicies(
	w http.ResponseWriter,
	r *http.Request,
	userID uuid.UUID,
	audience models.PolicyAudience,
	rawIDs string,
) bool {
	ids, err := parsePolicyIDs(rawIDs)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return false
	}
	missing, err := h.Store.MissingRequiredPolicies(r.Context(), audience, ids)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not check the policy acknowledgements")
		return false
	}
	if len(missing) > 0 {
		writeError(w, http.StatusBadRequest, "accept these policies to continue: "+strings.Join(missing, ", "))
		return false
	}
	if err := h.Store.RecordPolicyAcceptances(r.Context(), userID, ids); err != nil {
		writeError(w, http.StatusInternalServerError, "could not record the policy acknowledgements")
		return false
	}
	return true
}
