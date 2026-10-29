-- Staff attendance: photo-verified clock in/out, recorded only from a paired
-- office kiosk.
--
-- Design notes:
--   * Timestamps are stored in UTC (TIMESTAMPTZ). The server clock is the only
--     clock that matters; the browser never supplies the time.
--   * The weekday is derived at render time in the site timezone rather than
--     stored, so it can never drift away from the timestamp it describes.
--   * `status` is strictly the clock state (open / closed). Whether a record
--     needs an administrator's attention is derived from its age, not stored,
--     so the state machine stays a single dimension.
--   * A partial unique index guarantees at most one open record per staff
--     member: the database, not the application, is the backstop against a
--     double clock-in.

CREATE TABLE IF NOT EXISTS work_sites (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    address             TEXT,
    timezone            TEXT NOT NULL DEFAULT 'Africa/Lagos',
    work_start          TIME NOT NULL DEFAULT '08:00',
    work_end            TIME NOT NULL DEFAULT '17:00',
    late_grace_minutes  INTEGER NOT NULL DEFAULT 15
                        CHECK (late_grace_minutes BETWEEN 0 AND 120),
    early_leave_minutes INTEGER NOT NULL DEFAULT 15
                        CHECK (early_leave_minutes BETWEEN 0 AND 120),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One office per tenant (README: a single site in this iteration). Seeding
-- every existing tenant means the feature works the moment the migration
-- lands; Settings renames the site and adjusts the hours in place.
INSERT INTO work_sites (tenant_id, name)
SELECT t.id, 'Main Office'
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM work_sites ws WHERE ws.tenant_id = t.id
);

-- Clocking is restricted to an office laptop that an administrator has
-- paired. The laptop holds an HMAC-signed token naming this row; revoking the
-- row takes effect on the next request because the row, not the token, is the
-- source of truth for validity.
CREATE TABLE IF NOT EXISTS kiosk_devices (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    label            TEXT NOT NULL DEFAULT 'Office laptop',
    -- Hash of the short pairing code shown to the administrator. The code is
    -- plaintext once, at issue time, and is never stored in the clear.
    pairing_hash     TEXT,
    pairing_expires_at TIMESTAMPTZ,
    paired_at        TIMESTAMPTZ,
    paired_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Long enough that an always-on office laptop does not need weekly
    -- re-pairing, short enough to bound exposure if the token leaks. The
    -- admin screen shows this date and can revoke at any time.
    expires_at       TIMESTAMPTZ NOT NULL,
    revoked_at       TIMESTAMPTZ,
    last_seen_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kiosk_devices_tenant
    ON kiosk_devices(tenant_id);

CREATE TABLE IF NOT EXISTS attendance_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    staff_profile_id    UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    work_site_id        UUID NOT NULL REFERENCES work_sites(id) ON DELETE RESTRICT,

    status              TEXT NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'closed')),

    clock_in_at         TIMESTAMPTZ NOT NULL,
    clock_in_photo_key  TEXT,
    clock_in_ip         TEXT,
    clock_in_device_id  UUID REFERENCES kiosk_devices(id) ON DELETE SET NULL,

    clock_out_at        TIMESTAMPTZ,
    clock_out_photo_key TEXT,
    clock_out_ip        TEXT,
    clock_out_device_id UUID REFERENCES kiosk_devices(id) ON DELETE SET NULL,

    -- Derived from the work site's hours in the site timezone at write time,
    -- so the stored figure never depends on the viewer's clock.
    late_minutes        INTEGER NOT NULL DEFAULT 0,
    early_minutes       INTEGER NOT NULL DEFAULT 0,

    -- Set when an administrator corrects the record. A forgotten clock-out is
    -- closed this way; it is never closed automatically.
    note                TEXT,
    corrected_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    corrected_at        TIMESTAMPTZ,

    -- Nigeria Data Protection Act 2023: evidence of the staff member's
    -- consent to their photograph being captured and retained.
    consent_at          TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one open record per staff member, enforced in the database.
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_open_per_staff
    ON attendance_records(staff_profile_id)
    WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_attendance_tenant_clock_in
    ON attendance_records(tenant_id, clock_in_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_staff_clock_in
    ON attendance_records(staff_profile_id, clock_in_at DESC);

-- Serves the admin exceptions queue: open records are rare once the day ends.
CREATE INDEX IF NOT EXISTS idx_attendance_open
    ON attendance_records(tenant_id, clock_in_at)
    WHERE status = 'open';
