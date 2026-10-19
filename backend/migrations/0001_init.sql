-- MGM-Portal MVP schema (README §9)
-- PostgreSQL 15+

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Tenancy ---------------------------------------------------------------

CREATE TABLE tenants (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL,
    state_location_id UUID,
    status            TEXT NOT NULL DEFAULT 'active',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Locations: a parent/child tree, not a flat row (README §9.2) ----------

CREATE TABLE locations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID REFERENCES tenants(id),
    parent_id  UUID REFERENCES locations(id),
    type       TEXT NOT NULL CHECK (type IN ('country','state','lga','city','town')),
    name       TEXT NOT NULL,
    code       TEXT,
    slug       TEXT NOT NULL UNIQUE,
    status     TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending','approved','inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_locations_parent ON locations(parent_id);
CREATE INDEX idx_locations_tenant ON locations(tenant_id);
CREATE INDEX idx_locations_type   ON locations(type);

ALTER TABLE tenants
    ADD CONSTRAINT fk_tenants_state_location
    FOREIGN KEY (state_location_id) REFERENCES locations(id);

-- Users -----------------------------------------------------------------

CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID REFERENCES tenants(id),
    role              TEXT NOT NULL CHECK (role IN ('super_admin','admin','staff','applicant')),
    email             CITEXT NOT NULL UNIQUE,
    phone             TEXT,
    password_hash     TEXT,
    first_name        TEXT NOT NULL,
    last_name         TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('pending','active','suspended','disabled')),
    email_verified_at TIMESTAMPTZ,
    phone_verified_at TIMESTAMPTZ,
    last_login_at     TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_role   ON users(role);

-- Jobs ------------------------------------------------------------------

CREATE TABLE jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    title               TEXT NOT NULL,
    slug                TEXT NOT NULL,
    description         TEXT NOT NULL,
    requirements        TEXT,
    location_id         UUID REFERENCES locations(id),
    employment_category TEXT CHECK (employment_category IN ('director','employee','contractor','partner')),
    openings            INTEGER NOT NULL DEFAULT 1,
    publish_at          TIMESTAMPTZ,
    deadline_at         TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','published','closed','archived')),
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_jobs_slug ON jobs(tenant_id, slug);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_tenant ON jobs(tenant_id);

-- Applications ----------------------------------------------------------

CREATE TABLE applications (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number TEXT NOT NULL UNIQUE,
    tenant_id          UUID NOT NULL REFERENCES tenants(id),
    job_id             UUID NOT NULL REFERENCES jobs(id),
    applicant_id       UUID NOT NULL REFERENCES users(id),
    first_name         TEXT NOT NULL,
    last_name          TEXT NOT NULL,
    email              CITEXT NOT NULL,
    phone              TEXT NOT NULL,
    gender             TEXT,
    date_of_birth      DATE,
    location_id        UUID REFERENCES locations(id),
    address_line       TEXT,
    qualification      TEXT,
    cv_document_id     UUID,
    photo_document_id  UUID,
    status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','shortlisted','rejected','appointed','withdrawn')),
    submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_applications_tenant   ON applications(tenant_id);
CREATE INDEX idx_applications_job      ON applications(job_id);
CREATE INDEX idx_applications_status   ON applications(status);
CREATE INDEX idx_applications_applicant ON applications(applicant_id);
-- One open application per email per job (BR-09).
CREATE UNIQUE INDEX idx_applications_unique_active
    ON applications(job_id, email)
    WHERE status IN ('pending','shortlisted','appointed');

CREATE TABLE application_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    actor_id       UUID REFERENCES users(id),
    from_status    TEXT,
    to_status      TEXT NOT NULL,
    reason         TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_application_events_app ON application_events(application_id);

-- Interviews ------------------------------------------------------------

CREATE TABLE interview_announcements (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id),
    job_id       UUID NOT NULL REFERENCES jobs(id),
    interview_at TIMESTAMPTZ NOT NULL,
    venue        TEXT NOT NULL,
    instructions TEXT,
    audience     TEXT NOT NULL DEFAULT 'job_applicants'
                 CHECK (audience IN ('job_applicants','shortlisted_only','all_applicants')),
    status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','published','cancelled')),
    created_by   UUID REFERENCES users(id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_interviews_job ON interview_announcements(job_id);

-- Shortlists ------------------------------------------------------------

CREATE TABLE shortlists (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id      UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    job_id              UUID NOT NULL REFERENCES jobs(id),
    message             TEXT NOT NULL,          -- verbatim confirmation message (BR-07)
    message_template_id UUID,
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at          TIMESTAMPTZ
);

CREATE INDEX idx_shortlists_app ON shortlists(application_id);

-- Access codes ----------------------------------------------------------
-- The plaintext code is never stored (BR-17). code_hash is a SHA-256
-- digest; code_hint is the last four characters, for admin lookups.

CREATE TABLE access_codes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    code_hash       TEXT NOT NULL UNIQUE,
    code_hint       TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('applicant','staff')),
    application_id  UUID REFERENCES applications(id),
    issued_to       UUID REFERENCES users(id),
    issued_by       UUID REFERENCES users(id),
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','used','revoked','expired')),
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ,
    used_by         UUID REFERENCES users(id),
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_codes_tenant ON access_codes(tenant_id);
CREATE INDEX idx_access_codes_status ON access_codes(status);

-- Staff -----------------------------------------------------------------

CREATE TABLE departments (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name      TEXT NOT NULL
);

CREATE TABLE staff_profiles (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                       UUID NOT NULL REFERENCES tenants(id),
    user_id                         UUID REFERENCES users(id),
    staff_id                        TEXT NOT NULL UNIQUE,
    application_id                  UUID REFERENCES applications(id),
    employment_category             TEXT NOT NULL
                                    CHECK (employment_category IN ('director','employee','contractor','partner')),
    first_name                      TEXT NOT NULL,
    last_name                       TEXT NOT NULL,
    email                           CITEXT NOT NULL,
    phone                           TEXT NOT NULL,
    gender                          TEXT,
    date_of_birth                   DATE,
    address_line                    TEXT,
    location_id                     UUID REFERENCES locations(id),
    bank_name                       TEXT,
    bank_account_name               TEXT,
    bank_account_number             TEXT,
    guarantor_name                  TEXT,
    guarantor_phone                 TEXT,
    guarantor_address               TEXT,
    guarantor_relationship          TEXT,
    next_of_kin_name                TEXT,
    next_of_kin_phone               TEXT,
    next_of_kin_relationship        TEXT,
    department_id                   UUID REFERENCES departments(id),
    position                        TEXT,
    appointment_date                DATE,
    rules_of_engagement_accepted_at TIMESTAMPTZ,
    status                          TEXT NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active','suspended','exited')),
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_tenant ON staff_profiles(tenant_id);
CREATE INDEX idx_staff_status ON staff_profiles(status);

-- Documents -------------------------------------------------------------

CREATE TABLE documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID REFERENCES tenants(id),
    owner_type  TEXT NOT NULL CHECK (owner_type IN ('application','staff')),
    owner_id    UUID NOT NULL,
    category    TEXT NOT NULL,
    file_name   TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    mime_type   TEXT NOT NULL,
    size_bytes  BIGINT NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_owner ON documents(owner_type, owner_id);

ALTER TABLE applications
    ADD CONSTRAINT fk_applications_cv
    FOREIGN KEY (cv_document_id) REFERENCES documents(id);
ALTER TABLE applications
    ADD CONSTRAINT fk_applications_photo
    FOREIGN KEY (photo_document_id) REFERENCES documents(id);

-- Templates, notifications, audit ---------------------------------------

CREATE TABLE message_templates (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id  UUID REFERENCES tenants(id),
    key        TEXT NOT NULL,
    channel    TEXT NOT NULL CHECK (channel IN ('email','sms','whatsapp')),
    subject    TEXT,
    body       TEXT NOT NULL,
    variables  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, key, channel)
);

CREATE TABLE notifications (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID REFERENCES tenants(id),
    recipient_user_id UUID REFERENCES users(id),
    recipient_contact TEXT,
    channel           TEXT NOT NULL CHECK (channel IN ('email','sms','whatsapp')),
    template_key      TEXT,
    payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
    provider_ref      TEXT,
    status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','sent','failed','read')),
    error             TEXT,
    sent_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_status ON notifications(status);

CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID REFERENCES tenants(id),
    actor_id    UUID REFERENCES users(id),
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   UUID,
    before_data JSONB,
    after_data  JSONB,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_entity  ON audit_logs(entity_type, entity_id);

-- ID sequences ----------------------------------------------------------
-- Allocation uses an upsert that increments and returns atomically (BR-03).

CREATE TABLE id_sequences (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope      TEXT NOT NULL CHECK (scope IN ('applications','staff')),
    tenant_id  UUID NOT NULL REFERENCES tenants(id),
    year       INTEGER NOT NULL,
    prefix     TEXT NOT NULL,
    state_code TEXT NOT NULL,
    last_value INTEGER NOT NULL DEFAULT 0,
    UNIQUE (scope, tenant_id, year)
);

-- Sessions --------------------------------------------------------------

CREATE TABLE sessions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Row level security helper ---------------------------------------------
-- Tenant scoping is enforced in the query layer (BR-15). This function
-- provides the session's tenant for use in WHERE clauses.

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('app.tenant_id', TRUE), '')::UUID;
$$ LANGUAGE sql STABLE;
