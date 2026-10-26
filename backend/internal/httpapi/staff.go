package httpapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/mobigate/mgm-portal/internal/models"
	"github.com/mobigate/mgm-portal/internal/storage"
	"github.com/mobigate/mgm-portal/internal/store"
)

// This file holds the staff portal endpoints: code redemption, the
// onboarding draft, and the atomic onboarding submission.
//
// Redemption hands back a short-lived ticket signed with the service
// secret. The ticket authorises the draft and submission endpoints for that
// code and that user; it is not a session and carries no role.

// ticketTTL bounds how long a redemption may sit un-submitted.
const ticketTTL = 30 * time.Minute

// ticketMaxBytes caps the onboarding request body (documents included).
const ticketMaxBytes = 16 << 20

// redeemRequest is the POST /staff/redeem body.
type redeemRequest struct {
	Code string `json:"code"`
}

func (h *Handler) redeemAccessCode(w http.ResponseWriter, r *http.Request) {
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

	var req redeemRequest
	if err := decodeJSONBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "the request could not be read")
		return
	}
	if strings.TrimSpace(req.Code) == "" {
		writeError(w, http.StatusBadRequest, "enter your access code")
		return
	}

	// Redemption is attempted by candidates who may not have an account yet;
	// the per-IP attempt limiter is the backstop against guessing (BR-06 is
	// the per-code backstop).
	if h.redeemAttempts != nil && !h.redeemAttempts.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests, "too many attempts; try again in a few minutes")
		return
	}

	redemption, err := h.Store.RedeemAccessCode(r.Context(), req.Code, clientIP(r))
	if err != nil {
		writeCandidateError(w, err, "the code could not be redeemed")
		return
	}

	// The signed ticket ties the draft and submission endpoints to this
	// code and this user without storing server-side state.
	ticket, err := h.signTicket(userID, redemption.CodeID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not start onboarding")
		return
	}

	policies, err := h.Store.ApplicablePolicies(r.Context(), models.PolicyStaff)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load the staff policies")
		return
	}

	payload := map[string]any{
		"ticket":            ticket,
		"ticket_expires_at": time.Now().Add(ticketTTL).UTC().Format(time.RFC3339),
		"departments":       redemption.Departments,
		"policies":          policies,
	}
	if redemption.Application != nil {
		payload["application"] = redemption.Application
	}
	switch {
	case redemption.Staff != nil:
		// An existing staff record already holds the details captured by the
		// admin. Prefill them and let onboarding update the same profile.
		staff := redemption.Staff
		payload["prefill"] = map[string]any{
			"first_name":               staff.FirstName,
			"last_name":                staff.LastName,
			"email":                    staff.Email,
			"phone":                    staff.Phone,
			"gender":                   staff.Gender,
			"date_of_birth":            staff.DateOfBirth,
			"location_id":              staff.LocationID,
			"address_line":             staff.AddressLine,
			"employment_category":      staff.EmploymentCategory,
			"department_id":            staff.DepartmentID,
			"position":                 staff.Position,
			"appointment_date":         staff.AppointmentDate,
			"bank_name":                staff.BankName,
			"bank_account_name":        staff.BankAccountName,
			"bank_account_number":      staff.BankAccountNumber,
			"guarantor_name":           staff.GuarantorName,
			"guarantor_phone":          staff.GuarantorPhone,
			"guarantor_address":        staff.GuarantorAddress,
			"guarantor_relationship":   staff.GuarantorRelationship,
			"next_of_kin_name":         staff.NextOfKinName,
			"next_of_kin_phone":        staff.NextOfKinPhone,
			"next_of_kin_relationship": staff.NextOfKinRelationship,
		}
	case redemption.Application != nil:
		// Seed the form so the applicant does not retype their details.
		payload["prefill"] = map[string]any{
			"first_name":    redemption.Application.FirstName,
			"last_name":     redemption.Application.LastName,
			"email":         redemption.Application.Email,
			"phone":         redemption.Application.Phone,
			"gender":        redemption.Application.Gender,
			"date_of_birth": redemption.Application.DateOfBirth,
			"location_id":   redemption.Application.LocationID,
			"address_line":  redemption.Application.AddressLine,
		}
	}

	// A previously saved draft wins over the prefill.
	draft, err := h.Store.GetStaffDraft(r.Context(), userID, redemption.CodeID)
	if err == nil && draft != nil {
		payload["draft"] = draft
	}

	writeJSON(w, http.StatusOK, payload)
}

// getOnboardingDraft handles GET /staff/onboarding/draft.
func (h *Handler) getOnboardingDraft(w http.ResponseWriter, r *http.Request) {
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
	codeID, ok := h.ticketCodeID(w, r, userID)
	if !ok {
		return
	}
	draft, err := h.Store.GetStaffDraft(r.Context(), userID, codeID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load your draft")
		return
	}
	if draft == nil {
		writeJSON(w, http.StatusOK, map[string]any{"draft": map[string]any{}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"draft": draft})
}

// saveOnboardingDraft handles PUT /staff/onboarding/draft: an opaque JSON
// snapshot of the form, resumed across sessions (README §M9).
func (h *Handler) saveOnboardingDraft(w http.ResponseWriter, r *http.Request) {
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
	redemption, ok := h.redemptionFromTicket(w, r, userID)
	if !ok {
		return
	}

	var body struct {
		Draft map[string]any `json:"draft"`
	}
	if err := decodeJSONBody(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "the draft could not be saved")
		return
	}
	if body.Draft == nil {
		body.Draft = map[string]any{}
	}
	if err := h.Store.SaveStaffDraft(r.Context(), userID, redemption.CodeID, redemption.TenantID, body.Draft); err != nil {
		writeError(w, http.StatusInternalServerError, "could not save your draft")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"saved": true})
}

// completeOnboarding handles POST /staff/onboarding as multipart/form-data:
// the form fields plus supporting document images. The staff profile, the
// Staff ID, the code consumption, the draft removal and the audit entry are
// committed together (BR-11).
func (h *Handler) completeOnboarding(w http.ResponseWriter, r *http.Request) {
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
	redemption, ok := h.redemptionFromTicket(w, r, userID)
	if !ok {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, ticketMaxBytes)
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "the form could not be read; check the document sizes")
		return
	}
	defer func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}()

	in := store.OnboardingInput{
		CodeID:      redemption.CodeID,
		UserID:      userID,
		StaffUserID: userID,
	}
	if redemption.Application != nil {
		in.SetApplicationID(&redemption.Application.ID)
	}

	if err := decodeOnboardingForm(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if !h.requirePolicies(w, r, userID, models.PolicyStaff, r.FormValue("policy_ids")) {
		return
	}

	// Supporting documents: images only for now, same store as photos.
	uploaded := make([]string, 0, 3)
	for _, field := range []struct {
		name     string
		category string
	}{
		{"id_document", "id_proof"},
		{"qualification_document", "qualification"},
		{"other_document", "other"},
	} {
		file, header, err := h.singleUpload(r, field.name, maxPhotoBytes)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if header == nil {
			continue
		}
		key, uploadErr := h.Storage.Upload(r.Context(),
			fmt.Sprintf("users/%s/staff/%s-%s", userID, field.category, uuid.NewString()[:8]),
			sanitizeFilename(header.Filename), detectPhotoType(header), file, header.Size,
		)
		file.Close()
		if uploadErr != nil {
			for _, prior := range uploaded {
				h.Storage.Delete(r.Context(), prior)
			}
			writeError(w, http.StatusBadGateway, "a document could not be uploaded; try again")
			return
		}
		uploaded = append(uploaded, key)
		in.Documents = append(in.Documents, store.OnboardingDocument{
			Category: field.category,
			File: store.DocumentInput{
				FileName:   sanitizeFilename(header.Filename),
				StorageKey: key,
				MimeType:   detectPhotoType(header),
				SizeBytes:  header.Size,
			},
		})
	}

	profile, err := h.Store.CompleteOnboarding(r.Context(), in)
	if err != nil {
		for _, key := range uploaded {
			h.Storage.Delete(r.Context(), key)
		}
		writeCandidateError(w, err, "your staff profile could not be created")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"staff": profile})
}

// staffMe handles GET /staff/me: the signed-in staff member's own profile
// and documents. Bank and guarantor details are visible to the owner (README
// §M10).
func (h *Handler) staffMe(w http.ResponseWriter, r *http.Request) {
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
	profile, err := h.Store.StaffByUserID(r.Context(), userID)
	if err != nil {
		translateStoreError(w, err)
		return
	}
	documents, err := h.Store.StaffDocuments(r.Context(), profile.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load documents")
		return
	}
	// Strip storage keys; delivery goes through the signed-URL route.
	items := make([]map[string]any, 0, len(documents))
	for _, doc := range documents {
		items = append(items, map[string]any{
			"id":         doc.ID.String(),
			"category":   doc.Category,
			"file_name":  doc.FileName,
			"mime_type":  doc.MimeType,
			"size_bytes": doc.SizeBytes,
			"created_at": doc.CreatedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"staff":     profile,
		"documents": items,
	})
}

// staffDocumentURL handles GET /staff/documents/{id}: a short-lived signed URL
// for one of the caller's own documents. Ownership is checked before the
// storage key is read; another staff member's document is a 404 (BR-15).
func (h *Handler) staffDocumentURL(w http.ResponseWriter, r *http.Request) {
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
	if h.Storage == nil || !h.Storage.Configured() {
		writeError(w, http.StatusServiceUnavailable, "document downloads are not configured")
		return
	}
	id, ok := h.uuidParam(w, r, "id")
	if !ok {
		return
	}
	profile, err := h.Store.StaffByUserID(r.Context(), userID)
	if err != nil {
		translateStoreError(w, err)
		return
	}
	document, err := h.Store.DocumentByID(r.Context(), id)
	if err != nil {
		translateStoreError(w, err)
		return
	}
	if document.OwnerType != "staff" || document.OwnerID != profile.ID {
		writeError(w, http.StatusNotFound, "document not found")
		return
	}
	url, err := h.Storage.SignedURL(r.Context(), document.StorageKey)
	if err != nil {
		writeError(w, http.StatusBadGateway, "the document could not be opened; try again")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"url":        url,
		"file_name":  document.FileName,
		"mime_type":  document.MimeType,
		"expires_in": int(storage.SignedURLTTL.Seconds()),
	})
}

// -- Helpers -----------------------------------------------------------------

// decodeOnboardingForm reads the staff details sections of the form.
func decodeOnboardingForm(r *http.Request, in *store.OnboardingInput) error {
	value := func(name string) string { return strings.TrimSpace(r.FormValue(name)) }

	// Bio-data.
	in.FirstName, in.LastName = value("first_name"), value("last_name")
	in.Email, in.Phone = value("email"), value("phone")
	if in.FirstName == "" || in.LastName == "" || in.Email == "" || in.Phone == "" {
		return errors.New("full name, email and phone are required")
	}
	if !strings.Contains(in.Email, "@") {
		return errors.New("enter a valid email address")
	}
	if len(in.Phone) < 7 {
		return errors.New("enter a valid phone number")
	}
	if raw := value("gender"); raw != "" {
		in.Gender = &raw
	}
	if raw := value("date_of_birth"); raw != "" {
		parsed, err := time.Parse("2006-01-02", raw)
		if err != nil {
			return errors.New("enter a valid date of birth")
		}
		in.DateOfBirth = &parsed
	}
	if raw := value("address_line"); raw != "" {
		in.AddressLine = &raw
	}
	if raw := value("location_id"); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			return errors.New("invalid location selection")
		}
		in.LocationID = &parsed
	}

	// Employment.
	category := models.EmploymentCategory(value("employment_category"))
	switch category {
	case models.CategoryDirector, models.CategoryEmployee,
		models.CategoryContractor, models.CategoryPartner:
		in.EmploymentCategory = category
	default:
		return errors.New("select an employment category")
	}
	if raw := value("department_id"); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			return errors.New("invalid department selection")
		}
		in.DepartmentID = &parsed
	}
	if raw := value("position"); raw != "" {
		in.Position = &raw
	}
	if raw := value("appointment_date"); raw != "" {
		parsed, err := time.Parse("2006-01-02", raw)
		if err != nil {
			return errors.New("enter a valid appointment date")
		}
		in.AppointmentDate = &parsed
	}

	// Banking (README §M9: validated where the bank is supported; format
	// validation only until a verification provider is connected).
	if raw := value("bank_name"); raw != "" {
		in.BankName = &raw
	}
	if raw := value("bank_account_name"); raw != "" {
		in.BankAccountName = &raw
	}
	if raw := value("bank_account_number"); raw != "" {
		digits := strings.Map(func(r rune) rune {
			if r >= '0' && r <= '9' {
				return r
			}
			return -1
		}, raw)
		if len(digits) < 8 || len(digits) > 10 {
			return errors.New("enter a valid account number (8-10 digits)")
		}
		in.BankAccountNumber = &digits
	}

	// Guarantor.
	if raw := value("guarantor_name"); raw != "" {
		in.GuarantorName = &raw
	}
	if raw := value("guarantor_phone"); raw != "" {
		in.GuarantorPhone = &raw
	}
	if raw := value("guarantor_address"); raw != "" {
		in.GuarantorAddress = &raw
	}
	if raw := value("guarantor_relationship"); raw != "" {
		in.GuarantorRelationship = &raw
	}

	// Next of kin.
	if raw := value("next_of_kin_name"); raw != "" {
		in.NextOfKinName = &raw
	}
	if raw := value("next_of_kin_phone"); raw != "" {
		in.NextOfKinPhone = &raw
	}
	if raw := value("next_of_kin_relationship"); raw != "" {
		in.NextOfKinRelationship = &raw
	}

	if value("rules_accepted") != "true" {
		return errors.New("accept the rules of engagement to continue")
	}
	return nil
}

// singleUpload returns the one file filed under name, or nil when absent.
func (h *Handler) singleUpload(r *http.Request, name string, maxBytes int64) (multipart.File, *multipart.FileHeader, error) {
	if r.MultipartForm == nil {
		return nil, nil, nil
	}
	files := r.MultipartForm.File[name]
	if len(files) == 0 {
		return nil, nil, nil
	}
	header := files[0]
	if header.Size > maxBytes {
		return nil, nil, errors.New("documents must be 2 MB or smaller")
	}
	file, err := header.Open()
	if err != nil {
		return nil, nil, errors.New("a document could not be read")
	}
	head := make([]byte, 512)
	n, _ := io.ReadFull(file, head)
	file.Close()
	if !isAllowedPhotoType(http.DetectContentType(head[:n])) {
		return nil, nil, errors.New("documents must be PNG, JPG or WEBP images")
	}
	file, err = header.Open()
	if err != nil {
		return nil, nil, errors.New("a document could not be read")
	}
	return file, header, nil
}

// signTicket builds an HMAC-signed ticket binding a redemption to a user.
func (h *Handler) signTicket(userID, codeID uuid.UUID) (string, error) {
	if h.TicketSecret == "" {
		return "", errors.New("ticket secret not configured")
	}
	expiry := time.Now().Add(ticketTTL).Unix()
	body := fmt.Sprintf("%s|%s|%d", userID, codeID, expiry)
	mac := hmac.New(sha256.New, []byte(h.TicketSecret))
	mac.Write([]byte(body))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return base64.RawURLEncoding.EncodeToString([]byte(body)) + "." + signature, nil
}

// verifyTicket parses a ticket and returns its user and code IDs.
func (h *Handler) verifyTicket(token string) (uuid.UUID, uuid.UUID, error) {
	if h.TicketSecret == "" {
		return uuid.Nil, uuid.Nil, errors.New("ticket secret not configured")
	}
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return uuid.Nil, uuid.Nil, errors.New("malformed ticket")
	}
	bodyBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return uuid.Nil, uuid.Nil, errors.New("malformed ticket")
	}
	mac := hmac.New(sha256.New, []byte(h.TicketSecret))
	mac.Write(bodyBytes)
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(parts[1])) {
		return uuid.Nil, uuid.Nil, errors.New("invalid ticket")
	}
	// The body is `userID|codeID|expiry`. Do not use fmt.Sscanf here:
	// `%s` consumes the whole body (it stops only at whitespace), so every
	// ticket failed verification. Split on the delimiter and parse each
	// part explicitly.
	fields := strings.Split(string(bodyBytes), "|")
	if len(fields) != 3 {
		return uuid.Nil, uuid.Nil, errors.New("malformed ticket")
	}
	userID, err := uuid.Parse(fields[0])
	if err != nil {
		return uuid.Nil, uuid.Nil, errors.New("malformed ticket")
	}
	codeID, err := uuid.Parse(fields[1])
	if err != nil {
		return uuid.Nil, uuid.Nil, errors.New("malformed ticket")
	}
	expiry, err := strconv.ParseInt(fields[2], 10, 64)
	if err != nil {
		return uuid.Nil, uuid.Nil, errors.New("malformed ticket")
	}
	if time.Now().Unix() > expiry {
		return uuid.Nil, uuid.Nil, errors.New("ticket expired")
	}
	return userID, codeID, nil
}

// ticketCodeID reads and verifies the X-Onboarding-Ticket header.
func (h *Handler) ticketCodeID(w http.ResponseWriter, r *http.Request, userID uuid.UUID) (uuid.UUID, bool) {
	token := strings.TrimSpace(r.Header.Get("X-Onboarding-Ticket"))
	if token == "" {
		writeError(w, http.StatusUnauthorized, "redeem your access code first")
		return uuid.Nil, false
	}
	ticketUser, codeID, err := h.verifyTicket(token)
	if err != nil || ticketUser != userID {
		writeError(w, http.StatusUnauthorized, "your onboarding session expired; redeem the code again")
		return uuid.Nil, false
	}
	return codeID, true
}

// redemptionFromTicket verifies the ticket and reloads the redemption
// context, so the endpoints cannot be used after the code changed state.
func (h *Handler) redemptionFromTicket(w http.ResponseWriter, r *http.Request, userID uuid.UUID) (store.Redemption, bool) {
	codeID, ok := h.ticketCodeID(w, r, userID)
	if !ok {
		return store.Redemption{}, false
	}
	redemption, err := h.Store.RedeemAccessCodeByID(r.Context(), codeID, userID)
	if err != nil {
		writeCandidateError(w, err, "your onboarding session is no longer valid")
		return store.Redemption{}, false
	}
	return redemption, true
}

// decodeJSONBody reads a bounded JSON request body.
func decodeJSONBody(r *http.Request, dest any) error {
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		return errors.New("could not read request")
	}
	if len(body) == 0 {
		return nil
	}
	if err := json.Unmarshal(body, dest); err != nil {
		return errors.New("invalid JSON body")
	}
	return nil
}

// clientIP returns the caller address for rate limiting.
func clientIP(r *http.Request) string {
	host := r.RemoteAddr
	if idx := strings.LastIndex(host, ":"); idx > 0 {
		host = host[:idx]
	}
	return host
}

// attemptLimiter is a fixed-window per-key counter. It guards code
// redemption against guessing before a code row even exists to lock.
type attemptLimiter struct {
	mu      sync.Mutex
	buckets map[string]*attemptBucket
	limit   int
	window  time.Duration
}

type attemptBucket struct {
	count   int
	resetAt time.Time
}

func newAttemptLimiter(limit int, window time.Duration) *attemptLimiter {
	return &attemptLimiter{
		buckets: make(map[string]*attemptBucket),
		limit:   limit,
		window:  window,
	}
}

// allow reports whether the key has budget left, consuming one attempt.
func (l *attemptLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	bucket, ok := l.buckets[key]
	if !ok || now.After(bucket.resetAt) {
		bucket = &attemptBucket{resetAt: now.Add(l.window)}
		l.buckets[key] = bucket
	}
	// Opportunistic cleanup so the map cannot grow without bound.
	if len(l.buckets) > 10000 {
		for k, b := range l.buckets {
			if now.After(b.resetAt) {
				delete(l.buckets, k)
			}
		}
	}
	if bucket.count >= l.limit {
		return false
	}
	bucket.count++
	return true
}

// parseIntParam is a small helper for query parsing in this file.
func parseIntParam(raw string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || value < 0 {
		return fallback
	}
	return value
}

// InitRedeemLimiter configures the per-IP redemption throttle. Call once
// during wiring; leaving it unset disables the limit (used by tests).
func (h *Handler) InitRedeemLimiter(limit int, window time.Duration) {
	h.redeemAttempts = newAttemptLimiter(limit, window)
}
