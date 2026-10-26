-- Admin-managed policies shown as checkboxes on the applicant and staff forms.
--
-- Policies are group-wide in this iteration: every active policy for an
-- audience is shown to every user in that audience. Acceptance is recorded
-- against the policy version, so editing a policy and bumping its version
-- requires a fresh acknowledgement.

CREATE TABLE IF NOT EXISTS policies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    audience    TEXT NOT NULL DEFAULT 'both'
                CHECK (audience IN ('applicant', 'staff', 'both')),
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    version     INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policies_audience_active
    ON policies(audience, is_active);

CREATE TABLE IF NOT EXISTS policy_acceptances (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id      UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_version INTEGER NOT NULL,
    accepted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (policy_id, user_id, policy_version)
);

CREATE INDEX IF NOT EXISTS idx_policy_acceptances_user
    ON policy_acceptances(user_id, accepted_at DESC);
