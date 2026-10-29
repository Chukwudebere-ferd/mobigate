package httpapi

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mobigate/mgm-portal/internal/codes"
	"github.com/mobigate/mgm-portal/internal/models"
	"github.com/mobigate/mgm-portal/internal/store"
)

// This file holds the attendance endpoints: the public office-kiosk surface
// (pairing, staff lookup, clock in/out) and the signed-in staff and admin
// surfaces.
//
// Clocking is restricted to an office laptop that an administrator has
// paired. The laptop holds an HMAC-signed token naming its kiosk_devices row;
// every clock request carries it in X-Kiosk-Token. The row — not the token —
// decides validity, so revoking a device in Settings stops it on its very
// next request. Without this, "office laptop only" would be a request rather
// than a rule: any browser anywhere can open its own webcam.
//
// A second consequence of the pairing design: the staff lookup below also
// requires the token. Without it, anyone who guessed a staff number could
// read a colleague's name and department off a public endpoint.

// kioskTokenTTL is how long a paired laptop stays authorised. Long enough
// that an always-on office machine does not need weekly re-pairing, short
// enough to bound the window if a token ever leaked. Settings shows the date.
const kioskTokenTTL = 90 * 24 * time.Hour

// kioskPairingCodeLength is the one-time code an administrator reads off the
// Settings screen into the office laptop. Crockford base32, so it can be
// read aloud without ambiguity.
const kioskPairingCodeLength = 8

// kioskTokenHeader carries the paired laptop's signed token.
const kioskTokenHeader = "X-Kiosk-Token"

// -- Kiosk token -------------------------------------------------------------

// signKioskToken builds an HMAC-signed token naming one kiosk device.
//
// The "kiosk|" prefix is load-bearing, not decoration. An onboarding ticket
// has the same three-field shape (user|code|expiry); without the prefix a
// valid onboarding ticket would parse as a kiosk token naming the user's ID
// as a device. The prefix makes the two token families unambiguous.
func (h *Handler) signKioskToken(deviceID uuid.UUID) (string, error) {
	if h.TicketSecret == "" {
		return "", errors.New("ticket secret not configured")
	}
	expiry := time.Now().Add(kioskTokenTTL).Unix()
	body := fmt.Sprintf("kiosk|%s|%d", deviceID, expiry)
	mac := hmac.New(sha256.New, []byte(h.TicketSecret))
	mac.Write([]byte(body))
	signature := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return base64.RawURLEncoding.EncodeToString([]byte(body)) + "." + signature, nil
}

// verifyKioskToken checks the signature and expiry, returning the device ID.
func (h *Handler) verifyKioskToken(token string) (uuid.UUID, error) {
	if h.TicketSecret == "" {
		return uuid.Nil, errors.New("ticket secret not configured")
	}
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return uuid.Nil, errors.New("malformed kiosk token")
	}
	bodyBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return uuid.Nil, errors.New("malformed kiosk token")
	}
	mac := hmac.New(sha256.New, []byte(h.TicketSecret))
	mac.Write(bodyBytes)
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(parts[1])) {
		return uuid.Nil, errors.New("invalid kiosk token")
	}
	// Split explicitly; %s-style scanning would swallow the whole body.
	fields := strings.Split(string(bodyBytes), "|")
	if len(fields) != 3 || fields[0] != "kiosk" {
		return uuid.Nil, errors.New("malformed kiosk token")
	}
	deviceID, err := uuid.Parse(fields[1])
	if err != nil {
		return uuid.Nil, errors.New("malformed kiosk token")
	}
	expiry, err := strconv.ParseInt(fields[2], 10, 64)
	if err != nil {
		return uuid.Nil, errors.New("malformed kiosk token")
	}
	if time.Now().Unix() > expiry {
		return uuid.Nil, errors.New("this laptop's pairing has expired; pair it again in Settings")
	}
	return deviceID, nil
}

// kioskDevice resolves and authorises the calling laptop. It reads the
// token, then asks the store whether that device is still paired and live —
// which is what makes revocation immediate.
func (h *Handler) kioskDevice(w http.ResponseWriter, r *http.Request) (models.KioskDevice, bool) {
	token := strings.TrimSpace(r.Header.Get(kioskTokenHeader))
	if token == "" {
		writeError(w, http.StatusUnauthorized,
			"this laptop is not paired; pair it in Settings before clocking anyone in")
		return models.KioskDevice{}, false
	}
	deviceID, err := h.verifyKioskToken(token)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return models.KioskDevice{}, false
	}
	device, err := h.Store.ActiveKiosk(r.Context(), deviceID)
	if err != nil {
		writeError(w, http.StatusUnauthorized,
			"this laptop is no longer authorised; pair it again in Settings")
		return models.KioskDevice{}, false
	}
	return device, true
}

// requireKioskLimit throttles the public kiosk routes per IP. The pairing
// code is the real secret; this is the backstop against guessing it.
func (h *Handler) requireKioskLimit(w http.ResponseWriter, r *http.Request) bool {
	if h.kioskAttempts != nil && !h.kioskAttempts.allow(clientIP(r)) {
		writeError(w, http.StatusTooManyRequests,
			"too many attempts; wait a few minutes and try again")
		return false
	}
	return true
}

// InitKioskLimiter configures the per-IP throttle on the kiosk routes. Call
// once during wiring; leaving it unset disables the limit (used by tests).
func (h *Handler) InitKioskLimiter(limit int, window time.Duration) {
	h.kioskAttempts = newAttemptLimiter(limit, window)
}

// -- Public: pairing and clocking ---------------------------------------------

// kioskPair handles POST /kiosk/pair, trading a one-time pairing code for
// this laptop's long-lived token.
func (h *Handler) kioskPair(w http.ResponseWriter, r *http.Request) {
	if !h.requireStore(w) {
		return
	}
	if !h.requireKioskLimit(w, r) {
		return
	}
	var req struct {
		Code string `json:"code"`
	}
	if err := decodeJSONBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "the request could not be read")
		return
	}
	if strings.TrimSpace(req.Code) == "" {
		writeError(w, http.StatusBadRequest, "enter the pairing code shown in Settings")
		return
	}

	device, err := h.Store.RedeemKioskPairing(r.Context(), codes.HashAccessCode(req.Code))
	if err != nil {
		writeStoreError(w, err, "that pairing code is not valid")
		return
	}

	token, err := h.signKioskToken(device.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not pair this laptop")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"token":      token,
		"expires_at": time.Now().Add(kioskTokenTTL).UTC().Format(time.RFC3339),
		"device":     device,
	})
}

// kioskVerifyStaff handles POST /kiosk/staff/verify: the office laptop
// confirms a typed staff number before opening the camera, and shows the
// name and department so the person knows it is their record.
func (h *Handler) kioskVerifyStaff(w http.ResponseWriter, r *http.Request) {
	if !h.requireStore(w) {
		return
	}
	if !h.requireKioskLimit(w, r) {
		return
	}
	device, ok := h.kioskDevice(w, r)
	if !ok {
		return
	}
	var req struct {
		StaffID string `json:"staff_id"`
	}
	if err := decodeJSONBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "the request could not be read")
		return
	}

	staff, err := h.Store.KioskStaff(r.Context(), device.TenantID, req.StaffID)
	if err != nil {
		// One message for unknown and for inactive alike: the laptop must not
		// reveal which staff numbers exist.
		writeStoreError(w, err, "no active staff member uses that ID")
		return
	}
	writeJSON(w, http.StatusOK, staff)
}

// kioskClockIn handles POST /kiosk/clock-in: multipart staff profile, photo
// and consent, authorised by the laptop's token.
func (h *Handler) kioskClockIn(w http.ResponseWriter, r *http.Request) {
	if !h.requireStore(w) {
		return
	}
	if !h.requireKioskLimit(w, r) {
		return
	}
	device, ok := h.kioskDevice(w, r)
	if !ok {
		return
	}
	if h.Storage == nil || !h.Storage.Configured() {
		// Fail closed: an attendance record with no evidence photo is not the
		// feature that was asked for.
		writeError(w, http.StatusServiceUnavailable,
			"photo storage is not configured; attendance cannot be recorded")
		return
	}
	if err := r.ParseMultipartForm(maxPhotoBytes); err != nil {
		writeError(w, http.StatusBadRequest, "the request could not be read")
		return
	}

	staffProfileID, ok := h.kioskStaffProfileID(w, r)
	if !ok {
		return
	}
	header, err := h.photoFromForm(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if header == nil {
		writeError(w, http.StatusBadRequest, "take a photograph before clocking in")
		return
	}
	consent := false
	switch strings.ToLower(strings.TrimSpace(r.FormValue("consent"))) {
	case "true", "1", "on", "yes":
		consent = true
	}

	key, uploadErr := h.uploadPhoto(r.Context(), staffProfileID, header)
	if uploadErr != nil {
		writeError(w, http.StatusBadGateway,
			"the photograph could not be uploaded; try again")
		return
	}

	record, err := h.Store.ClockIn(r.Context(), store.ClockInInput{
		TenantID:       device.TenantID,
		StaffProfileID: staffProfileID,
		PhotoKey:       key,
		IP:             kioskClientIP(r),
		DeviceID:       device.ID,
		ConsentGiven:   consent,
	})
	if err != nil {
		// The record was not written, so the photo is an orphan. Remove it
		// rather than leave biometric data with no attendance row.
		h.Storage.Delete(r.Context(), key)
		writeStoreError(w, err, "the clock-in could not be recorded")
		return
	}
	writeJSON(w, http.StatusCreated, record)
}

// kioskClockOut handles POST /kiosk/clock-out, closing the open record.
func (h *Handler) kioskClockOut(w http.ResponseWriter, r *http.Request) {
	if !h.requireStore(w) {
		return
	}
	if !h.requireKioskLimit(w, r) {
		return
	}
	device, ok := h.kioskDevice(w, r)
	if !ok {
		return
	}
	if h.Storage == nil || !h.Storage.Configured() {
		writeError(w, http.StatusServiceUnavailable,
			"photo storage is not configured; attendance cannot be recorded")
		return
	}
	if err := r.ParseMultipartForm(maxPhotoBytes); err != nil {
		writeError(w, http.StatusBadRequest, "the request could not be read")
		return
	}

	staffProfileID, ok := h.kioskStaffProfileID(w, r)
	if !ok {
		return
	}
	header, err := h.photoFromForm(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if header == nil {
		writeError(w, http.StatusBadRequest, "take a photograph before clocking out")
		return
	}

	key, uploadErr := h.uploadPhoto(r.Context(), staffProfileID, header)
	if uploadErr != nil {
		writeError(w, http.StatusBadGateway,
			"the photograph could not be uploaded; try again")
		return
	}

	record, err := h.Store.ClockOut(r.Context(), store.ClockOutInput{
		TenantID:       device.TenantID,
		StaffProfileID: staffProfileID,
		PhotoKey:       key,
		IP:             kioskClientIP(r),
		DeviceID:       device.ID,
	})
	if err != nil {
		h.Storage.Delete(r.Context(), key)
		writeStoreError(w, err, "the clock-out could not be recorded")
		return
	}
	writeJSON(w, http.StatusOK, record)
}

// kioskStaffProfileID reads the staff profile UUID from the multipart form.
// Tenant and active-status are checked by the store, at write time, so a
// record can never be written for a suspended or foreign staff member.
func (h *Handler) kioskStaffProfileID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	raw := strings.TrimSpace(r.FormValue("staff_profile_id"))
	id, err := uuid.Parse(raw)
	if err != nil {
		writeError(w, http.StatusBadRequest, "select a staff member before continuing")
		return uuid.Nil, false
	}
	return id, true
}

// kioskClientIP returns the caller address recorded on the attendance row.
// It is evidence, not access control, so the RemoteAddr value is enough.
func kioskClientIP(r *http.Request) *string {
	ip := clientIP(r)
	if ip == "" {
		return nil
	}
	return &ip
}

// -- Staff: own history -------------------------------------------------------

// staffAttendance handles GET /staff/attendance: the signed-in staff
// member's own records. Read-only by design — clocking happens on the office
// laptop, not on a personal device.
func (h *Handler) staffAttendance(w http.ResponseWriter, r *http.Request) {
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

	records, err := h.Store.StaffAttendance(r.Context(), userID)
	if err != nil {
		translateStoreError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": records})
}

// -- Admin: list, correct, photos ---------------------------------------------

// adminAttendance handles GET /admin/attendance.
// Query: staff_profile_id, status, date_from, date_to, exceptions, search
func (h *Handler) adminAttendance(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}

	query := store.AttendanceQuery{
		TenantID:   scope,
		Status:     models.AttendanceStatus(strings.TrimSpace(r.URL.Query().Get("status"))),
		Exceptions: r.URL.Query().Get("exceptions") == "true",
		Search:     strings.TrimSpace(r.URL.Query().Get("search")),
	}
	switch query.Status {
	case "", "all", models.AttendanceOpen, models.AttendanceClosed:
	default:
		writeError(w, http.StatusBadRequest, "invalid status filter")
		return
	}
	if query.Status == "all" {
		query.Status = ""
	}

	if raw := strings.TrimSpace(r.URL.Query().Get("staff_profile_id")); raw != "" {
		parsed, err := uuid.Parse(raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid staff_profile_id")
			return
		}
		query.StaffProfileID = &parsed
	}
	for _, param := range []struct {
		name string
		dest **time.Time
	}{
		{"date_from", &query.DateFrom},
		{"date_to", &query.DateTo},
	} {
		raw := strings.TrimSpace(r.URL.Query().Get(param.name))
		if raw == "" {
			continue
		}
		parsed, err := time.Parse("2006-01-02", raw)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid "+param.name)
			return
		}
		if param.name == "date_to" {
			// Inclusive of the whole day the administrator picked.
			parsed = parsed.Add(24 * time.Hour)
		}
		*param.dest = &parsed
	}

	records, err := h.Store.ListAttendanceAdmin(r.Context(), query)
	if err != nil {
		writeStoreError(w, err, "could not load attendance")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": records})
}

// adminCorrectAttendance handles PATCH /admin/attendance/{id}: adjust the
// times, or close a forgotten clock-out. Always audited, always noted.
func (h *Handler) adminCorrectAttendance(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	recordID, ok := h.uuidParam(w, r, "id")
	if !ok {
		return
	}

	var req struct {
		ClockInAt  *string `json:"clock_in_at"`
		ClockOutAt *string `json:"clock_out_at"`
		Status     string  `json:"status"`
		Note       *string `json:"note"`
	}
	if err := decodeJSONBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "the request could not be read")
		return
	}

	in := store.AttendanceCorrection{
		Status: models.AttendanceStatus(req.Status),
		Note:   req.Note,
	}
	var err error
	if in.ClockInAt, err = parseOptionalRFC3339(req.ClockInAt); err != nil {
		writeError(w, http.StatusBadRequest, "the clock-in time could not be read")
		return
	}
	if in.ClockOutAt, err = parseOptionalRFC3339(req.ClockOutAt); err != nil {
		writeError(w, http.StatusBadRequest, "the clock-out time could not be read")
		return
	}

	record, err := h.Store.CorrectAttendance(r.Context(), *scope, adminActorIDOrZero(r), recordID, in)
	if err != nil {
		writeStoreError(w, err, "the record could not be corrected")
		return
	}
	writeJSON(w, http.StatusOK, record)
}

// adminAttendancePhoto handles GET /admin/attendance/{id}/photos/{which}.
// It returns a short-lived signed URL rather than proxying bytes: the photo
// never becomes a stable, guessable link.
func (h *Handler) adminAttendancePhoto(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.adminScope(w, r); !ok {
		return
	}
	if h.Storage == nil || !h.Storage.Configured() {
		writeError(w, http.StatusServiceUnavailable, "file storage is unavailable")
		return
	}
	recordID, ok := h.uuidParam(w, r, "id")
	if !ok {
		return
	}
	which := strings.ToLower(strings.TrimSpace(chi.URLParam(r, "which")))

	var key *string
	if h.Store != nil {
		scope, ok := h.adminScope(w, r)
		if !ok {
			return
		}
		record, err := h.Store.AttendanceRecordByID(r.Context(), *scope, recordID)
		if err != nil {
			writeStoreError(w, err, "record not found")
			return
		}
		switch which {
		case "in", "clock-in":
			key = record.ClockInPhotoKey
		case "out", "clock-out":
			key = record.ClockOutPhotoKey
		default:
			writeError(w, http.StatusNotFound, "unknown photo")
			return
		}
	}
	if key == nil || *key == "" {
		writeError(w, http.StatusNotFound, "no photograph on this record")
		return
	}

	url, err := h.Storage.SignedURL(r.Context(), *key)
	if err != nil {
		writeError(w, http.StatusBadGateway, "the photograph could not be opened; try again")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"url": url})
}

// parseOptionalRFC3339 turns an absent or present timestamp into a *time.Time.
func parseOptionalRFC3339(raw *string) (*time.Time, error) {
	if raw == nil {
		return nil, nil
	}
	value := strings.TrimSpace(*raw)
	if value == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

// adminActorIDOrZero is adminActorID, safe to dereference.
//
// adminActorID returns nil when the session is missing or its user ID will
// not parse. Callers that must pass a uuid.UUID to the store still have to
// produce one, so this returns uuid.Nil rather than panicking on a nil
// pointer. Audit rows written with a nil actor are the honest outcome: the
// action happened, but we cannot say who performed it.
func adminActorIDOrZero(r *http.Request) uuid.UUID {
	if id := adminActorID(r); id != nil {
		return *id
	}
	return uuid.Nil
}

// -- Admin: kiosk devices -----------------------------------------------------

// adminListKiosks handles GET /admin/kiosk: which laptops are paired, when
// each was last seen, and when each expires.
func (h *Handler) adminListKiosks(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	devices, err := h.Store.ListKioskDevices(r.Context(), *scope)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not load paired laptops")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": devices})
}

// adminPairKiosk handles POST /admin/kiosk: create a device and return its
// one-time pairing code. The plaintext is returned exactly once; only the
// hash is stored.
func (h *Handler) adminPairKiosk(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	if h.Store == nil {
		writeError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}

	var req struct {
		Label string `json:"label"`
	}
	if err := decodeJSONBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "the request could not be read")
		return
	}

	plaintext, err := codes.GenerateAccessCode(kioskPairingCodeLength)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not generate a pairing code")
		return
	}

	device, err := h.Store.PairKiosk(r.Context(), *scope, adminActorID(r),
		req.Label, codes.HashAccessCode(plaintext))
	if err != nil {
		writeStoreError(w, err, "the laptop could not be paired")
		return
	}

	// Returned once, never stored in the clear, and never recoverable.
	device.PairingCode = &plaintext
	writeJSON(w, http.StatusCreated, device)
}

// adminRevokeKiosk handles DELETE /admin/kiosk/{id}: withdraw a laptop's
// authority immediately.
func (h *Handler) adminRevokeKiosk(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	deviceID, ok := h.uuidParam(w, r, "id")
	if !ok {
		return
	}
	device, err := h.Store.RevokeKiosk(r.Context(), *scope, adminActorIDOrZero(r), deviceID)
	if err != nil {
		writeStoreError(w, err, "the laptop could not be unpaired")
		return
	}
	writeJSON(w, http.StatusOK, device)
}

// -- Admin: work site ---------------------------------------------------------

// adminWorkSite handles GET /admin/settings/work-site: the office hours that
// decide lateness and early leave.
func (h *Handler) adminWorkSite(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	site, err := h.Store.WorkSite(r.Context(), *scope)
	if err != nil {
		writeStoreError(w, err, "could not load the office settings")
		return
	}
	writeJSON(w, http.StatusOK, site)
}

// adminUpdateWorkSite handles PATCH /admin/settings/work-site. The new hours
// take effect on the next clock event; nothing needs a redeploy.
func (h *Handler) adminUpdateWorkSite(w http.ResponseWriter, r *http.Request) {
	scope, ok := h.adminScope(w, r)
	if !ok {
		return
	}
	var req struct {
		Name              string  `json:"name"`
		Address           *string `json:"address"`
		Timezone          string  `json:"timezone"`
		WorkStart         string  `json:"work_start"`
		WorkEnd           string  `json:"work_end"`
		LateGraceMinutes  int     `json:"late_grace_minutes"`
		EarlyLeaveMinutes int     `json:"early_leave_minutes"`
	}
	if err := decodeJSONBody(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "the request could not be read")
		return
	}

	site, err := h.Store.UpdateWorkSite(r.Context(), *scope, adminActorID(r),
		store.WorkSiteInput{
			Name:              req.Name,
			Address:           req.Address,
			Timezone:          req.Timezone,
			WorkStart:         req.WorkStart,
			WorkEnd:           req.WorkEnd,
			LateGraceMinutes:  req.LateGraceMinutes,
			EarlyLeaveMinutes: req.EarlyLeaveMinutes,
		})
	if err != nil {
		writeStoreError(w, err, "the office settings could not be saved")
		return
	}
	writeJSON(w, http.StatusOK, site)
}
