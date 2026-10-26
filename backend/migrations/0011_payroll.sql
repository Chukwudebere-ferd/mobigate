-- Staff payroll: salary assignments by month/year and upfront-payment
-- requests decided by an administrator. Amounts are stored in kobo so the
-- application never performs floating-point money arithmetic.

CREATE TABLE IF NOT EXISTS salary_payments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    period_month     INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    period_year      INTEGER NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
    amount_kobo      BIGINT NOT NULL CHECK (amount_kobo > 0),
    note             TEXT,
    created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (staff_profile_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_salary_payments_tenant_period
    ON salary_payments(tenant_id, period_year DESC, period_month DESC);

CREATE INDEX IF NOT EXISTS idx_salary_payments_staff
    ON salary_payments(staff_profile_id, period_year DESC, period_month DESC);

CREATE TABLE IF NOT EXISTS advance_requests (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
    amount_kobo      BIGINT NOT NULL CHECK (amount_kobo > 0),
    reason           TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'declined')),
    decision_note    TEXT,
    decided_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    decided_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advance_requests_tenant_status
    ON advance_requests(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_advance_requests_staff
    ON advance_requests(staff_profile_id, created_at DESC);

-- Email templates. Global rows are used by every tenant; an administrator can
-- override one with a tenant-owned template from Settings.
INSERT INTO message_templates (tenant_id, key, channel, subject, body, variables)
SELECT NULL, 'salary_assigned', 'email',
       'Your salary for {{period}} has been assigned',
       E'Dear {{first_name}},\n\nYour salary for {{period}} has been assigned.\n\nAmount: {{amount}}\n{{note_line}}\n\nIf any of these details look wrong, please contact HR.\n\nMobigate Group',
       '{"first_name":"Staff first name","period":"Month and year","amount":"Formatted amount","note_line":"Optional note line"}'
WHERE NOT EXISTS (
    SELECT 1 FROM message_templates
    WHERE key = 'salary_assigned' AND channel = 'email'
);

INSERT INTO message_templates (tenant_id, key, channel, subject, body, variables)
SELECT NULL, 'advance_request_approved', 'email',
       'Your upfront payment request has been approved',
       E'Dear {{first_name}},\n\nYour upfront payment request for {{amount}} has been approved.\n\nReason: {{reason}}\n{{note_line}}\n\nMobigate Group',
       '{"first_name":"Staff first name","amount":"Formatted amount","reason":"Staff reason","note_line":"Optional decision note"}'
WHERE NOT EXISTS (
    SELECT 1 FROM message_templates
    WHERE key = 'advance_request_approved' AND channel = 'email'
);

INSERT INTO message_templates (tenant_id, key, channel, subject, body, variables)
SELECT NULL, 'advance_request_declined', 'email',
       'Your upfront payment request was declined',
       E'Dear {{first_name}},\n\nYour upfront payment request for {{amount}} was declined.\n\nReason requested: {{reason}}\n{{note_line}}\n\nMobigate Group',
       '{"first_name":"Staff first name","amount":"Formatted amount","reason":"Staff reason","note_line":"Optional decision note"}'
WHERE NOT EXISTS (
    SELECT 1 FROM message_templates
    WHERE key = 'advance_request_declined' AND channel = 'email'
);
