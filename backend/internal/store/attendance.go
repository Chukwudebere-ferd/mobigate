package store

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/mobigate/mgm-portal/internal/models"
)

// This file holds the attendance domain: the work site that defines office
// hours, the clock in/out records, and the office laptops authorised to
// record them.
//
// Two rules are enforced here rather than in the handlers, because they are
// properties of the data and not of any one request:
//
//   - The server's clock is the only clock. No client-supplied time is
//     accepted anywhere in this file.
//   - At most one record may be open per staff member. The partial unique
//     index in migration 0012 is the backstop; the explicit checks below
//     turn that into a friendly error instead of a constraint violation.

// attendanceListLimit bounds the admin list so a long-running deployment
// cannot page an unbounded history into one response.
const attendanceListLimit = 500

// kioskTokenTTL is how long a paired office laptop stays authorised. It is
// long because the laptop is always on and re-pairing weekly would be a
// nuisance, and short enough to bound exposure if the token ever leaked. The
// admin screen shows this date and can revoke at any time.
const kioskTokenTTL = 90 * 24 * time.Hour

// kioskPairingTTL is how long the one-time pairing code stays redeemable.
// It is short because it is read aloud or typed in an office, and it is the
// only value that ever travels in the clear.
const kioskPairingTTL = 15 * time.Minute

// AttendanceQuery filters the admin attendance list.
type AttendanceQuery struct {
	// TenantID is nil for a Super Admin viewing every tenant.
	TenantID       *uuid.UUID
	StaffProfileID *uuid.UUID
	Status         models.AttendanceStatus
	DateFrom       *time.Time
	DateTo         *time.Time
	// Exceptions limits the list to open records from an earlier day, i.e.
	// forgotten clock-outs awaiting correction.
	Exceptions bool
	Search     string
}

// ClockInInput is a kiosk clock-in. The photo has already been validated and
// uploaded by the handler; only its storage key reaches the store.
type ClockInInput struct {
	TenantID       uuid.UUID
	StaffProfileID uuid.UUID
	PhotoKey       string
	IP             *string
	DeviceID       uuid.UUID
	ConsentGiven   bool
}

// ClockOutInput is a kiosk clock-out.
type ClockOutInput struct {
	TenantID       uuid.UUID
	StaffProfileID uuid.UUID
	PhotoKey       string
	IP             *string
	DeviceID       uuid.UUID
}

// AttendanceCorrection is an administrator's manual fix for a record.
type AttendanceCorrection struct {
	ClockInAt  *time.Time
	ClockOutAt *time.Time
	Status     models.AttendanceStatus
	Note       *string
}

// WorkSiteInput is the editable part of the office configuration.
type WorkSiteInput struct {
	Name              string
	Address           *string
	Timezone          string
	WorkStart         string
	WorkEnd           string
	LateGraceMinutes  int
	EarlyLeaveMinutes int
}

// attendanceSelect is the single source of truth for how a record is read.
// The derived columns (name, department, elapsed time, needs-attention) are
// computed in SQL so every caller sees the same numbers.
const attendanceSelect = `
	SELECT a.id, a.tenant_id, a.staff_profile_id, a.work_site_id, a.status,
	       a.clock_in_at, a.clock_in_photo_key, a.clock_in_ip,
	       a.clock_in_device_id,
	       a.clock_out_at, a.clock_out_photo_key, a.clock_out_ip,
	       a.clock_out_device_id,
	       a.late_minutes, a.early_minutes, a.note, a.corrected_by,
	       a.corrected_at, a.consent_at, a.created_at, a.updated_at,
	       sp.staff_id,
	       trim(sp.first_name || ' ' || sp.last_name) AS staff_name,
	       d.name AS department_name,
	       ws.name AS work_site_name,
	       (a.status = 'open'
	        AND (a.clock_in_at AT TIME ZONE ws.timezone)::date
	            < (now() AT TIME ZONE ws.timezone)::date) AS needs_attention,
	       floor(EXTRACT(EPOCH FROM (COALESCE(a.clock_out_at, now())
	           - a.clock_in_at)) / 60)::int AS hours_worked_minutes
	FROM attendance_records a
	JOIN staff_profiles sp ON sp.id = a.staff_profile_id
	JOIN work_sites ws ON ws.id = a.work_site_id
	LEFT JOIN departments d ON d.id = sp.department_id`

// -- Work site ---------------------------------------------------------------

// WorkSite returns the tenant's office configuration, creating it with
// defaults on first use so the feature works before anyone opens Settings.
func (s *Store) WorkSite(ctx context.Context, tenantID uuid.UUID) (models.WorkSite, error) {
	if tenantID == uuid.Nil {
		return models.WorkSite{}, ErrNotFound
	}
	const q = `
		INSERT INTO work_sites (tenant_id, name)
		VALUES ($1, 'Main Office')
		ON CONFLICT (tenant_id) DO NOTHING
		RETURNING id, tenant_id, name, address, timezone, work_start,
		          work_end, late_grace_minutes, early_leave_minutes, updated_at`

	var site models.WorkSite
	err := scanWorkSite(s.pool.QueryRow(ctx, q, tenantID), &site)
	if errors.Is(err, pgx.ErrNoRows) {
		// The row already existed; read it.
		err = scanWorkSite(s.pool.QueryRow(ctx, `
			SELECT id, tenant_id, name, address, timezone, work_start,
			       work_end, late_grace_minutes, early_leave_minutes,
			       updated_at
			FROM work_sites WHERE tenant_id = $1`, tenantID), &site)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return models.WorkSite{}, ErrNotFound
	}
	return site, err
}

// UpdateWorkSite persists the office configuration. The hours are used
// immediately by the next clock event; nothing needs a redeploy.
func (s *Store) UpdateWorkSite(
	ctx context.Context,
	tenantID uuid.UUID,
	actorID *uuid.UUID,
	in WorkSiteInput,
) (models.WorkSite, error) {
	in.Name = strings.TrimSpace(in.Name)
	in.Timezone = strings.TrimSpace(in.Timezone)
	if in.Name == "" {
		return models.WorkSite{}, fmt.Errorf("%w: enter the office name", ErrValidation)
	}
	if len([]rune(in.Name)) > 120 {
		return models.WorkSite{}, fmt.Errorf("%w: the office name is too long", ErrValidation)
	}
	if in.Timezone == "" {
		return models.WorkSite{}, fmt.Errorf("%w: choose a timezone", ErrValidation)
	}
	if !validTimeZone(in.Timezone) {
		return models.WorkSite{}, fmt.Errorf("%w: that timezone is not recognised", ErrValidation)
	}
	start, end, err := validateWorkHours(in.WorkStart, in.WorkEnd)
	if err != nil {
		return models.WorkSite{}, err
	}
	if in.LateGraceMinutes < 0 || in.LateGraceMinutes > 120 {
		return models.WorkSite{}, fmt.Errorf("%w: the late grace must be between 0 and 120 minutes", ErrValidation)
	}
	if in.EarlyLeaveMinutes < 0 || in.EarlyLeaveMinutes > 120 {
		return models.WorkSite{}, fmt.Errorf("%w: the early-leave grace must be between 0 and 120 minutes", ErrValidation)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.WorkSite{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Ensure the row exists before updating, so the first save after a fresh
	// database does not silently insert a second site.
	if _, err := s.WorkSite(ctx, tenantID); err != nil {
		return models.WorkSite{}, err
	}

	var before, after models.WorkSite
	if err := scanWorkSite(tx.QueryRow(ctx, `
		SELECT id, tenant_id, name, address, timezone, work_start,
		       work_end, late_grace_minutes, early_leave_minutes, updated_at
		FROM work_sites WHERE tenant_id = $1 FOR UPDATE`, tenantID), &before); err != nil {
		return models.WorkSite{}, err
	}

	if err := scanWorkSite(tx.QueryRow(ctx, `
		UPDATE work_sites
		SET name = $2, address = $3, timezone = $4, work_start = $5,
		    work_end = $6, late_grace_minutes = $7,
		    early_leave_minutes = $8, updated_at = now()
		WHERE tenant_id = $1
		RETURNING id, tenant_id, name, address, timezone, work_start,
		          work_end, late_grace_minutes, early_leave_minutes,
		          updated_at`,
		tenantID, in.Name, in.Address, in.Timezone, start, end,
		in.LateGraceMinutes, in.EarlyLeaveMinutes,
	), &after); err != nil {
		return models.WorkSite{}, err
	}

	if err := insertAudit(ctx, tx, tenantID, actorID,
		"settings.work_site_updated", "work_sites", after.ID,
		map[string]any{
			"name":       before.Name,
			"work_start": before.WorkStart,
			"work_end":   before.WorkEnd,
			"timezone":   before.Timezone,
		},
		map[string]any{
			"name":       after.Name,
			"work_start": after.WorkStart,
			"work_end":   after.WorkEnd,
			"timezone":   after.Timezone,
		},
	); err != nil {
		return models.WorkSite{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.WorkSite{}, err
	}
	return after, nil
}

func scanWorkSite(row rowScanner, site *models.WorkSite) error {
	return row.Scan(
		&site.ID, &site.TenantID, &site.Name, &site.Address, &site.Timezone,
		&site.WorkStart, &site.WorkEnd, &site.LateGraceMinutes,
		&site.EarlyLeaveMinutes, &site.UpdatedAt,
	)
}

// validTimeZone asks the time package whether the zone name resolves. This
// keeps a typo out of the database, where it would silently break the
// lateness arithmetic.
func validTimeZone(name string) bool {
	_, err := time.LoadLocation(name)
	return err == nil
}

// validateWorkHours parses "HH:MM" bounds and checks they are ordered.
func validateWorkHours(startRaw, endRaw string) (string, string, error) {
	start, err := parseClock(startRaw)
	if err != nil {
		return "", "", fmt.Errorf("%w: the start time must look like 08:00", ErrValidation)
	}
	end, err := parseClock(endRaw)
	if err != nil {
		return "", "", fmt.Errorf("%w: the end time must look like 17:00", ErrValidation)
	}
	if !start.Before(end) {
		return "", "", fmt.Errorf("%w: the end time must be after the start time", ErrValidation)
	}
	return start.Format("15:04"), end.Format("15:04"), nil
}

func parseClock(raw string) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	for _, layout := range []string{"15:04", "15:04:05"} {
		if parsed, err := time.Parse(layout, raw); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, errors.New("unparseable clock time")
}

// -- Staff lookup for the kiosk ----------------------------------------------

// KioskStaff resolves the staff number typed on the office laptop, inside
// the tenant that paired that laptop. A suspended or exited record is
// reported as not found, exactly as it is on the staff portal, so an
// inactive person cannot be clocked in at all.
//
// The tenant filter is not decoration: without it a laptop paired by one
// tenant could resolve (and then clock in) a staff member belonging to
// another. Cross-tenant reads surface as not-found throughout this codebase
// so that record existence is never leaked.
func (s *Store) KioskStaff(ctx context.Context, tenantID uuid.UUID, staffID string) (models.KioskStaff, error) {
	if tenantID == uuid.Nil {
		return models.KioskStaff{}, ErrNotFound
	}
	staffID = strings.ToUpper(strings.TrimSpace(staffID))
	if staffID == "" {
		return models.KioskStaff{}, fmt.Errorf("%w: enter your staff ID", ErrValidation)
	}

	const q = `
		SELECT sp.id, sp.staff_id, sp.first_name, sp.last_name, d.name,
		       sp.position,
		       a.id AS open_record_id
		FROM staff_profiles sp
		LEFT JOIN departments d ON d.id = sp.department_id
		LEFT JOIN attendance_records a
		       ON a.staff_profile_id = sp.id AND a.status = 'open'
		WHERE sp.staff_id = $1
		  AND sp.tenant_id = $2
		  AND sp.status = 'active'
		ORDER BY sp.created_at DESC
		LIMIT 1`

	var (
		profile  models.KioskStaff
		openID   *string
		deptName *string
		position *string
	)
	if err := s.pool.QueryRow(ctx, q, staffID, tenantID).Scan(
		&profile.StaffProfileID, &profile.StaffID, &profile.FirstName,
		&profile.LastName, &deptName, &position, &openID,
	); errors.Is(err, pgx.ErrNoRows) {
		return models.KioskStaff{}, ErrNotFound
	} else if err != nil {
		return models.KioskStaff{}, err
	}

	profile.DepartmentName = deptName
	profile.Position = position
	if openID != nil {
		parsed, err := uuid.Parse(*openID)
		if err != nil {
			return models.KioskStaff{}, err
		}
		profile.OpenRecordID = &parsed
		profile.IsClockedIn = true
	}
	return profile, nil
}

// -- Clock in / out -----------------------------------------------------------

// ClockIn records a arrival with the server's timestamp. The photo has
// already been uploaded; if the insert then fails (most commonly a second
// clock-in), the handler deletes the orphaned object.
func (s *Store) ClockIn(ctx context.Context, in ClockInInput) (models.AttendanceRecord, error) {
	if in.StaffProfileID == uuid.Nil {
		return models.AttendanceRecord{}, fmt.Errorf("%w: staff member not found", ErrValidation)
	}
	if strings.TrimSpace(in.PhotoKey) == "" {
		return models.AttendanceRecord{}, fmt.Errorf("%w: a photograph is required", ErrValidation)
	}
	if !in.ConsentGiven {
		return models.AttendanceRecord{}, fmt.Errorf("%w: confirm the data-processing notice to continue", ErrValidation)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.AttendanceRecord{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Resolve the site first: its hours feed the lateness calculation.
	var site models.WorkSite
	if err := scanWorkSite(tx.QueryRow(ctx, `
		SELECT id, tenant_id, name, address, timezone, work_start,
		       work_end, late_grace_minutes, early_leave_minutes, updated_at
		FROM work_sites WHERE tenant_id = $1`, in.TenantID), &site); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return models.AttendanceRecord{}, ErrNotFound
		}
		return models.AttendanceRecord{}, err
	}

	// Confirm the staff member exists, belongs to this tenant and is active.
	// The kiosk route already checked this, but the record must be valid at
	// the moment it is written, not merely when the form was opened.
	var (
		staffID   string
		firstName string
		lastName  string
	)
	err = tx.QueryRow(ctx, `
		SELECT staff_id, first_name, last_name
		FROM staff_profiles
		WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
		in.StaffProfileID, in.TenantID,
	).Scan(&staffID, &firstName, &lastName)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.AttendanceRecord{}, ErrNotFound
	}
	if err != nil {
		return models.AttendanceRecord{}, err
	}

	var recordID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO attendance_records (
			tenant_id, staff_profile_id, work_site_id, status,
			clock_in_at, clock_in_photo_key, clock_in_ip, clock_in_device_id,
			late_minutes, consent_at
		)
		SELECT $1, $2, $3, 'open', now(), $4, $5, $6,
		       GREATEST(0, floor(EXTRACT(EPOCH FROM (
		           (now() AT TIME ZONE ws.timezone)::time - ws.work_start
		       )) / 60)::int - ws.late_grace_minutes),
		       CASE WHEN $7 THEN now() ELSE NULL END
		FROM work_sites ws
		WHERE ws.id = $3
		RETURNING id`,
		in.TenantID, in.StaffProfileID, site.ID, in.PhotoKey, in.IP,
		in.DeviceID, in.ConsentGiven,
	).Scan(&recordID)
	if err != nil {
		// 23505 is the partial unique index firing: already clocked in.
		return models.AttendanceRecord{}, mapWriteError(err)
	}

	if err := insertAudit(ctx, tx, in.TenantID, &in.DeviceID,
		"attendance.clocked_in", "attendance_record", recordID,
		nil, map[string]any{
			"staff_id": staffID,
			"staff_name": strings.TrimSpace(firstName + " " + lastName),
		},
	); err != nil {
		return models.AttendanceRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.AttendanceRecord{}, err
	}
	return s.AttendanceRecordByID(ctx, in.TenantID, recordID)
}

// ClockOut closes the staff member's open record.
func (s *Store) ClockOut(ctx context.Context, in ClockOutInput) (models.AttendanceRecord, error) {
	if in.StaffProfileID == uuid.Nil {
		return models.AttendanceRecord{}, fmt.Errorf("%w: staff member not found", ErrValidation)
	}
	if strings.TrimSpace(in.PhotoKey) == "" {
		return models.AttendanceRecord{}, fmt.Errorf("%w: a photograph is required", ErrValidation)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.AttendanceRecord{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		recordID  uuid.UUID
		staffID   string
		firstName string
		lastName  string
	)
	err = tx.QueryRow(ctx, `
		UPDATE attendance_records a
		SET status = 'closed',
		    clock_out_at = now(),
		    clock_out_photo_key = $3,
		    clock_out_ip = $4,
		    clock_out_device_id = $5,
		    early_minutes = GREATEST(0, floor(EXTRACT(EPOCH FROM (
		        ws.work_end - (now() AT TIME ZONE ws.timezone)::time
		    )) / 60)::int - ws.early_leave_minutes),
		    updated_at = now()
		FROM work_sites ws, staff_profiles sp
		WHERE a.staff_profile_id = $2
		  AND a.tenant_id = $1
		  AND a.status = 'open'
		  AND ws.id = a.work_site_id
		  AND sp.id = a.staff_profile_id
		RETURNING a.id, sp.staff_id, sp.first_name, sp.last_name`,
		in.TenantID, in.StaffProfileID, in.PhotoKey, in.IP, in.DeviceID,
	).Scan(&recordID, &staffID, &firstName, &lastName)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.AttendanceRecord{}, fmt.Errorf("%w: you are not clocked in", ErrInvalidTransition)
	}
	if err != nil {
		return models.AttendanceRecord{}, err
	}

	if err := insertAudit(ctx, tx, in.TenantID, &in.DeviceID,
		"attendance.clocked_out", "attendance_record", recordID,
		nil, map[string]any{
			"staff_id":   staffID,
			"staff_name": strings.TrimSpace(firstName + " " + lastName),
		},
	); err != nil {
		return models.AttendanceRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.AttendanceRecord{}, err
	}
	return s.AttendanceRecordByID(ctx, in.TenantID, recordID)
}

// -- Reads --------------------------------------------------------------------

// AttendanceRecordByID reads one record inside a tenant scope.
func (s *Store) AttendanceRecordByID(ctx context.Context, tenantID, recordID uuid.UUID) (models.AttendanceRecord, error) {
	record, err := scanAttendance(s.pool.QueryRow(ctx,
		attendanceSelect+` WHERE a.id = $1 AND a.tenant_id = $2`,
		recordID, tenantID,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.AttendanceRecord{}, ErrNotFound
	}
	return record, err
}

// StaffAttendance returns the signed-in staff member's own history, newest
// first, plus their current state.
func (s *Store) StaffAttendance(ctx context.Context, userID uuid.UUID) ([]models.AttendanceRecord, error) {
	staff, err := s.StaffByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	rows, err := s.pool.Query(ctx, attendanceSelect+`
		WHERE a.staff_profile_id = $1
		ORDER BY a.clock_in_at DESC
		LIMIT 120`, staff.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := make([]models.AttendanceRecord, 0)
	for rows.Next() {
		record, err := scanAttendance(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, rows.Err()
}

// ListAttendanceAdmin lists records for the admin workspace.
func (s *Store) ListAttendanceAdmin(ctx context.Context, q AttendanceQuery) ([]models.AttendanceRecord, error) {
	if q.Status != "" && q.Status != models.AttendanceOpen && q.Status != models.AttendanceClosed {
		return nil, fmt.Errorf("%w: unknown attendance status", ErrValidation)
	}

	rows, err := s.pool.Query(ctx, attendanceSelect+`
		WHERE ($1::uuid IS NULL OR a.tenant_id = $1)
		  AND ($2::uuid IS NULL OR a.staff_profile_id = $2)
		  AND ($3::text = '' OR a.status = $3)
		  AND ($4::timestamptz IS NULL OR a.clock_in_at >= $4)
		  AND ($5::timestamptz IS NULL OR a.clock_in_at < $5)
		  AND ($6::boolean = FALSE OR a.status = 'open'
		       AND (a.clock_in_at AT TIME ZONE ws.timezone)::date
		           < (now() AT TIME ZONE ws.timezone)::date)
		  AND ($7::text = ''
		       OR sp.staff_id ILIKE '%' || $7 || '%'
		       OR (sp.first_name || ' ' || sp.last_name) ILIKE '%' || $7 || '%')
		ORDER BY a.clock_in_at DESC
		LIMIT `+strconv.Itoa(attendanceListLimit),
		q.TenantID, q.StaffProfileID, string(q.Status),
		q.DateFrom, q.DateTo, q.Exceptions, strings.TrimSpace(q.Search),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	records := make([]models.AttendanceRecord, 0)
	for rows.Next() {
		record, err := scanAttendance(rows)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, rows.Err()
}

// CorrectAttendance lets an administrator fix a record and close a forgotten
// clock-out. The correction is always audited and always carries a note.
func (s *Store) CorrectAttendance(
	ctx context.Context,
	tenantID, actorID, recordID uuid.UUID,
	in AttendanceCorrection,
) (models.AttendanceRecord, error) {
	note, err := cleanAttendanceNote(in.Note)
	if err != nil {
		return models.AttendanceRecord{}, err
	}
	if in.ClockInAt != nil && in.ClockOutAt != nil && in.ClockOutAt.Before(*in.ClockInAt) {
		return models.AttendanceRecord{}, fmt.Errorf("%w: the clock-out cannot be before the clock-in", ErrValidation)
	}
	if in.Status != models.AttendanceOpen && in.Status != models.AttendanceClosed {
		return models.AttendanceRecord{}, fmt.Errorf("%w: choose open or closed", ErrValidation)
	}
	if in.Status == models.AttendanceClosed && in.ClockOutAt == nil {
		return models.AttendanceRecord{}, fmt.Errorf("%w: enter the clock-out time", ErrValidation)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.AttendanceRecord{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var before models.AttendanceRecord
	before, err = scanAttendance(tx.QueryRow(ctx,
		attendanceSelect+` WHERE a.id = $1 AND a.tenant_id = $2 FOR UPDATE OF a`,
		recordID, tenantID,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return models.AttendanceRecord{}, ErrNotFound
	} else if err != nil {
		return models.AttendanceRecord{}, err
	}

	// Update by id alone. The read above already proved the record is in
	// this tenant, and re-selecting with the shared projection keeps the
	// derived columns consistent with every other read path.
	tag, err := tx.Exec(ctx, `
		UPDATE attendance_records
		SET clock_in_at = COALESCE($2, clock_in_at),
		    clock_out_at = $3,
		    status = $4,
		    note = $5,
		    corrected_by = $6,
		    corrected_at = now(),
		    late_minutes = CASE
		        WHEN $2::timestamptz IS NULL THEN late_minutes
		        ELSE GREATEST(0, floor(EXTRACT(EPOCH FROM (
		            ($2 AT TIME ZONE ws.timezone)::time - ws.work_start
		        )) / 60)::int - ws.late_grace_minutes)
		    END,
		    early_minutes = CASE
		        WHEN $3::timestamptz IS NULL THEN early_minutes
		        ELSE GREATEST(0, floor(EXTRACT(EPOCH FROM (
		            ws.work_end - ($3 AT TIME ZONE ws.timezone)::time
		        )) / 60)::int - ws.early_leave_minutes)
		    END,
		    updated_at = now()
		FROM work_sites ws
		WHERE attendance_records.id = $1
		  AND ws.id = attendance_records.work_site_id`,
		recordID, in.ClockInAt, in.ClockOutAt, string(in.Status),
		note, actorID,
	)
	if err != nil {
		return models.AttendanceRecord{}, err
	}
	if tag.RowsAffected() == 0 {
		return models.AttendanceRecord{}, ErrNotFound
	}

	var after models.AttendanceRecord
	after, err = scanAttendance(tx.QueryRow(ctx,
		attendanceSelect+` WHERE a.id = $1 AND a.tenant_id = $2`,
		recordID, tenantID,
	))
	if err != nil {
		return models.AttendanceRecord{}, err
	}

	if err := insertAudit(ctx, tx, tenantID, &actorID,
		"attendance.corrected", "attendance_record", recordID,
		map[string]any{
			"clock_in_at":  before.ClockInAt,
			"clock_out_at": before.ClockOutAt,
			"status":       before.Status,
		},
		map[string]any{
			"clock_in_at":  after.ClockInAt,
			"clock_out_at": after.ClockOutAt,
			"status":       after.Status,
			"note":         note,
		},
	); err != nil {
		return models.AttendanceRecord{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.AttendanceRecord{}, err
	}
	return after, nil
}

func scanAttendance(row rowScanner) (models.AttendanceRecord, error) {
	var (
		record          models.AttendanceRecord
		clockInPhoto    *string
		clockInIP       *string
		clockInDevice   *string
		clockOutPhoto   *string
		clockOutIP      *string
		clockOutDevice  *string
		correctedBy     *string
		staffID         string
		deptName        *string
		workSiteName    string
		needsAttention  bool
		hoursWorked     int
	)
	err := row.Scan(
		&record.ID, &record.TenantID, &record.StaffProfileID,
		&record.WorkSiteID, &record.Status,
		&record.ClockInAt, &clockInPhoto, &clockInIP, &clockInDevice,
		&record.ClockOutAt, &clockOutPhoto, &clockOutIP, &clockOutDevice,
		&record.LateMinutes, &record.EarlyMinutes, &record.Note,
		&correctedBy, &record.CorrectedAt, &record.ConsentAt,
		&record.CreatedAt, &record.UpdatedAt,
		&staffID, &record.StaffName, &deptName, &workSiteName,
		&needsAttention, &hoursWorked,
	)
	if err != nil {
		return models.AttendanceRecord{}, err
	}

	record.ClockInPhotoKey = clockInPhoto
	record.ClockInIP = clockInIP
	record.ClockOutPhotoKey = clockOutPhoto
	record.ClockOutIP = clockOutIP
	record.DepartmentName = deptName
	record.WorkSiteName = workSiteName
	record.StaffID = staffID
	record.NeedsAttention = needsAttention
	record.HoursWorkedMinutes = hoursWorked

	if parsed, err := optionalUUID(clockInDevice); err == nil {
		record.ClockInDeviceID = parsed
	}
	if parsed, err := optionalUUID(clockOutDevice); err == nil {
		record.ClockOutDeviceID = parsed
	}
	if parsed, err := optionalUUID(correctedBy); err == nil {
		record.CorrectedBy = parsed
	}
	return record, nil
}

func cleanAttendanceNote(note *string) (*string, error) {
	if note == nil {
		return nil, nil
	}
	cleaned := strings.TrimSpace(*note)
	if cleaned == "" {
		return nil, nil
	}
	if len([]rune(cleaned)) > 500 {
		return nil, fmt.Errorf("%w: notes must be 500 characters or fewer", ErrValidation)
	}
	return &cleaned, nil
}

// -- Kiosk devices ------------------------------------------------------------

// PairKiosk creates a device row and returns a short pairing code, plaintext
// once. The code is hashed before storage and cannot be retrieved again.
func (s *Store) PairKiosk(
	ctx context.Context,
	tenantID uuid.UUID,
	actorID *uuid.UUID,
	label, codeHash string,
) (models.KioskDevice, error) {
	label = strings.TrimSpace(label)
	if label == "" {
		label = "Office laptop"
	}
	if len([]rune(label)) > 80 {
		return models.KioskDevice{}, fmt.Errorf("%w: the device label is too long", ErrValidation)
	}
	if codeHash == "" {
		return models.KioskDevice{}, fmt.Errorf("%w: could not generate a pairing code", ErrValidation)
	}

	var device models.KioskDevice
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.KioskDevice{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// paired_by records the administrator who created this pairing, not the
	// office laptop: the laptop is anonymous by design, and the question an
	// audit needs to answer is who is responsible for the device.
	err = scanKiosk(tx.QueryRow(ctx, `
		INSERT INTO kiosk_devices (
			tenant_id, label, pairing_hash, pairing_expires_at,
			expires_at, paired_by
		) VALUES ($1, $2, $3, now() + $4::interval,
		          now() + $5::interval, $6)
		RETURNING id, tenant_id, label, pairing_expires_at, paired_at,
		          paired_by, expires_at, revoked_at, last_seen_at, created_at`,
		tenantID, label, codeHash, kioskPairingTTL.String(),
		kioskTokenTTL.String(), actorID,
	), &device)
	if err != nil {
		return models.KioskDevice{}, err
	}

	if err := insertAudit(ctx, tx, tenantID, actorID,
		"attendance.kiosk_paired", "kiosk_device", device.ID,
		nil, map[string]any{"label": device.Label},
	); err != nil {
		return models.KioskDevice{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.KioskDevice{}, err
	}
	device.Status = "pending"
	return device, nil
}

// RedeemKioskPairing trades a pairing code for the device's long-lived
// token. The caller signs the token; the store owns the row's validity.
func (s *Store) RedeemKioskPairing(ctx context.Context, codeHash string) (models.KioskDevice, error) {
	if codeHash == "" {
		return models.KioskDevice{}, fmt.Errorf("%w: enter the pairing code", ErrValidation)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.KioskDevice{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var device models.KioskDevice
	err = scanKiosk(tx.QueryRow(ctx, `
		UPDATE kiosk_devices
		SET paired_at = now(), pairing_hash = NULL, pairing_expires_at = NULL
		WHERE pairing_hash = $1
		  AND revoked_at IS NULL
		  AND paired_at IS NULL
		  AND pairing_expires_at > now()
		RETURNING id, tenant_id, label, pairing_expires_at, paired_at,
		          paired_by, expires_at, revoked_at, last_seen_at, created_at`,
		codeHash,
	), &device)
	if errors.Is(err, pgx.ErrNoRows) {
		// Distinguish "never existed" from "already used or expired" so the
		// office laptop can tell the admin to issue a fresh code.
		var exists bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1 FROM kiosk_devices
				WHERE pairing_hash = $1 AND revoked_at IS NULL
			)`, codeHash,
		).Scan(&exists); err != nil {
			return models.KioskDevice{}, err
		}
		if exists {
			return models.KioskDevice{}, fmt.Errorf("%w: that pairing code has expired; issue a new one", ErrValidation)
		}
		return models.KioskDevice{}, ErrNotFound
	}
	if err != nil {
		return models.KioskDevice{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.KioskDevice{}, err
	}
	device.Status = "active"
	return device, nil
}

// ActiveKiosk resolves a device for a clock event, rejecting anything
// revoked or expired. It also refreshes last-seen, which is what lets an
// administrator see whether the office laptop is alive.
func (s *Store) ActiveKiosk(ctx context.Context, deviceID uuid.UUID) (models.KioskDevice, error) {
	if deviceID == uuid.Nil {
		return models.KioskDevice{}, ErrNotFound
	}
	var device models.KioskDevice
	err := scanKiosk(s.pool.QueryRow(ctx, `
		UPDATE kiosk_devices
		SET last_seen_at = now()
		WHERE id = $1 AND revoked_at IS NULL AND paired_at IS NOT NULL
		  AND expires_at > now()
		RETURNING id, tenant_id, label, pairing_expires_at, paired_at,
		          paired_by, expires_at, revoked_at, last_seen_at, created_at`,
		deviceID,
	), &device)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.KioskDevice{}, ErrNotFound
	}
	if err != nil {
		return models.KioskDevice{}, err
	}
	device.Status = "active"
	return device, nil
}

// ListKioskDevices lists the tenant's paired and pending devices.
func (s *Store) ListKioskDevices(ctx context.Context, tenantID uuid.UUID) ([]models.KioskDevice, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, tenant_id, label, pairing_expires_at, paired_at,
		       paired_by, expires_at, revoked_at, last_seen_at, created_at
		FROM kiosk_devices
		WHERE ($1::uuid IS NULL OR tenant_id = $1)
		ORDER BY created_at DESC
		LIMIT 100`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	devices := make([]models.KioskDevice, 0)
	for rows.Next() {
		var device models.KioskDevice
		if err := rows.Scan(
			&device.ID, &device.TenantID, &device.Label,
			&device.PairingExpiresAt, &device.PairedAt, &device.PairedBy,
			&device.ExpiresAt, &device.RevokedAt, &device.LastSeenAt,
			&device.CreatedAt,
		); err != nil {
			return nil, err
		}
		device.Status = kioskStatus(device)
		devices = append(devices, device)
	}
	return devices, rows.Err()
}

// RevokeKiosk withdraws a device's authority immediately. The token may
// still be well-formed; the next request finds this row revoked and stops.
func (s *Store) RevokeKiosk(ctx context.Context, tenantID, actorID, deviceID uuid.UUID) (models.KioskDevice, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return models.KioskDevice{}, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var device models.KioskDevice
	err = scanKiosk(tx.QueryRow(ctx, `
		UPDATE kiosk_devices
		SET revoked_at = now()
		WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL
		RETURNING id, tenant_id, label, pairing_expires_at, paired_at,
		          paired_by, expires_at, revoked_at, last_seen_at, created_at`,
		deviceID, tenantID,
	), &device)
	if errors.Is(err, pgx.ErrNoRows) {
		return models.KioskDevice{}, ErrNotFound
	}
	if err != nil {
		return models.KioskDevice{}, err
	}

	if err := insertAudit(ctx, tx, tenantID, &actorID,
		"attendance.kiosk_revoked", "kiosk_device", deviceID,
		map[string]any{"label": device.Label}, nil,
	); err != nil {
		return models.KioskDevice{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return models.KioskDevice{}, err
	}
	device.Status = "revoked"
	return device, nil
}

func scanKiosk(row rowScanner, device *models.KioskDevice) error {
	return row.Scan(
		&device.ID, &device.TenantID, &device.Label,
		&device.PairingExpiresAt, &device.PairedAt, &device.PairedBy,
		&device.ExpiresAt, &device.RevokedAt, &device.LastSeenAt,
		&device.CreatedAt,
	)
}

func kioskStatus(device models.KioskDevice) string {
	switch {
	case device.RevokedAt != nil:
		return "revoked"
	case device.PairedAt == nil:
		if device.PairingExpiresAt != nil && device.PairingExpiresAt.Before(time.Now()) {
			return "expired"
		}
		return "pending"
	case device.ExpiresAt.Before(time.Now()):
		return "expired"
	default:
		return "active"
	}
}
