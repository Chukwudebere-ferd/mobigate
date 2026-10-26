package httpapi

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mobigate/mgm-portal/internal/auth"
	"github.com/mobigate/mgm-portal/internal/models"
	"github.com/mobigate/mgm-portal/internal/storage"
	"github.com/mobigate/mgm-portal/internal/store"
)

// This file holds the candidate-facing handlers: the public careers surface,
// application submission with photo upload, the /me reads and edits, and the
// staff redemption and onboarding endpoints.

// Upload limits (README §M4). CVs are deferred until object storage for
// documents is settled; photos go to Byteship today.
const (
	maxPhotoBytes = 2 << 20 // 2 MB
	photoTypes    = "image/jpeg,image/png,image/webp"
)

// publicSession resolves the signed-in user for /me and /staff routes.
//
// Most callers sit behind require/MiddlewareAllowPending, which has already
// attached a session. Public POST routes such as application submission use
// the same handler but cannot require a whole auth group; resolve the cookie
// directly in that case.
func (h *Handler) publicSession(w http.ResponseWriter, r *http.Request) (auth.Context, bool) {
	if session, ok := auth.FromContext(r.Context()); ok {
		return session, true
	}
	if h.Verifier == nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return auth.Context{}, false
	}
	session, err := h.Verifier.Verify(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return auth.Context{}, false
	}
	return session, true
}

// sessionUserID parses the session user ID as a UUID.
func sessionUserID(w http.ResponseWriter, session auth.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(session.User.ID)
	if err != nil {
		writeError(w, http.StatusForbidden, "account has an invalid identity")
		return uuid.Nil, false
	}
	return id, true
}

// -- Public careers ----------------------------------------------------------

func (h *Handler) listPublicJobs(w http.ResponseWriter, r *http.Request) {
	if !h.requireStore(w) {
		return
	}
	items, err := h.Store.ListPublicJobs(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load open roles")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) getPublicJob(w http.ResponseWriter, r *http.Request) {
	if !h.requireStore(w) {
		return
	}
	job, err := h.Store.GetPublicJob(r.Context(), strings.TrimSpace(chi.URLParam(r, "slug")))
	if err != nil {
		translateStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func (h *Handler) publicLocations(w http.ResponseWriter, r *http.Request) {
	if !h.requireStore(w) {
		return
	}
	items, err := h.Store.PublicLocations(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load locations")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) publicDepartments(w http.ResponseWriter, r *http.Request) {
	if !h.requireStore(w) {
		return
	}
	items, err := h.Store.PublicDepartments(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load departments")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

// -- Application submission ---------------------------------------------------

// provisionApplicant handles POST /public/provision. Better Auth has already
// created the identity and issued the session cookie at signup; this creates
// the domain users row every /me route authorises against, so a fresh
// account can use the API immediately.
//
// The role is taken from nothing the client controls: only an identity whose
// Better Auth role is already `applicant` may provision, and the row is
// written with role=applicant regardless. Admin and staff identities are
// provisioned by their own administrative flows.
func (h *Handler) provisionApplicant(w http.ResponseWriter, r *http.Request) {
	if h.Verifier == nil {
		writeError(w, http.StatusServiceUnavailable, "authentication is not configured")
		return
	}
	identity, err := h.Verifier.VerifyIdentity(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}
	if identity.Role != models.RoleApplicant {
		writeError(w, http.StatusForbidden, "this account is managed by an administrator")
		return
	}
	if !h.requireStore(w) {
		return
	}

	firstName, lastName := splitDisplayName(identity.Name)
	user, err := h.Store.ProvisionApplicant(r.Context(), identity.ID, identity.Email, firstName, lastName)
	if err != nil {
		translateStoreError(w, err)
		return
	}

	tenantID := ""
	if user.TenantID != nil {
		tenantID = user.TenantID.String()
	}
	h.writeCurrentUser(w, r, auth.Context{User: auth.User{
		ID:        user.ID.String(),
		Email:     user.Email,
		Role:      user.Role,
		Status:    user.Status,
		TenantID:  tenantID,
		FirstName: user.FirstName,
		LastName:  user.LastName,
	}})
}

// splitDisplayName splits Better Auth's single display name into first and
// last parts. A single-word name is used for both; an empty name falls back
// to a neutral placeholder because the users table requires both columns.
func splitDisplayName(name string) (string, string) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "New", "Applicant"
	}
	if idx := strings.IndexAny(name, " \t"); idx > 0 {
		first := name[:idx]
		if last := strings.TrimSpace(name[idx+1:]); last != "" {
			return first, last
		}
	}
	return name, name
}

// submitApplication handles POST /public/applications as multipart/form-data:
// the form fields plus the photo file. The photo is uploaded to Byteship
// before the database transaction; a failed transaction cleans the object
// up best-effort so no orphan outlives a rejected application.
func (h *Handler) submitApplication(w http.ResponseWriter, r *http.Request) {
	session, ok := h.publicSession(w, r)
	if !ok {
		return
	}
	if session.User.Status != models.UserStatusActive {
		writeError(w, http.StatusForbidden, "your account is not active")
		return
	}
	applicantID, ok := sessionUserID(w, session)
	if !ok {
		return
	}
	if !h.requireStore(w) {
		return
	}
	if err := r.ParseMultipartForm(maxPhotoBytes); err != nil {
		writeError(w, http.StatusBadRequest, "the form could not be read; check the photo size (2 MB max)")
		return
	}
	defer func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}()

	in := store.ApplicationInput{
		ApplicantID: applicantID,
		Email:       session.User.Email,
	}
	if err := decodeApplicationForm(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if !h.requirePolicies(w, r, applicantID, models.PolicyApplicant, r.FormValue("policy_ids")) {
		return
	}

	// Deadline and publication state are re-checked in the transaction; the
	// job ID is the only authority, never a client-supplied status.
	jobID, err := uuid.Parse(r.FormValue("job_id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "select a role to apply for")
		return
	}
	in.JobID = jobID

	file, header, err := h.photoFromForm(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if file != nil {
		defer file.Close()
		key, docErr := h.uploadPhoto(r.Context(), applicantID, file, header)
		if docErr != nil {
			writeError(w, http.StatusBadGateway, "the photograph could not be uploaded; try again")
			return
		}
		in.Photo = &store.DocumentInput{
			FileName:   sanitizeFilename(header.Filename),
			StorageKey: key,
			MimeType:   detectPhotoType(header),
			SizeBytes:  header.Size,
		}
	}

	application, err := h.Store.SubmitApplication(r.Context(), in)
	if err != nil {
		if in.Photo != nil {
			h.Storage.Delete(r.Context(), in.Photo.StorageKey)
		}
		writeCandidateError(w, err, "we could not submit your application")
		return
	}
	writeJSON(w, http.StatusCreated, application)
}

// decodeApplicationForm reads and validates the multipart text fields.
func decodeApplicationForm(r *http.Request, in *store.ApplicationInput) error {
	value := func(name string) string { return strings.TrimSpace(r.FormValue(name)) }

	firstName, lastName := value("first_name"), value("last_name")
	if firstName == "" || lastName == "" {
		return errors.New("first and last name are required")
	}
	in.FirstName, in.LastName = firstName, lastName

	phone := value("phone")
	if len(phone) < 7 {
		return errors.New("enter a valid phone number")
	}
	in.Phone = phone

	if gender := value("gender"); gender != "" {
		switch strings.ToLower(gender) {
		case "male", "female", "other":
			in.Gender = &gender
		default:
			return errors.New("select a gender")
		}
	}

	if raw := value("date_of_birth"); raw != "" {
		parsed, err := time.Parse("2006-01-02", raw)
		if err != nil || parsed.After(time.Now()) {
			return errors.New("enter a valid date of birth")
		}
		in.DateOfBirth = &parsed
	}

	if raw := value("location_id"); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			return errors.New("invalid location selection")
		}
		in.LocationID = &parsed
	}

	if raw := value("address_line"); raw != "" {
		in.AddressLine = &raw
	}
	if raw := value("qualification"); raw != "" {
		in.Qualification = &raw
	}

	// NDPA consent is mandatory (BR-14). The browser sends a boolean-ish
	// value; the server records its own timestamp and the notice version in
	// the store layer, never trusting a client-supplied time.
	switch strings.ToLower(value("consent")) {
	case "true", "1", "on", "yes":
		in.ConsentAccepted = true
	default:
		return errors.New("confirm that you agree to the data processing notice")
	}
	return nil
}

// photoFromForm extracts and validates the photo upload. A missing photo is
// accepted: some candidates apply from devices that cannot attach files.
func (h *Handler) photoFromForm(r *http.Request) (multipart.File, *multipart.FileHeader, error) {
	if r.MultipartForm == nil {
		return nil, nil, nil
	}
	files := r.MultipartForm.File["photo"]
	if len(files) == 0 {
		return nil, nil, nil
	}
	header := files[0]

	if header.Size > maxPhotoBytes {
		return nil, nil, errors.New("the photograph must be 2 MB or smaller")
	}

	file, err := header.Open()
	if err != nil {
		return nil, nil, errors.New("the photograph could not be read")
	}

	// Content sniffing, not the client-supplied type (README §11.3).
	head := make([]byte, 512)
	n, err := io.ReadFull(file, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		file.Close()
		return nil, nil, errors.New("the photograph could not be read")
	}
	detected := http.DetectContentType(head[:n])
	if !isAllowedPhotoType(detected) {
		file.Close()
		return nil, nil, errors.New("attach a PNG, JPG or WEBP image")
	}

	// Re-open so the upload reads from the start.
	file.Close()
	file, err = header.Open()
	if err != nil {
		return nil, nil, errors.New("the photograph could not be read")
	}
	return file, header, nil
}

// uploadPhoto streams a validated photo into Byteship under a tenant-scoped,
// non-public path.
func (h *Handler) uploadPhoto(ctx context.Context, applicantID uuid.UUID, reader io.Reader, header *multipart.FileHeader) (string, error) {
	if h.Storage == nil || !h.Storage.Configured() {
		return "", storage.ErrNotConfigured
	}
	key := fmt.Sprintf("users/%s/photos/%d-%s", applicantID, time.Now().UnixNano(), uuid.NewString()[:8])
	return h.Storage.Upload(ctx, key, sanitizeFilename(header.Filename), detectPhotoType(header), reader, header.Size)
}

// -- Applicant self-service ---------------------------------------------------

func (h *Handler) myApplications(w http.ResponseWriter, r *http.Request) {
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
	items, err := h.Store.MyApplications(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load your applications")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) myApplication(w http.ResponseWriter, r *http.Request) {
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
	id, ok := h.uuidParam(w, r, "id")
	if !ok {
		return
	}
	application, err := h.Store.GetMyApplication(r.Context(), userID, id)
	if err != nil {
		translateStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, application)
}

// myApplicationEvents handles GET /me/applications/{id}/events: the status
// timeline of an application the caller owns (BR-08).
func (h *Handler) myApplicationEvents(w http.ResponseWriter, r *http.Request) {
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
	id, ok := h.uuidParam(w, r, "id")
	if !ok {
		return
	}
	// Ownership is confirmed before the timeline is read.
	if _, err := h.Store.GetMyApplication(r.Context(), userID, id); err != nil {
		translateStoreError(w, err)
		return
	}
	items, err := h.Store.ListApplicationEvents(r.Context(), nil, id)
	if err != nil {
		translateStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) myShortlistMessage(w http.ResponseWriter, r *http.Request) {
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
	id, ok := h.uuidParam(w, r, "id")
	if !ok {
		return
	}
	// BR-08: only an applicant holding an active shortlist sees the message.
	shortlist, err := h.Store.MyShortlistMessage(r.Context(), userID, id)
	if err != nil {
		translateStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, shortlist)
}

func (h *Handler) myInterviews(w http.ResponseWriter, r *http.Request) {
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
	items, err := h.Store.MyInterviews(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load interviews")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

// editMyApplication handles PATCH /me/applications/{id}: an applicant edit
// of a still-pending application, with optional photo replacement.
func (h *Handler) editMyApplication(w http.ResponseWriter, r *http.Request) {
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
	id, ok := h.uuidParam(w, r, "id")
	if !ok {
		return
	}

	// Confirm ownership before touching storage.
	existing, err := h.Store.GetMyApplication(r.Context(), userID, id)
	if err != nil {
		translateStoreError(w, err)
		return
	}

	if err := r.ParseMultipartForm(maxPhotoBytes); err != nil && !errors.Is(err, http.ErrNotMultipart) {
		writeError(w, http.StatusBadRequest, "the form could not be read; check the photo size (2 MB max)")
		return
	}
	defer func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}()

	update := store.ApplicationUpdate{}
	if raw := strings.TrimSpace(r.FormValue("first_name")); raw != "" {
		update.FirstName = &raw
	}
	if raw := strings.TrimSpace(r.FormValue("last_name")); raw != "" {
		update.LastName = &raw
	}
	if raw := strings.TrimSpace(r.FormValue("phone")); raw != "" {
		update.Phone = &raw
	}
	if raw := strings.TrimSpace(r.FormValue("gender")); raw != "" {
		update.Gender = &raw
	}
	if raw := strings.TrimSpace(r.FormValue("date_of_birth")); raw != "" {
		parsed, err := time.Parse("2006-01-02", raw)
		if err != nil || parsed.After(time.Now()) {
			writeError(w, http.StatusBadRequest, "enter a valid date of birth")
			return
		}
		update.DateOfBirth = &parsed
	}
	if raw := strings.TrimSpace(r.FormValue("location_id")); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid location selection")
			return
		}
		update.LocationID = &parsed
	}
	if raw := strings.TrimSpace(r.FormValue("address_line")); raw != "" {
		update.AddressLine = &raw
	}
	if raw := strings.TrimSpace(r.FormValue("qualification")); raw != "" {
		update.Qualification = &raw
	}

	file, header, err := h.photoFromForm(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if file != nil {
		defer file.Close()
		key, uploadErr := h.uploadPhoto(r.Context(), userID, file, header)
		if uploadErr != nil {
			writeError(w, http.StatusBadGateway, "the photograph could not be uploaded; try again")
			return
		}
		update.Photo = &store.DocumentInput{
			FileName:   sanitizeFilename(header.Filename),
			StorageKey: key,
			MimeType:   detectPhotoType(header),
			SizeBytes:  header.Size,
		}
		if existing.PhotoDocumentID != nil {
			// Best-effort cleanup of the replaced object after commit.
			defer h.deleteDocumentPhoto(r.Context(), *existing.PhotoDocumentID, key)
		}
	}

	application, err := h.Store.UpdateMyApplication(r.Context(), userID, id, update)
	if err != nil {
		if update.Photo != nil {
			h.Storage.Delete(r.Context(), update.Photo.StorageKey)
		}
		writeCandidateError(w, err, "we could not update your application")
		return
	}
	writeJSON(w, http.StatusOK, application)
}

// withdrawMyApplication handles POST /me/applications/{id}/withdraw.
func (h *Handler) withdrawMyApplication(w http.ResponseWriter, r *http.Request) {
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
	id, ok := h.uuidParam(w, r, "id")
	if !ok {
		return
	}
	var reason *string
	if raw := strings.TrimSpace(r.FormValue("reason")); raw != "" {
		reason = &raw
	}
	application, err := h.Store.WithdrawApplication(r.Context(), userID, id, reason)
	if err != nil {
		writeCandidateError(w, err, "we could not withdraw your application")
		return
	}
	writeJSON(w, http.StatusOK, application)
}

// myApplicationPhoto redirects to a short-lived signed URL for the photo the
// applicant owns. The storage key itself is never exposed.
func (h *Handler) myApplicationPhoto(w http.ResponseWriter, r *http.Request) {
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
	id, ok := h.uuidParam(w, r, "id")
	if !ok {
		return
	}
	document, err := h.Store.MyApplicationPhoto(r.Context(), userID, id)
	if err != nil {
		translateStoreError(w, err)
		return
	}
	h.redirectToSignedURL(w, r, document.StorageKey)
}

// -- Helpers -----------------------------------------------------------------

func (h *Handler) requireStore(w http.ResponseWriter) bool {
	if h.Store == nil {
		writeError(w, http.StatusServiceUnavailable, "database unavailable")
		return false
	}
	return true
}

func (h *Handler) uuidParam(w http.ResponseWriter, r *http.Request, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return uuid.Nil, false
	}
	return id, true
}

// redirectToSignedURL issues a signed Byteship URL and redirects to it.
func (h *Handler) redirectToSignedURL(w http.ResponseWriter, r *http.Request, key string) {
	if h.Storage == nil || !h.Storage.Configured() {
		writeError(w, http.StatusServiceUnavailable, "file storage is unavailable")
		return
	}
	url, err := h.Storage.SignedURL(r.Context(), key)
	if err != nil {
		writeError(w, http.StatusBadGateway, "could not prepare the file")
		return
	}
	http.Redirect(w, r, url, http.StatusFound)
}

// deleteDocumentPhoto removes a replaced photo object, but only when the new
// upload used a different key.
func (h *Handler) deleteDocumentPhoto(ctx context.Context, documentID uuid.UUID, keepKey string) {
	document, err := h.Store.DocumentByID(ctx, documentID)
	if err != nil {
		return
	}
	if document.StorageKey == keepKey {
		return
	}
	h.Storage.Delete(ctx, document.StorageKey)
}

// writeCandidateError maps candidate-facing store errors onto clear 4xx
// responses without leaking internals.
func writeCandidateError(w http.ResponseWriter, err error, fallback string) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "record not found")
	case errors.Is(err, store.ErrConflict):
		writeError(w, http.StatusConflict, "you already have an open application for this role")
	case errors.Is(err, store.ErrInvalidTransition):
		writeError(w, http.StatusConflict, err.Error())
	case errors.Is(err, store.ErrLocked):
		writeError(w, http.StatusTooManyRequests, err.Error())
	case errors.Is(err, store.ErrValidation):
		writeError(w, http.StatusBadRequest, err.Error())
	default:
		writeError(w, http.StatusInternalServerError, fallback)
	}
}

func isAllowedPhotoType(contentType string) bool {
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return false
	}
	for _, allowed := range strings.Split(photoTypes, ",") {
		if mediaType == allowed {
			return true
		}
	}
	return false
}

func detectPhotoType(header *multipart.FileHeader) string {
	if header == nil {
		return "image/jpeg"
	}
	if ext := strings.ToLower(filepath.Ext(header.Filename)); ext != "" {
		switch ext {
		case ".png":
			return "image/png"
		case ".webp":
			return "image/webp"
		}
	}
	return "image/jpeg"
}

// sanitizeFilename strips path components and control characters from a
// client-supplied filename before it is stored or logged.
func sanitizeFilename(name string) string {
	name = filepath.Base(name)
	name = strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f {
			return -1
		}
		switch r {
		case '/', '\\', '"':
			return -1
		}
		return r
	}, name)
	name = strings.TrimSpace(name)
	if name == "" || name == "." {
		return "photo"
	}
	if len(name) > 200 {
		name = name[:200]
	}
	return name
}
